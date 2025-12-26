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
      return { icon: CheckCircle2, color: 'text-green-500', label: 'Complet' };
    case 'running':
      return { icon: PlayCircle, color: 'text-blue-500', label: 'În curs' };
    case 'partial':
      return { icon: AlertCircle, color: 'text-yellow-500', label: 'Parțial' };
    case 'failed':
      return { icon: XCircle, color: 'text-red-500', label: 'Eșuat' };
    case 'skipped':
      return { icon: Clock, color: 'text-gray-400', label: 'Omis' };
    default:
      return { icon: Clock, color: 'text-gray-400', label: 'Nepornit' };
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
        <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg animate-pulse">
          <div className="w-8 h-8 rounded-full bg-gray-200" />
          <div className="flex-1">
            <div className="h-4 w-32 bg-gray-200 rounded mb-1" />
            <div className="h-3 w-20 bg-gray-200 rounded" />
          </div>
          <div className="h-4 w-16 bg-gray-200 rounded" />
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
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      {/* Enable/Disable indicator */}
      <div
        className={clsx(
          'w-8 h-8 rounded-full flex items-center justify-center',
          feature.enabled ? 'bg-green-100' : 'bg-gray-200'
        )}
      >
        {feature.enabled ? (
          <CheckCircle2 className="w-5 h-5 text-green-600" />
        ) : (
          <XCircle className="w-5 h-5 text-gray-400" />
        )}
      </div>

      {/* Feature info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{feature.featureName}</p>
        <div className="flex items-center gap-2 text-xs text-gray-500">
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
        <p className="text-sm font-medium text-gray-900">
          {formatCurrency(feature.dailyCostEstimate)}
        </p>
        <p className="text-xs text-gray-500">/zi</p>
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
      <div className={clsx('bg-white rounded-lg border border-gray-200 p-6', className)}>
        <div className="h-6 w-40 bg-gray-200 rounded mb-4 animate-pulse" />
        <FeatureStatusSkeleton count={maxItems || 5} />
      </div>
    );
  }

  return (
    <div className={clsx('bg-white rounded-lg border border-gray-200 p-6', className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {batchOnly ? 'Procese Batch' : 'Funcționalități AI'}
        </h3>
        <span className="text-sm text-gray-500">
          {filteredFeatures.filter((f) => f.enabled).length} / {filteredFeatures.length} active
        </span>
      </div>

      {displayFeatures.length === 0 ? (
        <div className="text-center py-8 text-gray-500">Nu sunt funcționalități configurate</div>
      ) : (
        <div className="space-y-2">
          {displayFeatures.map((feature) => (
            <FeatureItem key={feature.id} feature={feature} />
          ))}
        </div>
      )}

      {maxItems && filteredFeatures.length > maxItems && (
        <div className="mt-4 text-center">
          <span className="text-sm text-gray-500">
            +{filteredFeatures.length - maxItems} alte funcționalități
          </span>
        </div>
      )}
    </div>
  );
}

export default FeatureStatusList;
