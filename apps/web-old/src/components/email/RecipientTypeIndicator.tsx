/**
 * Recipient Type Indicator Component
 * Story 5.3: AI-Powered Email Drafting - Task 18
 *
 * Displays visual indicator for recipient type (Client, OpposingCounsel, Court, etc.)
 */

'use client';

import React from 'react';
import type { RecipientType } from '@/hooks/useEmailDraft';

interface RecipientTypeIndicatorProps {
  recipientType: RecipientType;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const RECIPIENT_CONFIG: Record<
  RecipientType,
  { label: string; labelRo: string; color: string; bgColor: string; icon: string }
> = {
  Client: {
    label: 'Client',
    labelRo: 'Client',
    color: 'text-green-700 dark:text-green-300',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    icon: 'user',
  },
  OpposingCounsel: {
    label: 'Avocat Parte Adversă',
    labelRo: 'Avocat Parte Adversă',
    color: 'text-red-700 dark:text-red-300',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    icon: 'scales',
  },
  Court: {
    label: 'Instanță',
    labelRo: 'Instanță',
    color: 'text-purple-700 dark:text-purple-300',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    icon: 'building',
  },
  ThirdParty: {
    label: 'Terț',
    labelRo: 'Terț',
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    icon: 'users',
  },
  Internal: {
    label: 'Intern',
    labelRo: 'Intern',
    color: 'text-gray-700 dark:text-gray-300',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    icon: 'office',
  },
};

const SIZE_CLASSES = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
};

const ICON_SIZE_CLASSES = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

export function RecipientTypeIndicator({
  recipientType,
  showLabel = true,
  size = 'md',
}: RecipientTypeIndicatorProps) {
  const config = RECIPIENT_CONFIG[recipientType];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${config.color} ${config.bgColor} ${SIZE_CLASSES[size]}`}
      title={`${config.label} (${config.labelRo})`}
    >
      <RecipientIcon type={config.icon} className={ICON_SIZE_CLASSES[size]} />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}

function RecipientIcon({ type, className }: { type: string; className: string }) {
  switch (type) {
    case 'user':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      );
    case 'scales':
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
    case 'building':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      );
    case 'users':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      );
    case 'office':
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
    default:
      return null;
  }
}

export default RecipientTypeIndicator;
