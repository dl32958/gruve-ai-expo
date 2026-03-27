from __future__ import annotations

import time

from langgraph.graph import END, START, StateGraph

from app.config import get_annotated_output_dir, get_debug_output_dir
from app.pipeline.nodes import (
    constraints_engine_a_node,
    constraints_engine_b_node,
    cross_judgment_node,
    extraction_engine_a_node,
    extraction_engine_b_node,
    finalize_node,
    ocr_node,
    rule_synthesis_node,
    self_justify_engine_a_node,
    self_justify_engine_b_node,
    visualize_node,
)
from app.pipeline.state import PipelineState, build_initial_state


def build_graph():
    graph = StateGraph(PipelineState)
    graph.add_node("ocr", ocr_node)
    graph.add_node("constraints_engineA", constraints_engine_a_node)
    graph.add_node("constraints_engineB", constraints_engine_b_node)
    graph.add_node("rule_synthesis", rule_synthesis_node)
    graph.add_node("extraction_engineA", extraction_engine_a_node)
    graph.add_node("extraction_engineB", extraction_engine_b_node)
    graph.add_node("self_justify_engineA", self_justify_engine_a_node)
    graph.add_node("self_justify_engineB", self_justify_engine_b_node)
    graph.add_node("cross_judgment", cross_judgment_node)
    graph.add_node("visualize", visualize_node)
    graph.add_node("finalize", finalize_node)

    # Keep the workflow strictly sequential for single GPU execution pattern.
    graph.add_edge(START, "ocr")
    graph.add_edge("ocr", "constraints_engineA")
    graph.add_edge("constraints_engineA", "constraints_engineB")
    graph.add_edge("constraints_engineB", "rule_synthesis")
    graph.add_edge("rule_synthesis", "extraction_engineA")
    graph.add_edge("extraction_engineA", "extraction_engineB")
    graph.add_edge("extraction_engineB", "self_justify_engineA")
    graph.add_edge("self_justify_engineA", "self_justify_engineB")
    graph.add_edge("self_justify_engineB", "cross_judgment")
    graph.add_edge("cross_judgment", "visualize")
    graph.add_edge("visualize", "finalize")
    graph.add_edge("finalize", END)
    return graph.compile()


def run_pipeline_graph(
    image_path: str,
    doc_category: str,
    fields: list[str],
    debug: bool,
    output_dir: str | None = None,
    annotated_output_dir: str | None = None,
    run_ts: str | None = None,
):
    app = build_graph()
    if output_dir is None:
        output_dir = str(get_debug_output_dir())
    if annotated_output_dir is None:
        annotated_output_dir = str(get_annotated_output_dir())
    state = build_initial_state(
        image_path,
        doc_category,
        fields,
        debug,
        output_dir,
        annotated_output_dir,
    )
    state["run_metadata"] = {
        "pipeline_start": time.time(),
        "run_ts": run_ts,
    }
    final_state = app.invoke(state)
    return final_state["final_result"]
