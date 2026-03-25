from __future__ import annotations

from fastapi import FastAPI

from app.api.health import router as health_router
from app.api.pipeline import router as pipeline_router


app = FastAPI(title="Triangulation Judgment Backend")
app.include_router(health_router)
app.include_router(pipeline_router)
