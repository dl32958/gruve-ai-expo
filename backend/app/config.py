from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR / "data"
OUTPUT_DIR = BASE_DIR / "output"
DEV_DATA_DIR = DATA_DIR / "dev"
UPLOADS_DIR = DATA_DIR / "uploads"
DEBUG_ROOT_DIR = OUTPUT_DIR / "debug"

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

def get_debug_output_dir() -> Path:
    run_ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    return DEBUG_ROOT_DIR / run_ts


DEBUG_OUTPUT_DIR = get_debug_output_dir()

LANGFUSE_PUBLIC_KEY = os.getenv("LANGFUSE_PUBLIC_KEY", "")
LANGFUSE_SECRET_KEY = os.getenv("LANGFUSE_SECRET_KEY", "")
LANGFUSE_HOST = os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com")
