from __future__ import annotations

from fastapi import APIRouter

from app.schemas.api import HealthResponse


router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health_check():
    return HealthResponse(status="ok")
