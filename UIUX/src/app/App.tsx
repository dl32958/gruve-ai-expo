import { useState, useRef } from 'react';
import { Toaster } from './components/ui/sonner';
import { HistorySidebar } from './components/HistorySidebar';
import { UploadSection } from './components/UploadSection';
import type { QueueItem } from './components/UploadSection';
import { RunControls } from './components/RunControls';
import { ModernFieldCard } from './components/ModernFieldCard';
import { FieldDrawer } from './components/FieldDrawer';
import { ExplainDebugDrawer } from './components/ExplainDebugDrawer';
import { Download, Zap, Sun, Moon } from 'lucide-react';
import { mockRunResult } from './mockData';
import { toast } from 'sonner';
import { useTheme } from './ThemeContext';
import { dark, light } from './tokens';
import type { RunResult, PipelineStep, FieldResult } from './types';

export default function App() {
  const { theme, toggle } = useTheme();
  const t = theme === 'dark' ? dark : light;

  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState<PipelineStep | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [history, setHistory] = useState<RunResult[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedField, setSelectedField] = useState<FieldResult | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('');
  const [fields, setFields] = useState<string[]>(['company', 'date', 'address', 'total']);
  const processingRef = useRef(false);

  const processItem = async (item: QueueItem): Promise<RunResult> => {
    for (let step = 1; step <= 5; step++) {
      setCurrentStep(step as PipelineStep);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return {
      ...mockRunResult,
      metadata: {
        ...mockRunResult.metadata,
        timestamp: new Date().toLocaleTimeString(),
        doc_category: category,
        fields,
        debug: debugMode,
        image_path: item.name,
      },
    };
  };

  const updateItemStatus = (id: string, status: QueueItem['status']) =>
    setQueue(prev => prev.map(item => item.id === id ? { ...item, status } : item));

  const runQueue = async (currentQueue: QueueItem[]) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setIsRunning(true);
    for (const item of currentQueue.filter(i => i.status === 'pending')) {
      setActiveItemId(item.id);
      updateItemStatus(item.id, 'processing');
      try {
        const res = await processItem(item);
        updateItemStatus(item.id, 'done');
        setResult(res);
        setHistory(prev => [res, ...prev].slice(0, 20));
        toast.success(`✓ ${category} · ${item.name}`);
      } catch {
        updateItemStatus(item.id, 'error');
        toast.error(`Failed: ${item.name}`);
      }
    }
    setActiveItemId(null);
    setCurrentStep(null);
    setIsRunning(false);
    processingRef.current = false;
  };

  const handleRun = () => {
    if (!category || queue.filter(i => i.status === 'pending').length === 0) return;
    runQueue(queue);
  };

  const handleNewChat = () => {
    if (isRunning) return;
    setResult(null); setQueue([]); setActiveItemId(null);
    setCategory(''); setFields(['company', 'date', 'address', 'total']);
  };

  const downloadFinalResult = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'final_result.json'; a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded final_result.json');
  };

  const pendingCount = queue.filter(i => i.status === 'pending').length;
  const canRun = pendingCount > 0 && !!category && !isRunning;

  const sortedFields = result
    ? [...result.fields].sort((a, b) => ({ fail: 0, review_needed: 1, pass: 2 }[a.field_state] - { fail: 0, review_needed: 1, pass: 2 }[b.field_state]))
    : [];

  const passCount   = result?.fields.filter(f => f.field_state === 'pass').length ?? 0;
  const reviewCount = result?.fields.filter(f => f.field_state === 'review_needed').length ?? 0;
  const failCount   = result?.fields.filter(f => f.field_state === 'fail').length ?? 0;

  // Display label for result header: "invoice · receipt_001.jpg"
  const resultLabel = result?.metadata
    ? `${result.metadata.doc_category}${result.metadata.image_path ? ' · ' + result.metadata.image_path : ''}`
    : '';

  const headerBtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '5px 12px', fontSize: '11px', letterSpacing: '0.06em',
    border: `1px solid ${t.border}`, color: t.gold,
    background: t.goldFaint, cursor: 'pointer',
    fontFamily: 'var(--font-mono)', textTransform: 'uppercase', transition: 'all 0.15s',
  };

  return (
    <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: t.bg, fontFamily: 'var(--font-mono)', transition: 'background 0.3s' }}>
      {/* Ambient glow */}
      <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '600px', height: '1px', boxShadow: `0 0 120px 40px ${t.goldDim}`, pointerEvents: 'none', zIndex: 0 }} />

      <HistorySidebar
        history={history} currentResult={result}
        onSelectHistory={setResult}
        onDeleteHistory={i => { setHistory(prev => prev.filter((_, idx) => idx !== i)); toast.success('Deleted'); }}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onNewChat={handleNewChat}
        tokens={t}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative', zIndex: 1 }}>
        {/* ── Header ── */}
        <div style={{ height: '56px', borderBottom: `1px solid ${t.border}`, background: theme === 'dark' ? 'rgba(6,6,10,0.95)' : 'rgba(245,242,235,0.95)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flexShrink: 0 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '32px', height: '32px', border: `1px solid ${t.borderHover}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.goldFaint, position: 'relative' }}>
              <Zap size={14} style={{ color: t.gold }} />
              <div style={{ position: 'absolute', inset: '-1px', boxShadow: `0 0 12px ${t.goldDim}`, pointerEvents: 'none' }} />
            </div>
            <div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '14px', letterSpacing: '0.08em', textTransform: 'uppercase', color: t.text }}>GRUVE</div>
              <div style={{ fontSize: '10px', color: t.textMuted, letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '-2px' }}>Document Intelligence</div>
            </div>
          </div>

          {/* Right controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {result && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                  <span style={{ color: t.green }}>■ {passCount}</span>
                  <span style={{ color: t.textGhost }}>/</span>
                  <span style={{ color: t.yellow }}>■ {reviewCount}</span>
                  <span style={{ color: t.textGhost }}>/</span>
                  <span style={{ color: t.red }}>■ {failCount}</span>
                </div>
                <span style={{ color: t.border }}>|</span>
                <span style={{ fontSize: '11px', color: t.textMuted }}>{result.metadata.elapsed_seconds.toFixed(2)}s</span>
                <button style={headerBtn}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = t.goldDim; (e.currentTarget as HTMLElement).style.borderColor = t.borderHover; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = t.goldFaint; (e.currentTarget as HTMLElement).style.borderColor = t.border; }}
                  onClick={downloadFinalResult}>
                  <Download size={11} /> Export
                </button>
              </>
            )}
            {/* Theme toggle */}
            <button
              onClick={toggle}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${t.border}`, background: t.goldFaint, cursor: 'pointer', color: t.gold, transition: 'all 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = t.goldDim; (e.currentTarget as HTMLElement).style.borderColor = t.borderHover; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = t.goldFaint; (e.currentTarget as HTMLElement).style.borderColor = t.border; }}
            >
              {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left panel */}
          <div style={{ width: '380px', flexShrink: 0, borderRight: `1px solid ${t.border}`, background: t.bgPanel, display: 'flex', flexDirection: 'column', transition: 'background 0.3s' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              <div style={{ marginBottom: '28px' }}>
                <div style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: t.textMuted, marginBottom: '4px' }}>Input</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '20px', color: t.text }}>Configure Analysis</div>
              </div>
              <UploadSection queue={queue} onQueueChange={setQueue} activeItemId={activeItemId} category={category} onCategoryChange={setCategory} fields={fields} onFieldsChange={setFields} tokens={t} />
            </div>
            <div style={{ padding: '20px 24px', borderTop: `1px solid ${t.border}`, flexShrink: 0 }}>
              <RunControls onRun={handleRun} isRunning={isRunning} currentStep={currentStep} debugMode={debugMode} onDebugModeChange={setDebugMode} canRun={canRun} pendingCount={pendingCount} tokens={t} />
            </div>
          </div>

          {/* Right panel */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: t.bg, transition: 'background 0.3s' }}>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {!result ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
                  <div style={{ textAlign: 'center', maxWidth: '360px' }}>
                    <div style={{ width: '64px', height: '64px', margin: '0 auto 24px', border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                      <Zap size={24} style={{ color: t.border }} />
                      {[0,1,2,3].map(i => (
                        <div key={i} style={{ position: 'absolute',
                          ...(i===0 ? { top:'-4px', left:'-4px', borderTop:`2px solid ${t.borderHover}`, borderLeft:`2px solid ${t.borderHover}`, width:'10px', height:'10px' } : {}),
                          ...(i===1 ? { top:'-4px', right:'-4px', borderTop:`2px solid ${t.borderHover}`, borderRight:`2px solid ${t.borderHover}`, width:'10px', height:'10px' } : {}),
                          ...(i===2 ? { bottom:'-4px', left:'-4px', borderBottom:`2px solid ${t.borderHover}`, borderLeft:`2px solid ${t.borderHover}`, width:'10px', height:'10px' } : {}),
                          ...(i===3 ? { bottom:'-4px', right:'-4px', borderBottom:`2px solid ${t.borderHover}`, borderRight:`2px solid ${t.borderHover}`, width:'10px', height:'10px' } : {}),
                        }} />
                      ))}
                    </div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px', color: t.text, marginBottom: '8px' }}>Awaiting Input</div>
                    <div style={{ fontSize: '12px', color: t.textGhost, lineHeight: '1.7' }}>Upload documents and run analysis<br />to extract structured field data</div>
                    <div style={{ marginTop: '32px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', opacity: 0.4 }}>
                      {Array.from({ length: 9 }).map((_, i) => <div key={i} style={{ height: '2px', background: t.goldDim }} />)}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Result header */}
                  <div style={{ border: `1px solid ${t.border}`, background: t.goldFaint, padding: '20px 24px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: `linear-gradient(90deg, transparent, ${t.gold}, transparent)`, opacity: 0.5 }} />
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
                      <div>
                        <div style={{ fontSize: '10px', letterSpacing: '0.2em', color: t.textMuted, textTransform: 'uppercase', marginBottom: '4px' }}>Analysis Complete</div>
                        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '22px', color: t.text }}>{result.fields.length} Fields Extracted</div>
                        <div style={{ fontSize: '11px', color: t.textMuted, marginTop: '2px' }}>{resultLabel} · {result.metadata.timestamp}</div>
                      </div>
                      <button onClick={handleNewChat}
                        style={{ padding: '6px 14px', fontSize: '11px', letterSpacing: '0.08em', border: `1px solid ${t.border}`, color: t.gold, background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', transition: 'all 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = t.goldDim)}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        New Analysis
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
                      {[
                        { label: 'PASSED', count: passCount, color: t.green, bg: t.greenBg, border: t.greenBorder },
                        { label: 'REVIEW', count: reviewCount, color: t.yellow, bg: t.yellowBg, border: t.yellowBorder },
                        { label: 'FAILED', count: failCount, color: t.red, bg: t.redBg, border: t.redBorder },
                      ].map(({ label, count, color, bg, border }) => (
                        <div key={label} style={{ background: bg, border: `1px solid ${border}`, padding: '16px', textAlign: 'center', transition: 'transform 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                          onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '32px', color, lineHeight: 1 }}>{count}</div>
                          <div style={{ fontSize: '10px', letterSpacing: '0.18em', color, opacity: 0.7, marginTop: '6px', textTransform: 'uppercase' }}>{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Field cards grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '12px' }}>
                    {sortedFields.map(field => (
                      <ModernFieldCard key={field.field_name} field={field} onClick={() => setSelectedField(field)} tokens={t} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Debug drawer — only shown when debugMode is on */}
            {result && debugMode && (
              <div style={{ flexShrink: 0 }}>
                <ExplainDebugDrawer result={result} debugMode={debugMode} tokens={t} />
              </div>
            )}
          </div>
        </div>
      </div>

      <FieldDrawer field={selectedField} open={!!selectedField} onClose={() => setSelectedField(null)} tokens={t} />
      <Toaster theme={theme} />
    </div>
  );
}
