import { Play, Loader2, Settings2 } from 'lucide-react';
import type { PipelineStep } from '../types';
import type { Tokens } from '../tokens';

interface Props {
  onRun: () => void; isRunning: boolean; currentStep: PipelineStep | null;
  debugMode: boolean; onDebugModeChange: (v: boolean) => void;
  canRun: boolean; pendingCount?: number; tokens: Tokens;
}

const STEPS = [
  { step: 1, label: 'OCR' },
  { step: 2, label: 'Const' },
  { step: 3, label: 'Extr' },
  { step: 4, label: 'Synth' },
  { step: 5, label: 'Valid' },
];

export function RunControls({ onRun, isRunning, currentStep, debugMode, onDebugModeChange, canRun, pendingCount = 0, tokens: t }: Props) {
  const progress = currentStep ? (currentStep / 5) * 100 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontFamily: 'var(--font-mono)' }}>
      {/* Debug toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', border: `1px solid ${t.border}`, background: t.bgCard, transition: 'border-color 0.15s, background 0.3s' }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = t.borderHover)}
        onMouseLeave={e => (e.currentTarget.style.borderColor = t.border)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings2 size={11} style={{ color: t.textMuted }} />
          <div>
            <div style={{ fontSize: '11px', color: t.text, letterSpacing: '0.06em' }}>Debug Mode</div>
            <div style={{ fontSize: '10px', color: t.textGhost }}>Verbose output + downloads</div>
          </div>
        </div>
        {/* Custom toggle */}
        <div onClick={() => onDebugModeChange(!debugMode)}
          style={{ width: '32px', height: '16px', borderRadius: '8px', cursor: 'pointer', background: debugMode ? t.gold : t.bgInput, border: `1px solid ${debugMode ? t.gold : t.border}`, position: 'relative', transition: 'all 0.2s' }}>
          <div style={{ position: 'absolute', top: '1px', left: debugMode ? '17px' : '1px', width: '12px', height: '12px', borderRadius: '50%', background: debugMode ? t.bg : t.textMuted, transition: 'left 0.2s', boxShadow: debugMode ? `0 0 6px ${t.goldDim}` : 'none' }} />
        </div>
      </div>

      {/* Run button */}
      <button onClick={onRun} disabled={!canRun}
        style={{ width: '100%', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '12px', letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', border: `1px solid ${canRun ? t.borderHover : t.border}`, background: canRun ? t.goldFaint : 'transparent', color: canRun ? t.gold : t.textGhost, cursor: canRun ? 'pointer' : 'not-allowed', transition: 'all 0.15s', position: 'relative', overflow: 'hidden' }}
        onMouseEnter={e => { if (canRun && !isRunning) (e.currentTarget as HTMLElement).style.background = t.goldDim; }}
        onMouseLeave={e => { if (canRun && !isRunning) (e.currentTarget as HTMLElement).style.background = t.goldFaint; }}>
        {isRunning
          ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Processing...</>
          : <><Play size={13} /> {pendingCount > 1 ? `Run Analysis — ${pendingCount} files` : 'Run Analysis'}</>}
      </button>

      {/* Progress */}
      {isRunning && currentStep && (
        <div style={{ border: `1px solid ${t.border}`, background: t.bgCard, padding: '14px', transition: 'background 0.3s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', color: t.gold, letterSpacing: '0.06em' }}>{STEPS[currentStep - 1].label}</span>
            <span style={{ fontSize: '10px', color: t.textGhost }}>{currentStep}/5</span>
          </div>
          <div style={{ height: '2px', background: t.bgInput, marginBottom: '10px' }}>
            <div style={{ height: '100%', background: t.gold, width: `${progress}%`, transition: 'width 0.3s', boxShadow: `0 0 8px ${t.goldDim}` }} />
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {STEPS.map(({ step, label }) => (
              <div key={step} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ height: '2px', marginBottom: '4px', background: currentStep > step ? t.green : currentStep === step ? t.gold : t.bgInput, boxShadow: currentStep === step ? `0 0 6px ${t.goldDim}` : 'none', transition: 'all 0.3s' }} />
                <div style={{ fontSize: '9px', color: currentStep >= step ? t.textMuted : t.textGhost, letterSpacing: '0.06em' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
