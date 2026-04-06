import { useState, useCallback, useRef } from "react";
import { Upload, X, CheckCircle2, Clock, Loader2, AlertCircle, ImageIcon, FolderOpen } from "lucide-react";
import type { Tokens } from "../tokens";

export type QueueItemStatus = "pending" | "processing" | "done" | "error";
export interface QueueItem {
  id: string;
  file: File;
  preview: string;
  status: QueueItemStatus;
  name: string;
}

interface Props {
  queue: QueueItem[];
  onQueueChange: (q: QueueItem[]) => void;
  activeItemId: string | null;
  category: string;
  onCategoryChange: (c: string) => void;
  fields: string[];
  onFieldsChange: (f: string[]) => void;
  tokens: Tokens;
}

const CATEGORIES = ["receipt", "invoice", "bank_statement", "menu", "bill", "contract", "other"];

export function UploadSection({ queue, onQueueChange, activeItemId, category, onCategoryChange, fields, onFieldsChange, tokens: t }: Props) {
  const [dragActive, setDragActive] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [fieldInput, setFieldInput] = useState("");
  const [fieldError, setFieldError] = useState("");
  const folderRef = useRef<HTMLInputElement>(null);

  const readFiles = useCallback(
    (files: FileList | File[]) => {
      const images = Array.from(files).filter((file) => file.type.startsWith("image/"));
      if (!images.length) return;

      Promise.all(
        images.map(
          (file) =>
            new Promise<QueueItem>((resolve) => {
              const reader = new FileReader();
              reader.onload = (event) =>
                resolve({
                  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                  file,
                  preview: event.target?.result as string,
                  status: "pending",
                  name: file.name,
                });
              reader.readAsDataURL(file);
            }),
        ),
      ).then((items) => onQueueChange([...queue, ...items]));
    },
    [queue, onQueueChange],
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files?.length) readFiles(e.dataTransfer.files);
    },
    [readFiles],
  );

  const addField = () => {
    const value = fieldInput.trim().toLowerCase().replace(/\s+/g, "_");
    if (!value) return;
    if (fields.includes(value)) {
      setFieldError(`"${value}" already exists`);
      setTimeout(() => setFieldError(""), 2500);
      setFieldInput("");
      return;
    }
    onFieldsChange([...fields, value]);
    setFieldInput("");
    setFieldError("");
  };

  const label: React.CSSProperties = {
    fontSize: "10px",
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: t.textMuted,
    marginBottom: "8px",
    display: "block",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", fontFamily: "var(--font-mono)" }}>
      <div>
        <span style={label}>Documents</span>
        <div
          style={{
            position: "relative",
            border: `1px dashed ${dragActive ? t.borderHover : t.border}`,
            padding: "24px 16px",
            textAlign: "center",
            background: dragActive ? t.goldFaint : "transparent",
            transition: "all 0.15s",
            cursor: "pointer",
          }}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div style={{ pointerEvents: "none" }}>
            <Upload size={18} style={{ color: dragActive ? t.gold : t.textGhost, margin: "0 auto 10px", transition: "color 0.15s" }} />
            <div style={{ fontSize: "12px", color: t.text, marginBottom: "4px" }}>Drop files or click to browse</div>
            <div style={{ fontSize: "10px", color: t.textGhost, display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
              <ImageIcon size={9} /> JPG, PNG — multiple files
            </div>
          </div>
          <input
            type="file"
            accept="image/*"
            multiple
            style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
            onChange={(e) => {
              if (e.target.files?.length) readFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        <button
          onClick={() => folderRef.current?.click()}
          style={{
            marginTop: "6px",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            padding: "8px",
            fontSize: "11px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            border: `1px dashed ${t.border}`,
            background: "transparent",
            color: t.textMuted,
            cursor: "pointer",
            transition: "all 0.15s",
            fontFamily: "var(--font-mono)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = t.gold;
            e.currentTarget.style.borderColor = t.borderHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = t.textMuted;
            e.currentTarget.style.borderColor = t.border;
          }}
        >
          <FolderOpen size={12} /> Upload Folder
        </button>
        <input
          ref={folderRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          // @ts-ignore
          webkitdirectory=""
          mozdirectory=""
          directory=""
          onChange={(e) => {
            if (e.target.files?.length) readFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {queue.length > 0 && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={label}>Queue ({queue.length})</span>
            {queue.some((item) => item.status === "done") && (
              <button
                onClick={() => onQueueChange(queue.filter((item) => item.status !== "done"))}
                style={{
                  fontSize: "10px",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  background: "none",
                  border: "none",
                  color: t.textGhost,
                  cursor: "pointer",
                  fontFamily: "var(--font-mono)",
                  transition: "color 0.1s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = t.gold;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = t.textGhost;
                }}
              >
                Clear done
              </button>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "200px", overflowY: "auto" }}>
            {queue.map((item, idx) => {
              const isActive = item.id === activeItemId;
              const statusColor = { pending: t.textGhost, processing: t.gold, done: t.green, error: t.red }[item.status];
              const StatusIcon = { pending: Clock, processing: Loader2, done: CheckCircle2, error: AlertCircle }[item.status];

              return (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "8px 10px",
                    border: `1px solid ${isActive ? t.borderHover : t.border}`,
                    background: isActive ? t.goldFaint : "transparent",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ width: "28px", height: "28px", flexShrink: 0, background: t.bgInput, overflow: "hidden" }}>
                    <img src={item.preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "11px", color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {category ? (
                        <>
                          <span style={{ color: t.gold }}>{category}</span> · {item.name}
                        </>
                      ) : (
                        item.name
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "2px", color: statusColor, fontSize: "10px" }}>
                      <StatusIcon size={10} style={item.status === "processing" ? { animation: "spin 1s linear infinite" } : {}} />
                      <span style={{ letterSpacing: "0.06em" }}>
                        {item.status}
                        {isActive && item.status === "processing" ? " · now" : ""}
                      </span>
                    </div>
                  </div>
                  {item.status === "pending" && <span style={{ fontSize: "10px", color: t.textGhost }}>#{idx + 1}</span>}
                  {item.status !== "processing" && (
                    <button
                      onClick={() => onQueueChange(queue.filter((entry) => entry.id !== item.id))}
                      style={{ background: "none", border: "none", color: t.textGhost, cursor: "pointer", padding: "2px", transition: "color 0.1s" }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = t.red;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = t.textGhost;
                      }}
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ position: "relative" }}>
        <span style={label}>Document Type</span>
        <div
          onClick={() => setCatOpen(!catOpen)}
          style={{
            padding: "10px 14px",
            border: `1px solid ${t.border}`,
            background: t.bgCard,
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "12px",
            color: category ? t.text : t.textGhost,
            transition: "border-color 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = t.borderHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = t.border;
          }}
        >
          <span>{category || "Select type..."}</span>
          <span style={{ color: t.textGhost, fontSize: "10px", transition: "transform 0.2s", display: "inline-block", transform: catOpen ? "rotate(180deg)" : "rotate(0)" }}>▾</span>
        </div>
        {catOpen && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, background: t.bgInput, border: `1px solid ${t.borderHover}`, borderTop: "none", boxShadow: t.shadow }}>
            {CATEGORIES.map((item) => (
              <div
                key={item}
                onClick={() => {
                  onCategoryChange(item);
                  setCatOpen(false);
                }}
                style={{
                  padding: "9px 14px",
                  fontSize: "12px",
                  cursor: "pointer",
                  color: category === item ? t.gold : t.text,
                  background: category === item ? t.goldFaint : "transparent",
                  transition: "all 0.1s",
                  letterSpacing: "0.04em",
                }}
                onMouseEnter={(e) => {
                  if (category !== item) e.currentTarget.style.background = t.goldFaint;
                }}
                onMouseLeave={(e) => {
                  if (category !== item) e.currentTarget.style.background = "transparent";
                }}
              >
                {item}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <span style={label}>Extract Fields</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
          {fields.map((field) => (
            <div
              key={field}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                fontSize: "11px",
                letterSpacing: "0.06em",
                border: `1px solid ${t.borderHover}`,
                color: t.gold,
                background: t.goldFaint,
                transition: "all 0.15s",
              }}
            >
              <span>{field}</span>
              <button
                onClick={() => onFieldsChange(fields.filter((entry) => entry !== field))}
                style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, opacity: 0.5, lineHeight: 1, transition: "opacity 0.1s" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = "1";
                  e.currentTarget.style.color = t.red;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = "0.5";
                  e.currentTarget.style.color = "inherit";
                }}
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>

        <div style={{ position: "relative" }}>
          <input
            value={fieldInput}
            onChange={(e) => {
              setFieldInput(e.target.value);
              setFieldError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") addField();
            }}
            placeholder="Type field name + Enter"
            style={{
              width: "100%",
              padding: "9px 14px",
              fontSize: "12px",
              fontFamily: "var(--font-mono)",
              background: t.bgCard,
              border: `1px solid ${fieldError ? t.red : t.border}`,
              color: t.text,
              outline: "none",
              boxSizing: "border-box",
              transition: "border-color 0.15s",
              caretColor: t.gold,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = fieldError ? t.red : t.borderHover;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = fieldError ? t.red : t.border;
            }}
          />
          {fieldInput && (
            <button
              onClick={addField}
              style={{
                position: "absolute",
                right: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: t.gold,
                cursor: "pointer",
                fontSize: "10px",
                letterSpacing: "0.1em",
                fontFamily: "var(--font-mono)",
                textTransform: "uppercase",
              }}
            >
              Add ↵
            </button>
          )}
        </div>

        {fieldError && (
          <div style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "5px", fontSize: "10px", color: t.red, animation: "fadeIn 0.15s ease" }}>
            <AlertCircle size={10} />
            <span>{fieldError}</span>
          </div>
        )}
      </div>
    </div>
  );
}
