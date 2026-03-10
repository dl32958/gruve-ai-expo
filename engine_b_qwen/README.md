# Engine B – Qwen Extractor

Engine B is the Qwen-based extraction engine in the multi-engine invoice processing pipeline.

Its responsibility is limited to **extraction only**:
- read OCR text from a single `.txt` file
- extract the fields `company`, `date`, `address`, and `total`
- output a structured JSON object

It does **not** perform:
- OCR
- normalization
- evidence retrieval
- validity checking
- arbitration across engines

Those responsibilities belong to downstream shared modules in the overall architecture.

Example Run:
python -m engine_b_qwen.run \
  --input data/temp/X00016469612.txt \
  --output engine_b_qwen/outputs_engine_b/engine_b_qwen.jsonl \
  --model Qwen/Qwen2.5-3B-Instruct