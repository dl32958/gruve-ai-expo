from __future__ import annotations

import json
import time
from datetime import datetime
from pathlib import Path

from app.config import ENGINE_A_PATH, ENGINE_B_PATH, EVAL_MODEL_PATH, OUTPUT_DIR
from app.pipeline.prompts import (
    build_constraints_prompt_a,
    build_constraints_prompt_b,
    build_cross_judge_prompt,
    build_rule_synthesis_prompt,
    build_single_extraction_prompt,
    build_stage2_prompt,
)
from app.pipeline.state import PipelineState
from app.services.inference import load_model_and_tokenizer, release_model, run_chat_inference
from app.services.tracing import tracing_service
from app.utils.io import maybe_save_json, maybe_save_text
from app.utils.json_utils import extract_json_block
from app.utils.ocr import phase_ocr_with_bbox
from app.utils.visualize import phase_visualize


def run_sanity_check(value):
    value = str(value).strip() if value is not None else ""
    if not value:
        return "not_pass"
    return "pass"


def ocr_node(state: PipelineState) -> PipelineState:
    with tracing_service.span("ocr_node", {"image_path": state["image_path"]}):
        raw_text, word_df, image = phase_ocr_with_bbox(state["image_path"])
        maybe_save_text(raw_text, f"{state['base_name']}_raw_text.txt", state["debug"], state["output_dir"])
        return {"raw_text": raw_text, "word_df": word_df, "image": image}


def constraints_engine_a_node(state: PipelineState) -> PipelineState:
    prompt = build_constraints_prompt_a(state["raw_text"], state["doc_category"], state["fields"])
    with tracing_service.span("constraints_engineA_node", {"prompt": prompt}):
        tokenizer, model = load_model_and_tokenizer(ENGINE_A_PATH)
        response = run_chat_inference(model, tokenizer, prompt, max_new_tokens=800)
        release_model(model, tokenizer)
    maybe_save_text(response, f"{state['base_name']}_engineA_constraints.txt", state["debug"], state["output_dir"])
    constraints = dict(state.get("constraints", {}))
    constraints["engineA"] = response
    return {"constraints": constraints}


def constraints_engine_b_node(state: PipelineState) -> PipelineState:
    prompt = build_constraints_prompt_b(state["raw_text"], state["doc_category"], state["fields"])
    with tracing_service.span("constraints_engineB_node", {"prompt": prompt}):
        tokenizer, model = load_model_and_tokenizer(ENGINE_B_PATH)
        response = run_chat_inference(model, tokenizer, prompt, max_new_tokens=800)
        release_model(model, tokenizer)
    maybe_save_text(response, f"{state['base_name']}_engineB_constraints.txt", state["debug"], state["output_dir"])
    constraints = dict(state.get("constraints", {}))
    constraints["engineB"] = response
    return {"constraints": constraints}


def rule_synthesis_node(state: PipelineState) -> PipelineState:
    prompt = build_rule_synthesis_prompt(
        state["constraints"]["engineA"],
        state["constraints"]["engineB"],
        state["doc_category"],
        state["fields"],
    )
    with tracing_service.span("rule_synthesis_node", {"prompt": prompt}):
        tokenizer, model = load_model_and_tokenizer(EVAL_MODEL_PATH)
        response = run_chat_inference(model, tokenizer, prompt, max_new_tokens=800)
        release_model(model, tokenizer)
    consolidated_rules = json.loads(extract_json_block(response))
    maybe_save_json(
        consolidated_rules,
        f"{state['base_name']}_eval_constraints.json",
        state["debug"],
        state["output_dir"],
    )
    return {"consolidated_rules": consolidated_rules}


