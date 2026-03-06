import json
import re
from typing import Any, Dict, Optional


def clean_ocr_text(text: str) -> str:
    """Light cleanup: normalize whitespace and strip weird spacing."""
    if text is None:
        return ""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    # Collapse excessive blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Trim trailing spaces per line
    text = "\n".join(line.strip() for line in text.splitlines())
    return text.strip()


def strip_code_fences(s: str) -> str:
    """Remove ```json ... ``` fences if the model wraps output."""
    s = s.strip()
    if s.startswith("```"):
        s = re.sub(r"^```[a-zA-Z]*\n?", "", s)
        s = re.sub(r"\n?```$", "", s)
    return s.strip()


def extract_first_json_object(s: str) -> Optional[Dict[str, Any]]:
    """
    Best-effort extraction of the first JSON object in a string.
    Returns dict if found, else None.
    """
    s = strip_code_fences(s)

    # Fast path: try parse whole string
    try:
        obj = json.loads(s)
        if isinstance(obj, dict):
            return obj
    except Exception:
        pass

    # Bracket-matching extraction for first {...}
    start = s.find("{")
    if start == -1:
        return None

    depth = 0
    in_string = False
    escape = False

    for i in range(start, len(s)):
        ch = s[i]

        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            continue
        else:
            if ch == '"':
                in_string = True
                continue
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    candidate = s[start : i + 1].strip()
                    try:
                        obj = json.loads(candidate)
                        if isinstance(obj, dict):
                            return obj
                    except Exception:
                        return None

    return None


def normalize_date_ddmmyyyy(date_str: Optional[str]) -> Optional[str]:
    """If date contains time, try to keep DD/MM/YYYY only."""
    if date_str is None:
        return None
    date_str = date_str.strip()
    m = re.search(r"(\d{2}/\d{2}/\d{4})", date_str)
    return m.group(1) if m else date_str


def normalize_total_2dp(total_str: Optional[str]) -> Optional[str]:
    """Strip currency symbols/commas and enforce two decimals if possible."""
    if total_str is None:
        return None
    s = total_str.strip()
    # Remove currency and commas, keep digits and dot
    s = s.replace(",", "")
    s = re.sub(r"[^\d.]", "", s)

    # If it's already like 193.00
    if re.match(r"^\d+(\.\d{2})$", s):
        return s

    # If like 193 or 193.0 or 193.000 -> coerce to 2dp if numeric
    try:
        val = float(s)
        return f"{val:.2f}"
    except Exception:
        return total_str.strip()


def postprocess_fields(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Minimal postprocessing to help match dataset formatting.
    Does NOT add new keys.
    """
    out = dict(data)

    # Keep only the expected keys if the model adds extras
    expected = {"company", "date", "address", "total"}
    out = {k: out.get(k, None) for k in expected}

    # Normalize
    if isinstance(out.get("company"), str):
        out["company"] = out["company"].strip() or None

    if isinstance(out.get("address"), str):
        out["address"] = re.sub(r"\s+", " ", out["address"]).strip() or None

    if isinstance(out.get("date"), str):
        out["date"] = normalize_date_ddmmyyyy(out["date"])

    if isinstance(out.get("total"), str):
        out["total"] = normalize_total_2dp(out["total"])

    return out