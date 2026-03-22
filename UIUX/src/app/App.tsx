import { useState } from 'react';
import { Toaster } from './components/ui/sonner';
import { HistorySidebar } from './components/HistorySidebar';
import { UploadSection } from './components/UploadSection';
import { RunControls } from './components/RunControls';
import { ModernFieldCard } from './components/ModernFieldCard';
import { FieldDrawer } from './components/FieldDrawer';
import { ExplainDebugDrawer } from './components/ExplainDebugDrawer';
import { Download, Sparkles } from 'lucide-react';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { mockRunResult } from './mockData';
import { toast } from 'sonner';
import type { RunResult, PipelineStep, FieldResult } from './types';

export default function App() {
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState<PipelineStep | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [history, setHistory] = useState<RunResult[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedField, setSelectedField] = useState<FieldResult | null>(null);

  // Upload form state
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('');
  const [fields, setFields] = useState<string[]>(['company', 'date', 'address', 'total']);

  const handleRun = async () => {
    setIsRunning(true);

    // Simulate pipeline steps (5 steps)
    for (let step = 1; step <= 5; step++) {
      setCurrentStep(step as PipelineStep);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Set mock result with current timestamp
    const newResult = {
      ...mockRunResult,
      metadata: {
        ...mockRunResult.metadata,
        timestamp: new Date().toLocaleTimeString(),
        doc_category: category,
        fields: fields,
        debug: debugMode,
      },
    };
    
    setResult(newResult);
    setHistory(prev => [newResult, ...prev].slice(0, 20)); // Keep last 20
    setIsRunning(false);
    setCurrentStep(null);
  };

  const handleSelectHistory = (historyResult: RunResult) => {
    setResult(historyResult);
  };

  const handleDeleteHistory = (index: number) => {
    setHistory(prev => prev.filter((_, i) => i !== index));
    toast.success('History item deleted');
  };

  const handleNewChat = () => {
    setResult(null);
    setUploadedImage(null);
    setCategory('');
    setFields(['company', 'date', 'address', 'total']);
  };

  const downloadFinalResult = () => {
    if (!result) return;
    const json = JSON.stringify(result, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'final_result.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded final_result.json');
  };

  const canRun = uploadedImage && category;

  // Sort fields: review_needed and fail first
  const sortedFields = result ? [...result.fields].sort((a, b) => {
    const priority = { fail: 0, review_needed: 1, pass: 2 };
    return priority[a.field_state] - priority[b.field_state];
  }) : [];

  const getOverallStatus = () => {
    if (!result) return null;
    const hasFailure = result.fields.some(f => f.field_state === 'fail');
    const hasReview = result.fields.some(f => f.field_state === 'review_needed');
    
    if (hasFailure) return { label: 'Failed Fields', variant: 'destructive' as const };
    if (hasReview) return { label: 'Needs Review', variant: 'secondary' as const };
    return { label: 'All Passed', variant: 'default' as const };
  };

  const overallStatus = getOverallStatus();

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* History Sidebar */}
      <HistorySidebar
        history={history}
        currentResult={result}
        onSelectHistory={handleSelectHistory}
        onDeleteHistory={handleDeleteHistory}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onNewChat={handleNewChat}
      />

      {/* Main Content - Two Column Layout */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Fixed Header */}
        <div className="flex-shrink-0 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
          <div className="h-16 px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">AI Document Analyzer</h1>
                <p className="text-sm text-gray-500">Intelligent field extraction</p>
              </div>
            </div>
            {result && overallStatus && (
              <div className="flex items-center gap-3">
                <Badge variant={overallStatus.variant} className="text-sm h-7 px-3">
                  {overallStatus.label}
                </Badge>
                <span className="text-sm text-gray-500">
                  {result.metadata.elapsed_seconds.toFixed(1)}s
                </span>
                <Button onClick={downloadFinalResult} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export JSON
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column - Input */}
          <div className="w-[420px] flex-shrink-0 bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 flex flex-col">
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold mb-1">Input</h2>
                  <p className="text-sm text-gray-500">Upload and configure</p>
                </div>

                <UploadSection
                  uploadedImage={uploadedImage}
                  onImageUpload={setUploadedImage}
                  onImageRemove={() => setUploadedImage(null)}
                  category={category}
                  onCategoryChange={setCategory}
                  fields={fields}
                  onFieldsChange={setFields}
                />
              </div>
            </div>

            <div className="flex-shrink-0 p-6 border-t border-gray-200 dark:border-gray-800">
              <RunControls
                onRun={handleRun}
                isRunning={isRunning}
                currentStep={currentStep}
                debugMode={debugMode}
                onDebugModeChange={setDebugMode}
                canRun={!!canRun}
              />
            </div>
          </div>

          {/* Right Column - Results */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 overflow-y-auto">
              {!result ? (
                <div className="h-full flex items-center justify-center p-8">
                  <div className="text-center max-w-md">
                    <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="h-10 w-10 text-gray-400" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Ready to analyze</h3>
                    <p className="text-gray-500">
                      Upload a document and click "Run Analysis" to extract fields
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-6 space-y-6">
                  {/* Summary */}
                  <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-xl font-bold mb-1">Results</h2>
                        <p className="text-sm text-gray-500">
                          {result.fields.length} fields • {result.metadata.doc_category}
                        </p>
                      </div>
                      <Button variant="outline" onClick={handleNewChat} size="sm">
                        New Analysis
                      </Button>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                        <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                          {result.fields.filter(f => f.field_state === 'pass').length}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 font-medium">Passed</div>
                      </div>
                      <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
                        <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                          {result.fields.filter(f => f.field_state === 'review_needed').length}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 font-medium">Review</div>
                      </div>
                      <div className="text-center p-4 bg-red-50 dark:bg-red-950/20 rounded-lg">
                        <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                          {result.fields.filter(f => f.field_state === 'fail').length}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 font-medium">Failed</div>
                      </div>
                    </div>
                  </div>

                  {/* Field Cards - 2 Column Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    {sortedFields.map((field) => (
                      <ModernFieldCard
                        key={field.field_name}
                        field={field}
                        onClick={() => setSelectedField(field)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Drawer */}
            {result && (
              <div className="flex-shrink-0">
                <ExplainDebugDrawer result={result} debugMode={debugMode} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Field Details Drawer */}
      <FieldDrawer
        field={selectedField}
        open={!!selectedField}
        onClose={() => setSelectedField(null)}
      />

      <Toaster />
    </div>
  );
}