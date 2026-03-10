"""
Invoice Extraction System — DeepSeek-OCR-2
==========================================
Dataset : SROIE dataset v2  dev/{img,box,entities}
Model   : deepseek-ai/DeepSeek-OCR-2  (3B MoE, ~500M active, ~10GB VRAM)

Three passes — all using prompts the model was actually trained on:

  Pass 1 │ Free OCR
         │ prompt : "<image>\\nFree OCR."
         │ output : raw_ocr_text — full document text in DeepSeek-OCR-2's
         │          Visual Causal Flow reading order (structure → columns →
         │          rows → cells). This IS the model's structural reasoning:
         │          the sequence it chose reflects its understanding of the
         │          document hierarchy.

  Pass 2 │ Markdown structure  ← replaces the broken JSON instruction pass
         │ prompt : "<image>\\n<|grounding|>Convert the document to markdown."
         │ output : markdown_structure — the model's interpretation of the
         │          document as a hierarchy (headers, tables, bold labels).
         │          This is the spatial/structural reasoning evidence:
         │          how it groups values under headers, how it orders table
         │          columns, what it treats as a label vs a value.

  Pass 3 │ Coordinate localisation — one call per extracted field value
         │ prompt : "<image>\\nLocate <|ref|>{value}<|/ref|> in the image."
         │ output : bounding box {x1,y1,x2,y2} normalised 0–1
         │          This is the visual evidence — pixel-level proof of
         │          where each value was found on the receipt.

  Parser │ Extracts field values from Pass 1 raw text using regex rules.
         │ No LLM needed — the OCR text is clean enough for pattern matching.

  Output │ Per field: value + reading_position (where in Pass 1 sequence)
         │            + markdown_context (surrounding markdown from Pass 2)
         │            + bboxes_model (Pass 3 coordinates)
         │            + bboxes_gt (cross-ref with SROIE dataset v2 box files)
         │
         │ The judgment agent receives all four as the reasoning package.
"""

import io, re, sys, json, torch, time
from pathlib import Path
from datetime import datetime
from PIL import Image, ImageDraw
from transformers import AutoModel, AutoTokenizer


# ── CONFIG ────────────────────────────────────────────────────────────────────
MODEL_NAME = "deepseek-ai/DeepSeek-OCR-2"
# Lower-VRAM alternative (~6 GB, 4-bit):
# MODEL_NAME = "unsloth/DeepSeek-OCR-2"

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
DTYPE  = torch.bfloat16

# Fields to extract + evaluate
INVOICE_FIELDS = [
    "company", "date", "address", "total",   # covered by SROIE dataset v2 ground truth
    "receipt_number", "cashier", "member",
    "subtotal", "rounding", "cash", "change",
    "line_items",                             # list of {name, qty, price, amount}
]

GT_FIELDS    = ["company", "date", "address", "total"]
COORD_SCALE  = 1000.0   # model outputs coords in 0-1000 space


# ── MODEL ─────────────────────────────────────────────────────────────────────
_model     = None
_tokenizer = None

def load_model():
    global _model, _tokenizer
    if _model is not None:
        return _model, _tokenizer
    print(f"Loading {MODEL_NAME} ...")
    _tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, trust_remote_code=True)
    _model = AutoModel.from_pretrained(
        MODEL_NAME,
        _attn_implementation="eager",
        trust_remote_code=True,
        use_safetensors=True,
    ).eval().to(DEVICE).to(DTYPE)
    print(f"Model ready on {DEVICE}.\n")
    return _model, _tokenizer


# ── CORE INFERENCE — stdout capture ───────────────────────────────────────────
# Raw stdout from the last _infer call is stored here so process_sample can
# read it without changing _infer's return signature or inference path.
_last_raw_stdout: str = ""

def _infer(model, tokenizer, prompt: str, image_path: str, tmp_dir: str) -> str:
    """
    DeepSeek-OCR-2 streams output to stdout and returns None from model.infer().
    We redirect stdout to a StringIO buffer to capture the actual text.
    """
    buf = io.StringIO()
    old_stdout = sys.stdout
    sys.stdout = buf
    try:
        model.infer(
            tokenizer,
            prompt=prompt,
            image_file=image_path,
            output_path=tmp_dir,
            base_size=1024,
            image_size=768,
            crop_mode=True,
            save_results=False,
        )
    finally:
        sys.stdout = old_stdout

    raw = buf.getvalue()

    # Split on the "save results" footer the model always appends
    text = raw.split("save results")[0] if "save results" in raw else raw

    # Filter out tensor shape debug lines and tqdm progress bars
    lines = [
        l for l in text.splitlines()
        if not any(tok in l for tok in [
            "BASE:", "PATCHES:", "NO PATCHES", "it/s", "0it", "====",
            "torch.Size", "attention_mask", "pad_token_id", "eos_token_id",
            "attention layers", "position_ids", "position_embeddings",
            "seen_tokens", "get_max_cache", "UserWarning", "warnings.warn",
            "DeprecationWarning",
        ])
    ]
    global _last_raw_stdout
    _last_raw_stdout = raw.strip()
    return "\n".join(lines).strip()


