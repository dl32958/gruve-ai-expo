import { useState } from 'react';
import { PanelLeftClose, PanelLeft, Trash2, Plus, FileText } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { formatRunTimestamp } from '../time';
import type { RunResult } from '../types';
import type { Tokens } from '../tokens';

interface Props {
  history: RunResult[]; currentResult: RunResult | null;
  onSelectHistory: (r: RunResult) => void; onDeleteHistory: (i: number) => void;
  isCollapsed: boolean; onToggleCollapse: () => void; onNewChat: () => void;
  tokens: Tokens;
}

export function HistorySidebar({ history, currentResult, onSelectHistory, onDeleteHistory, isCollapsed, onToggleCollapse, onNewChat, tokens: t }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);

  const getImageName = (imagePath?: string) => {
    if (!imagePath) return "";
    return imagePath.split("/").pop() || imagePath;
  };

  const dotColor = (r: RunResult) => {
    if (r.fields.some(f => f.field_state === 'fail')) return t.red;
    if (r.fields.some(f => f.field_state === 'review_needed')) return t.yellow;
    return t.green;
  };

  const iconBtn: React.CSSProperties = { width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${t.border}`, background: 'transparent', color: t.textMuted, cursor: 'pointer', transition: 'all 0.15s', borderRadius: 0 };

  if (isCollapsed) return (
    <div style={{ width: '48px', background: t.bg, borderRight: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', gap: '8px', flexShrink: 0, transition: 'background 0.3s' }}>
      {[{ icon: PanelLeft, action: onToggleCollapse }, { icon: Plus, action: onNewChat }].map(({ icon: Icon, action }, i) => (
        <button key={i} style={iconBtn} onClick={action}
          onMouseEnter={e => { (e.currentTarget.style.color = t.gold); (e.currentTarget.style.borderColor = t.borderHover); }}
          onMouseLeave={e => { (e.currentTarget.style.color = t.textMuted); (e.currentTarget.style.borderColor = t.border); }}>
          <Icon size={13} />
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ width: '240px', flexShrink: 0, background: t.bg, borderRight: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-mono)', transition: 'background 0.3s' }}>
      <div style={{ height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', borderBottom: `1px solid ${t.border}` }}>
        <div style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: t.textGhost }}>Sessions</div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[{ icon: Plus, action: onNewChat }, { icon: PanelLeftClose, action: onToggleCollapse }].map(({ icon: Icon, action }, i) => (
            <button key={i} style={iconBtn} onClick={action}
              onMouseEnter={e => { (e.currentTarget.style.color = t.gold); (e.currentTarget.style.borderColor = t.borderHover); }}
              onMouseLeave={e => { (e.currentTarget.style.color = t.textMuted); (e.currentTarget.style.borderColor = t.border); }}>
              <Icon size={12} />
            </button>
          ))}
        </div>
      </div>

      <ScrollArea style={{ flex: 1 }}>
        <div style={{ padding: '8px' }}>
          {history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px' }}>
              <FileText size={20} style={{ color: t.textGhost, margin: '0 auto 10px' }} />
              <div style={{ fontSize: '11px', color: t.textGhost, lineHeight: 1.6 }}>No sessions yet.<br />Upload a document to begin.</div>
            </div>
          ) : history.map((item, idx) => {
            const isActive = currentResult === item;
            const color = dotColor(item);
            return (
              <div key={idx}
                onClick={() => onSelectHistory(item)}
                onMouseEnter={() => setHovered(idx)}
                onMouseLeave={() => setHovered(null)}
                style={{ padding: '10px 12px', cursor: 'pointer', marginBottom: '2px', background: isActive ? t.goldFaint : hovered === idx ? t.goldFaint : 'transparent', borderLeft: `2px solid ${isActive ? t.gold : 'transparent'}`, transition: 'all 0.15s', transform: hovered === idx && !isActive ? 'translateX(2px)' : 'translateX(0)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: color, flexShrink: 0, marginTop: '5px', boxShadow: `0 0 6px ${color}` }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* category · filename */}
                    <div style={{ fontSize: '11px', fontWeight: 700, color: isActive ? t.gold : t.text, letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.metadata.doc_category}
                      {item.metadata.image_path && <span style={{ color: t.textMuted, fontWeight: 400 }}> · {getImageName(item.metadata.image_path)}</span>}
                    </div>
                    <div style={{ fontSize: '10px', color: t.textGhost, marginTop: '2px' }}>
                      {formatRunTimestamp(item.metadata.timestamp)} · {item.fields.length}f
                    </div>
                  </div>
                  {hovered === idx && (
                    <button onClick={e => { e.stopPropagation(); onDeleteHistory(idx); }}
                      style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: t.textGhost, cursor: 'pointer', transition: 'color 0.1s', flexShrink: 0 }}
                      onMouseEnter={e => (e.currentTarget.style.color = t.red)}
                      onMouseLeave={e => (e.currentTarget.style.color = t.textGhost)}>
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
