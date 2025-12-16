/**
 * MissingItemsChecklist - Checklist of missing document items
 * Story 5.4: Proactive AI Suggestions System (Task 32)
 */

'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { MissingItem } from '@legal-platform/types';

// Icons
const CheckIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="16"
    height="16"
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const AlertIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="16"
    height="16"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
    />
  </svg>
);

const InfoIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="16"
    height="16"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const ExternalLinkIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="14"
    height="14"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
    />
  </svg>
);

const LightbulbIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="16"
    height="16"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
    />
  </svg>
);

export interface MissingItemsChecklistProps {
  items: MissingItem[];
  suggestions?: string[];
  onItemCheck?: (item: MissingItem) => void;
  onItemNavigate?: (item: MissingItem) => void;
  showSuggestions?: boolean;
  groupBySeverity?: boolean;
  className?: string;
}

const severityConfig = {
  required: {
    icon: AlertIcon,
    iconColor: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    label: 'Obligatoriu',
    badgeColor: 'bg-red-100 text-red-800',
  },
  recommended: {
    icon: InfoIcon,
    iconColor: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    label: 'Recomandat',
    badgeColor: 'bg-yellow-100 text-yellow-800',
  },
  optional: {
    icon: InfoIcon,
    iconColor: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    label: 'Opțional',
    badgeColor: 'bg-blue-100 text-blue-800',
  },
};

/**
 * MissingItemsChecklist displays missing document items
 * grouped by severity with AI suggestions.
 */
export function MissingItemsChecklist({
  items,
  suggestions = [],
  onItemCheck,
  onItemNavigate,
  showSuggestions = true,
  groupBySeverity = true,
  className = '',
}: MissingItemsChecklistProps) {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  // Group items by severity
  const groupedItems = useMemo(() => {
    if (!groupBySeverity) return { all: items };

    return {
      required: items.filter((i) => i.severity === 'required'),
      recommended: items.filter((i) => i.severity === 'recommended'),
      optional: items.filter((i) => i.severity === 'optional'),
    };
  }, [items, groupBySeverity]);

  const handleCheck = (item: MissingItem) => {
    const itemKey = `${item.item}-${item.section}`;
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemKey)) {
        next.delete(itemKey);
      } else {
        next.add(itemKey);
      }
      return next;
    });
    onItemCheck?.(item);
  };

  const isChecked = (item: MissingItem) => checkedItems.has(`${item.item}-${item.section}`);

  const renderItem = (item: MissingItem, index: number) => {
    const config = severityConfig[item.severity] || severityConfig.optional;
    const Icon = config.icon;
    const checked = isChecked(item);

    return (
      <li
        key={`${item.item}-${item.section}-${index}`}
        className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
          checked
            ? 'bg-gray-50 border-gray-200 opacity-60'
            : `${config.bgColor} ${config.borderColor}`
        }`}
      >
        {/* Checkbox */}
        <button
          onClick={() => handleCheck(item)}
          className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            checked
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          role="checkbox"
          aria-checked={checked}
          aria-label={`Marchează ca rezolvat: ${item.item}`}
        >
          {checked && <CheckIcon className="w-3 h-3" />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Icon className={`shrink-0 ${config.iconColor}`} />
            <span
              className={`font-medium ${
                checked ? 'line-through text-muted-foreground' : 'text-foreground'
              }`}
            >
              {item.item}
            </span>
            <Badge className={config.badgeColor} variant="secondary">
              {config.label}
            </Badge>
          </div>

          {item.section && (
            <p className="text-sm text-muted-foreground mt-1">Secțiune: {item.section}</p>
          )}

          {item.suggestion && (
            <p className="text-sm mt-2 text-muted-foreground">
              <span className="font-medium">Sugestie:</span> {item.suggestion}
            </p>
          )}

          {/* Navigate button */}
          {item.section && onItemNavigate && (
            <Button
              size="sm"
              variant="link"
              className="mt-1 h-auto p-0 text-xs"
              onClick={() => onItemNavigate(item)}
            >
              Navighează la secțiune
              <ExternalLinkIcon className="ml-1" />
            </Button>
          )}
        </div>
      </li>
    );
  };

  const renderGroup = (
    groupItems: MissingItem[],
    severity: 'required' | 'recommended' | 'optional',
    label: string
  ) => {
    if (groupItems.length === 0) return null;

    const config = severityConfig[severity];

    return (
      <div className="mb-4 last:mb-0">
        <h4 className="flex items-center gap-2 font-medium text-sm mb-2">
          <config.icon className={config.iconColor} />
          {label} ({groupItems.length})
        </h4>
        <ul className="space-y-2" role="list">
          {groupItems.map((item, index) => renderItem(item, index))}
        </ul>
      </div>
    );
  };

  return (
    <div className={`${className}`} role="list" aria-label="Elemente lipsă din document">
      {groupBySeverity ? (
        <>
          {renderGroup(groupedItems.required || [], 'required', 'Obligatoriu')}
          {renderGroup(groupedItems.recommended || [], 'recommended', 'Recomandat')}
          {renderGroup(groupedItems.optional || [], 'optional', 'Opțional')}
        </>
      ) : (
        <ul className="space-y-2">{items.map((item, index) => renderItem(item, index))}</ul>
      )}

      {/* AI Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <h4 className="flex items-center gap-2 font-medium text-sm text-purple-800 mb-2">
            <LightbulbIcon className="text-purple-600" />
            Sugestii AI
          </h4>
          <ul className="space-y-1">
            {suggestions.map((suggestion, index) => (
              <li key={index} className="text-sm text-purple-700 flex items-start gap-2">
                <span className="text-purple-400">•</span>
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Summary */}
      {items.length > 0 && (
        <div className="mt-4 pt-3 border-t text-sm text-muted-foreground">
          <p>
            {checkedItems.size} din {items.length} elemente marcate ca rezolvate
          </p>
        </div>
      )}
    </div>
  );
}

MissingItemsChecklist.displayName = 'MissingItemsChecklist';

/**
 * Compact version for sidebars or smaller spaces
 */
export interface MissingItemsCompactProps {
  items: MissingItem[];
  onItemNavigate?: (item: MissingItem) => void;
  maxVisible?: number;
}

export function MissingItemsCompact({
  items,
  onItemNavigate,
  maxVisible = 3,
}: MissingItemsCompactProps) {
  const requiredItems = items.filter((i) => i.severity === 'required');
  const visibleItems = requiredItems.slice(0, maxVisible);
  const hiddenCount = requiredItems.length - maxVisible;

  if (requiredItems.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {visibleItems.map((item, index) => (
        <div
          key={index}
          className="flex items-center justify-between p-2 bg-red-50 border border-red-200 rounded text-sm"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertIcon className="text-red-600 shrink-0" />
            <span className="truncate">{item.item}</span>
          </div>
          {item.section && onItemNavigate && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 shrink-0"
              onClick={() => onItemNavigate(item)}
            >
              <ExternalLinkIcon />
            </Button>
          )}
        </div>
      ))}
      {hiddenCount > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          +{hiddenCount} mai multe elemente obligatorii
        </p>
      )}
    </div>
  );
}

MissingItemsCompact.displayName = 'MissingItemsCompact';
