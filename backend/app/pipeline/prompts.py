from __future__ import annotations

import json


def _fields_str(fields: list[str]) -> str:
    return "\n".join(f"- {field}" for field in fields)


def build_constraints_prompt_a(raw_text, doc_category, fields):
    return f"""
You are a constraint inference engine for OCR-based information extraction.

Document category:
{doc_category}

Target fields:
{_fields_str(fields)}

OCR raw text:
{raw_text}

Your task:
Infer GENERAL validation constraints for each target field based on:
1. the document category
2. the OCR text patterns visible in this document
3. the likely semantic role of each field

Important:
These constraints are NOT the extracted field values.
They are reusable field-level validation hints that can later help evaluate whether a candidate value is credible.

Think at the level of:
- semantic type
- common text form
- likely context signals
- broad structural tendencies in text

Examples of useful constraint types:
- whether a field usually looks like a name, label, amount, date, identifier, short phrase, or multi-line text block
- whether a field tends to have numeric, alphabetic, mixed, or symbolic characters
- whether a field often appears with nearby cue words or local context
- whether a field is usually short, medium, or multi-line
- whether a field may contain delimiters, currency symbols, punctuation, or formatting markers

Rules:
- Be general and reusable.
- Do NOT copy exact values from the OCR text as constraints.
- Do NOT invent document-specific facts.
- Do NOT rely on exact position or page layout assumptions such as top, bottom, left, or right.
- Do NOT require strict regex-like rules unless they are truly fundamental.
- Prefer soft validation guidance over brittle hard rules.
- Keep each field's constraints concise and practical.

Return ONLY valid JSON in exactly this format:

{{
  "constraint_summary": {{
    {", ".join([f'"{field}": ["constraint 1", "constraint 2"]' for field in fields])}
  }}
}}
""".strip()


def build_constraints_prompt_b(raw_text, doc_category, fields):
    return build_constraints_prompt_a(raw_text, doc_category, fields)


def build_single_extraction_prompt(raw_text, constraint_trace, field, doc_category):
    return f"""
You are an information extraction engine for {doc_category} documents.

You are given:
1. OCR raw text from a {doc_category}
2. A constraint trace previously generated for this document

Your task:
Extract ONLY this field:
- {field}

For this field, provide:
1. field_extraction: the extracted value
2. evidence_trace: the most directly relevant supporting OCR text
3. reasoning: explain why this evidence supports the extraction and how the constraint trace helped

Important guidelines:
- Use only the OCR raw text and the constraint trace below.
- Do NOT use outside knowledge.
- If the field is partially visible or uncertain but still plausibly present, provide the best supported guess and mention the uncertainty in reasoning.
- If the field is not present in the OCR text, or no sufficiently supported candidate can be identified, you MUST return an empty string "" for field_extraction.
- Do NOT hallucinate a value.
- The evidence_trace should be SHORT, LOCAL, and DIRECTLY GROUNDED in the OCR text.
- Do NOT use large unrelated text blocks as evidence.
- The extracted value should be supported by the evidence_trace.
- If field_extraction is "", then evidence_trace must also be "", and reasoning should briefly explain that no sufficiently supported value was found.

Special rule for OCR noise:
- If the selected field value or supporting OCR evidence contains "?", preserve it exactly as-is.
- Do NOT remove, replace, or normalize question marks.
- Do NOT guess missing characters hidden by "?".

Return ONLY valid JSON in exactly this format:

{{
  "field_extraction": "",
  "evidence_trace": "",
  "reasoning": ""
}}

Constraint trace:
{constraint_trace}

OCR raw text:
{raw_text}
""".strip()


