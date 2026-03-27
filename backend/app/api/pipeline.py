from __future__ import annotations

import json
import threading
import traceback
import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.config import DEBUG_ROOT_DIR, create_run_timestamp, get_annotated_output_dir, get_debug_output_dir
from app.pipeline.graph import run_pipeline_graph
from app.schemas.api import (
    DebugArtifactsResponse,
    JobCreateResponse,
    JobStatusResponse,
    RunPipelineRequest,
    RunPipelineResponse,
    UploadPipelineResponse,
)
from app.utils.uploads import save_upload_file


router = APIRouter(prefix="/pipeline", tags=["pipeline"])
_jobs: dict[str, dict] = {}
_jobs_lock = threading.Lock()


def _parse_fields(fields: str) -> list[str]:
    return [field.strip() for field in fields.split(",") if field.strip()]


def _read_optional_text(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def _read_optional_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def _set_job_state(job_id: str, **updates) -> None:
    with _jobs_lock:
        if job_id not in _jobs:
            return
        _jobs[job_id].update(updates)


def _run_job(
    job_id: str,
    *,
    image_path: str,
    doc_category: str,
    fields: list[str],
    debug: bool,
    saved_image_path: str | None = None,
) -> None:
    run_ts = create_run_timestamp()
    _set_job_state(job_id, status="running")
    try:
        result = run_pipeline_graph(
            image_path=image_path,
            doc_category=doc_category,
            fields=fields,
            debug=debug,
            output_dir=str(get_debug_output_dir(run_ts)),
            annotated_output_dir=str(get_annotated_output_dir(run_ts)),
            run_ts=run_ts,
        )
        _set_job_state(
            job_id,
            status="completed",
            result=result,
            saved_image_path=saved_image_path,
        )
    except Exception as exc:
        _set_job_state(
            job_id,
            status="failed",
            error=f"{exc}\n\n{traceback.format_exc()}",
            saved_image_path=saved_image_path,
        )


def _create_job(
    *,
    image_path: str,
    doc_category: str,
    fields: list[str],
    debug: bool,
    saved_image_path: str | None = None,
) -> JobCreateResponse:
    job_id = uuid.uuid4().hex
    with _jobs_lock:
        _jobs[job_id] = {
            "status": "queued",
            "job_id": job_id,
            "saved_image_path": saved_image_path,
            "result": None,
            "error": None,
        }

    thread = threading.Thread(
        target=_run_job,
        kwargs={
            "job_id": job_id,
            "image_path": image_path,
            "doc_category": doc_category,
            "fields": fields,
            "debug": debug,
            "saved_image_path": saved_image_path,
        },
        daemon=True,
    )
    thread.start()
    return JobCreateResponse(status="accepted", job_id=job_id, saved_image_path=saved_image_path)


@router.post("/run-from-path", response_model=RunPipelineResponse)
def run_pipeline_from_path(request: RunPipelineRequest):
    run_ts = create_run_timestamp()
    result = run_pipeline_graph(
        image_path=request.image_path,
        doc_category=request.doc_category,
        fields=request.fields,
        debug=request.debug,
        output_dir=str(get_debug_output_dir(run_ts)),
        annotated_output_dir=str(get_annotated_output_dir(run_ts)),
        run_ts=run_ts,
    )
    return RunPipelineResponse(status="ok", result=result)


@router.post("/run", response_model=UploadPipelineResponse)
def run_pipeline_from_upload(
    file: UploadFile = File(...),
    doc_category: str = Form(...),
    fields: str = Form(...),
    debug: bool = Form(True),
):
    run_ts = create_run_timestamp()
    saved_image_path = save_upload_file(file, run_ts=run_ts)
    result = run_pipeline_graph(
        image_path=str(saved_image_path),
        doc_category=doc_category,
        fields=_parse_fields(fields),
        debug=debug,
        output_dir=str(get_debug_output_dir(run_ts)),
        annotated_output_dir=str(get_annotated_output_dir(run_ts)),
        run_ts=run_ts,
    )
    return UploadPipelineResponse(
        status="ok",
        saved_image_path=str(saved_image_path),
        result=result,
    )


@router.post("/jobs/run-from-path", response_model=JobCreateResponse)
def create_pipeline_job_from_path(request: RunPipelineRequest):
    return _create_job(
        image_path=request.image_path,
        doc_category=request.doc_category,
        fields=request.fields,
        debug=request.debug,
    )


@router.post("/jobs/run", response_model=JobCreateResponse)
def create_pipeline_job_from_upload(
    file: UploadFile = File(...),
    doc_category: str = Form(...),
    fields: str = Form(...),
    debug: bool = Form(True),
):
    run_ts = create_run_timestamp()
    saved_image_path = save_upload_file(file, run_ts=run_ts)
    return _create_job(
        image_path=str(saved_image_path),
        doc_category=doc_category,
        fields=_parse_fields(fields),
        debug=debug,
        saved_image_path=str(saved_image_path),
    )


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
def get_pipeline_job(job_id: str):
    with _jobs_lock:
        job = _jobs.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail=f"Job {job_id} was not found.")
        return JobStatusResponse(**job)


@router.get("/debug/{run_ts}", response_model=DebugArtifactsResponse)
def get_pipeline_debug(run_ts: str):
    run_dir = DEBUG_ROOT_DIR / run_ts
    if not run_dir.exists():
        raise HTTPException(status_code=404, detail=f"Debug artifacts for run_ts={run_ts} were not found.")

    raw_text_path = next(run_dir.glob("*_raw_text.txt"), None)
    engine_a_extraction_path = next(run_dir.glob("*_engineA_extraction.json"), None)
    engine_b_extraction_path = next(run_dir.glob("*_engineB_extraction.json"), None)
    cross_judge_path = next(run_dir.glob("*_cross_judge.json"), None)

    return DebugArtifactsResponse(
        status="ok",
        run_ts=run_ts,
        raw_text=_read_optional_text(raw_text_path) if raw_text_path else "",
        engineA_extraction=_read_optional_json(engine_a_extraction_path) if engine_a_extraction_path else {},
        engineB_extraction=_read_optional_json(engine_b_extraction_path) if engine_b_extraction_path else {},
        cross_judge=_read_optional_json(cross_judge_path) if cross_judge_path else {},
    )