def _run_extraction_for_engine(state: PipelineState, engine_name: str, model_path: str) -> PipelineState:
    tokenizer, model = load_model_and_tokenizer(model_path)
    engine_started_at = time.time()

    extraction = {
        "field_extraction": {},
        "evidence_trace": {},
        "reasoning": {},
        "engine_metrics": {
            "elapsed_seconds": 0.0,
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
            "field_count": len(state["fields"]),
        },
    }

    for field in state["fields"]:
        prompt = build_single_extraction_prompt(
            state["raw_text"],
            state["constraints"][engine_name],
            field,
            state["doc_category"],
        )
        response, usage = run_chat_inference(
            model,
            tokenizer,
            prompt,
            max_new_tokens=500,
            return_usage=True,
        )
        extraction["engine_metrics"]["prompt_tokens"] += usage["prompt_tokens"]
        extraction["engine_metrics"]["completion_tokens"] += usage["completion_tokens"]
        extraction["engine_metrics"]["total_tokens"] += usage["total_tokens"]

        try:
            parsed = json.loads(extract_json_block(response))
            extraction["field_extraction"][field] = parsed.get("field_extraction", "")
            extraction["evidence_trace"][field] = parsed.get("evidence_trace", "")
            extraction["reasoning"][field] = parsed.get(
                "reasoning",
                "No sufficiently supported value was found for this field.",
            )
        except Exception:
            extraction["field_extraction"][field] = ""
            extraction["evidence_trace"][field] = ""
            extraction["reasoning"][field] = "No sufficiently supported value was found for this field."

    extraction["engine_metrics"]["elapsed_seconds"] = round(time.time() - engine_started_at, 4)
    release_model(model, tokenizer)
    maybe_save_json(
        extraction,
        f"{state['base_name']}_{engine_name}_extraction.json",
        state["debug"],
        state["output_dir"],
    )
    extractions = dict(state.get("extractions", {}))
    extractions[engine_name] = extraction
    return {"extractions": extractions}


def extraction_engine_a_node(state: PipelineState) -> PipelineState:
    with tracing_service.span("extraction_engineA_node"):
        return _run_extraction_for_engine(state, "engineA", ENGINE_A_PATH)


def extraction_engine_b_node(state: PipelineState) -> PipelineState:
    with tracing_service.span("extraction_engineB_node"):
        return _run_extraction_for_engine(state, "engineB", ENGINE_B_PATH)


def _run_self_justification_for_engine(state: PipelineState, engine_name: str) -> PipelineState:
    extraction = state["extractions"][engine_name]
    engine_metrics = extraction.get("engine_metrics", {})
    engine_result = {
        "engine": engine_name,
        "engine_metrics": engine_metrics,
        "field_results": {},
    }

    tokenizer, model = load_model_and_tokenizer(EVAL_MODEL_PATH)
    try:
        for field in state["fields"]:
            extracted_value = extraction["field_extraction"][field]
            evidence_text = extraction["evidence_trace"][field]
            reasoning_text = extraction["reasoning"][field]
            rules = state["consolidated_rules"]["consolidated_rules"][field]
            run_sanity_check(extracted_value)

            prompt = build_stage2_prompt(
                field_name=field,
                rules=rules,
                extracted_value=extracted_value,
                evidence_text=evidence_text,
                reasoning_text=reasoning_text,
                ocr_raw_text=state["raw_text"],
                doc_category=state["doc_category"],
            )
            response = run_chat_inference(model, tokenizer, prompt, max_new_tokens=600)
            engine_result["field_results"][field] = {
                **json.loads(extract_json_block(response)),
                "engine_metrics": engine_metrics,
            }
    finally:
        release_model(model, tokenizer)

    maybe_save_json(
        engine_result,
        f"{state['base_name']}_{engine_name}_self_judge.json",
        state["debug"],
        state["output_dir"],
    )
    results = dict(state.get("self_justifications", {}))
    results[engine_name] = engine_result
    return {"self_justifications": results}


def self_justify_engine_a_node(state: PipelineState) -> PipelineState:
    with tracing_service.span("self_justify_engineA_node"):
        return _run_self_justification_for_engine(state, "engineA")


def self_justify_engine_b_node(state: PipelineState) -> PipelineState:
    with tracing_service.span("self_justify_engineB_node"):
        return _run_self_justification_for_engine(state, "engineB")


