import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from './ui/sheet';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';
import type { FieldResult } from '../types';

interface FieldDrawerProps {
  field: FieldResult | null;
  open: boolean;
  onClose: () => void;
}

const getSignalLabel = (value: number): { label: string; variant: 'default' | 'secondary' | 'destructive' } => {
  if (value >= 0.9) return { label: 'Very High', variant: 'default' };
  if (value >= 0.7) return { label: 'High', variant: 'default' };
  if (value >= 0.5) return { label: 'Medium', variant: 'secondary' };
  if (value >= 0.3) return { label: 'Low', variant: 'secondary' };
  return { label: 'Weak', variant: 'destructive' };
};

const getCorruptionLabel = (value: number): { label: string; variant: 'default' | 'secondary' | 'destructive' } => {
  if (value <= 0.1) return { label: 'Absent', variant: 'default' };
  if (value <= 0.3) return { label: 'Possible', variant: 'secondary' };
  return { label: 'Present', variant: 'destructive' };
};

export function FieldDrawer({ field, open, onClose }: FieldDrawerProps) {
  const [compareMode, setCompareMode] = useState(false);

  if (!field) return null;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl">{field.field_name}</SheetTitle>
          <SheetDescription>
            Detailed analysis and evidence chain
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* (A) Final Decision (Summary) */}
          <div>
            <h3 className="font-semibold text-lg mb-3">Final Decision</h3>
            <Card>
              <CardContent className="p-4 space-y-3">
                <div>
                  <span className="text-sm text-gray-600">Recommended Value:</span>
                  <p className="text-2xl font-semibold mt-1">
                    {field.recommended_value || '—'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={
                    field.field_state === 'pass' ? 'default' :
                    field.field_state === 'review_needed' ? 'secondary' : 'destructive'
                  }>
                    {field.field_state === 'pass' ? 'Pass' :
                     field.field_state === 'review_needed' ? 'Review Needed' : 'Failed'}
                  </Badge>
                  <Badge variant="outline">
                    Confidence: {field.field_confidence.replace('_', ' ')}
                  </Badge>
                </div>
                {field.state_reason && (
                  <div className="pt-2 border-t">
                    <span className="text-sm font-medium text-gray-600">Reason:</span>
                    <p className="text-sm text-gray-700 mt-1">{field.state_reason}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* (B) Signals (2x2 Grid) */}
          <div>
            <h3 className="font-semibold text-lg mb-3">Signals</h3>
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <span className="text-sm text-gray-600">Rule Consistency</span>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold">
                        {field.signals.final_rule_consistency.toFixed(2)}
                      </span>
                      <Badge variant={getSignalLabel(field.signals.final_rule_consistency).variant}>
                        {getSignalLabel(field.signals.final_rule_consistency).label}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <span className="text-sm text-gray-600">Engine Self-Consistency</span>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold">
                        {field.signals.final_engine_self_consistency.toFixed(2)}
                      </span>
                      <Badge variant={getSignalLabel(field.signals.final_engine_self_consistency).variant}>
                        {getSignalLabel(field.signals.final_engine_self_consistency).label}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <span className="text-sm text-gray-600">OCR Alignment</span>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold">
                        {field.signals.final_ocr_alignment.toFixed(2)}
                      </span>
                      <Badge variant={getSignalLabel(field.signals.final_ocr_alignment).variant}>
                        {getSignalLabel(field.signals.final_ocr_alignment).label}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <span className="text-sm text-gray-600">OCR Corruption</span>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold">
                        {field.signals.final_ocr_corruption.toFixed(2)}
                      </span>
                      <Badge variant={getCorruptionLabel(field.signals.final_ocr_corruption).variant}>
                        {getCorruptionLabel(field.signals.final_ocr_corruption).label}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <Separator />

          {/* (C) Engine Comparison (A vs B) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-lg">Engine Comparison</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCompareMode(!compareMode)}
              >
                {compareMode ? 'Collapse' : 'Expand'} Details
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Engine A</CardTitle>
                  {field.selected_engine === 'engineA' && (
                    <Badge variant="default" className="w-fit">Selected</Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <span className="text-gray-600">Value:</span>
                    <p className="font-medium mt-1">{field.engineA.extracted_value || '—'}</p>
                  </div>
                  {compareMode && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Consistency:</span>
                          <span>{field.engineA.rule_consistency.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">OCR Align:</span>
                          <span>{field.engineA.ocr_alignment.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Corruption:</span>
                          <span>{field.engineA.ocr_corruption.toFixed(2)}</span>
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <span className="text-gray-600">Summary:</span>
                        <p className="text-xs mt-1 text-gray-700">{field.engineA.judgment_summary}</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Engine B</CardTitle>
                  {field.selected_engine === 'engineB' && (
                    <Badge variant="default" className="w-fit">Selected</Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <span className="text-gray-600">Value:</span>
                    <p className="font-medium mt-1">{field.engineB.extracted_value || '—'}</p>
                  </div>
                  {compareMode && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Consistency:</span>
                          <span>{field.engineB.rule_consistency.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">OCR Align:</span>
                          <span>{field.engineB.ocr_alignment.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Corruption:</span>
                          <span>{field.engineB.ocr_corruption.toFixed(2)}</span>
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <span className="text-gray-600">Summary:</span>
                        <p className="text-xs mt-1 text-gray-700">{field.engineB.judgment_summary}</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}