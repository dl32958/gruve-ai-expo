export type FieldState = "pass" | "review_needed" | "fail";
export type FieldConfidence = "very_high" | "high" | "medium" | "low";
export type SelectedEngine = "engineA" | "engineB" | "none";
export type RunStatus = "idle" | "running" | "success" | "partial" | "failed";
export type PipelineStep = 1 | 2 | 3 | 4 | 5;

export interface FieldSignals {
  final_rule_consistency: number;
  final_engine_self_consistency: number;
  final_ocr_alignment: number;
  final_ocr_corruption: number;
}

export interface FieldSignalLabels {
  final_rule_consistency: string;
  final_engine_self_consistency: string;
  final_ocr_alignment: string;
  final_ocr_corruption: string;
}

export interface EngineExtraction {
  extracted_value: string;
  rule_consistency: number;
  engine_self_consistency: number;
  ocr_alignment: number;
  ocr_corruption: number;
  judgment_summary: string;
  constraint_summary: string[];
  field_extraction: Record<string, unknown>;
  evidence_trace: string[];
  reasoning: string;
}

export interface FieldResult {
  field_name: string;
  recommended_value: string;
  field_state: FieldState;
  field_confidence: FieldConfidence;
  selected_engine: SelectedEngine;
  selection_reason?: string;
  state_reason?: string;
  selected_engine_total_tokens?: number;
  selected_engine_elapsed_seconds?: number;
  signals: FieldSignals;
  signal_labels: FieldSignalLabels;
  engineA: EngineExtraction;
  engineB: EngineExtraction;
}

export interface Metadata {
  run_ts?: string;
  timestamp: string;
  elapsed_seconds: number;
  doc_category: string;
  fields: string[];
  debug: boolean;
  image_path?: string;
  annotated_image?: string;
  annotated_image_url?: string;
  saved_image_path?: string;
}

export interface RunResult {
  status: RunStatus;
  metadata: Metadata;
  fields: FieldResult[];
  raw_result: unknown;
}

export interface BackendFieldResult {
  recommended_value: string;
  selected_engine: SelectedEngine;
  selection_reason: string;
  selected_engine_total_tokens: number;
  selected_engine_elapsed_seconds: number;
  final_rule_consistency: string;
  final_engine_self_consistency: string;
  final_ocr_alignment: string;
  final_ocr_corruption: string;
  field_confidence: FieldConfidence;
  field_state: FieldState;
  state_reason: string;
}

export interface BackendFinalResult {
  metadata: Metadata;
  field_results: Record<string, BackendFieldResult>;
}

export interface BackendRunResponse {
  status: string;
  saved_image_path?: string;
  result: BackendFinalResult;
}

export interface DebugArtifacts {
  status: string;
  run_ts: string;
  raw_text: string;
  engineA_extraction: Record<string, unknown>;
  engineB_extraction: Record<string, unknown>;
  cross_judge: Record<string, unknown>;
}

export interface BackendJobCreateResponse {
  status: "accepted";
  job_id: string;
  saved_image_path?: string | null;
}

export interface BackendJobStatusResponse {
  status: "queued" | "running" | "completed" | "failed";
  job_id: string;
  saved_image_path?: string | null;
  result?: BackendFinalResult | null;
  error?: string | null;
}
