from __future__ import annotations

from pathlib import Path
from typing import Annotated, Any, TypedDict


def _merge_dict(left: dict[str, Any], right: dict[str, Any]) -> dict[str, Any]:
    merged = dict(left or {})
    merged.update(right or {})
    return merged


def _merge_list(left: list[str], right: list[str]) -> list[str]:
    return [*(left or []), *(right or [])]


class PipelineState(TypedDict, total=False):
    image_path: str
    doc_category: str
    fields: list[str]
    debug: bool
    base_name: str
    output_dir: str
    annotated_output_dir: str
    raw_text: str
    word_df: Any
    image: Any
    constraints: Annotated[dict[str, str], _merge_dict]
    consolidated_rules: dict[str, Any]
    extractions: Annotated[dict[str, dict[str, Any]], _merge_dict]
    self_justifications: Annotated[dict[str, dict[str, Any]], _merge_dict]
    cross_result: dict[str, Any]
    annotated_image: str
    final_result: dict[str, Any]
    run_metadata: Annotated[dict[str, Any], _merge_dict]
    errors: Annotated[list[str], _merge_list]


def build_initial_state(
    image_path: str,
    doc_category: str,
    fields: list[str],
    debug: bool,
    output_dir: str | Path,
    annotated_output_dir: str | Path,
) -> PipelineState:
    return {
        "image_path": image_path,
        "doc_category": doc_category,
        "fields": fields,
        "debug": debug,
        "base_name": Path(image_path).stem,
        "output_dir": str(output_dir),
        "annotated_output_dir": str(annotated_output_dir),
        "constraints": {},
        "extractions": {},
        "self_justifications": {},
        "run_metadata": {},
        "errors": [],
    }
