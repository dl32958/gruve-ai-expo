import { useState } from 'react';
import { MessageSquare, PanelLeftClose, PanelLeft, Trash2, Clock, Plus } from 'lucide-react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import type { RunResult } from '../types';

interface HistorySidebarProps {
  history: RunResult[];
  currentResult: RunResult | null;
  onSelectHistory: (result: RunResult) => void;
  onDeleteHistory: (index: number) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onNewChat: () => void;
}

export function HistorySidebar({
  history,
  currentResult,
  onSelectHistory,
  onDeleteHistory,
  isCollapsed,
  onToggleCollapse,
  onNewChat,
}: HistorySidebarProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'partial':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'failed':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  if (isCollapsed) {
    return (
      <div className="w-14 bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 flex flex-col items-center py-3 gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="h-10 w-10 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <PanelLeft className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onNewChat}
          className="h-10 w-10 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-64 bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 flex flex-col">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-3 border-b border-gray-200 dark:border-gray-800">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="h-9 w-9 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <PanelLeftClose className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onNewChat}
          className="text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <Plus className="h-4 w-4 mr-1" />
          New
        </Button>
      </div>

      {/* History List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {history.length === 0 ? (
            <div className="text-center py-12 px-4">
              <MessageSquare className="h-10 w-10 mx-auto mb-3 text-gray-300 dark:text-gray-700" />
              <p className="text-sm text-gray-500 dark:text-gray-600">No history yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-700 mt-1">
                Upload a document to start
              </p>
            </div>
          ) : (
            history.map((item, index) => (
              <div
                key={index}
                className={`
                  relative group rounded-lg p-2.5 cursor-pointer transition-all
                  ${currentResult === item 
                    ? 'bg-gray-100 dark:bg-gray-800' 
                    : 'hover:bg-gray-50 dark:hover:bg-gray-900'
                  }
                `}
                onClick={() => onSelectHistory(item)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div className="flex items-start gap-2">
                  <MessageSquare className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {item.metadata.doc_category}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500 dark:text-gray-500">
                        {item.metadata.timestamp}
                      </span>
                      <Badge
                        className={`text-xs h-4 px-1.5 ${getStatusColor(item.status)}`}
                        variant="secondary"
                      >
                        {item.fields.length}
                      </Badge>
                    </div>
                  </div>
                  {hoveredIndex === index && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-red-600 dark:hover:text-red-400"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteHistory(index);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}