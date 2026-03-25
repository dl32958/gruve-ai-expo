from __future__ import annotations

import gc
import time

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer


def load_model_and_tokenizer(model_path: str):
    tokenizer = AutoTokenizer.from_pretrained(model_path, trust_remote_code=True)
    model = AutoModelForCausalLM.from_pretrained(
        model_path,
        dtype=torch.float16,
        device_map="auto",
        trust_remote_code=True,
    )
    return tokenizer, model


def run_chat_inference(
    model,
    tokenizer,
    prompt: str,
    max_new_tokens: int = 1200,
    return_usage: bool = False,
):
    messages = [{"role": "user", "content": prompt}]
    text = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True,
    )
    inputs = tokenizer(text, return_tensors="pt").to(model.device)
    prompt_tokens = int(inputs["input_ids"].shape[1])
    started_at = time.time()

    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            do_sample=False,
        )

    elapsed_seconds = round(time.time() - started_at, 4)
    completion_tokens = int(outputs[0].shape[0] - inputs["input_ids"].shape[1])

    response = tokenizer.decode(
        outputs[0][inputs["input_ids"].shape[1] :],
        skip_special_tokens=True,
    )
    if not return_usage:
        return response

    usage = {
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": prompt_tokens + completion_tokens,
        "elapsed_seconds": elapsed_seconds,
    }
    return response, usage


def release_model(model=None, tokenizer=None) -> None:
    del model
    del tokenizer
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
