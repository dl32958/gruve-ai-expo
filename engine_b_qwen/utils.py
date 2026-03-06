import json
import re
from typing import Any, Dict, Optional


def clean_ocr_text(text: str) -> str:
    """Minimal OCR text cleanup for extraction input."""
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


def postprocess_fields(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Minimal extraction-stage postprocessing.

    This function keeps only the expected output fields and applies light
    cleanup needed to make the extractor output usable by downstream modules.
    It intentionally avoids heavy normalization, which should happen in the
    shared normalization module later in the pipeline.
    """
    out = dict(data)

    # Keep only the expected keys if the model adds extras
    expected = {"company", "date", "address", "total"}
    out = {k: out.get(k, None) for k in expected}

    # Light cleanup only; no downstream normalization here.
    if isinstance(out.get("company"), str):
        out["company"] = out["company"].strip() or None

    if isinstance(out.get("address"), str):
        out["address"] = out["address"].strip() or None

    if isinstance(out.get("date"), str):
        out["date"] = out["date"].strip() or None

    if isinstance(out.get("total"), str):
        out["total"] = out["total"].strip() or None

    return out