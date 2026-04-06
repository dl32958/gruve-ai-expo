import { useState } from "react";
import { ChevronDown, ChevronUp, Copy, X } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "../ThemeContext";
import type { Tokens } from "../tokens";
import { dark, light } from "../tokens";
import type { FieldResult } from "../types";

interface Props {
  field: FieldResult | null;
  open: boolean;
  onClose: () => void;
}

const ScoreBar = ({ val, inv = false, t }: { val: number; inv?: boolean; t: Tokens }) => {
  const color = inv ? (val <= 0.1 ? t.green : val <= 0.3 ? t.yellow : t.red) : val >= 0.8 ? t.green : val >= 0.5 ? t.yellow : t.red;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <div style={{ flex: 1, height: "3px", background: t.bgInput, borderRadius: "2px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${val * 100}%`, background: color, boxShadow: `0 0 6px ${color}`, transition: "width 0.4s ease" }} />
      </div>
      <span style={{ fontSize: "11px", color, fontFamily: "var(--font-mono)", width: "36px", textAlign: "right", flexShrink: 0 }}>{val.toFixed(2)}</span>
    </div>
  );
};

export function FieldDrawer({ field, open, onClose }: Props) {
  const { theme } = useTheme();
  const t = theme === "dark" ? dark : light;
  const [compareExpanded, setCompareExpanded] = useState(false);

  if (!field || !open) return null;

  const stateColor = { pass: t.green, review_needed: t.yellow, fail: t.red }[field.field_state];
  const stateLabel = { pass: "Pass", review_needed: "Review Needed", fail: "Failed" }[field.field_state];

  const section: React.CSSProperties = { marginBottom: "24px" };
  const sectionTitle: React.CSSProperties = { fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: t.textMuted, marginBottom: "12px", display: "block" };
  const card: React.CSSProperties = { background: t.bgCard, border: `1px solid ${t.border}`, padding: "16px" };
  const labelStyle: React.CSSProperties = { fontSize: "11px", color: t.textMuted, letterSpacing: "0.06em" };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", zIndex: 100, transition: "opacity 0.2s" }} />

      <div
        style={{
          position: "fixed",
          right: 0,
          top: 0,
          bottom: 0,
          width: "520px",
          zIndex: 101,
          background: t.bgPanel,
          borderLeft: `1px solid ${t.border}`,
          overflowY: "auto",
          fontFamily: "var(--font-mono)",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.4)",
          animation: "slideIn 0.22s cubic-bezier(0.34,1.2,0.64,1)",
        }}
      >
        <div style={{ position: "sticky", top: 0, background: t.bgPanel, borderBottom: `1px solid ${t.border}`, padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 10 }}>
          <div>
            <div style={{ fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: t.textMuted, marginBottom: "2px" }}>Field Detail</div>
            <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "20px", color: t.text }}>{field.field_name}</div>
          </div>
          <button
            onClick={onClose}
            style={{ width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${t.border}`, background: "transparent", color: t.textMuted, cursor: "pointer", transition: "all 0.15s" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = t.red;
              e.currentTarget.style.borderColor = t.red;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = t.textMuted;
              e.currentTarget.style.borderColor = t.border;
            }}
          >
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: "24px" }}>
          <div style={section}>
            <span style={sectionTitle}>Final Decision</span>
            <div style={{ ...card, borderLeft: `3px solid ${stateColor}`, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: `linear-gradient(90deg, ${stateColor}, transparent)`, opacity: 0.5 }} />
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px" }}>
                <div>
                  <div style={{ fontSize: "10px", color: stateColor, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "6px" }}>{stateLabel}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "26px", color: t.text, lineHeight: 1 }}>{field.recommended_value || "—"}</div>
                </div>
                {field.recommended_value && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(field.recommended_value);
                      toast.success("Copied");
                    }}
                    style={{ padding: "6px 12px", fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", border: `1px solid ${t.border}`, color: t.gold, background: "transparent", cursor: "pointer", fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", gap: "5px", transition: "all 0.15s" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = t.goldFaint;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <Copy size={10} /> Copy
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ padding: "3px 10px", fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", border: `1px solid ${stateColor}`, color: stateColor, background: `${stateColor}15` }}>{stateLabel}</span>
                <span style={{ padding: "3px 10px", fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", border: `1px solid ${t.border}`, color: t.textMuted }}>
                  {field.field_confidence.replace("_", " ")}
                </span>
                <span style={{ padding: "3px 10px", fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", border: `1px solid ${t.border}`, color: t.textMuted }}>
                  {field.selected_engine === "engineA" ? "Engine A" : field.selected_engine === "engineB" ? "Engine B" : "No Engine"}
                </span>
              </div>
              {field.state_reason && <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: `1px solid ${t.border}`, fontSize: "11px", color: t.textSub, lineHeight: 1.6 }}>{field.state_reason}</div>}
            </div>
          </div>

          <div style={section}>
            <span style={sectionTitle}>Signal Analysis</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {[
                { label: "Rule Consistency", val: field.signals.final_rule_consistency },
                { label: "Self-Consistency", val: field.signals.final_engine_self_consistency },
                { label: "OCR Alignment", val: field.signals.final_ocr_alignment },
                { label: "OCR Corruption", val: field.signals.final_ocr_corruption, inv: true },
              ].map(({ label, val, inv }) => (
                <div key={label} style={card}>
                  <div style={{ fontSize: "10px", color: t.textMuted, letterSpacing: "0.08em", marginBottom: "8px", textTransform: "uppercase" }}>{label}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "20px", color: t.text, marginBottom: "8px" }}>{val.toFixed(2)}</div>
                  <ScoreBar val={val} inv={inv} t={t} />
                </div>
              ))}
            </div>
          </div>

          <div style={section}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <span style={sectionTitle}>Engine Comparison</span>
              <button
                onClick={() => setCompareExpanded(!compareExpanded)}
                style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", background: "none", border: "none", color: t.gold, cursor: "pointer", fontFamily: "var(--font-mono)" }}
              >
                {compareExpanded ? (
                  <>
                    <ChevronUp size={11} /> Collapse
                  </>
                ) : (
                  <>
                    <ChevronDown size={11} /> Expand
                  </>
                )}
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {(["engineA", "engineB"] as const).map((engine) => {
                const data = field[engine];
                const isSelected = field.selected_engine === engine;

                return (
                  <div key={engine} style={{ ...card, borderTop: isSelected ? `2px solid ${t.gold}` : `1px solid ${t.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: t.text, letterSpacing: "0.06em" }}>{engine === "engineA" ? "Engine A" : "Engine B"}</div>
                      {isSelected && <span style={{ fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: t.gold, border: `1px solid ${t.borderHover}`, padding: "2px 6px" }}>Selected</span>}
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "16px", color: data.extracted_value ? t.text : t.textGhost, marginBottom: "8px" }}>{data.extracted_value || "—"}</div>
                    {compareExpanded && (
                      <div style={{ paddingTop: "10px", borderTop: `1px solid ${t.border}` }}>
                        {[
                          { label: "Consistency", val: data.rule_consistency },
                          { label: "OCR Align", val: data.ocr_alignment },
                          { label: "Corruption", val: data.ocr_corruption, inv: true },
                        ].map(({ label, val, inv }) => (
                          <div key={label} style={{ marginBottom: "8px" }}>
                            <div style={{ ...labelStyle, marginBottom: "3px" }}>{label}</div>
                            <ScoreBar val={val} inv={inv} t={t} />
                          </div>
                        ))}
                        <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: `1px solid ${t.border}` }}>
                          <div style={{ ...labelStyle, marginBottom: "4px" }}>Summary</div>
                          <div style={{ fontSize: "11px", color: t.textSub, lineHeight: 1.6 }}>{data.judgment_summary}</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
