import {
  Copy,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { toast } from "sonner";
import type { FieldResult, FieldState } from "../types";

interface ModernFieldCardProps {
  field: FieldResult;
  onClick: () => void;
}

const stateConfig: Record<
  FieldState,
  {
    icon: React.ReactNode;
    label: string;
    bg: string;
    border: string;
    textColor: string;
  }
> = {
  pass: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    label: "Pass",
    bg: "bg-green-50 dark:bg-green-950/20",
    border: "border-l-green-500",
    textColor: "text-green-700 dark:text-green-400",
  },
  review_needed: {
    icon: <AlertCircle className="h-4 w-4" />,
    label: "Review Needed",
    bg: "bg-yellow-50 dark:bg-yellow-950/20",
    border: "border-l-yellow-500",
    textColor: "text-yellow-700 dark:text-yellow-400",
  },
  fail: {
    icon: <XCircle className="h-4 w-4" />,
    label: "Failed",
    bg: "bg-red-50 dark:bg-red-950/20",
    border: "border-l-red-500",
    textColor: "text-red-700 dark:text-red-400",
  },
};

export function ModernFieldCard({
  field,
  onClick,
}: ModernFieldCardProps) {
  const config = stateConfig[field.field_state];

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (field.recommended_value) {
      navigator.clipboard.writeText(field.recommended_value);
      toast.success('Copied to clipboard');
    }
  };

  const getReasoning = () => {
    if (field.selected_engine === 'engineA') return field.engineA.reasoning;
    if (field.selected_engine === 'engineB') return field.engineB.reasoning;
    return null;
  };

  const reasoning = getReasoning();

  return (
    <Card
      className={`
        group cursor-pointer transition-all duration-200 border-l-4
        hover:shadow-lg hover:scale-[1.02] ${config.border} ${config.bg}
      `}
      onClick={onClick}
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <span className={config.textColor}>{config.icon}</span>
              <h3 className="font-bold text-xl">{field.field_name}</h3>
            </div>
            <Badge variant="outline" className={`${config.textColor} border-current text-sm`}>
              {config.label}
            </Badge>
          </div>
          <ChevronRight className="h-6 w-6 text-gray-400 group-hover:translate-x-1 transition-transform flex-shrink-0" />
        </div>

        {/* Value */}
        <div className="mb-4 p-4 bg-white dark:bg-gray-900 rounded-lg border">
          {field.recommended_value ? (
            <div className="flex items-start gap-2">
              <span className="text-2xl font-bold flex-1 break-all leading-tight">
                {field.recommended_value}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 flex-shrink-0 hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={handleCopy}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-400">
              <span className="text-2xl font-bold">—</span>
              <span className="text-base">No value extracted</span>
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="space-y-2.5 text-base">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400 font-medium">Confidence</span>
            <Badge variant="secondary" className="capitalize text-sm">
              {field.field_confidence.replace('_', ' ')}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400 font-medium">Engine</span>
            <Badge variant="outline" className="text-sm">
              {field.selected_engine === 'engineA' ? 'Engine A' : 
               field.selected_engine === 'engineB' ? 'Engine B' : 'None'}
            </Badge>
          </div>
          
          {reasoning && (
            <div className="pt-3 mt-3 border-t">
              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
                {reasoning}
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}