'use client';

import * as React from 'react';
import { useState } from 'react';
import { Pencil, ChevronDown, ChevronUp, CheckCircle2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InlineEditor } from './InlineEditor';
import type {
  ContextSection as ContextSectionType,
  UserCorrection,
  CorrectionType,
} from '@/graphql/case-context';

interface ContextSectionProps {
  section: ContextSectionType;
  corrections: UserCorrection[];
  onAddCorrection: (data: {
    sectionId: string;
    correctedValue: string;
    correctionType: CorrectionType;
    reason?: string;
  }) => Promise<void>;
  className?: string;
}

// Render inline formatting (bold, etc.)
function renderInlineFormatting(text: string): React.ReactNode {
  if (!text.includes('**')) return text;

  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-medium text-linear-text-primary">
        {part}
      </strong>
    ) : (
      part
    )
  );
}

// Enhanced markdown rendering with better structure
function renderContent(content: string): React.ReactNode {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];
  let inList = false;

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="space-y-2 mt-1">
          {currentList}
        </ul>
      );
      currentList = [];
      inList = false;
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Empty line - flush list and add spacing
    if (!trimmed) {
      flushList();
      elements.push(<div key={index} className="h-1.5" />);
      return;
    }

    // Strikethrough (removed content)
    if (trimmed.startsWith('~~') && trimmed.endsWith('~~')) {
      flushList();
      elements.push(
        <p key={index} className="text-sm text-linear-text-tertiary line-through opacity-60">
          {trimmed.slice(2, -2)}
        </p>
      );
      return;
    }

    // Nested list item (indented with spaces, starts with -)
    if (line.match(/^\s{2,}- /) && inList) {
      const nestedContent = trimmed.slice(2);
      currentList.push(
        <li key={index} className="ml-5 flex gap-2 text-sm text-linear-text-tertiary">
          <span className="text-linear-text-quaternary shrink-0">◦</span>
          <span>{renderInlineFormatting(nestedContent)}</span>
        </li>
      );
      return;
    }

    // Main list item (starts with -)
    if (trimmed.startsWith('- ')) {
      inList = true;
      const itemContent = trimmed.slice(2);

      // Check for document pattern: **Title** (type): summary
      const docMatch = itemContent.match(/^\*\*(.+?)\*\*\s*\(([^)]+)\):\s*(.+)$/);
      if (docMatch) {
        const [, title, type, summary] = docMatch;
        currentList.push(
          <li key={index} className="flex gap-2 text-sm">
            <span className="text-linear-accent shrink-0 mt-px">•</span>
            <div className="flex flex-col gap-1">
              <span>
                <span className="font-medium text-linear-text-primary">{title}</span>
                <span className="text-linear-text-tertiary ml-1.5 text-xs">({type})</span>
              </span>
              <span className="text-linear-text-secondary text-[13px] leading-relaxed">
                {summary}
              </span>
            </div>
          </li>
        );
        return;
      }

      // Check for email pattern: **Subject**!: summary (! indicates urgent)
      const emailMatch = itemContent.match(/^\*\*(.+?)\*\*(\s*!)?\s*:\s*(.+)$/);
      if (emailMatch) {
        const [, subject, urgent, summary] = emailMatch;
        currentList.push(
          <li key={index} className="flex gap-2 text-sm">
            <span className="text-linear-accent shrink-0 mt-px">•</span>
            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5">
                <span className="font-medium text-linear-text-primary">{subject}</span>
                {urgent && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[10px] font-medium">
                    Urgent
                  </span>
                )}
              </span>
              <span className="text-linear-text-secondary text-[13px] leading-relaxed">
                {summary}
              </span>
            </div>
          </li>
        );
        return;
      }

      // Check for key-value pattern (e.g., "Rol: Nume")
      const kvMatch = itemContent.match(/^([^:]+):\s*(.+)$/);
      if (kvMatch) {
        const [, key, value] = kvMatch;
        currentList.push(
          <li key={index} className="flex gap-2 text-sm">
            <span className="text-linear-accent shrink-0 mt-px">•</span>
            <span>
              <span className="text-linear-text-tertiary">{key}:</span>{' '}
              <span className="text-linear-text-secondary">{renderInlineFormatting(value)}</span>
            </span>
          </li>
        );
      } else {
        currentList.push(
          <li key={index} className="flex gap-2 text-sm">
            <span className="text-linear-accent shrink-0 mt-px">•</span>
            <span className="text-linear-text-secondary">
              {renderInlineFormatting(itemContent)}
            </span>
          </li>
        );
      }
      return;
    }

    // Key-value line (not in list, e.g., "Nume: Value")
    const kvMatch = trimmed.match(/^([^:]+):\s*(.+)$/);
    if (kvMatch && !inList) {
      flushList();
      const [, key, value] = kvMatch;
      elements.push(
        <div key={index} className="flex gap-2 text-sm py-0.5">
          <span className="text-linear-text-tertiary min-w-[80px] shrink-0">{key}:</span>
          <span className="text-linear-text-secondary">{renderInlineFormatting(value)}</span>
        </div>
      );
      return;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <p key={index} className="text-sm text-linear-text-secondary">
        {renderInlineFormatting(trimmed)}
      </p>
    );
  });

  // Flush any remaining list items
  flushList();

  return elements;
}

