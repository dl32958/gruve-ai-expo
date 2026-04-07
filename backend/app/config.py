from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR / "data"
ARTIFACTS_DIR = DATA_DIR / "artifacts"
OUTPUT_DIR = ARTIFACTS_DIR
DEV_DATA_DIR = DATA_DIR / "dev"
UPLOADS_DIR = DATA_DIR / "uploads"
DEBUG_ROOT_DIR = OUTPUT_DIR / "debug"
ANNOTATED_ROOT_DIR = OUTPUT_DIR / "annotated"

ENGINE_A_PATH = os.getenv(
    "ENGINE_A_PATH",
    "/projects/insightx-lab/cn_grpo/models/Llama-3.1-8B-Instruct",
)
ENGINE_B_PATH = os.getenv(
    "ENGINE_B_PATH",
    "/projects/insightx-lab/cn_grpo/models/Qwen2.5-7B-Instruct",
)
EVAL_MODEL_PATH = os.getenv(
    "EVAL_MODEL_PATH",
    "/projects/insightx-lab/cn_grpo/models/Mistral-7B-Instruct-v0.3",
)
TESSERACT_CMD = os.getenv(
    "TESSERACT_CMD",
    "/home/lu.dong1/.conda/envs/expo-judge/bin/tesseract",
)

DEFAULT_DOC_CATEGORY = os.getenv("DEFAULT_DOC_CATEGORY", "receipt")
DEFAULT_FIELDS = ["company", "date", "address", "total", "phone number"]
DEBUG = os.getenv("DEBUG", "true").lower() == "true"
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:4173,http://localhost:5173",
    ).split(",")
    if origin.strip()
]


def ensure_runtime_dirs() -> None:
    for path in (DEV_DATA_DIR, UPLOADS_DIR, DEBUG_ROOT_DIR, ANNOTATED_ROOT_DIR):
        path.mkdir(parents=True, exist_ok=True)


def create_run_timestamp() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def get_debug_output_dir(run_ts: str | None = None) -> Path:
    ensure_runtime_dirs()
    run_ts = run_ts or create_run_timestamp()
    return DEBUG_ROOT_DIR / run_ts


def get_uploads_dir(run_ts: str | None = None) -> Path:
    ensure_runtime_dirs()
    run_ts = run_ts or create_run_timestamp()
    return UPLOADS_DIR / run_ts


def get_annotated_output_dir(run_ts: str | None = None) -> Path:
    ensure_runtime_dirs()
    run_ts = run_ts or create_run_timestamp()
    return ANNOTATED_ROOT_DIR / run_ts


DEBUG_OUTPUT_DIR = get_debug_output_dir()

LANGFUSE_PUBLIC_KEY = os.getenv("LANGFUSE_PUBLIC_KEY", "")
LANGFUSE_SECRET_KEY = os.getenv("LANGFUSE_SECRET_KEY", "")
LANGFUSE_HOST = os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com")
