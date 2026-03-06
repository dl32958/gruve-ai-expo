# Engine B – Qwen Extractor

Engine B is an LLM-based invoice field extraction module using Qwen. It converts OCR-extracted invoice text into structured JSON that matches the dataset ground-truth schema. This module is part of a multi-engine architecture and produces outputs that are evaluated by a downstream Triangulation / Judgment Agent.

INPUT FORMAT
Each record must follow:
{
  "doc_id": "string",
  "ocr_text": "full OCR text of the invoice"
}

Notes:
- OCR must be completed upstream.
- This module does not process images.
- OCR coordinate lines should be converted to readable text before inference.

OUTPUT FORMAT
For each input record, the module returns:
{
  "doc_id": "string",
  "company": "string | null",
  "date": "string | null",
  "address": "string | null",
  "total": "string | null"
}

Formatting Rules:
- Missing fields must be returned as null.
- Date format must match dataset convention (e.g., DD/MM/YYYY if present).
- Total must be returned as a numeric string with two decimals (e.g., "193.00").
- Output must contain only the defined keys.

RESPONSIBILITIES
This module:
- Accepts OCR text
- Uses Qwen to extract structured fields
- Validates and normalizes output
- Produces ground-truth comparable JSON

This module does NOT:
- Perform OCR
- Assign confidence scores
- Compare against ground truth
- Perform cross-engine triangulation

EXECUTION (LOCAL)
Example:
python -m engine_b_qwen.run --input data/ocr.jsonl --output outputs/engine_b_qwen.jsonl

Design Principles:
- Deterministic output structure
- Strict schema compliance
- Null over hallucination
- Modular and replaceable within the larger system

to run:
rm -f outputs/engine_b_qwen.jsonl

python -m engine_b_qwen.run \
  --input data/ocr.jsonl \
  --output outputs/engine_b_qwen.jsonl \
  --model Qwen/Qwen2.5-0.5B-Instruct \
  --device mps \
  --max_new_tokens 96