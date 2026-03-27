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


class UploadPipelineResponse(BaseModel):
    status: str
    saved_image_path: str
    result: dict[str, Any]


class DebugArtifactsResponse(BaseModel):
    status: str
    run_ts: str
    raw_text: str = ""
    engineA_extraction: dict[str, Any] = Field(default_factory=dict)
    engineB_extraction: dict[str, Any] = Field(default_factory=dict)
    cross_judge: dict[str, Any] = Field(default_factory=dict)


class JobCreateResponse(BaseModel):
    status: str
    job_id: str
    saved_image_path: str | None = None


class JobStatusResponse(BaseModel):
    status: str
    job_id: str
    saved_image_path: str | None = None
    result: dict[str, Any] | None = None
    error: str | None = None


class HealthResponse(BaseModel):
    status: str