def build_rule_synthesis_prompt(engine_a_constraints_text, engine_b_constraints_text, doc_category, fields):
    consolidated_block = "\n".join(f'    "{field}": [],' for field in fields[:-1])
    consolidated_block += f'\n    "{fields[-1]}": []'
    return f"""
Return ONLY valid JSON.
Do not output explanations.

You are a rule synthesis engine for {doc_category} field evaluation.

Two extraction engines independently analyzed the OCR text and produced
field-level validation constraints.

Your task is to synthesize them into ONE shared set of consolidated checking rules
for evaluating the credibility of extracted fields.

Fields:
{_fields_str(fields)}

These rules will later be used for self-justification and cross-engine judgment.

--------------------------------
SYNTHESIS PRINCIPLES
--------------------------------
1. Do NOT simply merge or concatenate rules from both engines.
2. If two rules express similar ideas, merge them into ONE generalized rule.
3. Prefer generalized plausibility rules rather than strict schema validation.
4. Avoid overly brittle rules that depend on a specific OCR instance.
5. Preserve useful signals such as format clues, semantic meaning, local contextual clues in text, and numeric or textual patterns.
6. The goal is evaluation-oriented checking rules, not strict regex validation.
7. Each field should contain 3–5 compact checking rules.
8. synthesis_summary.notes should briefly summarize the main agreement or disagreement patterns between the two engines.
9. Keep synthesis_summary.notes short, concrete, and limited to one sentence.
10. Do not leave synthesis_summary.notes empty unless both engine outputs are completely uninformative.

--------------------------------
OUTPUT FORMAT
--------------------------------
Return JSON in EXACTLY this format:
{{
  "consolidated_rules": {{
{consolidated_block}
  }},
  "synthesis_summary": {{
    "agreement_level": "high | moderate | low",
    "notes": ""
  }}
}}

--------------------------------
ENGINE A OUTPUT
--------------------------------
{engine_a_constraints_text}

--------------------------------
ENGINE B OUTPUT
--------------------------------
{engine_b_constraints_text}
""".strip()


def build_stage2_prompt(field_name, rules, extracted_value, evidence_text, reasoning_text, ocr_raw_text, doc_category):
    return f"""
You are an evaluation model for {doc_category} field extraction reliability.

Your job is to evaluate whether the extracted value for one field is credible.

Return ONLY valid JSON. No explanation.

Field name:
{field_name}

Consolidated validation rules:
{json.dumps(rules, indent=2, ensure_ascii=False)}

Extracted value:
{extracted_value}

Evidence trace:
{evidence_text}

Engine reasoning:
{reasoning_text}

OCR raw text:
{ocr_raw_text}

Evaluation definitions:
1. rule_consistency:
How well the extracted value matches the consolidated validation rules for this field.

2. engine_self_consistency:
How well the engine's evidence trace and reasoning support its own extracted value.

3. ocr_alignment:
How well the extracted value is grounded in OCR raw text with the correct local semantic context for the target field.

Use the following scale:
- strong: the value is clearly grounded in OCR text, and the surrounding OCR context strongly supports that it belongs to the target field.
- partial: the value has some OCR support, but the surrounding context is incomplete, ambiguous, noisy, or only indirectly supportive.
- weak: the value is ungrounded, mismatched, coincidental, or supported by the wrong context.

4. ocr_corruption:
Whether the extracted value itself appears to contain OCR corruption.

Judge OCR corruption mainly from the extracted value string itself.
Focus on visible recognition artifacts in the text form, not just on whether the overall meaning seems plausible.

Use the following scale:
- absent: no obvious OCR corruption is present; the value appears clean, readable, and textually well-formed.
- possible: mild or uncertain OCR corruption may be present; the value is still partly readable, but some segments, characters, or symbols are questionable.
- present: obvious OCR corruption is present; the value contains clear recognition artifacts such as unexpected "?" characters, broken segments, unusual symbol substitutions, merged fragments, or corrupted text that makes the semantic meaning unclear.

General hints:
- Unexpected "?" characters inside a word, number, or phrase are strong evidence of OCR corruption.
- Strange symbol substitutions, broken fragments, or malformed character sequences may indicate OCR corruption even if part of the value is still readable.
- A value can still be semantically plausible while being OCR-corrupted.
- Clean punctuation alone does not imply corruption.
- Normal delimiters such as commas, periods, slashes, hyphens, ampersands, or parentheses are not OCR corruption by themselves.

Examples:
- absent:
  "2023-08-15"
  "123 Main Street"
  "Total: 45.90"
- possible:
  "2O23-08-15"
  "123 Main Stree1"
  "Tota1: 45.90"
- present:
  "2O?3-0?15"
  "123 Ma?n Str?et"
  "To?al: 4?.9O"

Important:
- OCR corruption does NOT automatically mean the value is wrong.
- A value may still be partially usable even if OCR corruption is present.
- Focus on whether corruption is absent, possible, or clearly present.

5. judgment_summary:
Write one short summary sentence explaining the overall credibility of the extracted value.
The summary must be consistent with the other output fields.
Do not introduce new evidence or new conclusions beyond:
- rule_consistency
- engine_self_consistency
- ocr_alignment
- ocr_corruption

Return JSON in exactly this format:

{{
  "extracted_value": "",
  "rule_consistency": "high | moderate | low",
  "engine_self_consistency": "strong | moderate | weak",
  "ocr_alignment": "strong | partial | weak",
  "ocr_corruption": "absent | possible | present",
  "judgment_summary": ""
}}
""".strip()


