/**
 * AI Feature Card Component
 * OPS-243: Feature Toggles Page
 *
 * Displays an AI feature with toggle switch, model selector, status indicator, and run now button.
 */

'use client';

import React from 'react';
import { Play, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { ModelSelector } from './ModelSelector';
import type { AIFeatureConfig, AIAvailableModel } from '@/hooks/useAIFeatures';

// ============================================================================
// Types
// ============================================================================

interface FeatureCardProps {
  feature: AIFeatureConfig;
  models: AIAvailableModel[];
  onToggle: (enabled: boolean) => void;
  onModelChange: (model: string | null) => void;
  onRunNow?: () => void;
  isToggling?: boolean;
  isChangingModel?: boolean;
  isRunning?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatDate(dateString: string | null): string {
  if (!dateString) return 'Niciodată';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) {
    return 'Acum câteva minute';
  } else if (diffHours < 24) {
    return `Acum ${diffHours} ${diffHours === 1 ? 'oră' : 'ore'}`;
  } else if (diffDays < 7) {
    return `Acum ${diffDays} ${diffDays === 1 ? 'zi' : 'zile'}`;
  }

  return date.toLocaleDateString('ro-RO', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCost(cost: number | null): string {
  if (cost === null || cost === 0) return '€0.00';
  return `€${cost.toFixed(2)}`;
}

function getStatusIcon(status: string | null) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-linear-success" />;
    case 'partial':
      return <AlertTriangle className="h-4 w-4 text-linear-warning" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-linear-error" />;
    case 'running':
      return <Clock className="h-4 w-4 text-linear-accent animate-spin" />;
    default:
      return null;
  }
}

function getStatusLabel(status: string | null): string {
  switch (status) {
    case 'completed':
      return 'Complet';
    case 'partial':
      return 'Parțial';
    case 'failed':
      return 'Eșuat';
    case 'running':
      return 'Rulează';
    case 'skipped':
      return 'Omis';
    default:
      return '';
  }
}

// ============================================================================
// Component
// ============================================================================

export function FeatureCard({
  feature,
  models,
  onToggle,
  onModelChange,
  onRunNow,
  isToggling = false,
  isChangingModel = false,
  isRunning = false,
}: FeatureCardProps) {
  const isBatch = feature.featureType === 'batch';

  return (
    <div className="p-4 bg-linear-bg-secondary border border-linear-border-subtle rounded-lg hover:border-linear-border transition-colors">
      {/* Main row: Feature info + controls */}
      <div className="flex items-center justify-between">
        {/* Left section: Status and info */}
        <div className="flex items-center gap-4">
          {/* Status indicator */}
          <div
            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
              feature.enabled ? 'bg-linear-success' : 'bg-linear-text-muted'
            }`}
          />

          {/* Feature info */}
          <div className="min-w-0">
            <h3 className="font-medium text-linear-text-primary">{feature.featureName}</h3>
            <div className="flex items-center gap-2 mt-1 text-sm text-linear-text-tertiary">
              {isBatch && feature.lastRunAt && (
                <>
                  <span>Ultima rulare: {formatDate(feature.lastRunAt)}</span>
                  {feature.lastRunStatus && (
                    <span className="flex items-center gap-1">
                      {getStatusIcon(feature.lastRunStatus)}
                      <span className="text-xs">{getStatusLabel(feature.lastRunStatus)}</span>
                    </span>
                  )}
                </>
              )}
              {isBatch && !feature.lastRunAt && <span>Niciodată rulat</span>}
              {!isBatch && <span>La cerere</span>}
            </div>
          </div>
        </div>

        {/* Right section: Cost, toggle, run now */}
        <div className="flex items-center gap-4">
          {/* Daily cost estimate */}
          <span className="text-sm text-linear-text-tertiary tabular-nums">
            ~{formatCost(feature.dailyCostEstimate)}/zi
          </span>

          {/* Toggle switch */}
          <Switch
            checked={feature.enabled}
            onCheckedChange={onToggle}
            disabled={isToggling}
            aria-label={`${feature.enabled ? 'Dezactivare' : 'Activare'} ${feature.featureName}`}
          />

          {/* Run Now button (batch only) */}
          {isBatch && onRunNow && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRunNow}
              disabled={!feature.enabled || isRunning}
              className="h-8 w-8 p-0"
              title="Rulează acum"
            >
              <Play className={`h-4 w-4 ${isRunning ? 'animate-pulse' : ''}`} />
            </Button>
          )}
        </div>
      </div>

      {/* Model selector row */}
      <div className="mt-3 pt-3 border-t border-linear-border-subtle/50 flex items-center justify-between">
        <span className="text-sm text-linear-text-tertiary">Model Claude:</span>
        <ModelSelector
          models={models}
          value={feature.model}
          onChange={onModelChange}
          disabled={!feature.enabled || isChangingModel}
        />
      </div>
    </div>
  );
}
