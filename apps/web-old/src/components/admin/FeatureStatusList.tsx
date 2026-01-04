/**
 * FeatureStatusList Component
 * OPS-242: AI Ops Dashboard Layout & Overview
 *
 * Quick view of AI feature status with on/off indicators and last run times.
 */

'use client';

import React from 'react';
import clsx from 'clsx';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  PlayCircle,
  type LucideIcon,
} from 'lucide-react';
import type { AIFeatureConfig } from '@/hooks/useAIOps';

// ============================================================================
// Types
// ============================================================================

export interface FeatureStatusListProps {
  /** Feature configurations */
  features: AIFeatureConfig[];
  /** Show only batch features */
  batchOnly?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Maximum items to show */
  maxItems?: number;
  /** Additional class name */
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format relative time
 */
function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Niciodată';

  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Acum';
  if (diffMins < 60) return `Acum ${diffMins} min`;
  if (diffHours < 24) return `Acum ${diffHours} ore`;
  if (diffDays === 1) return 'Ieri';
  if (diffDays < 7) return `Acum ${diffDays} zile`;

  return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
}

/**
 * Get status indicator props
 */
function getStatusIndicator(status: string | null): {
  icon: LucideIcon;
  color: string;
  label: string;
} {
  switch (status) {
    case 'completed':
      return { icon: CheckCircle2, color: 'text-linear-success', label: 'Complet' };
    case 'running':
      return { icon: PlayCircle, color: 'text-linear-accent', label: 'În curs' };
    case 'partial':
      return { icon: AlertCircle, color: 'text-linear-warning', label: 'Parțial' };
    case 'failed':
      return { icon: XCircle, color: 'text-linear-error', label: 'Eșuat' };
    case 'skipped':
      return { icon: Clock, color: 'text-linear-text-muted', label: 'Omis' };
    default:
      return { icon: Clock, color: 'text-linear-text-muted', label: 'Nepornit' };
  }
}

/**
 * Format currency in EUR
 */
function formatCurrency(value: number): string {
  if (value < 0.01) return '< €0.01';
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// ============================================================================
// Skeleton
// ============================================================================

function FeatureStatusSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {[...Array(count)].map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 bg-linear-bg-tertiary rounded-lg animate-pulse"
        >
          <div className="w-8 h-8 rounded-full bg-linear-bg-hover" />
          <div className="flex-1">
            <div className="h-4 w-32 bg-linear-bg-hover rounded mb-1" />
            <div className="h-3 w-20 bg-linear-bg-hover rounded" />
          </div>
          <div className="h-4 w-16 bg-linear-bg-hover rounded" />
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Feature Item
// ============================================================================

interface FeatureItemProps {
  feature: AIFeatureConfig;
}

function FeatureItem({ feature }: FeatureItemProps) {
  const status = getStatusIndicator(feature.lastRunStatus);
  const StatusIcon = status.icon;

  return (
    <div className="flex items-center gap-3 p-3 bg-linear-bg-tertiary rounded-lg hover:bg-linear-bg-hover transition-colors">
      {/* Enable/Disable indicator */}
      <div
        className={clsx(
          'w-8 h-8 rounded-full flex items-center justify-center',
          feature.enabled ? 'bg-linear-success/15' : 'bg-linear-bg-hover'
        )}
      >
        {feature.enabled ? (
          <CheckCircle2 className="w-5 h-5 text-linear-success" />
        ) : (
          <XCircle className="w-5 h-5 text-linear-text-muted" />
        )}
      </div>

      {/* Feature info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-linear-text-primary truncate">
          {feature.featureName}
        </p>
        <div className="flex items-center gap-2 text-xs text-linear-text-tertiary">
          {feature.featureType === 'batch' && (
            <>
              <StatusIcon className={clsx('w-3 h-3', status.color)} />
              <span>{formatRelativeTime(feature.lastRunAt)}</span>
            </>
          )}
          {feature.featureType === 'request' && <span>La cerere</span>}
        </div>
      </div>

      {/* Daily cost estimate */}
      <div className="text-right">
        <p className="text-sm font-medium text-linear-text-primary">
          {formatCurrency(feature.dailyCostEstimate)}
        </p>
        <p className="text-xs text-linear-text-tertiary">/zi</p>
      </div>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function FeatureStatusList({
  features,
  batchOnly = false,
  loading = false,
  maxItems,
  className,
}: FeatureStatusListProps) {
  // Filter features
  const filteredFeatures = batchOnly ? features.filter((f) => f.featureType === 'batch') : features;

  // Limit if needed
  const displayFeatures = maxItems ? filteredFeatures.slice(0, maxItems) : filteredFeatures;

  if (loading) {
    return (
      <div
        className={clsx(
          'bg-linear-bg-secondary rounded-lg border border-linear-border-subtle p-6',
          className
        )}
      >
        <div className="h-6 w-40 bg-linear-bg-hover rounded mb-4 animate-pulse" />
        <FeatureStatusSkeleton count={maxItems || 5} />
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'bg-linear-bg-secondary rounded-lg border border-linear-border-subtle p-6',
        className
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-linear-text-primary">
          {batchOnly ? 'Procese Batch' : 'Funcționalități AI'}
        </h3>
        <span className="text-sm text-linear-text-tertiary">
          {filteredFeatures.filter((f) => f.enabled).length} / {filteredFeatures.length} active
        </span>
      </div>

      {displayFeatures.length === 0 ? (
        <div className="text-center py-8 text-linear-text-tertiary">
          Nu sunt funcționalități configurate
        </div>
      ) : (
        <div className="space-y-2">
          {displayFeatures.map((feature) => (
            <FeatureItem key={feature.id} feature={feature} />
          ))}
        </div>
      )}

      {maxItems && filteredFeatures.length > maxItems && (
        <div className="mt-4 text-center">
          <span className="text-sm text-linear-text-tertiary">
            +{filteredFeatures.length - maxItems} alte funcționalități
          </span>
        </div>
      )}
    </div>
  );
}

export default FeatureStatusList;
