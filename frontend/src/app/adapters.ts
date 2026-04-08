import type { BackendFieldResult, BackendRunResponse, EngineExtraction, FieldResult, RunResult } from "./types";

function scoreFromLevel(level: string | undefined): number {
  switch (level) {
    case "very_high":
      return 0.95;
    case "high":
    case "strong":
      return 0.85;
    case "medium":
    case "moderate":
    case "partial":
      return 0.6;
    case "low":
    case "weak":
      return 0.25;
    case "absent":
      return 0.05;
    case "possible":
      return 0.2;
    case "present":
      return 0.8;
    default:
      return 0;
  }
}

function createEngineExtraction(field: BackendFieldResult): EngineExtraction {
  return {
    extracted_value: field.recommended_value || "",
    rule_consistency: scoreFromLevel(field.final_rule_consistency),
    engine_self_consistency: scoreFromLevel(field.final_engine_self_consistency),
    ocr_alignment: scoreFromLevel(field.final_ocr_alignment),
    ocr_corruption: scoreFromLevel(field.final_ocr_corruption),
    judgment_summary: field.selection_reason || field.state_reason || "No detailed engine summary available.",
    constraint_summary: [],
    field_extraction: {},
    evidence_trace: [],
    reasoning: field.selection_reason || field.state_reason || "No detailed reasoning available in the current API response.",
  };
}

function getRunStatus(fields: FieldResult[]): RunResult["status"] {
  if (fields.some((field) => field.field_state === "fail")) {
    return "failed";
  }
  if (fields.some((field) => field.field_state === "review_needed")) {
    return "partial";
  }
  return "success";
}

export function adaptBackendRunResponse(payload: BackendRunResponse): RunResult {
  const result = payload.result;
  const fields = Object.entries(result.field_results).map(([fieldName, field]) => {
    const engineA = createEngineExtraction(field);
    const engineB = createEngineExtraction(field);

    return {
      field_name: fieldName,
      recommended_value: field.recommended_value,
      field_state: field.field_state,
      field_confidence: field.field_confidence,
      selected_engine: field.selected_engine,
      selection_reason: field.selection_reason,
      state_reason: field.state_reason,
      selected_engine_total_tokens: field.selected_engine_total_tokens,
      selected_engine_elapsed_seconds: field.selected_engine_elapsed_seconds,
      signals: {
        final_rule_consistency: scoreFromLevel(field.final_rule_consistency),
        final_engine_self_consistency: scoreFromLevel(field.final_engine_self_consistency),
        final_ocr_alignment: scoreFromLevel(field.final_ocr_alignment),
        final_ocr_corruption: scoreFromLevel(field.final_ocr_corruption),
      },
      signal_labels: {
        final_rule_consistency: field.final_rule_consistency,
        final_engine_self_consistency: field.final_engine_self_consistency,
        final_ocr_alignment: field.final_ocr_alignment,
        final_ocr_corruption: field.final_ocr_corruption,
      },
      engineA,
      engineB,
    } satisfies FieldResult;
  });

  return {
    status: getRunStatus(fields),
    metadata: {
      ...result.metadata,
      saved_image_path: payload.saved_image_path,
    },
    fields,
    raw_result: payload,
  };
}
