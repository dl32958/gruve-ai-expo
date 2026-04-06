import { useEffect, useRef, useState } from "react";
import { Download, Moon, Sun, Zap } from "lucide-react";
import { toast } from "sonner";
import { adaptBackendRunResponse } from "./adapters";
import { runPipelineUpload } from "./api";
import { ThemeProvider, useTheme } from "./ThemeContext";
import { dark, light } from "./tokens";
import { ExplainDebugDrawer } from "./components/ExplainDebugDrawer";
import { FieldDrawer } from "./components/FieldDrawer";
import { HistorySidebar } from "./components/HistorySidebar";
import { ModernFieldCard } from "./components/ModernFieldCard";
import { RunControls } from "./components/RunControls";
import { UploadSection, type QueueItem } from "./components/UploadSection";
import { Toaster } from "./components/ui/sonner";
import type { FieldResult, PipelineStep, RunResult } from "./types";

function AppShell() {
  const { theme, toggle } = useTheme();
  const tokens = theme === "dark" ? dark : light;

  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState<PipelineStep | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [history, setHistory] = useState<RunResult[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedField, setSelectedField] = useState<FieldResult | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [category, setCategory] = useState("");
  const [fields, setFields] = useState<string[]>(["company", "date", "address", "total"]);

  const processingRef = useRef(false);
  const progressTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) {
        window.clearInterval(progressTimerRef.current);
      }
    };
  }, []);

  const startStepAnimation = () => {
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
    }

    setCurrentStep(1);
    progressTimerRef.current = window.setInterval(() => {
      setCurrentStep((prev) => {
        if (!prev) return 1;
        return prev >= 5 ? 5 : ((prev + 1) as PipelineStep);
      });
    }, 2500);
  };

  const stopStepAnimation = () => {
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setCurrentStep(null);
  };

  const updateItemStatus = (id: string, status: QueueItem["status"]) =>
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));

  const processItem = async (item: QueueItem): Promise<RunResult> => {
    const response = await runPipelineUpload({
      file: item.file,
      docCategory: category,
      fieldsText: fields.join(","),
      debug: debugMode,
    });
    return adaptBackendRunResponse(response);
  };

  const runQueue = async (currentQueue: QueueItem[]) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setIsRunning(true);
    startStepAnimation();

    try {
      for (const item of currentQueue.filter((entry) => entry.status === "pending")) {
        setActiveItemId(item.id);
        updateItemStatus(item.id, "processing");

        try {
          const nextResult = await processItem(item);
          updateItemStatus(item.id, "done");
          setResult(nextResult);
          setHistory((prev) => [nextResult, ...prev].slice(0, 20));
          toast.success(`Completed ${item.name}`);
        } catch (error) {
          updateItemStatus(item.id, "error");
          const message = error instanceof Error ? error.message : `Failed: ${item.name}`;
          toast.error(message);
        }
      }
    } finally {
      setActiveItemId(null);
      stopStepAnimation();
      setIsRunning(false);
      processingRef.current = false;
    }
  };

  const handleRun = () => {
    if (!category || queue.filter((item) => item.status === "pending").length === 0 || isRunning) return;
    runQueue(queue);
  };

  const handleNewChat = () => {
    if (isRunning) return;
    setResult(null);
    setQueue([]);
    setActiveItemId(null);
    setCategory("");
    setFields(["company", "date", "address", "total"]);
    setSelectedField(null);
  };

  const downloadFinalResult = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result.raw_result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "final_result.json";
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded final_result.json");
  };

  const pendingCount = queue.filter((item) => item.status === "pending").length;
  const canRun = pendingCount > 0 && !!category && !isRunning;

  const sortedFields = result
    ? [...result.fields].sort(
        (a, b) =>
          { fail: 0, review_needed: 1, pass: 2 }[a.field_state] -
          { fail: 0, review_needed: 1, pass: 2 }[b.field_state],
      )
    : [];

  const passCount = result?.fields.filter((field) => field.field_state === "pass").length ?? 0;
  const reviewCount = result?.fields.filter((field) => field.field_state === "review_needed").length ?? 0;
  const failCount = result?.fields.filter((field) => field.field_state === "fail").length ?? 0;

  const resultLabel = result?.metadata
    ? `${result.metadata.doc_category}${result.metadata.image_path ? ` · ${result.metadata.image_path}` : ""}`
    : "";

  const headerBtn: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "5px 12px",
    fontSize: "11px",
    letterSpacing: "0.06em",
    border: `1px solid ${tokens.border}`,
    color: tokens.gold,
    background: tokens.goldFaint,
    cursor: "pointer",
    fontFamily: "var(--font-mono)",
    textTransform: "uppercase",
    transition: "all 0.15s",
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        overflow: "hidden",
        background: tokens.bg,
        fontFamily: "var(--font-mono)",
        transition: "background 0.3s",
      }}
    >
      <div
        style={{
          position: "fixed",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "600px",
          height: "1px",
          boxShadow: `0 0 120px 40px ${tokens.goldDim}`,
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <HistorySidebar
        history={history}
        currentResult={result}
        onSelectHistory={setResult}
        onDeleteHistory={(index) => {
          setHistory((prev) => prev.filter((_, idx) => idx !== index));
          toast.success("Deleted");
        }}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onNewChat={handleNewChat}
        tokens={tokens}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, position: "relative", zIndex: 1 }}>
        <div
          style={{
            height: "56px",
            borderBottom: `1px solid ${tokens.border}`,
            background: theme === "dark" ? "rgba(6,6,10,0.95)" : "rgba(245,242,235,0.95)",
            backdropFilter: "blur(20px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                border: `1px solid ${tokens.borderHover}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: tokens.goldFaint,
                position: "relative",
              }}
            >
              <Zap size={14} style={{ color: tokens.gold }} />
              <div style={{ position: "absolute", inset: "-1px", boxShadow: `0 0 12px ${tokens.goldDim}`, pointerEvents: "none" }} />
            </div>
            <div>
              <div
                style={{
                  fontFamily: "Syne, sans-serif",
                  fontWeight: 700,
                  fontSize: "14px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: tokens.text,
                }}
              >
                GRUVE
              </div>
              <div style={{ fontSize: "10px", color: tokens.textMuted, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: "-2px" }}>
                Document Intelligence
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {result && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px" }}>
                  <span style={{ color: tokens.green }}>■ {passCount}</span>
                  <span style={{ color: tokens.textGhost }}>/</span>
                  <span style={{ color: tokens.yellow }}>■ {reviewCount}</span>
                  <span style={{ color: tokens.textGhost }}>/</span>
                  <span style={{ color: tokens.red }}>■ {failCount}</span>
                </div>
                <span style={{ color: tokens.border }}>|</span>
                <span style={{ fontSize: "11px", color: tokens.textMuted }}>{result.metadata.elapsed_seconds.toFixed(2)}s</span>
                <button
                  style={headerBtn}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = tokens.goldDim;
                    e.currentTarget.style.borderColor = tokens.borderHover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = tokens.goldFaint;
                    e.currentTarget.style.borderColor = tokens.border;
                  }}
                  onClick={downloadFinalResult}
                >
                  <Download size={11} /> Export
                </button>
              </>
            )}

            <button
              onClick={toggle}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              style={{
                width: "32px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `1px solid ${tokens.border}`,
                background: tokens.goldFaint,
                cursor: "pointer",
                color: tokens.gold,
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = tokens.goldDim;
                e.currentTarget.style.borderColor = tokens.borderHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = tokens.goldFaint;
                e.currentTarget.style.borderColor = tokens.border;
              }}
            >
              {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
            </button>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div
            style={{
              width: "380px",
              flexShrink: 0,
              borderRight: `1px solid ${tokens.border}`,
              background: tokens.bgPanel,
              display: "flex",
              flexDirection: "column",
              transition: "background 0.3s",
            }}
          >
            <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
              <div style={{ marginBottom: "28px" }}>
                <div style={{ fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: tokens.textMuted, marginBottom: "4px" }}>
                  Input
                </div>
                <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "20px", color: tokens.text }}>Configure Analysis</div>
              </div>
              <UploadSection
                queue={queue}
                onQueueChange={setQueue}
                activeItemId={activeItemId}
                category={category}
                onCategoryChange={setCategory}
                fields={fields}
                onFieldsChange={setFields}
                tokens={tokens}
              />
            </div>
            <div style={{ padding: "20px 24px", borderTop: `1px solid ${tokens.border}`, flexShrink: 0 }}>
              <RunControls
                onRun={handleRun}
                isRunning={isRunning}
                currentStep={currentStep}
                debugMode={debugMode}
                onDebugModeChange={setDebugMode}
                canRun={canRun}
                pendingCount={pendingCount}
                tokens={tokens}
              />
            </div>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: tokens.bg, transition: "background 0.3s" }}>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {!result ? (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px" }}>
                  <div style={{ textAlign: "center", maxWidth: "360px" }}>
                    <div
                      style={{
                        width: "64px",
                        height: "64px",
                        margin: "0 auto 24px",
                        border: `1px solid ${tokens.border}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                      }}
                    >
                      <Zap size={24} style={{ color: tokens.border }} />
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          style={{
                            position: "absolute",
                            ...(i === 0 ? { top: "-4px", left: "-4px", borderTop: `2px solid ${tokens.borderHover}`, borderLeft: `2px solid ${tokens.borderHover}`, width: "10px", height: "10px" } : {}),
                            ...(i === 1 ? { top: "-4px", right: "-4px", borderTop: `2px solid ${tokens.borderHover}`, borderRight: `2px solid ${tokens.borderHover}`, width: "10px", height: "10px" } : {}),
                            ...(i === 2 ? { bottom: "-4px", left: "-4px", borderBottom: `2px solid ${tokens.borderHover}`, borderLeft: `2px solid ${tokens.borderHover}`, width: "10px", height: "10px" } : {}),
                            ...(i === 3 ? { bottom: "-4px", right: "-4px", borderBottom: `2px solid ${tokens.borderHover}`, borderRight: `2px solid ${tokens.borderHover}`, width: "10px", height: "10px" } : {}),
                          }}
                        />
                      ))}
                    </div>
                    <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "18px", color: tokens.text, marginBottom: "8px" }}>
                      Awaiting Input
                    </div>
                    <div style={{ fontSize: "12px", color: tokens.textGhost, lineHeight: "1.7" }}>
                      Upload documents and run analysis
                      <br />
                      to extract structured field data
                    </div>
                    <div style={{ marginTop: "32px", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "8px", opacity: 0.4 }}>
                      {Array.from({ length: 9 }).map((_, i) => (
                        <div key={i} style={{ height: "2px", background: tokens.goldDim }} />
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
                  <div style={{ border: `1px solid ${tokens.border}`, background: tokens.goldFaint, padding: "20px 24px", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: `linear-gradient(90deg, transparent, ${tokens.gold}, transparent)`, opacity: 0.5 }} />
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px" }}>
                      <div>
                        <div style={{ fontSize: "10px", letterSpacing: "0.2em", color: tokens.textMuted, textTransform: "uppercase", marginBottom: "4px" }}>
                          Analysis Complete
                        </div>
                        <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "22px", color: tokens.text }}>{result.fields.length} Fields Extracted</div>
                        <div style={{ fontSize: "11px", color: tokens.textMuted, marginTop: "2px" }}>
                          {resultLabel} · {result.metadata.timestamp}
                        </div>
                      </div>
                      <button
                        onClick={handleNewChat}
                        style={{
                          padding: "6px 14px",
                          fontSize: "11px",
                          letterSpacing: "0.08em",
                          border: `1px solid ${tokens.border}`,
                          color: tokens.gold,
                          background: "transparent",
                          cursor: "pointer",
                          fontFamily: "var(--font-mono)",
                          textTransform: "uppercase",
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = tokens.goldDim;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                        }}
                      >
                        New Analysis
                      </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px" }}>
                      {[
                        { label: "PASSED", count: passCount, color: tokens.green, bg: tokens.greenBg, border: tokens.greenBorder },
                        { label: "REVIEW", count: reviewCount, color: tokens.yellow, bg: tokens.yellowBg, border: tokens.yellowBorder },
                        { label: "FAILED", count: failCount, color: tokens.red, bg: tokens.redBg, border: tokens.redBorder },
                      ].map(({ label, count, color, bg, border }) => (
                        <div
                          key={label}
                          style={{ background: bg, border: `1px solid ${border}`, padding: "16px", textAlign: "center", transition: "transform 0.15s" }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-2px)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                          }}
                        >
                          <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "32px", color, lineHeight: 1 }}>{count}</div>
                          <div style={{ fontSize: "10px", letterSpacing: "0.18em", color, opacity: 0.7, marginTop: "6px", textTransform: "uppercase" }}>{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "12px" }}>
                    {sortedFields.map((field) => (
                      <ModernFieldCard key={field.field_name} field={field} onClick={() => setSelectedField(field)} tokens={tokens} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {result && debugMode && (
              <div style={{ flexShrink: 0 }}>
                <ExplainDebugDrawer result={result} />
              </div>
            )}
          </div>
        </div>
      </div>

      <FieldDrawer field={selectedField} open={!!selectedField} onClose={() => setSelectedField(null)} />
      <Toaster theme={theme} />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}
