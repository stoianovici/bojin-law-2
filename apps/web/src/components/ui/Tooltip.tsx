/**
 * Tooltip Component
 * Accessible tooltip component using Radix UI
 */

'use client';

import React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

export interface TooltipProps {
  /**
   * The content to display inside the tooltip
   */
  content: React.ReactNode;

  /**
   * The trigger element that shows the tooltip
   */
  children: React.ReactNode;

  /**
   * Optional side to show the tooltip
   */
  side?: 'top' | 'right' | 'bottom' | 'left';

  /**
   * Optional alignment of the tooltip
   */
  align?: 'start' | 'center' | 'end';

  /**
   * Delay before showing the tooltip (ms)
   */
  delayDuration?: number;

  /**
   * Optional CSS class name for the tooltip content
   */
  className?: string;
}

/**
 * Tooltip component providing accessible tooltips using Radix UI
 * Supports Romanian content and proper ARIA attributes
 */
export function Tooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  delayDuration = 300,
  className = '',
}: TooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          {children}
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            align={align}
            className={`
              z-50 px-3 py-2 text-sm text-white
              bg-gray-900 rounded-lg shadow-lg
              border border-gray-700
              max-w-xs text-center
              animate-in fade-in-0 zoom-in-95
              data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95
              ${className}
            `}
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-gray-900" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

// Predefined tooltips for common features
export const FeatureTooltips = {
  /**
   * AI suggestions panel tooltip
   */
  AISuggestions: () => (
    <Tooltip content="AI-ul analizează contextul cazului pentru a sugera documente relevante">
      <div className="w-5 h-5 text-gray-400 hover:text-gray-600 cursor-help">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
    </Tooltip>
  ),

  /**
   * Natural language input tooltip
   */
  NaturalLanguageInput: () => (
    <Tooltip content="Tastați în limbaj natural, de exemplu: 'Verifică contract până vineri pentru cazul Tech Solutions'">
      <div className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
          />
        </svg>
      </div>
    </Tooltip>
  ),

  /**
   * Extracted items tooltip
   */
  ExtractedItems: () => (
    <Tooltip content="AI-ul extrage automat termene, angajamente și acțiuni din email-uri">
      <div className="w-4 h-4 text-blue-500 hover:text-blue-700 cursor-help">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
      </div>
    </Tooltip>
  ),

  /**
   * Case status tooltip
   */
  CaseStatus: (status: string) => (
    <Tooltip content={`Status: ${status}. Faceți clic pentru detalii`}>
      <div className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
    </Tooltip>
  ),

  /**
   * User avatar tooltip
   */
  UserAvatar: (name: string, role: string) => (
    <Tooltip content={`${name} - ${role}`}>
      <span className="sr-only">Info utilizator</span>
    </Tooltip>
  ),
};