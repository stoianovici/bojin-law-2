/**
 * CompletenessIndicator - Visual progress indicator for document completeness
 * Story 5.4: Proactive AI Suggestions System (Task 31)
 */

'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { MissingItemsChecklist } from './MissingItemsChecklist';
import type { CompletenessCheckResult, MissingItem } from '@legal-platform/types';

export interface CompletenessIndicatorProps {
  completenessScore: number; // 0.0 - 1.0
  missingItems?: MissingItem[];
  suggestions?: string[];
  documentType?: string;
  onItemCheck?: (item: MissingItem) => void;
  onItemNavigate?: (item: MissingItem) => void;
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeConfig = {
  sm: {
    ring: 'w-8 h-8',
    stroke: 3,
    text: 'text-xs',
    radius: 12,
  },
  md: {
    ring: 'w-12 h-12',
    stroke: 4,
    text: 'text-sm',
    radius: 18,
  },
  lg: {
    ring: 'w-16 h-16',
    stroke: 5,
    text: 'text-base',
    radius: 26,
  },
};

function getScoreColor(score: number): {
  stroke: string;
  bg: string;
  text: string;
  label: string;
} {
  if (score >= 0.9) {
    return {
      stroke: 'stroke-green-500',
      bg: 'bg-green-100',
      text: 'text-green-700',
      label: 'Complet',
    };
  }
  if (score >= 0.7) {
    return {
      stroke: 'stroke-yellow-500',
      bg: 'bg-yellow-100',
      text: 'text-yellow-700',
      label: 'Parțial',
    };
  }
  return {
    stroke: 'stroke-red-500',
    bg: 'bg-red-100',
    text: 'text-red-700',
    label: 'Incomplet',
  };
}

/**
 * CompletenessIndicator displays a circular progress ring
 * showing document completeness score.
 */
export function CompletenessIndicator({
  completenessScore,
  missingItems = [],
  suggestions = [],
  documentType,
  onItemCheck,
  onItemNavigate,
  showDetails = true,
  size = 'md',
  className = '',
}: CompletenessIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const config = sizeConfig[size];
  const scoreColor = getScoreColor(completenessScore);
  const percentage = Math.round(completenessScore * 100);

  // Calculate SVG parameters
  const circumference = 2 * Math.PI * config.radius;
  const strokeDashoffset = circumference - (completenessScore * circumference);

  const hasIssues = missingItems.length > 0;
  const requiredCount = missingItems.filter((i) => i.severity === 'required').length;

  return (
    <div className={className}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <button
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
            aria-label={`Completitudine document: ${percentage}%. ${
              hasIssues ? `${missingItems.length} probleme de rezolvat.` : 'Complet.'
            } Apasă pentru detalii.`}
            aria-expanded={isExpanded}
          >
            {/* Progress Ring */}
            <div
              className={`relative ${config.ring}`}
              role="progressbar"
              aria-valuenow={percentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${percentage}% complet`}
            >
              <svg className="w-full h-full transform -rotate-90">
                {/* Background circle */}
                <circle
                  cx="50%"
                  cy="50%"
                  r={config.radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={config.stroke}
                  className="text-gray-200"
                />
                {/* Progress circle */}
                <circle
                  cx="50%"
                  cy="50%"
                  r={config.radius}
                  fill="none"
                  strokeWidth={config.stroke}
                  strokeLinecap="round"
                  className={scoreColor.stroke}
                  style={{
                    strokeDasharray: circumference,
                    strokeDashoffset,
                    transition: 'stroke-dashoffset 0.5s ease-in-out',
                  }}
                />
              </svg>
              {/* Percentage text */}
              <span
                className={`absolute inset-0 flex items-center justify-center font-medium ${config.text}`}
              >
                {percentage}%
              </span>
            </div>

            {/* Text label */}
            <div className="text-left">
              <p className={`font-medium ${scoreColor.text} ${config.text}`}>
                {scoreColor.label}
              </p>
              {hasIssues && (
                <p className="text-xs text-muted-foreground">
                  {requiredCount > 0
                    ? `${requiredCount} element${requiredCount > 1 ? 'e' : ''} obligatoriu${
                        requiredCount > 1 ? 'e' : ''
                      } lipsesc`
                    : `${missingItems.length} sugestii`}
                </p>
              )}
            </div>

            {/* Badge for issues count */}
            {hasIssues && (
              <Badge
                variant="secondary"
                className={`${scoreColor.bg} ${scoreColor.text}`}
              >
                {missingItems.length}
              </Badge>
            )}
          </button>
        </CollapsibleTrigger>

        {showDetails && hasIssues && (
          <CollapsibleContent className="pt-2">
            <MissingItemsChecklist
              items={missingItems}
              suggestions={suggestions}
              onItemCheck={onItemCheck}
              onItemNavigate={onItemNavigate}
            />
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  );
}

CompletenessIndicator.displayName = 'CompletenessIndicator';

/**
 * Compact inline version for use in document lists
 */
export interface CompletenessIndicatorInlineProps {
  completenessScore: number;
  missingCount?: number;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export function CompletenessIndicatorInline({
  completenessScore,
  missingCount = 0,
  size = 'sm',
  showLabel = false,
}: CompletenessIndicatorInlineProps) {
  const config = sizeConfig[size];
  const scoreColor = getScoreColor(completenessScore);
  const percentage = Math.round(completenessScore * 100);

  const circumference = 2 * Math.PI * config.radius;
  const strokeDashoffset = circumference - (completenessScore * circumference);

  return (
    <div
      className="flex items-center gap-1"
      role="progressbar"
      aria-valuenow={percentage}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${percentage}% complet`}
      title={`${percentage}% complet${
        missingCount > 0 ? `, ${missingCount} probleme` : ''
      }`}
    >
      <div className={`relative ${config.ring}`}>
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="50%"
            cy="50%"
            r={config.radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={config.stroke}
            className="text-gray-200"
          />
          <circle
            cx="50%"
            cy="50%"
            r={config.radius}
            fill="none"
            strokeWidth={config.stroke}
            strokeLinecap="round"
            className={scoreColor.stroke}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset,
            }}
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center font-medium ${config.text}`}>
          {percentage}
        </span>
      </div>
      {showLabel && (
        <span className={`${config.text} ${scoreColor.text}`}>
          {scoreColor.label}
        </span>
      )}
    </div>
  );
}

CompletenessIndicatorInline.displayName = 'CompletenessIndicatorInline';

/**
 * Status badge version for very compact displays
 */
export function CompletenessStatusBadge({
  completenessScore,
}: {
  completenessScore: number;
}) {
  const scoreColor = getScoreColor(completenessScore);
  const percentage = Math.round(completenessScore * 100);

  return (
    <Badge className={`${scoreColor.bg} ${scoreColor.text}`}>
      {percentage}% {scoreColor.label}
    </Badge>
  );
}

CompletenessStatusBadge.displayName = 'CompletenessStatusBadge';
