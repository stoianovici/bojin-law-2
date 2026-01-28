'use client';

/**
 * AttentionBadge Component
 * Displays attention indicators for cases that need review
 *
 * Features:
 * - Visual flags for stuck/overdue/approaching deadlines
 * - Severity-based styling (warning vs critical)
 * - Compact badge with icon and message
 */

import { AlertTriangle, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';

// ============================================================================
// Types
// ============================================================================

export type AttentionType =
  | 'STUCK_TASK'
  | 'OVERDUE_TASK'
  | 'DRAFT_PENDING_REVIEW'
  | 'COURT_DATE_APPROACHING'
  | 'HEAVY_TASK_APPROACHING'
  | 'OVERBOOKING';

export type AttentionSeverity = 'WARNING' | 'CRITICAL';

export interface AttentionBadgeProps {
  /** Type of attention indicator */
  type: AttentionType;
  /** Message to display */
  message: string;
  /** Severity level affecting styling */
  severity: AttentionSeverity;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function AttentionBadge({ type, message, severity, className }: AttentionBadgeProps) {
  const Icon = severity === 'CRITICAL' ? AlertCircle : AlertTriangle;

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
        severity === 'WARNING' && 'bg-linear-warning/10 text-linear-warning',
        severity === 'CRITICAL' && 'bg-linear-error/10 text-linear-error',
        className
      )}
      role="status"
      aria-label={`${severity === 'CRITICAL' ? 'Critical' : 'Warning'}: ${message}`}
      data-attention-type={type}
    >
      <Icon className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
      <span className="truncate">{message}</span>
    </span>
  );
}

AttentionBadge.displayName = 'AttentionBadge';

export default AttentionBadge;
