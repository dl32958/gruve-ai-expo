import { Play, Loader2, Settings2 } from 'lucide-react';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Card } from './ui/card';
import { Progress } from './ui/progress';
import type { PipelineStep } from '../types';

interface RunControlsProps {
  onRun: () => void;
  isRunning: boolean;
  currentStep: PipelineStep | null;
  debugMode: boolean;
  onDebugModeChange: (enabled: boolean) => void;
  canRun: boolean;
}

const PIPELINE_STEPS = [
  { step: 1, label: 'OCR Processing' },
  { step: 2, label: 'Constraints Analysis' },
  { step: 3, label: 'Data Extraction' },
  { step: 4, label: 'Rule Synthesis' },
  { step: 5, label: 'Cross Validation' },
];

export function RunControls({
  onRun,
  isRunning,
  currentStep,
  debugMode,
  onDebugModeChange,
  canRun,
}: RunControlsProps) {
  const getProgress = () => {
    if (!currentStep) return 0;
    return (currentStep / 5) * 100;
  };

  return (
    <div className="space-y-4">
      {/* Debug Mode Toggle */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-gray-500" />
            <div>
              <Label className="text-sm font-medium cursor-pointer">Debug Mode</Label>
              <p className="text-xs text-gray-500">Enable detailed logging and downloads</p>
            </div>
          </div>
          <Switch checked={debugMode} onCheckedChange={onDebugModeChange} />
        </div>
      </Card>

      {/* Run Button */}
      <Button
        className="w-full h-12 text-base font-medium"
        size="lg"
        onClick={onRun}
        disabled={!canRun || isRunning}
      >
        {isRunning ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Play className="h-5 w-5 mr-2" />
            Run Analysis
          </>
        )}
      </Button>

      {/* Progress Indicator */}
      {isRunning && currentStep && (
        <Card className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{PIPELINE_STEPS[currentStep - 1].label}</span>
              <span className="text-gray-500">
                Step {currentStep}/5
              </span>
            </div>
            <Progress value={getProgress()} className="h-2" />
            <div className="grid grid-cols-5 gap-1">
              {PIPELINE_STEPS.map(({ step }) => (
                <div
                  key={step}
                  className={`
                    h-1 rounded-full transition-all
                    ${currentStep > step ? 'bg-green-500' : ''}
                    ${currentStep === step ? 'bg-blue-500 animate-pulse' : ''}
                    ${currentStep < step ? 'bg-gray-200 dark:bg-gray-700' : ''}
                  `}
                />
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
