from __future__ import annotations

import json
import re
from typing import Any


def extract_json_block(text: str) -> str:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return match.group(0)
    return text


def try_parse_json(text: str) -> Any:
    for fn in (lambda t: json.loads(t), lambda t: json.loads(extract_json_block(t))):
        try:
            return fn(text)
        except Exception:
            pass
    return None
