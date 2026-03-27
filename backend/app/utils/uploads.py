from __future__ import annotations

from datetime import datetime
from pathlib import Path

from fastapi import UploadFile

from app.config import get_uploads_dir


def save_upload_file(upload_file: UploadFile, run_ts: str | None = None) -> Path:
    upload_dir = get_uploads_dir(run_ts)
    upload_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(upload_file.filename or "").suffix or ".jpg"
    stem = Path(upload_file.filename or "upload").stem or "upload"
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    destination = upload_dir / f"{stem}_{timestamp}{suffix}"
    destination.write_bytes(upload_file.file.read())
    return destination
