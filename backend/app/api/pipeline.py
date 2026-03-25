from __future__ import annotations

from fastapi import APIRouter

from app.config import get_debug_output_dir
from app.pipeline.graph import run_pipeline_graph
from app.schemas.api import RunPipelineRequest, RunPipelineResponse


router = APIRouter(prefix="/pipeline", tags=["pipeline"])


@router.post("/run", response_model=RunPipelineResponse)
def run_pipeline(request: RunPipelineRequest):
    result = run_pipeline_graph(
        image_path=request.image_path,
        doc_category=request.doc_category,
        fields=request.fields,
        debug=request.debug,
        output_dir=str(get_debug_output_dir()),
    )
    return RunPipelineResponse(status="ok", result=result)