def cross_judgment_node(state: PipelineState) -> PipelineState:
    stage3 = {"field_results": {}}

    tokenizer, model = load_model_and_tokenizer(EVAL_MODEL_PATH)
    try:
        for field in state["fields"]:
            engine_a_result = state["self_justifications"]["engineA"]["field_results"][field]
            engine_b_result = state["self_justifications"]["engineB"]["field_results"][field]
            rules = state["consolidated_rules"]["consolidated_rules"][field]
            prompt = build_cross_judge_prompt(
                field,
                rules,
                engine_a_result,
                engine_b_result,
                state["doc_category"],
            )
            response = run_chat_inference(model, tokenizer, prompt, max_new_tokens=600)
            judged = json.loads(extract_json_block(response))

            engine_a_metrics = state["self_justifications"]["engineA"].get("engine_metrics", {})
            engine_b_metrics = state["self_justifications"]["engineB"].get("engine_metrics", {})
            selected_engine = judged.get("selected_engine", "")
            selected_metrics = {}
            if selected_engine == "engineA":
                selected_metrics = engine_a_metrics
            elif selected_engine == "engineB":
                selected_metrics = engine_b_metrics

            stage3["field_results"][field] = {
                "recommended_value": judged.get("recommended_value", ""),
                "selected_engine": selected_engine,
                "selection_reason": judged.get("selection_reason", ""),
                "selected_engine_total_tokens": selected_metrics.get("total_tokens", 0),
                "selected_engine_elapsed_seconds": selected_metrics.get("elapsed_seconds", 0.0),
                "final_rule_consistency": judged.get("final_rule_consistency", ""),
                "final_engine_self_consistency": judged.get("final_engine_self_consistency", ""),
                "final_ocr_alignment": judged.get("final_ocr_alignment", ""),
                "final_ocr_corruption": judged.get("final_ocr_corruption", ""),
                "field_confidence": judged.get("field_confidence", ""),
                "field_state": judged.get("field_state", ""),
                "state_reason": judged.get("state_reason", ""),
                "engineA_evidence": state["extractions"]["engineA"]["evidence_trace"].get(field, ""),
                "engineB_evidence": state["extractions"]["engineB"]["evidence_trace"].get(field, ""),
            }
    finally:
        release_model(model, tokenizer)

    maybe_save_json(stage3, f"{state['base_name']}_cross_judge.json", state["debug"], state["output_dir"])
    return {"cross_result": stage3}


def visualize_node(state: PipelineState) -> PipelineState:
    output_dir = state["annotated_output_dir"]
    annotated_image = phase_visualize(
        cross_result=state["cross_result"],
        fields=state["fields"],
        output_dir=output_dir,
        base_name=state["base_name"],
        word_df=state["word_df"],
        image=state["image"],
    )
    return {"annotated_image": annotated_image}


def finalize_node(state: PipelineState) -> PipelineState:
    run_metadata = state.get("run_metadata", {})
    started_at = run_metadata.get("pipeline_start", time.time())
    run_ts = run_metadata.get("run_ts", "")
    public_field_results = {}
    for field, result in state["cross_result"]["field_results"].items():
        public_field_results[field] = {
            key: value
            for key, value in result.items()
            if key not in {"engineA_evidence", "engineB_evidence"}
        }

    annotated_image_path = Path(state["annotated_image"])
    try:
        annotated_relative_path = annotated_image_path.relative_to(OUTPUT_DIR).as_posix()
        annotated_image_url = f"/artifacts/{annotated_relative_path}"
    except ValueError:
        annotated_image_url = ""

    final_result = {
        "metadata": {
            "image_path": state["image_path"],
            "doc_category": state["doc_category"],
            "fields": state["fields"],
            "debug": state["debug"],
            "run_ts": run_ts,
            "timestamp": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
            "elapsed_seconds": round(time.time() - started_at, 1),
            "annotated_image": state["annotated_image"],
            "annotated_image_url": annotated_image_url,
        },
        "field_results": public_field_results,
    }
    maybe_save_json(final_result, f"{state['base_name']}_final_result.json", state["debug"], state["output_dir"])
    return {"final_result": final_result}