def build_cross_judge_prompt(field_name, consolidated_rules_for_field, engine_a_field_result, engine_b_field_result, doc_category):
    return f"""
Return ONLY valid JSON.
Do not output explanations.

You are a cross-engine judgment model for {doc_category} field extraction reliability.

Your task is to compare the self-justification results from engineA and engineB
for one field, and decide which extracted value is more credible.

Field name:
{field_name}

Consolidated checking rules:
{json.dumps(consolidated_rules_for_field, indent=2, ensure_ascii=False)}

EngineA result:
{json.dumps(engine_a_field_result, indent=2, ensure_ascii=False)}

EngineB result:
{json.dumps(engine_b_field_result, indent=2, ensure_ascii=False)}

Judgment instructions:
1. Compare the two candidate extractions and their stage-3B signals.
2. Select the more credible extracted value.
3. selected_engine must be exactly one of:
   - "engineA"
   - "engineB"
   - "none"
4. Use selected_engine = "none" only if neither engine provides a usable recommendation.
5. If selected_engine = "none", recommended_value must be an empty string.
6. Only when both engines provide equally strong and equally credible extractions, you may use engine efficiency as a secondary tiebreaker.
7. Engine efficiency is reflected by lower total_tokens and lower elapsed_seconds in the engine_metrics metadata.
8. Do NOT prefer a less credible extraction just because it is faster or cheaper.

Field confidence definition:
field_confidence should reflect the overall credibility of the recommended value,
based on:
- final_rule_consistency
- final_engine_self_consistency
- final_ocr_alignment
- final_ocr_corruption

Use the following scale:
- very_high: all major support signals are very strong, and OCR corruption is absent.
- high: support signals are strong overall, and OCR corruption is absent.
- medium: the value is still plausible, but one or more support signals is not strong,
  or OCR corruption is possible.
- low: the value is weakly supported, OCR corruption is present, or no usable value can be recommended.

Field state definitions:
- pass:
  use this only when OCR corruption is absent and the three main support signals
  (rule consistency, engine self-consistency, OCR alignment) are all strong.
- review_needed:
  use this when a usable candidate still exists, but OCR corruption is possible or present,
  or one or more of the three support signals is not strong.
- fail:
  use this when no usable candidate value is available,
  or when the three support signals are collectively too weak to justify a credible recommendation.

Important clarification:
- OCR corruption means recognition artifacts such as unexpected "?" characters,
  unusual symbol substitutions, broken segments, or corrupted text that makes the semantic meaning unclear.
- OCR corruption does NOT automatically mean fail.
- A non-empty but OCR-corrupted value should usually be labeled review_needed, not fail.
- Example: "NO.5? $5,57 & 59, JALAN SAGU 18" is OCR-corrupted text and should usually be treated as review_needed if it still provides a partially usable candidate.

State reason:
- state_reason explains why the final field_state is "review_needed" or "fail".
- If field_state = "pass", state_reason must be an empty string.
- If field_state = "review_needed" or "fail", state_reason must be a short, specific reason.

Decision rules:
- If selected_engine = "none" or recommended_value is empty, use field_state = "fail".
- If the recommended value is non-empty but OCR corruption is possible or present, use field_state = "review_needed".
- If OCR corruption is absent, and all three main support signals are strong, use field_state = "pass".
- If OCR corruption is absent, but one or more of the three support signals is not strong, use field_state = "review_needed".
- Use fail only when no usable recommendation exists, or the support signals are collectively too weak.

Consistency constraints:
- If field_state = "pass", field_confidence should be "high" or "very_high".
- If field_state = "review_needed", field_confidence should be "medium" or "low".
- If field_state = "fail", field_confidence must be "low".
- Do NOT output multiple engines.
- Do NOT output "engineA | engineB".

Return JSON in exactly this format:
{{
  "recommended_value": "",
  "selected_engine": "",
  "selection_reason": "",
  "final_rule_consistency": "high | moderate | low",
  "final_engine_self_consistency": "strong | moderate | weak",
  "final_ocr_alignment": "strong | partial | weak",
  "final_ocr_corruption": "absent | possible | present",
  "field_confidence": "very_high | high | medium | low",
  "field_state": "pass | review_needed | fail",
  "state_reason": ""
}}
""".strip()