# ── BBOX PARSING ──────────────────────────────────────────────────────────────
_BOX_RE = re.compile(
    r"<box>\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*</box>"
    r"|\[\[\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\]\]"
)

def _parse_boxes(text: str) -> list:
    boxes = []
    for m in _BOX_RE.finditer(text):
        vals = [v for v in m.groups() if v is not None]
        x1, y1, x2, y2 = [int(v) / COORD_SCALE for v in vals[:4]]
        boxes.append({"x1": x1, "y1": y1, "x2": x2, "y2": y2})
    return boxes


# ── DATA LOADERS ──────────────────────────────────────────────────────────────
def load_box_file(path: str) -> list:
    """Parse SROIE dataset v2 box file: x1,y1,x2,y2,x1,y1,x2,y2,text per line."""
    entries = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            parts = line.strip().split(",", 8)
            if len(parts) < 9:
                continue
            try:
                x1, y1, x2, y2 = int(parts[0]), int(parts[1]), int(parts[2]), int(parts[3])
                entries.append({"x1": x1, "y1": y1, "x2": x2, "y2": y2, "text": parts[8]})
            except ValueError:
                continue
    return entries


def load_entities(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def gt_boxes_for(box_entries: list, value: str) -> list:
    """Find ground-truth box entries whose text overlaps with value."""
    target = value.strip().lower()
    return [
        {"x1": e["x1"], "y1": e["y1"], "x2": e["x2"], "y2": e["y2"], "source": "gt_box"}
        for e in box_entries
        if e["text"].strip().lower() in target or target in e["text"].strip().lower()
    ]


# ── PASS 1: Free OCR ──────────────────────────────────────────────────────────
def pass1_free_ocr(model, tokenizer, image_path: str, tmp_dir: str) -> str:
    """
    Raw OCR in Visual Causal Flow order.
    The sequence of tokens IS the model's structural reasoning —
    it reflects what it decided to read first, second, and so on.
    """
    return _infer(model, tokenizer, "<image>\nFree OCR.", image_path, tmp_dir)


# ── PASS 2: Markdown structure ────────────────────────────────────────────────
def pass2_markdown(model, tokenizer, image_path: str, tmp_dir: str) -> str:
    """
    Convert the document to markdown using the model's grounding mode.
    This reveals the model's spatial/structural reasoning:
      - What it treats as a header vs body text
      - How it groups table columns and rows
      - Which labels it links to which values
      - What reading hierarchy it assigns to the document
    This is the 'why' of its extraction — it put Total: 9.00 under a
    bold label because it recognised the label-value pairing structure.
    """
    return _infer(
        model, tokenizer,
        "<image>\n<|grounding|>Convert the document to markdown.",
        image_path, tmp_dir
    )


# ── STEP 3: Parse coordinates from Pass 2 markdown ──────────────────────────
# Pass 2 already outputs <|det|>[[x1,y1,x2,y2]]<|/det|> for every element.
# We parse those directly — zero extra model calls, much faster.

_DET_RE = re.compile(r"<[|]det[|]>\[\[(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\]\]<[|]/det[|]>")

def parse_coords_from_markdown(markdown: str, value: str) -> list:
    """
    Find bounding boxes for a value from Pass 2 markdown <|det|> tags.
    Each block in the markdown has the form:
        <|ref|>type<|/ref|><|det|>[[x1,y1,x2,y2]]<|/det|>
        text content of that region
    We find blocks whose text contains our target value.
    Coordinates are in 0-1000 space, normalised to 0-1 on return.
    """
    if not value or not markdown:
        return []
    target = str(value).strip().lower()
    boxes = []
    # Split into blocks at each <|ref|> tag
    blocks = re.split(r"(?=<[|]ref[|]>)", markdown)
    for block in blocks:
        m = _DET_RE.search(block)
        if not m:
            continue
        # Strip tags to get plain text content
        block_text = _DET_RE.sub("", block)
        block_text = re.sub(r"<[|]ref[|]>[^<]*<[|]/ref[|]>", "", block_text).strip().lower()
        # Skip empty blocks (e.g. barcode image regions with no text)
        if len(block_text) < 2:
            continue
        if target in block_text or block_text in target:
            x1 = int(m.group(1)) / COORD_SCALE
            y1 = int(m.group(2)) / COORD_SCALE
            x2 = int(m.group(3)) / COORD_SCALE
            y2 = int(m.group(4)) / COORD_SCALE
            boxes.append({"x1": x1, "y1": y1, "x2": x2, "y2": y2, "source": "pass2_det"})
    return boxes


# ── FIELD PARSER ─────────────────────────────────────────────────────────────
def _find_in_markdown(markdown: str, value: str) -> str:
    """
    Find the markdown context surrounding a value — the line(s) that
    contain it. This is the structural reasoning snippet for that field.
    """
    if not value:
        return ""
    target = str(value).strip()
    for line in markdown.splitlines():
        if target.lower() in line.lower():
            return line.strip()
    return ""


def _reading_position(ocr_text: str, value: str) -> dict:
    """
    Find where in the reading order a value appears.
    Returns line number and surrounding context from the OCR sequence.
    """
    if not value:
        return {"line": None, "context": ""}
    lines = ocr_text.splitlines()
    target = str(value).strip().lower()
    for i, line in enumerate(lines):
        if target in line.lower():
            ctx_start = max(0, i - 1)
            ctx_end   = min(len(lines), i + 2)
            return {
                "line":    i + 1,
                "context": " | ".join(lines[ctx_start:ctx_end]).strip()
            }
    return {"line": None, "context": ""}


def parse_fields(ocr_text: str) -> dict:
    """
    Extract field values from Pass 1 OCR text (markdown-formatted).
    Handles **bold** labels, | table separators, and Malaysian receipt formats.
    """
    text = ocr_text

    def first(pattern, flags=re.IGNORECASE | re.MULTILINE):
        m = re.search(pattern, text, flags)
        return m.group(1).strip() if m else None

    def clean(s):
        if not s:
            return s
        return re.sub(r"[*|]", "", s).strip(" :-")

    # ── Company ───────────────────────────────────────────────────────────────
    company = None
    for m in re.finditer(r"\*\*(.+?)\*\*", text):
        c = m.group(1).strip()
        if any(k in c.upper() for k in [
            "SDN", "BHD", "ENTERPRISE", "TRADING", "MOTOR", "SHOP",
            "MART", "STORE", "MARKET", "HARDWARE", "GIFT", "DIY", "CO."
        ]):
            company = c
            break
    if not company:
        lines = [l.strip().lstrip("#").strip() for l in text.splitlines() if l.strip() and not l.startswith("#")]
        company = lines[1] if len(lines) > 1 else None

    # ── Date ──────────────────────────────────────────────────────────────────
    # P1: explicit "Date:" label
    date = first(r"(?:\*\*)?[Dd]ate(?:\*\*)?[\s*]*[:\|][\s*]*(?:\*\*)?(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})")
    if not date:
        # P2: date embedded in ORD/REG line e.g. "ORD #50 -REG #19- 18/01/2018"
        date = first(r"(?:ORD|REG|TXN|Ord|Reg)[^\n]*?(\d{1,2}[/\-]\d{1,2}[/\-]\d{4})")
    if not date:
        # P3: any 4-digit-year date
        date = first(r"\b(\d{1,2}[/\-]\d{1,2}[/\-]\d{4})\b")

    # ── Address ───────────────────────────────────────────────────────────────
    addr_keywords = ["JALAN", "TAMAN", "LORONG", "NO.", "LOT", "JOHOR",
                     "SELANGOR", "KUALA", "PINANG", "PERAK", "MELAKA",
                     "PENGERANG", "SUNGAI", "KAWASAN", "JAYA", "BAHRU",
                     "BANGUNAN", "LEVEL", "TINGKAT", "DAMANSARA",
                     "PETALING", "CHERAS", "PUCHONG", "KLANG", "SUBANG"]
    address_lines = []
    for line in text.splitlines():
        l = clean(line.strip())
        if not l or len(l) < 4:
            continue
        if any(k in l.upper() for k in addr_keywords):
            if company and company.upper() in l.upper():
                continue
            address_lines.append(l)
    address = ", ".join(l.rstrip(",").strip() for l in address_lines) if address_lines else None

    # ── Total ─────────────────────────────────────────────────────────────────
    # P1: "Total Rounded" — word order used by some receipts like McDonald's
    total = first(r"[Tt]otal\s+[Rr]ounded?\s*(?:RM\s*)?(\d+\.\d{2})")
    if not total:
        # P2: "Rounded Total" or "Round:d Total"
        total = first(r"[Rr]ound\S*\s*[Tt]otal\s*(?:\(RM\))?\s*[:\|]?\s*(?:RM\s*)?(\d+\.\d{2})")
    if not total:
        # P3: prefixed totals e.g. "TakeOut Total", "Sub Total", "Grand Total"
        total = first(r"(?:[Tt]ake\s*[Oo]ut|[Ss]ub|[Gg]rand)\s+[Tt]otal[^\d]*(\d+\.\d{2})")
    if not total:
        # P4: labelled "Total :" or "**Total**:"
        total = first(r"(?:\*\*)?[Tt]otal(?:\*\*)?[\s*]*[:\|][\s*]*(?:RM\s*)?(\d+\.\d{2})")
    if not total:
        # P5: table cell "Total" value
        total = first(r"[Tt]otal\s*:?\s*(\d+\.\d{2})")

    # ── Receipt number ────────────────────────────────────────────────────────
    # P1: Doc No / Document No
    receipt_number = first(r"(?:\*\*)?[Dd]oc(?:ument)?\s*[Nn]o(?:\*\*)?[^\w]*(\w+)")
    if not receipt_number:
        # P2: INV# — at least 6 chars to avoid false matches
        receipt_number = first(r"[Ii][Nn][Vv]#?\s*([\w]{6,})")
    if not receipt_number:
        # P3: Receipt No / Invoice No
        receipt_number = first(r"(?:[Rr]eceipt|[Ii]nvoice)\s*[Nn]o\.?\s*[:#]?\s*([\w\-]{4,})")
    if not receipt_number:
        # P4: Cash Bill number
        receipt_number = first(r"(?:[Cc]ash\s*[Bb]ill|CS)\s*[:#]?\s*([\w\-]{4,})")

    # ── Cashier ───────────────────────────────────────────────────────────────
    cashier_raw = first(r"(?:\*\*)?[Cc]ashier(?:\*\*)?[\s*]*[:\|][\s*]*(?:\*\*)?([A-Za-z][A-Za-z0-9 ]{1,25}?)(?:\*\*)?(?=\s*\n|\s{2,}|$)")
    cashier = clean(cashier_raw) if cashier_raw else None

    # ── Member ────────────────────────────────────────────────────────────────
    member_raw = first(r"(?:\*\*)?[Mm]ember(?:\*\*)?[\s*]*[:\|][\s*]*(?:\*\*)?([A-Za-z0-9][A-Za-z0-9 ]{1,30}?)(?:\*\*)?(?=\s*\n|\s{2,}|$)")
    member = clean(member_raw) if member_raw and len(member_raw.strip()) > 1 else None

    # ── Subtotal ──────────────────────────────────────────────────────────────
    subtotal = first(r"[Ss]ub\s*[Tt]otal[^\d]*(\d+\.\d{2})")
    if not subtotal:
        subtotal = first(r"[Tt]otal\s*[Aa]mt[^\d]*(\d+\.\d{2})")

    # ── Rounding ──────────────────────────────────────────────────────────────
    # Rounding: catch OCR typos e.g. "Rour Jing Adjustment", "Rounding Adj"
    rounding = first(r"[Rr]ou[rn][^:]{0,25}[Aa]dj[^\d\-−]*([-−]?\d+\.\d{2})")
    if not rounding:
        rounding = first(r"[Rr]ounding[^\d\-−]*([-−]?\d+\.\d{2})")

    # ── Cash ──────────────────────────────────────────────────────────────────
    cash = first(r"(?:\*\*)?[Cc]ash(?:\*\*)?(?!\s*[Bb]ill)(?!\s*[Ss]ales)\s*(?:[:\|]\s*)?([\d]+\.\d{2})")

    # ── Change ────────────────────────────────────────────────────────────────
    change = first(r"(?:\*\*)?[Cc]hange(?:\*\*)?[\s*]*[:\|]?[\s*]*(?:RM\s*)?(\d+\.\d{2})")

    # ── Line items ────────────────────────────────────────────────────────────
    line_items = []
    item_re = re.compile(r"(\d[\d\w\-]{4,})\s+(\d+)\s*[xX]?\s*(\d+\.\d{2})\s+(\d+\.\d{2})", re.MULTILINE)
    for m in item_re.finditer(text):
        line_items.append({
            "code": m.group(1), "qty": m.group(2),
            "price": m.group(3), "amount": m.group(4),
        })

    return {
        "company": company, "date": date, "address": address,
        "total": total, "receipt_number": receipt_number,
        "cashier": cashier, "member": member,
        "subtotal": subtotal, "rounding": rounding,
        "cash": cash, "change": change,
        "line_items": line_items if line_items else None,
    }




# ── REGION DETECTION ──────────────────────────────────────────────────────────
def detect_regions(ocr_text: str, fields_out: dict) -> dict:
    """
    Split OCR text into header / body / ending using extracted field line
    positions as anchors — more reliable than keyword guessing.

    Header : lines 1 → last line of {company, address, date, cashier,
                                      receipt_number, member}
    Body   : lines after header → last line of any financial field
             {line_items, subtotal, rounding, total, cash, change}
    Ending : lines after body — only non-financial footer content.
             Any line still containing a currency pattern stays in body.
    """
    lines = ocr_text.splitlines()
    n     = len(lines)
    if n == 0:
        return {"header": {"start_line": 1, "end_line": 0, "text": ""},
                "body":   {"start_line": 1, "end_line": 0, "text": ""},
                "ending": {"start_line": 1, "end_line": 0, "text": ""}}

    header_fields  = ["company", "address", "date", "cashier", "receipt_number", "member"]
    body_fields    = ["line_items", "subtotal", "rounding", "total", "cash", "change"]
    header_lines, body_lines = [], []

    for field in header_fields:
        fd  = fields_out.get(field, {})
        pos = fd.get("reading_position") or {}
        if pos.get("line"):
            header_lines.append(pos["line"])

    for field in body_fields:
        fd  = fields_out.get(field, {})
        pos = fd.get("reading_position") or {}
        if pos.get("line"):
            body_lines.append(pos["line"])
        if field == "line_items" and isinstance(fd.get("value"), list):
            for item in fd["value"]:
                ip = item.get("reading_position") or {}
                if ip.get("line"):
                    body_lines.append(ip["line"])

    header_end = min(max(header_lines) if header_lines else max(1, n // 4), n)
    body_end   = min(max(body_lines)   if body_lines   else max(header_end + 1, n * 3 // 4), n)
    body_end   = max(body_end, header_end + 1)

    # Pull any post-body lines that still contain a currency value back into body
    currency_re = re.compile(r"\d+\.\d{2}")
    for i in range(body_end, n):
        if currency_re.search(lines[i]):
            body_end = i + 1

    ending_start = body_end + 1

    def region_text(start, end):
        return "\n".join(lines[start - 1:end])

    return {
        "header": {"start_line": 1,            "end_line": header_end,   "text": region_text(1, header_end)},
        "body":   {"start_line": header_end+1,  "end_line": body_end,     "text": region_text(header_end+1, body_end)},
        "ending": {"start_line": ending_start,  "end_line": n,            "text": region_text(ending_start, n)},
    }

# ── EVALUATION ────────────────────────────────────────────────────────────────
def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", str(s).lower().strip())

def evaluate(fields: dict, ground_truth: dict) -> dict:
    results = {}
    correct, total = 0, 0
    for field in GT_FIELDS:
        gt = ground_truth.get(field)
        if gt is None:
            continue
        total += 1
        pred = fields.get(field, {}).get("value")
        norm_match = _norm(str(pred or "")) == _norm(str(gt))
        if norm_match:
            correct += 1
        results[field] = {
            "gt":          gt,
            "pred":        pred,
            "exact_match": str(pred) == str(gt),
            "norm_match":  norm_match,
        }
    results["_score"] = {
        "correct":  correct,
        "total":    total,
        "accuracy": round(correct / total, 3) if total else 0.0,
    }
    return results


# ── FULL PIPELINE ─────────────────────────────────────────────────────────────
def process_sample(img_path: str, box_path: str, entities_path: str,
                   output_dir: str, visualise: bool = True,
                   model=None, tokenizer=None) -> dict:

    tmp_dir = str(Path(output_dir) / "_tmp")
    Path(tmp_dir).mkdir(parents=True, exist_ok=True)
    stem = Path(img_path).stem

    if model is None or tokenizer is None:
        model, tokenizer = load_model()

    box_entries  = load_box_file(box_path)    if Path(box_path).exists()      else []
    ground_truth = load_entities(entities_path) if Path(entities_path).exists() else {}

    timings = {
        "model_inference": {},
        "extraction":      {},
        "output":          {},
    }
    t_total = time.time()

    # ── Pass 1: Free OCR ─────────────────────────────────────────────────────
    print("  [1/3] Free OCR ...")
    t0 = time.time()
    ocr_text = pass1_free_ocr(model, tokenizer, img_path, tmp_dir)
    raw_ocr = _last_raw_stdout
    timings["model_inference"]["ocr_sec"] = round(time.time() - t0, 2)
    print(f"        {len(ocr_text)} chars  ({timings['model_inference']['ocr_sec']}s)")

    # ── Pass 2: Markdown structure ────────────────────────────────────────────
    print("  [2/3] Markdown structure (spatial reasoning) ...")
    t0 = time.time()
    markdown = pass2_markdown(model, tokenizer, img_path, tmp_dir)
    raw_markdown = _last_raw_stdout
    timings["model_inference"]["structured_read_sec"] = round(time.time() - t0, 2)
    timings["model_inference"]["total_sec"] = round(timings["model_inference"]["ocr_sec"] + timings["model_inference"]["structured_read_sec"], 2)
    print(f"        {len(markdown)} chars  ({timings['model_inference']['structured_read_sec']}s)")

    # ── Parse fields from OCR text ────────────────────────────────────────────
    parsed = parse_fields(ocr_text)

    # ── Pass 3: Locate each found field value ─────────────────────────────────
    found_fields = [f for f in INVOICE_FIELDS
                    if parsed.get(f) and f != "line_items"]
    print(f"  [3/3] Extracting coords from Pass 2 markdown for {len(found_fields)} fields ...")
    t0 = time.time()

    fields_out = {}
    for field in INVOICE_FIELDS:
        value = parsed.get(field)

        if field == "line_items":
            # Locate each line item individually
            items_out = []
            for item in (value or []):
                snippet = item.get("amount", item.get("code", ""))
                bboxes_model = parse_coords_from_markdown(markdown, snippet) if snippet else []
                bboxes_gt    = gt_boxes_for(box_entries, snippet) if snippet else []
                items_out.append({**item, "bboxes_model": bboxes_model, "bboxes_gt": bboxes_gt})
            fields_out[field] = {
                "value":            items_out or None,
                "reading_position": None,
                "markdown_context": None,
                "bboxes_model":     [],
                "bboxes_gt":        [],
            }
            continue

        if value is None:
            fields_out[field] = {
                "value": None, "reading_position": None,
                "markdown_context": None,
                "bboxes_model": [], "bboxes_gt": [],
            }
            continue

        # Reading position — where in the causal flow this value appeared
        reading_pos = _reading_position(ocr_text, value)

        # Markdown context — what structural role the model assigned to this value
        md_context = _find_in_markdown(markdown, value)

        # Bounding boxes from Pass 2 markdown det tags (no extra model call)
        bboxes_model = parse_coords_from_markdown(markdown, str(value))
        bboxes_gt    = gt_boxes_for(box_entries, str(value))

        fields_out[field] = {
            "value":            value,
            # ── Reasoning package for judgment agent ──────────────────────
            "reading_position": reading_pos,   # line N in causal reading order + context
            "markdown_context": md_context,    # how OCR-2 structured this value in markdown
            "bboxes_model":     bboxes_model,  # pixel evidence: where model found it (norm 0-1)
            "bboxes_gt":        bboxes_gt,     # pixel evidence: ground truth box file coords
        }

    # ── Region detection ──────────────────────────────────────────────────────
    regions = detect_regions(ocr_text, fields_out)

    # ── Evaluate ──────────────────────────────────────────────────────────────
    timings["extraction"]["coord_parsing_sec"] = round(time.time() - t0, 2)
    timings["extraction"]["total_sec"] = timings["extraction"]["coord_parsing_sec"]
    timings["total_sec"] = round(time.time() - t_total, 2)
    eval_results = evaluate(fields_out, ground_truth)
    acc = eval_results.get("_score", {}).get("accuracy", 0)
    timings["output"]["total_sec"] = 0.0
    print(f"  Accuracy: {acc:.1%}  |  OCR: {timings['model_inference']['ocr_sec']}s  read: {timings['model_inference']['structured_read_sec']}s  extract: {timings['extraction']['total_sec']}s  total: {timings['total_sec']}s")

    # ── Engine-C format (matches engine A: engine + source_file + extracted_fields) ──
    engine_out = {
        "engine":           "DeepSeek-OCR-2",
        "source_file":      img_path,
        "extracted_fields": {f: fields_out[f]["value"] for f in GT_FIELDS if f in fields_out},
        "timings":          timings,
    }

    # ── Full result — no raw text or regions (those are standalone files) ─────
    result = {
        "image_path":      img_path,
        "processed_at":    datetime.now().isoformat(),
        "timings":         timings,
        "pass1_ocr_text":  ocr_text,
        "pass2_markdown":  markdown,
        "fields":          fields_out,
        "ground_truth":    ground_truth,
        "evaluation":      eval_results,
    }

    # ── Save files ────────────────────────────────────────────────────────────
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    with open(out / f"{stem}_engineC.json", "w", encoding="utf-8") as f:
        json.dump(engine_out, f, indent=2, ensure_ascii=False)

    with open(out / f"{stem}_full.json", "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    # Standalone text files for LLM consumption
    # _raw_ocr.txt      : clean OCR text, debug lines stripped, ready for LLM extraction
    # _raw_structured.txt: full structured read with <|ref|> and <|det|> tags for layout context
    with open(out / f"{stem}_raw_ocr.txt", "w", encoding="utf-8") as f:
        f.write(ocr_text)

    with open(out / f"{stem}_raw_structured.txt", "w", encoding="utf-8") as f:
        f.write(raw_markdown)

    # Standalone regions file
    with open(out / f"{stem}_regions.json", "w", encoding="utf-8") as f:
        json.dump({
            "image_path":   img_path,
            "processed_at": datetime.now().isoformat(),
            "regions":      regions,
        }, f, indent=2, ensure_ascii=False)

    t0_vis = time.time()
    if visualise:
        _draw_boxes(img_path, result, str(out / f"{stem}_annotated.png"))
    timings["output"]["visualisation_sec"] = round(time.time() - t0_vis, 2)
    timings["output"]["total_sec"] = timings["output"]["visualisation_sec"]

    return result


# ── VISUALISATION ─────────────────────────────────────────────────────────────
def _draw_boxes(image_path: str, result: dict, output_path: str):
    img  = Image.open(image_path).convert("RGB")
    draw = ImageDraw.Draw(img)
    w, h = img.size
    palette = ["#e63946","#2a9d8f","#e9c46a","#f4a261",
               "#264653","#8ecae6","#a8dadc","#457b9d"]

    for idx, (field, data) in enumerate(result["fields"].items()):
        colour = palette[idx % len(palette)]
        for box in data.get("bboxes_model", []):
            x1, y1 = int(box["x1"]*w), int(box["y1"]*h)
            x2, y2 = int(box["x2"]*w), int(box["y2"]*h)
            draw.rectangle([x1,y1,x2,y2], outline=colour, width=2)
            draw.text((x1+2, max(0,y1-12)), field, fill=colour)
        for box in data.get("bboxes_gt", []):
            draw.rectangle([box["x1"],box["y1"],box["x2"],box["y2"]],
                           outline="#00ff00", width=1)
        if field == "line_items" and isinstance(data.get("value"), list):
            for item in data["value"]:
                for box in item.get("bboxes_model", []):
                    x1,y1 = int(box["x1"]*w), int(box["y1"]*h)
                    x2,y2 = int(box["x2"]*w), int(box["y2"]*h)
                    draw.rectangle([x1,y1,x2,y2], outline=colour, width=1)

    img.save(output_path)
    print(f"  Annotated: {output_path}  (green=GT boxes, coloured=model boxes)")


# ── BATCH RUNNER ──────────────────────────────────────────────────────────────
def process_dataset(data_dir: str, output_dir: str,
                    max_images: int = 10, visualise: bool = True):
    data         = Path(data_dir)
    img_dir      = data / "img"
    box_dir      = data / "box"
    entities_dir = data / "entities"

    images = sorted(img_dir.glob("*.jpg")) + sorted(img_dir.glob("*.png"))
    images = images[:max_images]
    print(f"Found {len(images)} images in {img_dir}\n")

    model, tokenizer = load_model()

    per_image_summaries = []
    field_correct = {f: 0 for f in GT_FIELDS}
    field_total   = {f: 0 for f in GT_FIELDS}
    timing_sums   = {
        "ocr_sec": 0, "structured_read_sec": 0,
        "coord_parsing_sec": 0, "visualisation_sec": 0, "total_sec": 0,
    }
    scored  = 0
    errors  = []
    t_load  = time.time()
    model_load_sec = round(time.time() - t_load, 2)
    t_dataset = time.time()

    for i, img_path in enumerate(images):
        stem = img_path.stem
        print(f"[{i+1}/{len(images)}] {img_path.name}")
        try:
            result = process_sample(
                str(img_path),
                str(box_dir      / f"{stem}.txt"),
                str(entities_dir / f"{stem}.txt"),
                output_dir, visualise,
                model=model, tokenizer=tokenizer,
            )
            t  = result["timings"]
            mi = t["model_inference"]
            ex = t["extraction"]
            op = t["output"]
            timing_sums["ocr_sec"]             += mi.get("ocr_sec", 0)
            timing_sums["structured_read_sec"]  += mi.get("structured_read_sec", 0)
            timing_sums["coord_parsing_sec"]    += ex.get("coord_parsing_sec", 0)
            timing_sums["visualisation_sec"]    += op.get("visualisation_sec", 0)
            timing_sums["total_sec"]            += t.get("total_sec", 0)
            for field in GT_FIELDS:
                ev = result["evaluation"].get(field, {})
                if ev.get("gt") is not None:
                    field_total[field] += 1
                    if ev.get("norm_match"):
                        field_correct[field] += 1
            scored += 1
            per_image_summaries.append({
                "image":      img_path.name,
                "accuracy":   result["evaluation"]["_score"]["accuracy"],
                "timings":    t,
                "evaluation": {f: result["evaluation"][f] for f in GT_FIELDS
                               if f in result["evaluation"]},
                "files": {
                    "engineC":        f"{stem}_engineC.json",
                    "full":           f"{stem}_full.json",
                    "raw_ocr":        f"{stem}_raw_ocr.txt",
                    "raw_structured": f"{stem}_raw_structured.txt",
                    "regions":        f"{stem}_regions.json",
                    "annotated":      f"{stem}_annotated.png" if visualise else None,
                },
            })
        except Exception as e:
            import traceback
            print(f"  ERROR: {e}")
            traceback.print_exc()
            errors.append({"image": str(img_path), "error": str(e)})

    dataset_secs = round(time.time() - t_dataset, 1)
    n   = max(scored, 1)
    avg = round(sum(s["accuracy"] for s in per_image_summaries) / n, 3)

    summary = {
        "run_info": {
            "model":             MODEL_NAME,
            "device":            DEVICE,
            "processed_at":      datetime.now().isoformat(),
            "total_images":      len(images),
            "successful":        scored,
            "errors":            len(errors),
            "total_run_sec":     dataset_secs,
            "avg_sec_per_image": round(dataset_secs / n, 1),
        },
        "accuracy_summary": {
            "overall_avg": avg,
            "per_field": {
                f: {
                    "correct":  field_correct[f],
                    "total":    field_total[f],
                    "accuracy": round(field_correct[f] / field_total[f], 3)
                                if field_total[f] else 0.0,
                }
                for f in GT_FIELDS
            },
        },
        "timing_summary": {
            "model_inference": {
                "avg_ocr_sec":             round(timing_sums["ocr_sec"] / n, 2),
                "avg_structured_read_sec": round(timing_sums["structured_read_sec"] / n, 2),
            },
            "extraction": {
                "avg_coord_parsing_sec": round(timing_sums["coord_parsing_sec"] / n, 3),
            },
            "output": {
                "avg_visualisation_sec": round(timing_sums["visualisation_sec"] / n, 3),
            },
            "avg_total_sec": round(timing_sums["total_sec"] / n, 2),
            "min_total_sec": round(min((s["timings"]["total_sec"]
                                        for s in per_image_summaries), default=0), 2),
            "max_total_sec": round(max((s["timings"]["total_sec"]
                                        for s in per_image_summaries), default=0), 2),
        },
        "per_image": per_image_summaries,
        "errors":    errors,
    }

    out = Path(output_dir)
    with open(out / "all_results.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    ok = scored
    print(f"\n{'='*50}")
    print(f"Complete       : {ok}/{len(images)} processed")
    print(f"Avg accuracy   : {avg:.1%}")
    print(f"Per field      : " + "  ".join(
        f"{f}={round(field_correct[f]/field_total[f]*100)}%"
        if field_total[f] else f"{f}=N/A" for f in GT_FIELDS
    ))
    print(f"Avg per image  : {round(timing_sums['total_sec']/n,1)}s  "
          f"(OCR {round(timing_sums['ocr_sec']/n,1)}s + "
          f"read {round(timing_sums['structured_read_sec']/n,1)}s)")
    print(f"Total run time : {dataset_secs}s")
    print(f"Results        : {out / 'all_results.json'}")
    return summary


# ── CLI ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(description="DeepSeek-OCR-2 invoice extractor")
    ap.add_argument("--data",    default="./dev")
    ap.add_argument("--output",  default="./engine_c_deepseekocr2/results")
    ap.add_argument("--max",     type=int, default=10)
    ap.add_argument("--no-vis",  action="store_true")
    ap.add_argument("--image",   help="Single image stem e.g. X00016469612")
    args = ap.parse_args()

    if args.image:
        data = Path(args.data)
        img  = data / "img" / f"{args.image}.jpg"
        if not img.exists():
            img = data / "img" / f"{args.image}.png"
        result = process_sample(
            str(img),
            str(data / "box"      / f"{args.image}.txt"),
            str(data / "entities" / f"{args.image}.txt"),
            args.output, not args.no_vis,
        )
        sep = "="*60
        print(f"\n{sep}\nPASS 1 — OCR TEXT (reading order = structural reasoning)\n{sep}")
        print(result["pass1_ocr_text"][:800])
        print(f"\n{sep}\nPASS 2 — MARKDOWN (spatial hierarchy = layout reasoning)\n{sep}")
        print(result["pass2_markdown"][:800])
        print(f"\n{sep}\nEXTRACTED FIELDS\n{sep}")
        for field, d in result["fields"].items():
            if d["value"] is not None:
                print(f"\n  {field.upper()}")
                print(f"    value            : {d['value']}")
                print(f"    reading_position : {d['reading_position']}")
                print(f"    markdown_context : {d['markdown_context']}")
                print(f"    bboxes_model     : {d['bboxes_model']}")
                print(f"    bboxes_gt        : {d['bboxes_gt']}")
        print(f"\n{sep}\nEVALUATION\n{sep}")
        for k, v in result["evaluation"].items():
            print(f"  {k}: {v}")
    else:
        process_dataset(args.data, args.output, args.max, not args.no_vis)
