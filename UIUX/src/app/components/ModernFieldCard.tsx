import { useState } from 'react';
import { Copy, ChevronRight, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { FieldResult, FieldState } from '../types';
import type { Tokens } from '../tokens';

interface Props { field: FieldResult; onClick: () => void; tokens: Tokens; }

export function ModernFieldCard({ field, onClick, tokens: t }: Props) {
  const [hovered, setHovered] = useState(false);

  const cfg = {
    pass:          { icon: <CheckCircle2 size={11} />, label: 'Pass',   color: t.green,  bg: t.greenBg,  border: t.greenBorder },
    review_needed: { icon: <AlertCircle  size={11} />, label: 'Review', color: t.yellow, bg: t.yellowBg, border: t.yellowBorder },
    fail:          { icon: <XCircle      size={11} />, label: 'Fail',   color: t.red,    bg: t.redBg,    border: t.redBorder },
  }[field.field_state];

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (field.recommended_value) {
      navigator.clipboard.writeText(field.recommended_value);
      toast.success('Copied');
    }
  };

  const reasoning = field.selected_engine === 'engineA' ? field.engineA.reasoning
    : field.selected_engine === 'engineB' ? field.engineB.reasoning : null;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? cfg.bg : 'transparent',
        border: `1px solid ${hovered ? cfg.color : cfg.border}`,
        borderLeft: `2px solid ${cfg.color}`,
        padding: '16px',
        cursor: 'pointer',
        position: 'relative',
        fontFamily: 'var(--font-mono)',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        boxShadow: hovered ? t.shadowHover : 'none',
        transition: 'all 0.18s cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      {/* Hover shimmer line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: `linear-gradient(90deg, transparent, ${cfg.color}, transparent)`, opacity: hovered ? 0.6 : 0, transition: 'opacity 0.2s' }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <span style={{ color: cfg.color }}>{cfg.icon}</span>
            <span style={{ fontSize: '10px', color: cfg.color, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{cfg.label}</span>
          </div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '13px', color: t.text, letterSpacing: '0.04em' }}>
            {field.field_name}
          </div>
        </div>
        <ChevronRight size={13} style={{ color: t.textGhost, flexShrink: 0, transform: hovered ? 'translateX(3px)' : 'translateX(0)', transition: 'transform 0.18s' }} />
      </div>

      {/* Value box */}
      <div style={{ padding: '10px 12px', background: hovered ? t.bgCard : t.bgInput, border: `1px solid ${t.border}`, marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', transition: 'background 0.15s' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '15px', color: field.recommended_value ? t.text : t.textGhost, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {field.recommended_value || '—'}
        </span>
        {field.recommended_value && (
          <button onClick={handleCopy}
            style={{ background: 'none', border: 'none', color: t.textGhost, cursor: 'pointer', padding: '2px', flexShrink: 0, transition: 'all 0.1s', transform: hovered ? 'scale(1.1)' : 'scale(1)' }}
            onMouseEnter={e => (e.currentTarget.style.color = t.gold)}
            onMouseLeave={e => (e.currentTarget.style.color = t.textGhost)}>
            <Copy size={11} />
          </button>
        )}
      </div>

      {/* Meta row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: t.textGhost, letterSpacing: '0.06em', marginBottom: reasoning ? '10px' : 0 }}>
        <span>CONF: <span style={{ color: t.textMuted }}>{field.field_confidence.replace('_', ' ')}</span></span>
        <span style={{ color: hovered ? cfg.color : t.textGhost, transition: 'color 0.15s' }}>
          {field.selected_engine === 'none' ? 'NO ENGINE' : field.selected_engine === 'engineA' ? 'ENG-A' : 'ENG-B'}
        </span>
      </div>

      {reasoning && (
        <div style={{ paddingTop: '10px', borderTop: `1px solid ${t.border}`, fontSize: '10px', color: t.textGhost, lineHeight: 1.6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
          {reasoning}
        </div>
      )}
    </div>
  );
}
