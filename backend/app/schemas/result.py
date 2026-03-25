from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class FieldResult(BaseModel):
    recommended_value: str
    selected_engine: str
    selection_reason: str
    selected_engine_total_tokens: int
    selected_engine_elapsed_seconds: float
    final_rule_consistency: str
    final_engine_self_consistency: str
    final_ocr_alignment: str
    final_ocr_corruption: str
    field_confidence: Literal["very_high", "high", "medium", "low"]
    field_state: Literal["pass", "review_needed", "fail"]
    state_reason: str
    engineA_evidence: str
    engineB_evidence: str


class FinalMetadata(BaseModel):
    image_path: str
    doc_category: str
    fields: list[str]
    debug: bool
    timestamp: str
    elapsed_seconds: float
    annotated_image: str


class FinalResult(BaseModel):
    metadata: FinalMetadata
    field_results: dict[str, FieldResult]
