import { useState } from 'react';
import { ChevronUp, Download, Search } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { toast } from 'sonner';
import type { RunResult } from '../types';
import type { Tokens } from '../tokens';

interface Props { result: RunResult | null; debugMode: boolean; tokens: Tokens; }

export function ExplainDebugDrawer({ result, debugMode, tokens: t }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<'ocr'|'extraction'|'judgment'>('ocr');
  const [engTab, setEngTab] = useState<'A'|'B'>('A');
  const [selfTab, setSelfTab] = useState<'A'|'B'>('A');
  const [ocrSearch, setOcrSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string,boolean>>({});

  if (!result) return null;

  const dl = (data: any, name: string) => {
    const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=name; a.click();
    URL.revokeObjectURL(url); toast.success(`Downloaded ${name}`);
  };

  const highlight = (text: string, q: string) => {
    if (!q.trim()) return text;
    return text.split(new RegExp(`(${q})`, 'gi')).map((p,i) =>
      p.toLowerCase()===q.toLowerCase() ? `<mark style="background:rgba(201,168,76,0.3);color:${t.gold}">${p}</mark>` : p
    ).join('');
  };

  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase',
    cursor: 'pointer', border: 'none', background: 'none', fontFamily: 'var(--font-mono)',
    color: active ? t.gold : t.textGhost,
    borderBottom: active ? `1px solid ${t.gold}` : '1px solid transparent',
    transition: 'all 0.15s',
  });

  const dlBtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px',
    fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase',
    border: `1px solid ${t.border}`, color: t.gold, background: 'transparent',
    cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s',
  };

  const scoreBar = (val: number, inv = false) => {
    const color = inv ? (val<=0.1?t.green:val<=0.3?t.yellow:t.red) : (val>=0.8?t.green:val>=0.5?t.yellow:t.red);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ flex: 1, height: '2px', background: t.bgInput }}>
          <div style={{ height: '100%', background: color, width: `${val*100}%`, boxShadow: `0 0 4px ${color}` }} />
        </div>
        <span style={{ fontSize: '11px', color, width: '36px', textAlign: 'right' }}>{val.toFixed(2)}</span>
      </div>
    );
  };

  return (
    <div style={{ borderTop: `1px solid ${t.border}`, background: t.bgPanel, fontFamily: 'var(--font-mono)', transition: 'background 0.3s' }}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button style={{ width: '100%', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', background: 'none', border: 'none', cursor: 'pointer', color: t.textGhost, transition: 'all 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = t.goldFaint)}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
            <span style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase' }}>Technical Details & Debug</span>
            <ChevronUp size={12} style={{ transition: 'transform 0.2s', transform: isOpen ? '' : 'rotate(180deg)' }} />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div style={{ maxHeight: '380px', overflowY: 'auto', borderTop: `1px solid ${t.border}`, padding: '20px 24px' }}>
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${t.border}`, marginBottom: '20px' }}>
              {(['ocr','extraction','judgment'] as const).map(tab2 => (
                <button key={tab2} style={tabBtn(tab===tab2)} onClick={() => setTab(tab2)}>
                  {tab2==='ocr'?'OCR':tab2==='extraction'?'Extraction':'Judgment'}
                </button>
              ))}
            </div>

            {/* OCR */}
            {tab==='ocr' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: t.textMuted }}>OCR Output</span>
                  {debugMode && <button style={dlBtn} onClick={() => dl({raw_text:result.stage1_ocr_text},'ocr_raw.json')}><Download size={10}/> DL</button>}
                </div>
                <div style={{ position: 'relative' }}>
                  <Search size={11} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: t.textGhost }} />
                  <input placeholder="Search OCR text..." value={ocrSearch} onChange={e => setOcrSearch(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px 8px 28px', background: t.bgCard, border: `1px solid ${t.border}`, color: t.text, fontSize: '11px', fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => (e.currentTarget.style.borderColor = t.borderHover)}
                    onBlur={e => (e.currentTarget.style.borderColor = t.border)} />
                </div>
                <pre style={{ fontSize: '11px', background: t.bgCard, padding: '14px', border: `1px solid ${t.border}`, lineHeight: '1.7', maxHeight: '200px', overflowY: 'auto', whiteSpace: 'pre-wrap', color: t.textSub, margin: 0, fontFamily: 'var(--font-mono)' }}
                  dangerouslySetInnerHTML={{ __html: highlight(result.stage1_ocr_text, ocrSearch) }} />
              </div>
            )}

            {/* Extraction */}
            {tab==='extraction' && (
              <div>
                <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${t.border}`, marginBottom: '16px', alignItems: 'center' }}>
                  {(['A','B'] as const).map(e => <button key={e} style={tabBtn(engTab===e)} onClick={() => setEngTab(e)}>Engine {e}</button>)}
                  {debugMode && <button style={{ ...dlBtn, marginLeft: 'auto' }} onClick={() => { const d = result.fields.map(f => ({field:f.field_name,extraction:engTab==='A'?f.engineA:f.engineB})); dl(d,`engine${engTab}.json`); }}><Download size={10}/> DL</button>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {result.fields.map(field => {
                    const key = `${engTab}-${field.field_name}`;
                    const ext = engTab==='A' ? field.engineA : field.engineB;
                    const open = expanded[key];
                    return (
                      <div key={key} style={{ border: `1px solid ${t.border}`, background: t.bgCard }}>
                        <div onClick={() => setExpanded(p=>({...p,[key]:!p[key]}))}
                          style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                          onMouseEnter={e => (e.currentTarget.style.background = t.goldFaint)}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <span style={{ fontSize: '12px', color: t.text }}>{field.field_name}</span>
                          <ChevronUp size={11} style={{ color: t.textGhost, transform: open?'':'rotate(180deg)', transition: '0.2s' }} />
                        </div>
                        {open && (
                          <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div>
                              <div style={{ fontSize: '10px', color: t.textGhost, marginBottom: '4px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Value</div>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: ext.extracted_value ? t.gold : t.textGhost }}>{ext.extracted_value||'—'}</div>
                            </div>
                            {ext.constraint_summary?.length>0 && (
                              <div>
                                <div style={{ fontSize: '10px', color: t.textGhost, marginBottom: '4px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Constraints</div>
                                {ext.constraint_summary.map((c:string,i:number) => (
                                  <div key={i} style={{ fontSize: '11px', color: t.textSub, paddingLeft: '10px', borderLeft: `1px solid ${t.borderHover}`, marginBottom: '3px', lineHeight: 1.5 }}>{c}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Judgment */}
            {tab==='judgment' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ border: `1px solid ${t.borderHover}`, background: t.goldFaint, padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: t.textMuted }}>Consolidated Rules</span>
                    {debugMode && <button style={dlBtn} onClick={() => dl(result.stage3_consolidated_rules,'rules.json')}><Download size={10}/> DL</button>}
                  </div>
                  {result.stage3_consolidated_rules.rules.map((rule,i) => (
                    <div key={i} style={{ fontSize: '11px', color: t.textSub, display: 'flex', gap: '8px', marginBottom: '4px', lineHeight: 1.5 }}>
                      <span style={{ color: t.textGhost, flexShrink: 0 }}>■</span><span>{rule}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', marginTop: '10px' }}>
                    <span style={{ color: t.textGhost, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Agreement:</span>
                    <span style={{ color: t.gold, border: `1px solid ${t.borderHover}`, padding: '2px 8px', fontSize: '10px' }}>{result.stage3_consolidated_rules.agreement_level}</span>
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${t.border}`, marginBottom: '12px' }}>
                    {(['A','B'] as const).map(e => <button key={e} style={tabBtn(selfTab===e)} onClick={() => setSelfTab(e)}>Engine {e}</button>)}
                  </div>
                  {result.fields.map(field => {
                    const data = selfTab==='A' ? field.engineA : field.engineB;
                    return (
                      <div key={field.field_name} style={{ border: `1px solid ${t.border}`, background: t.bgCard, padding: '12px 14px', marginBottom: '6px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: t.text, marginBottom: '10px' }}>{field.field_name}</div>
                        {[
                          { label:'Rule Consistency', val:data.rule_consistency },
                          { label:'Self-Consistency', val:data.engine_self_consistency },
                          { label:'OCR Alignment',    val:data.ocr_alignment },
                          { label:'OCR Corruption',   val:data.ocr_corruption, inv:true },
                        ].map(({label,val,inv}) => (
                          <div key={label} style={{ marginBottom: '6px' }}>
                            <div style={{ fontSize: '10px', color: t.textGhost, letterSpacing: '0.08em', marginBottom: '3px', textTransform: 'uppercase' }}>{label}</div>
                            {scoreBar(val, inv)}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
