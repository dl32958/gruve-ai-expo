import type { BackendJobCreateResponse, BackendJobStatusResponse, BackendRunResponse } from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");
const JOB_POLL_INTERVAL_MS = 2000;
const JOB_TIMEOUT_MS = 20 * 60 * 1000;

function buildApiUrl(path: string) {
  if (!API_BASE) return path;
  return `${API_BASE}${path}`;
}

export function buildArtifactUrl(path: string | undefined) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  if (!API_BASE) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

async function createUploadJob({
  file,
  docCategory,
  fieldsText,
  debug,
}: {
  file: File;
  docCategory: string;
  fieldsText: string;
  debug: boolean;
}): Promise<BackendJobCreateResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("doc_category", docCategory);
  formData.append("fields", fieldsText);
  formData.append("debug", String(debug));

  const response = await fetch(buildApiUrl("/pipeline/jobs/run"), {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error((await response.text()) || "Upload job request failed");
  }

  return response.json();
}

async function createPathJob({
  imagePath,
  docCategory,
  fields,
  debug,
}: {
  imagePath: string;
  docCategory: string;
  fields: string[];
  debug: boolean;
}): Promise<BackendJobCreateResponse> {
  const response = await fetch(buildApiUrl("/pipeline/jobs/run-from-path"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image_path: imagePath,
      doc_category: docCategory,
      fields,
      debug,
    }),
  });

  if (!response.ok) {
    throw new Error((await response.text()) || "Path job request failed");
  }

  return response.json();
}

async function getJobStatus(jobId: string): Promise<BackendJobStatusResponse> {
  const response = await fetch(buildApiUrl(`/pipeline/jobs/${encodeURIComponent(jobId)}`));

  if (!response.ok) {
    throw new Error((await response.text()) || "Job status request failed");
  }

  return response.json();
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForJob(jobId: string): Promise<BackendJobStatusResponse> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < JOB_TIMEOUT_MS) {
    const job = await getJobStatus(jobId);

    if (job.status === "completed") {
      return job;
    }

    if (job.status === "failed") {
      throw new Error(job.error || "Pipeline job failed");
    }

    await sleep(JOB_POLL_INTERVAL_MS);
  }

  throw new Error("Pipeline job timed out");
}

export async function runPipelineUpload({
  file,
  docCategory,
  fieldsText,
  debug,
}: {
  file: File;
  docCategory: string;
  fieldsText: string;
  debug: boolean;
}) {
  const job = await createUploadJob({ file, docCategory, fieldsText, debug });
  const completed = await waitForJob(job.job_id);
  if (!completed.result) {
    throw new Error("Pipeline job completed without a result");
  }

  return {
    status: "ok",
    saved_image_path: completed.saved_image_path ?? job.saved_image_path ?? undefined,
    result: completed.result,
  } satisfies BackendRunResponse;
}

export async function runPipelineFromPath({
  imagePath,
  docCategory,
  fields,
  debug,
}: {
  imagePath: string;
  docCategory: string;
  fields: string[];
  debug: boolean;
}) {
  const job = await createPathJob({ imagePath, docCategory, fields, debug });
  const completed = await waitForJob(job.job_id);
  if (!completed.result) {
    throw new Error("Pipeline job completed without a result");
  }

  return {
    status: "ok",
    saved_image_path: completed.saved_image_path ?? job.saved_image_path ?? undefined,
    result: completed.result,
  } satisfies BackendRunResponse;
}

export async function getPipelineDebug(runTs: string) {
  const response = await fetch(buildApiUrl(`/pipeline/debug/${encodeURIComponent(runTs)}`));

  if (!response.ok) {
    throw new Error((await response.text()) || "Debug artifacts request failed");
  }

  return response.json();
}
