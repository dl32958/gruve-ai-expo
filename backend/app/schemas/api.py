from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from app.config import DEFAULT_DOC_CATEGORY, DEFAULT_FIELDS


class RunPipelineRequest(BaseModel):
    image_path: str
    doc_category: str = DEFAULT_DOC_CATEGORY
    fields: list[str] = Field(default_factory=lambda: list(DEFAULT_FIELDS))
    debug: bool = True


class RunPipelineResponse(BaseModel):
    status: str
    result: dict[str, Any]


class HealthResponse(BaseModel):
    status: str
