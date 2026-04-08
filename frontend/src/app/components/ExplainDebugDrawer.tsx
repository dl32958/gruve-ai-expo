import { useEffect, useState } from "react";
import { ChevronUp, Download } from "lucide-react";
import { toast } from "sonner";
import { getPipelineDebug } from "../api";
import type { DebugArtifacts, RunResult } from "../types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";

interface ExplainDebugDrawerProps {
  result: RunResult | null;
}

export function ExplainDebugDrawer({ result }: ExplainDebugDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"ocr" | "extraction" | "judgment">("ocr");
  const [debugData, setDebugData] = useState<DebugArtifacts | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!result) return null;

  useEffect(() => {
    if (!isOpen || !result.metadata.debug || !result.metadata.run_ts || debugData?.run_ts === result.metadata.run_ts) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    getPipelineDebug(result.metadata.run_ts)
      .then((payload) => {
        if (!cancelled) {
          setDebugData(payload);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Failed to load debug artifacts";
          toast.error(message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, result.metadata.debug, result.metadata.run_ts, debugData?.run_ts]);

  useEffect(() => {
    setDebugData(null);
    setActiveTab("ocr");
  }, [result.metadata.run_ts]);

  const downloadJSON = (data: unknown, filename: string) => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}`);
  };

  return (
    <div className="border-t bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full h-12 flex items-center justify-between px-6 hover:bg-gray-50 dark:hover:bg-gray-900 text-base font-semibold"
          >
            <span>Technical Details & Debug Info</span>
            <ChevronUp className={`h-5 w-5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-6 border-t max-h-[400px] overflow-y-auto border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Technical Details</h3>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{result.metadata.doc_category}</Badge>
                {result.metadata.debug ? <Badge variant="secondary">Debug On</Badge> : null}
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Debug View</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!result.metadata.debug ? (
                  <p className="text-sm text-gray-500">Debug mode was not enabled for this run.</p>
                ) : isLoading ? (
                  <p className="text-sm text-gray-500">Loading debug artifacts...</p>
                ) : !debugData ? (
                  <p className="text-sm text-gray-500">Debug artifacts are not available for this run.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2 rounded-xl bg-gray-100 p-1 dark:bg-gray-900">
                      <button
                        className={`rounded-lg px-3 py-2 text-sm font-medium ${
                          activeTab === "ocr" ? "bg-white shadow-sm dark:bg-gray-800" : "text-gray-600 dark:text-gray-400"
                        }`}
                        onClick={() => setActiveTab("ocr")}
                        type="button"
                      >
                        OCR Text
                      </button>
                      <button
                        className={`rounded-lg px-3 py-2 text-sm font-medium ${
                          activeTab === "extraction" ? "bg-white shadow-sm dark:bg-gray-800" : "text-gray-600 dark:text-gray-400"
                        }`}
                        onClick={() => setActiveTab("extraction")}
                        type="button"
                      >
                        Engine Extraction
                      </button>
                      <button
                        className={`rounded-lg px-3 py-2 text-sm font-medium ${
                          activeTab === "judgment" ? "bg-white shadow-sm dark:bg-gray-800" : "text-gray-600 dark:text-gray-400"
                        }`}
                        onClick={() => setActiveTab("judgment")}
                        type="button"
                      >
                        Final Judgment
                      </button>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadJSON(debugData, `debug_${debugData.run_ts}.json`)}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Download
                      </Button>
                    </div>

                    {activeTab === "ocr" ? (
                      <pre className="text-sm whitespace-pre-wrap font-mono bg-gray-50 dark:bg-gray-900 p-4 rounded max-h-64 overflow-y-auto leading-relaxed">
                        {debugData.raw_text || "No OCR text available."}
                      </pre>
                    ) : null}

                    {activeTab === "extraction" ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        <ExtractionSummary title="Engine A" data={debugData.engineA_extraction} />
                        <ExtractionSummary title="Engine B" data={debugData.engineB_extraction} />
                      </div>
                    ) : null}

                    {activeTab === "judgment" ? <CrossJudgeSummary data={debugData.cross_judge} /> : null}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function ExtractionSummary({ title, data }: { title: string; data: Record<string, unknown> }) {
  const fieldExtraction = asRecord(data.field_extraction);
  const evidenceTrace = asRecord(data.evidence_trace);
  const reasoning = asRecord(data.reasoning);
  const engineMetrics = asRecord(data.engine_metrics);
  const fields = Object.keys(fieldExtraction);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.keys(engineMetrics).length > 0 ? (
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
            <MetricRow label="Total Tokens" value={String(engineMetrics.total_tokens ?? "0")} />
            <MetricRow label="Elapsed" value={`${Number(engineMetrics.elapsed_seconds ?? 0).toFixed(4)}s`} />
          </div>
        ) : null}

        {fields.length === 0 ? (
          <p className="text-sm text-gray-500">No extraction details available.</p>
        ) : (
          <div className="space-y-3">
            {fields.map((fieldName) => (
              <div key={fieldName} className="rounded-lg border bg-gray-50 p-3 dark:bg-gray-900">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">{fieldName}</span>
                </div>
                <div className="space-y-2 text-sm">
                  <LabeledBlock label="Extracted Value" value={stringValue(fieldExtraction[fieldName]) || "N/A"} />
                  <LabeledBlock label="Evidence" value={stringValue(evidenceTrace[fieldName]) || "N/A"} />
                  <LabeledBlock label="Reasoning" value={stringValue(reasoning[fieldName]) || "N/A"} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CrossJudgeSummary({ data }: { data: Record<string, unknown> }) {
  const fieldResults = asRecord(data.field_results);
  const fields = Object.entries(fieldResults);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Cross Judgment</CardTitle>
      </CardHeader>
      <CardContent>
        {fields.length === 0 ? (
          <p className="text-sm text-gray-500">No final judgment details available.</p>
        ) : (
          <div className="space-y-3">
            {fields.map(([fieldName, rawValue]) => {
              const value = asRecord(rawValue);
              return (
                <div key={fieldName} className="rounded-lg border bg-gray-50 p-3 dark:bg-gray-900">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold">{fieldName}</span>
                    <Badge variant={badgeVariantForState(stringValue(value.field_state))}>
                      {prettyLabel(stringValue(value.field_state) || "unknown")}
                    </Badge>
                  </div>
                  <div className="grid gap-2 text-sm md:grid-cols-2">
                    <LabeledBlock label="Recommended Value" value={stringValue(value.recommended_value) || "N/A"} />
                    <LabeledBlock label="Selected Engine" value={stringValue(value.selected_engine) || "N/A"} />
                    <LabeledBlock label="Confidence" value={prettyLabel(stringValue(value.field_confidence) || "N/A")} />
                    <LabeledBlock label="OCR Corruption" value={prettyLabel(stringValue(value.final_ocr_corruption) || "N/A")} />
                  </div>
                  <div className="mt-2 space-y-2 text-sm">
                    <LabeledBlock label="Selection Reason" value={stringValue(value.selection_reason) || "N/A"} />
                    {stringValue(value.state_reason) ? (
                      <LabeledBlock label="State Reason" value={stringValue(value.state_reason) || ""} />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LabeledBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</span>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-gray-50 px-3 py-2 dark:bg-gray-900">
      <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{value}</div>
    </div>
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function stringValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value == null) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function prettyLabel(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function badgeVariantForState(
  state: string | undefined,
): "default" | "secondary" | "destructive" | "outline" {
  if (state === "pass") return "default";
  if (state === "review_needed") return "secondary";
  if (state === "fail") return "destructive";
  return "outline";
}
