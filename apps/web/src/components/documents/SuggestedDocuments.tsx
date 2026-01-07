'use client';

import { useState } from 'react';
import { Sparkles, Check, X, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Button,
  Badge,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui';
// Badge used for header count, custom badge styling for confidence
import { cn } from '@/lib/utils';
import type { Document } from '@/types/document';
import { formatFileSize, fileTypeColors } from '@/types/document';

// Confidence level for document matching
export type MatchConfidence = 'high' | 'medium' | 'low';

// Document suggestion with confidence score
export interface DocumentSuggestion {
  document: Document;
  confidence: MatchConfidence;
  matchReason: string;
}

interface SuggestedDocumentsProps {
  suggestions: DocumentSuggestion[];
  slotName: string;
  onAssign?: (documentId: string) => void;
  onIgnore?: (documentId: string) => void;
  className?: string;
  compact?: boolean;
}

/**
 * SuggestedDocuments component
 * Shows AI-suggested documents for an empty slot with confidence indicators
 */
export function SuggestedDocuments({
  suggestions,
  slotName,
  onAssign,
  onIgnore,
  className,
  compact = false,
}: SuggestedDocumentsProps) {
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [ignoredIds, setIgnoredIds] = useState<Set<string>>(new Set());

  // Filter out ignored suggestions
  const visibleSuggestions = suggestions.filter((s) => !ignoredIds.has(s.document.id));

  if (visibleSuggestions.length === 0) {
    return null;
  }

  const handleIgnore = (documentId: string) => {
    setIgnoredIds((prev) => new Set(prev).add(documentId));
    onIgnore?.(documentId);
  };

  const getConfidenceColor = (confidence: MatchConfidence) => {
    switch (confidence) {
      case 'high':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-gray-100 text-gray-600 border-gray-300';
    }
  };

  const getConfidenceLabel = (confidence: MatchConfidence) => {
    switch (confidence) {
      case 'high':
        return 'Potrivire bună';
      case 'medium':
        return 'Potrivire medie';
      case 'low':
        return 'Potrivire slabă';
    }
  };

  return (
    <div className={cn('border border-linear-border-subtle rounded-lg overflow-hidden', className)}>
      {/* Header */}
      <button
        className={cn(
          'w-full flex items-center justify-between px-3 py-2',
          'bg-linear-accent/5 hover:bg-linear-accent/10 transition-colors',
          'text-left'
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-linear-accent" />
          <span className="text-sm font-medium text-linear-text-primary">
            Sugestii pentru &quot;{slotName}&quot;
          </span>
          <Badge variant="default" className="text-xs">
            {visibleSuggestions.length}
          </Badge>
        </div>
        {compact &&
          (isExpanded ? (
            <ChevronUp className="w-4 h-4 text-linear-text-tertiary" />
          ) : (
            <ChevronDown className="w-4 h-4 text-linear-text-tertiary" />
          ))}
      </button>

      {/* Suggestions List */}
      {isExpanded && (
        <div className="divide-y divide-linear-border-subtle">
          {visibleSuggestions.map((suggestion) => (
            <SuggestionItem
              key={suggestion.document.id}
              suggestion={suggestion}
              onAssign={() => onAssign?.(suggestion.document.id)}
              onIgnore={() => handleIgnore(suggestion.document.id)}
              getConfidenceColor={getConfidenceColor}
              getConfidenceLabel={getConfidenceLabel}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface SuggestionItemProps {
  suggestion: DocumentSuggestion;
  onAssign: () => void;
  onIgnore: () => void;
  getConfidenceColor: (confidence: MatchConfidence) => string;
  getConfidenceLabel: (confidence: MatchConfidence) => string;
}

function SuggestionItem({
  suggestion,
  onAssign,
  onIgnore,
  getConfidenceColor,
  getConfidenceLabel,
}: SuggestionItemProps) {
  const { document, confidence, matchReason } = suggestion;

  return (
    <div className="px-3 py-2 flex items-center gap-3 bg-linear-bg-primary hover:bg-linear-bg-secondary transition-colors">
      {/* File Icon */}
      <div
        className="w-8 h-8 rounded flex items-center justify-center"
        style={{ backgroundColor: `${fileTypeColors[document.fileType]}15` }}
      >
        <FileText className="w-4 h-4" style={{ color: fileTypeColors[document.fileType] }} />
      </div>

      {/* Document Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-linear-text-primary truncate">
            {document.fileName}
          </span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full text-xs font-medium px-2 py-0.5 border',
                    getConfidenceColor(confidence)
                  )}
                >
                  {confidence === 'high' ? '95%' : confidence === 'medium' ? '70%' : '40%'}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">{getConfidenceLabel(confidence)}</p>
                <p className="text-xs text-gray-400 mt-1">{matchReason}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-linear-text-tertiary">
            {formatFileSize(document.fileSize)}
          </span>
          <span className="text-xs text-linear-text-muted">
            {new Date(document.uploadedAt).toLocaleDateString('ro-RO')}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-linear-success hover:bg-linear-success/10"
                onClick={onAssign}
              >
                <Check className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Atribuie documentul</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-linear-text-tertiary hover:text-linear-error hover:bg-linear-error/10"
                onClick={onIgnore}
              >
                <X className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Ignoră sugestia</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

/**
 * Empty slot with suggestions indicator
 * Use this in MapaSlotItem when suggestions are available
 */
interface SuggestionsIndicatorProps {
  count: number;
  onClick?: () => void;
  className?: string;
}

export function SuggestionsIndicator({ count, onClick, className }: SuggestionsIndicatorProps) {
  if (count === 0) return null;

  return (
    <button
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded',
        'bg-linear-accent/10 hover:bg-linear-accent/20 transition-colors',
        'text-linear-accent text-xs font-medium',
        className
      )}
      onClick={onClick}
    >
      <Sparkles className="w-3 h-3" />
      <span>
        {count} {count === 1 ? 'sugestie' : 'sugestii'}
      </span>
    </button>
  );
}
