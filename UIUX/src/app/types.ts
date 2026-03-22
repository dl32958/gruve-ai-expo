// Type definitions for the AI Judgment Dashboard

export type FieldState = 'pass' | 'review_needed' | 'fail';
export type FieldConfidence = 'very_high' | 'high' | 'medium' | 'low';
export type SelectedEngine = 'engineA' | 'engineB' | 'none';
export type RunStatus = 'idle' | 'running' | 'success' | 'partial' | 'failed';
export type PipelineStep = 1 | 2 | 3 | 4 | 5;

export type SignalLevel = 'very_high' | 'high' | 'strong' | 'medium' | 'low' | 'weak' | 'absent' | 'possible' | 'present';

export interface FieldSignals {
  final_rule_consistency: number;
  final_engine_self_consistency: number;
  final_ocr_alignment: number;
  final_ocr_corruption: number;
}

export interface EngineExtraction {
  extracted_value: string;
  rule_consistency: number;
  engine_self_consistency: number;
  ocr_alignment: number;
  ocr_corruption: number;
  judgment_summary: string;
  constraint_summary: string[];
  field_extraction: Record<string, any>;
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
  signals: FieldSignals;
  engineA: EngineExtraction;
  engineB: EngineExtraction;
}

export interface Metadata {
  timestamp: string;
  elapsed_seconds: number;
  doc_category: string;
  fields: string[];
  debug: boolean;
  image_path?: string;
}

export interface RunResult {
  status: RunStatus;
  metadata: Metadata;
  fields: FieldResult[];
  stage1_ocr_text: string;
  stage3_consolidated_rules: {
    rules: string[];
    agreement_level: string;
    notes: string;
  };
}