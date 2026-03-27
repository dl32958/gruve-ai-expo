from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.health import router as health_router
from app.api.pipeline import router as pipeline_router
from app.config import FRONTEND_ORIGINS, OUTPUT_DIR, ensure_runtime_dirs


app = FastAPI(title="Triangulation Judgment Backend")
ensure_runtime_dirs()
app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/artifacts", StaticFiles(directory=OUTPUT_DIR), name="artifacts")
app.include_router(health_router)
app.include_router(pipeline_router)