export function ContextSection({
  section,
  corrections,
  onAddCorrection,
  className,
}: ContextSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  // Count active corrections for this section
  const activeCorrectionCount = corrections.filter((c) => c.isActive).length;

  const handleSave = async (data: {
    correctedValue: string;
    correctionType: CorrectionType;
    reason?: string;
  }) => {
    await onAddCorrection({
      sectionId: section.id,
      ...data,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  return (
    <div
      className={cn(
        'rounded-lg border border-linear-border-subtle bg-linear-bg-secondary overflow-hidden',
        isEditing && 'ring-1 ring-linear-accent',
        className
      )}
    >
      {/* Section header */}
      <div
        className={cn(
          'flex items-center justify-between px-4 py-3 cursor-pointer transition-colors',
          isExpanded ? 'bg-linear-bg-tertiary' : 'hover:bg-linear-bg-hover'
        )}
        onClick={() => !isEditing && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <FileText className="w-4 h-4 text-linear-text-tertiary" />
          <h4 className="text-sm font-medium text-linear-text-primary">{section.title}</h4>
          {activeCorrectionCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-linear-accent/10 text-linear-accent text-[10px] font-medium">
              <CheckCircle2 className="w-3 h-3" />
              {activeCorrectionCount} {activeCorrectionCount === 1 ? 'corectie' : 'corectii'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-linear-text-tertiary">{section.tokenCount} tokeni</span>
          {!isEditing && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
                setIsExpanded(true);
              }}
              className="p-1.5 rounded-md hover:bg-linear-bg-hover transition-colors"
              title="Editeaza sectiunea"
            >
              <Pencil className="w-3.5 h-3.5 text-linear-text-tertiary" />
            </button>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-linear-text-tertiary" />
          ) : (
            <ChevronDown className="w-4 h-4 text-linear-text-tertiary" />
          )}
        </div>
      </div>

      {/* Section content */}
      {isExpanded && (
        <div className="p-4">
          {isEditing ? (
            <InlineEditor
              initialContent={section.content}
              sectionId={section.id}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          ) : (
            <div className="space-y-1.5">{renderContent(section.content)}</div>
          )}

          {/* Show corrections applied to this section */}
          {!isEditing && activeCorrectionCount > 0 && (
            <div className="mt-4 pt-4 border-t border-linear-border-subtle">
              <p className="text-[10px] font-medium text-linear-text-tertiary uppercase tracking-wider mb-2">
                Corectii aplicate
              </p>
              <div className="space-y-2">
                {corrections
                  .filter((c) => c.isActive)
                  .map((correction) => (
                    <div
                      key={correction.id}
                      className="flex items-start gap-2 p-2 rounded bg-linear-accent/5 text-xs"
                    >
                      <span
                        className={cn(
                          'px-1.5 py-0.5 rounded text-[10px] font-medium',
                          correction.correctionType === 'override' &&
                            'bg-blue-500/10 text-blue-400',
                          correction.correctionType === 'append' &&
                            'bg-green-500/10 text-green-400',
                          correction.correctionType === 'remove' && 'bg-red-500/10 text-red-400',
                          correction.correctionType === 'note' && 'bg-yellow-500/10 text-yellow-400'
                        )}
                      >
                        {correction.correctionType}
                      </span>
                      <span className="text-linear-text-secondary flex-1 truncate">
                        {correction.correctedValue.slice(0, 100)}
                        {correction.correctedValue.length > 100 && '...'}
                      </span>
                      {correction.reason && (
                        <span className="text-linear-text-tertiary italic">
                          ({correction.reason})
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ContextSection;
