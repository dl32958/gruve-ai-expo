from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def save_text(text: str, path: str | Path) -> None:
    Path(path).write_text(text, encoding="utf-8")


def save_json(obj: Any, path: str | Path) -> None:
    Path(path).write_text(
        json.dumps(obj, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def maybe_save_text(text: str, filename: str, debug: bool, output_dir: str | Path) -> None:
    if not debug:
        return
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    save_text(text, output_path / filename)


def maybe_save_json(obj: Any, filename: str, debug: bool, output_dir: str | Path) -> None:
    if not debug:
        return
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    save_json(obj, output_path / filename)
