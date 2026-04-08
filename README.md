# Triangulation Judgment System

AI-powered document extraction and judgment system developed in collaboration with [Gruve AI](https://gruve.ai/), using multi-engine triangulation and cross-model adjudication to improve trustworthiness of LLM outputs.

## Overview

This project was built as a trustworthiness study around LLM-based document understanding.

Gruve AI builds enterprise-level AI-agent products, and one of their core challenges is convincing clients that LLM outputs are trustworthy. This project explores that question through a document extraction setting, where the system must not only extract structured values, but also justify whether those values should be trusted.

Instead of relying on a single model output, the system uses:

- multiple extraction engines
- evidence-backed reasoning
- rule synthesis
- cross-model judgment

The final result is not just an extracted field value, but a structured decision that includes confidence, OCR-related signals, selection rationale, and downloadable artifacts for inspection.

The project was developed and evaluated in the Northeastern University (NEU) HPC environment, where the backend inference workflow runs with GPU-backed resources.

## Key Features

- Multi-engine field extraction for structured document understanding
- Constraint synthesis and evidence-backed extraction reasoning
- Cross-model judgment for final value selection
- OCR-aware trust signals such as alignment and corruption assessment
- Async job-based backend workflow for long-running inference
- Annotated artifact export and structured debug retrieval
- Full-stack interface with a React frontend and FastAPI backend
- Supports multiple document categories, including receipts, invoices, and menus, through field-configurable extraction and judgment workflows

## Screenshots

### Main Interface

![Main interface](screenshots/interface.jpg)

### Analysis Results

![Analysis results](screenshots/result.jpg)

### Debug View

![Debug view](screenshots/debug1.jpg)

Additional screenshots are available in the [`screenshots/`](screenshots/) directory.

## System Architecture

At a high level, the system consists of:

- `frontend/`: the current React/Vite UI for upload, analysis, result browsing, export, and debug viewing
- `backend/`: a FastAPI service that exposes job APIs and runs the document judgment pipeline
- OCR + model engines: OCR produces raw text and grounding information; multiple LLM engines then perform extraction and judgment

High-level flow:

1. User uploads a document or provides a server-side image path
2. OCR extracts raw text and grounding information
3. Multiple engines infer field-level constraints and generate candidate field values
4. Each engine produces evidence trace and reasoning for its extraction
5. An evaluator model performs rule synthesis, self-justification, and cross-judgment
6. The backend returns final results, debug data, and downloadable artifacts

## Pipeline Flow

The main pipeline is organized into the following stages:

1. **OCR**  
   Extract raw OCR text, word-level grounding information, and the working image.

2. **Constraint Inference**  
   Each extraction engine infers field-specific constraints describing what a valid value should satisfy.

3. **Field Extraction**  
   Each engine extracts candidate values for the requested fields and records evidence trace, reasoning, and engine usage metrics.

4. **Rule Synthesis**  
   An evaluator model consolidates engine-specific constraints into shared field-level rules.

5. **Self-Justification**  
   Each engine’s candidate output is evaluated against rules, OCR evidence, and its own reasoning.

6. **Cross-Judgment**  
   A final evaluator compares engine outputs and selects the most trustworthy result.

7. **Artifacts and Final Result**  
   The system produces final structured output, debug payloads, and annotated artifacts.

## Repository Structure

```text
.
├── backend/            # FastAPI backend and pipeline orchestration
├── frontend/           # current UI integrated with real backend APIs
├── data/
│   ├── dev/            # local test documents (gitignored)
│   ├── uploads/        # runtime uploads (gitignored)
│   └── artifacts/
│       ├── debug/      # debug outputs (gitignored)
│       └── annotated/  # annotated artifacts (gitignored)
├── pipeline_studies/   # experimental studies and supporting work
├── screenshots/        # project screenshots
└── environment.yml / deepseek-ocr2.yml
```

## API Overview

Core backend endpoints:

- `GET /health`  
  Health check

- `POST /pipeline/run`  
  Synchronous upload-based run

- `POST /pipeline/run-from-path`  
  Synchronous run from a server-side image path

- `POST /pipeline/jobs/run`  
  Create an async job from an uploaded image

- `POST /pipeline/jobs/run-from-path`  
  Create an async job from a server-side image path

- `GET /pipeline/jobs/{job_id}`  
  Poll async job status and retrieve results

- `GET /pipeline/debug/{run_ts}`  
  Retrieve structured debug information for a completed run

## Running the Project

### Backend

Create and activate your Python environment, then install dependencies:

```bash
cd backend
pip install -r requirements.txt
```

Start the FastAPI service:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Model Path Configuration

Before running the backend, you must configure the local paths to the required models in:

```text
backend/app/config.py
```

In particular, make sure the model path settings point to valid local checkpoints in your own environment, such as the extraction engines and evaluator model paths. These paths are not portable across machines and should be updated by each user before running the pipeline.

### Frontend

The current frontend lives in `frontend/`.

Install dependencies:

```bash
cd frontend
npm install
```

For local development:

```bash
npm run dev
```

For production-style preview:

```bash
npm run build
npx vite preview --host 0.0.0.0 --port 5173
```

### Frontend Environment Variable

Set the backend base URL in:

```text
frontend/.env.local
```

Example:

```env
VITE_API_BASE=https://your-backend-host
```

In HPC / Open OnDemand environments, this should point to the backend reverse-proxy URL.

## Environment Files

This project currently uses two Conda environment specifications:

- `env_backend.yml`  
  Main backend environment for FastAPI, pipeline orchestration, and the primary inference workflow

- `env_frontend.yml`  
  Auxiliary environment used for the frontend-side runtime setup in the NEU HPC workflow

The project was developed in the NEU HPC environment, so these environment files reflect the practical runtime setup used during development and experimentation.

## Data and Artifacts

The project uses the following runtime directories:

- `data/dev/`  
  Local development and test images

- `data/uploads/`  
  Uploaded inputs created during runs

- `data/artifacts/debug/`  
  Debug JSON / text outputs for completed runs

- `data/artifacts/annotated/`  
  Annotated documents and exported artifacts

These runtime directories are intentionally gitignored.

## Export and Debug Outputs

The system can produce:

- final structured extraction results (`final_result.json`)
- annotated artifact downloads
- OCR raw text
- engine extraction debug outputs
- cross-judgment outputs

The current UI also supports:

- exporting final analysis results
- downloading annotated artifacts when available
- browsing structured debug information

## Current Limitations

- Frontend supports queued multi-file submission, but backend jobs are still handled one image at a time
- OCR corruption detection is still prompt-sensitive and benefits from iterative prompt refinement
- The current system is optimized for trust-oriented analysis rather than high-throughput batch processing

## Future Work

- Native backend batch APIs and queue/worker execution
- Stronger trust calibration and corruption-aware judgment
- Richer debug and audit visualizations
- More document categories and benchmark coverage

## Tech Stack

- **Frontend:** React, Vite
- **Backend:** FastAPI
- **Orchestration:** LangGraph
- **Tracing:** Langfuse
- **Inference:** multi-engine LLM pipeline
- **Runtime:** HPC / GPU-backed execution

## Acknowledgments

This project was developed in collaboration with [Gruve AI](https://gruve.ai/) as part of a study on improving the trustworthiness of LLM outputs for enterprise document understanding workflows.

We thank [Prof. Ruidong Ma](https://coe.northeastern.edu/people/ma-ruidong/) for his guidance and support throughout the project.

We also thank Northeastern University for providing HPC resources that supported development, experimentation, and GPU-backed execution for this project.
