/**
 * Tone Selector Component
 * Story 5.3: AI-Powered Email Drafting - Task 17
 *
 * Displays tone options with icons and accessibility support
 */

'use client';

import React from 'react';
import type { EmailTone } from '@/hooks/useEmailDraft';

interface ToneSelectorProps {
  tones: EmailTone[];
  selectedTone: EmailTone | null;
  recommendedTone?: EmailTone;
  recommendationReason?: string;
  onSelect: (tone: EmailTone) => void;
}

const TONE_CONFIG: Record<
  EmailTone,
  {
    icon: React.FC<{ className?: string }>;
    label: string;
    description: string;
  }
> = {
  Formal: {
    icon: ScaleIcon,
    label: 'Formal',
    description: 'Court or official correspondence with legal language',
  },
  Professional: {
    icon: BriefcaseIcon,
    label: 'Professional',
    description: 'Standard business communication',
  },
  Brief: {
    icon: ZapIcon,
    label: 'Brief',
    description: 'Quick and concise acknowledgment',
  },
  Detailed: {
    icon: ListIcon,
    label: 'Detailed',
    description: 'Comprehensive with full explanations',
  },
};

export function ToneSelector({
  tones,
  selectedTone,
  recommendedTone,
  recommendationReason,
  onSelect,
}: ToneSelectorProps) {
  return (
    <div>
      {/* Recommendation reason */}
      {recommendedTone && recommendationReason && (
        <div
          className="mb-4 flex items-start gap-2 rounded-md bg-blue-50 p-3 dark:bg-blue-900/30"
          id="tone-recommendation"
        >
          <SparklesIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <span className="font-medium">Recommended: {TONE_CONFIG[recommendedTone].label}</span>
            {' - '}
            {recommendationReason}
          </p>
        </div>
      )}

      {/* Tone options */}
      <div
        role="radiogroup"
        aria-label="Select email tone"
        aria-describedby={recommendedTone ? 'tone-recommendation' : undefined}
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {tones.map((tone) => {
          const config = TONE_CONFIG[tone];
          const isSelected = selectedTone === tone;
          const isRecommended = recommendedTone === tone;
          const Icon = config.icon;

          return (
            <button
              key={tone}
              role="radio"
              aria-checked={isSelected}
              aria-describedby={`tone-desc-${tone}`}
              onClick={() => onSelect(tone)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                  const idx = tones.indexOf(tone);
                  const nextTone = tones[(idx + 1) % tones.length];
                  onSelect(nextTone);
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                  const idx = tones.indexOf(tone);
                  const prevTone = tones[(idx - 1 + tones.length) % tones.length];
                  onSelect(prevTone);
                }
              }}
              className={`relative flex flex-col items-center rounded-lg border-2 p-4 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/30'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600 dark:hover:bg-gray-750'
              }`}
            >
              {/* Recommended badge */}
              {isRecommended && (
                <span className="absolute -top-2 -right-2 inline-flex items-center rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
                  <SparklesIcon className="mr-0.5 h-3 w-3" />
                  AI
                </span>
              )}

              {/* Icon */}
              <Icon
                className={`h-6 w-6 ${
                  isSelected
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              />

              {/* Label */}
              <span
                className={`mt-2 text-sm font-medium ${
                  isSelected
                    ? 'text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {config.label}
              </span>

              {/* Description (hidden but available for screen readers) */}
              <span id={`tone-desc-${tone}`} className="sr-only">
                {config.description}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected tone description */}
      {selectedTone && (
        <p className="mt-3 text-center text-sm text-gray-600 dark:text-gray-400">
          {TONE_CONFIG[selectedTone].description}
        </p>
      )}
    </div>
  );
}

// Icons
function ScaleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
      />
    </svg>
  );
}

function BriefcaseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  );
}

function ZapIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  );
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6h16M4 10h16M4 14h16M4 18h16"
      />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
      />
    </svg>
  );
}
