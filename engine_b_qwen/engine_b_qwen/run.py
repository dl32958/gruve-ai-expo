import argparse
import json
import os
from typing import Dict, Iterable, Optional, Set

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

from .schema import validate_output
from .utils import clean_ocr_text, extract_first_json_object, postprocess_fields


def load_prompt(prompt_path: str) -> str:
    with open(prompt_path, "r", encoding="utf-8") as f:
        return f.read()


def iter_jsonl(path: str) -> Iterable[Dict]:
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)


def load_done_doc_ids(output_path: str) -> Set[str]:
    done = set()
    if not os.path.exists(output_path):
        return done
    with open(output_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                doc_id = obj.get("doc_id")
                if isinstance(doc_id, str):
                    done.add(doc_id)
            except Exception:
                continue
    return done


def build_model(model_name: str, device: str):
    tokenizer = AutoTokenizer.from_pretrained(model_name, use_fast=True)

    # Some Qwen models need padding side set; safe default
    tokenizer.padding_side = "left"
    if tokenizer.pad_token is None and tokenizer.eos_token is not None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        torch_dtype=torch.float16 if device.startswith("cuda") else torch.float32,
        device_map="auto" if device.startswith("cuda") else None,
    )

    if not device.startswith("cuda"):
        model.to(device)

    model.eval()
    return tokenizer, model


@torch.no_grad()
def qwen_extract(
    tokenizer,
    model,
    prompt_template: str,
    ocr_text: str,
    max_new_tokens: int = 256,
) -> str:
    user_content = prompt_template.replace("{{OCR_TEXT}}", ocr_text)

    messages = [
        {"role": "system", "content": "You are a careful invoice information extraction system."},
        {"role": "user", "content": user_content},
    ]

    prompt = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True
    )

    inputs = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=4096)
    inputs = {k: v.to(model.device) for k, v in inputs.items()}

    outputs = model.generate(
        **inputs,
        max_new_tokens=max_new_tokens,
        do_sample=False,      # deterministic
        temperature=0.0,
        top_p=1.0,
        repetition_penalty=1.05,
        eos_token_id=tokenizer.eos_token_id,
        pad_token_id=tokenizer.pad_token_id,
    )

    decoded = tokenizer.decode(outputs[0], skip_special_tokens=True)

    # Try to return only the assistant's generated portion
    if decoded.startswith(prompt):
        return decoded[len(prompt):].strip()
    return decoded.strip()


def process_record(
    doc_id: str,
    ocr_text: str,
    tokenizer,
    model,
    prompt_template: str,
) -> Dict:
    ocr_text = clean_ocr_text(ocr_text)

    raw = qwen_extract(tokenizer, model, prompt_template, ocr_text)
    obj = extract_first_json_object(raw)

    if obj is None:
        # Hard-fail into nulls (still schema-compatible) rather than crashing
        obj = {"company": None, "date": None, "address": None, "total": None}

    obj = postprocess_fields(obj)

    # Validate strictly (will raise if date/total formatting violates schema)
    validated = validate_output(obj)

    return {
        "doc_id": doc_id,
        "company": validated.company,
        "date": validated.date,
        "address": validated.address,
        "total": validated.total,
    }


def main():
    parser = argparse.ArgumentParser(description="Engine B (Qwen) - OCR text to invoice fields.")
    parser.add_argument("--input", required=True, help="Path to input JSONL with {doc_id, ocr_text}.")
    parser.add_argument("--output", required=True, help="Path to output JSONL.")
    parser.add_argument("--model", required=True, help="HuggingFace model name/path for Qwen.")
    parser.add_argument("--prompt", default=os.path.join(os.path.dirname(__file__), "prompt.md"))
    parser.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    parser.add_argument("--max_new_tokens", type=int, default=256)
    args = parser.parse_args()

    prompt_template = load_prompt(args.prompt)
    tokenizer, model = build_model(args.model, args.device)

    done = load_done_doc_ids(args.output)

    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)

    with open(args.output, "a", encoding="utf-8") as out_f:
        for rec in iter_jsonl(args.input):
            doc_id = rec.get("doc_id")
            ocr_text = rec.get("ocr_text")

            if not isinstance(doc_id, str):
                continue
            if doc_id in done:
                continue
            if not isinstance(ocr_text, str):
                ocr_text = ""

            result = process_record(doc_id, ocr_text, tokenizer, model, prompt_template)
            out_f.write(json.dumps(result, ensure_ascii=False) + "\n")
            out_f.flush()
            done.add(doc_id)


if __name__ == "__main__":
    main()