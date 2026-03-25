import { useState } from 'react';
import { ChevronUp, Download, Search } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { toast } from 'sonner';
import type { RunResult } from '../types';

interface ExplainDebugDrawerProps {
  result: RunResult | null;
  debugMode: boolean;
}

export function ExplainDebugDrawer({ result, debugMode }: ExplainDebugDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [ocrSearch, setOcrSearch] = useState('');
  const [expandedFields, setExpandedFields] = useState<Record<string, boolean>>({});

  if (!result) return null;

  const downloadJSON = (data: any, filename: string) => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}`);
  };

  const toggleFieldExpanded = (fieldName: string) => {
    setExpandedFields(prev => ({ ...prev, [fieldName]: !prev[fieldName] }));
  };

  const highlightText = (text: string, search: string) => {
    if (!search.trim()) return text;
    const parts = text.split(new RegExp(`(${search})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === search.toLowerCase() 
        ? `<mark class="bg-yellow-200">${part}</mark>` 
        : part
    ).join('');
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
            <ChevronUp className={`h-5 w-5 transition-transform ${isOpen ? '' : 'rotate-180'}`} />
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="p-6 border-t max-h-[400px] overflow-y-auto border-gray-200 dark:border-gray-800">
            <Tabs defaultValue="ocr">
              <TabsList className="w-full mb-4 grid grid-cols-3">
                <TabsTrigger value="ocr" className="text-base">OCR Text</TabsTrigger>
                <TabsTrigger value="extraction" className="text-base">Engine Extraction</TabsTrigger>
                <TabsTrigger value="judgment" className="text-base">Final Judgment</TabsTrigger>
              </TabsList>

              {/* OCR Raw Text */}
              <TabsContent value="ocr" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">Optical Character Recognition</h3>
                  {debugMode && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadJSON({ raw_text: result.stage1_ocr_text }, 'ocr_raw_text.json')}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </Button>
                  )}
                </div>
                
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search in OCR text..."
                    value={ocrSearch}
                    onChange={(e) => setOcrSearch(e.target.value)}
                    className="pl-9 text-base"
                  />
                </div>

                <Card>
                  <CardContent className="p-4">
                    <pre 
                      className="text-base whitespace-pre-wrap font-mono bg-gray-50 dark:bg-gray-900 p-4 rounded max-h-64 overflow-y-auto leading-relaxed"
                      dangerouslySetInnerHTML={{ 
                        __html: highlightText(result.stage1_ocr_text, ocrSearch) 
                      }}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Engine Extraction */}
              <TabsContent value="extraction" className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg">Dual-Engine Field Extraction</h3>
                </div>

                <Tabs defaultValue="engineA">
                  <TabsList className="w-full">
                    <TabsTrigger value="engineA" className="flex-1 text-base">Engine A</TabsTrigger>
                    <TabsTrigger value="engineB" className="flex-1 text-base">Engine B</TabsTrigger>
                  </TabsList>

                  <TabsContent value="engineA" className="space-y-3 mt-4">
                    {debugMode && (
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const data = result.fields.map(f => ({
                              field: f.field_name,
                              extraction: f.engineA,
                            }));
                            downloadJSON(data, 'engineA_extraction.json');
                          }}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                      </div>
                    )}
                    {result.fields.map((field) => (
                      <EngineExtractionCard
                        key={field.field_name}
                        fieldName={field.field_name}
                        extraction={field.engineA}
                        isExpanded={expandedFields[`A-${field.field_name}`] || false}
                        onToggle={() => toggleFieldExpanded(`A-${field.field_name}`)}
                      />
                    ))}
                  </TabsContent>

                  <TabsContent value="engineB" className="space-y-3 mt-4">
                    {debugMode && (
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const data = result.fields.map(f => ({
                              field: f.field_name,
                              extraction: f.engineB,
                            }));
                            downloadJSON(data, 'engineB_extraction.json');
                          }}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                      </div>
                    )}
                    {result.fields.map((field) => (
                      <EngineExtractionCard
                        key={field.field_name}
                        fieldName={field.field_name}
                        extraction={field.engineB}
                        isExpanded={expandedFields[`B-${field.field_name}`] || false}
                        onToggle={() => toggleFieldExpanded(`B-${field.field_name}`)}
                      />
                    ))}
                  </TabsContent>
                </Tabs>
              </TabsContent>

              {/* Final Judgment */}
              <TabsContent value="judgment" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">Cross-Engine Validation & Rules</h3>
                  {debugMode && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadJSON(result.stage3_consolidated_rules, 'consolidated_rules.json')}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </Button>
                  )}
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Consolidated Rules</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <span className="text-base font-medium text-gray-600 dark:text-gray-400">Rules:</span>
                      <ul className="mt-2 space-y-1.5">
                        {result.stage3_consolidated_rules.rules.map((rule, idx) => (
                          <li key={idx} className="text-base flex items-start gap-2">
                            <span className="text-gray-400">•</span>
                            <span>{rule}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-medium text-gray-600 dark:text-gray-400">Agreement Level:</span>
                      <Badge className="text-sm">{result.stage3_consolidated_rules.agreement_level}</Badge>
                    </div>
                    {result.stage3_consolidated_rules.notes && (
                      <div>
                        <span className="text-base font-medium text-gray-600 dark:text-gray-400">Notes:</span>
                        <p className="mt-1 text-base text-gray-700 dark:text-gray-300">{result.stage3_consolidated_rules.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="mt-4">
                  <h4 className="font-semibold mb-3 text-base">Self-Consistency Scores</h4>
                  <Tabs defaultValue="self-engineA">
                    <TabsList className="w-full">
                      <TabsTrigger value="self-engineA" className="flex-1">Engine A</TabsTrigger>
                      <TabsTrigger value="self-engineB" className="flex-1">Engine B</TabsTrigger>
                    </TabsList>

                    <TabsContent value="self-engineA" className="space-y-3 mt-4">
                      {result.fields.map((field) => (
                        <SelfJustificationCard key={field.field_name} field={field} engine="A" />
                      ))}
                    </TabsContent>

                    <TabsContent value="self-engineB" className="space-y-3 mt-4">
                      {result.fields.map((field) => (
                        <SelfJustificationCard key={field.field_name} field={field} engine="B" />
                      ))}
                    </TabsContent>
                  </Tabs>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function EngineExtractionCard({ 
  fieldName, 
  extraction, 
  isExpanded, 
  onToggle 
}: { 
  fieldName: string; 
  extraction: any; 
  isExpanded: boolean; 
  onToggle: () => void;
}) {
  return (
    <Card>
      <CardHeader className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">{fieldName}</CardTitle>
          <ChevronUp className={`h-4 w-4 transition-transform ${isExpanded ? '' : 'rotate-180'}`} />
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="space-y-3 text-base">
          <div>
            <span className="font-medium text-gray-600 dark:text-gray-400">Constraints:</span>
            <ul className="mt-1 space-y-1">
              {extraction.constraint_summary.map((constraint: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                  <span className="text-gray-400">•</span>
                  <span>{constraint}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <span className="font-medium text-gray-600 dark:text-gray-400">Extracted Value:</span>
            <p className="mt-1 font-semibold">{extraction.extracted_value || '—'}</p>
          </div>

          <div>
            <span className="font-medium text-gray-600 dark:text-gray-400">Evidence Trace:</span>
            <ul className="mt-1 space-y-1">
              {extraction.evidence_trace.map((evidence: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                  <span className="text-gray-400">→</span>
                  <span>{evidence}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <span className="font-medium text-gray-600 dark:text-gray-400">Reasoning:</span>
            <p className="mt-1 text-gray-600 dark:text-gray-400">{extraction.reasoning}</p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function SelfJustificationCard({ field, engine }: { field: any; engine: 'A' | 'B' }) {
  const data = engine === 'A' ? field.engineA : field.engineB;
  
  const getScoreBar = (value: number, type: 'normal' | 'corruption' = 'normal') => {
    const percentage = value * 100;
    let color = 'bg-gray-300';
    
    if (type === 'corruption') {
      if (value <= 0.1) color = 'bg-green-500';
      else if (value <= 0.3) color = 'bg-yellow-500';
      else color = 'bg-red-500';
    } else {
      if (value >= 0.9) color = 'bg-green-500';
      else if (value >= 0.7) color = 'bg-blue-500';
      else if (value >= 0.5) color = 'bg-yellow-500';
      else color = 'bg-red-500';
    }

    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className={`h-full ${color}`} style={{ width: `${percentage}%` }} />
        </div>
        <span className="text-sm font-medium w-12 text-right">{value.toFixed(2)}</span>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{field.field_name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2.5">
          <div>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Rule Consistency</span>
            {getScoreBar(data.rule_consistency)}
          </div>
          <div>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Engine Self-Consistency</span>
            {getScoreBar(data.engine_self_consistency)}
          </div>
          <div>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">OCR Alignment</span>
            {getScoreBar(data.ocr_alignment)}
          </div>
          <div>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">OCR Corruption</span>
            {getScoreBar(data.ocr_corruption, 'corruption')}
          </div>
        </div>
        <div className="pt-2 border-t">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Summary:</span>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{data.judgment_summary}</p>
        </div>
      </CardContent>
    </Card>
  );
}