/**
 * AI Model Selector Component
 * Dropdown for selecting Claude model for an AI feature
 */

'use client';

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AIAvailableModel } from '@/hooks/useAIFeatures';

// ============================================================================
// Types
// ============================================================================

interface ModelSelectorProps {
  models: AIAvailableModel[];
  value: string | null;
  onChange: (model: string | null) => void;
  disabled?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatCost(costPerMillion: number): string {
  return `€${costPerMillion.toFixed(2)}/M`;
}

function getCategoryColor(category: string): string {
  switch (category) {
    case 'haiku':
      return 'text-linear-success';
    case 'sonnet':
      return 'text-linear-accent';
    case 'opus':
      return 'text-purple-600';
    default:
      return 'text-linear-text-secondary';
  }
}

function getCategoryLabel(category: string): string {
  switch (category) {
    case 'haiku':
      return 'Rapid';
    case 'sonnet':
      return 'Echilibrat';
    case 'opus':
      return 'Performant';
    default:
      return category;
  }
}

// ============================================================================
// Component
// ============================================================================

export function ModelSelector({ models, value, onChange, disabled = false }: ModelSelectorProps) {
  // Find default model for placeholder text
  const defaultModel = models.find((m) => m.isDefault);
  const selectedModel = models.find((m) => m.id === value);

  // Group models by category
  const haikuModels = models.filter((m) => m.category === 'haiku');
  const sonnetModels = models.filter((m) => m.category === 'sonnet');
  const opusModels = models.filter((m) => m.category === 'opus');

  const handleChange = (newValue: string) => {
    // Special value for "use default"
    if (newValue === '__default__') {
      onChange(null);
    } else {
      onChange(newValue);
    }
  };

  return (
    <Select value={value || '__default__'} onValueChange={handleChange} disabled={disabled}>
      <SelectTrigger className="w-[200px] h-8 text-sm">
        <SelectValue>
          {value ? (
            <span className="flex items-center gap-2">
              <span className={getCategoryColor(selectedModel?.category || '')}>
                {getCategoryLabel(selectedModel?.category || '')}
              </span>
              <span className="text-linear-text-tertiary">•</span>
              <span>{selectedModel?.name}</span>
            </span>
          ) : (
            <span className="text-linear-text-tertiary">
              Implicit ({defaultModel?.name || 'Sonnet 4'})
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {/* Default option */}
        <SelectItem value="__default__" className="text-sm">
          <span className="text-linear-text-tertiary">
            Implicit ({defaultModel?.name || 'Sonnet 4'})
          </span>
        </SelectItem>

        {/* Separator */}
        <div className="h-px bg-linear-border-subtle my-1" />

        {/* Haiku models (cheap) */}
        {haikuModels.length > 0 && (
          <>
            <div className="px-2 py-1 text-xs font-medium text-linear-text-muted uppercase">
              Haiku (Rapid, Ieftin)
            </div>
            {haikuModels.map((model) => (
              <SelectItem key={model.id} value={model.id} className="text-sm">
                <div className="flex items-center justify-between w-full gap-4">
                  <span>{model.name}</span>
                  <span className="text-xs text-linear-text-muted tabular-nums">
                    {formatCost(model.inputCostPerMillion)} in /{' '}
                    {formatCost(model.outputCostPerMillion)} out
                  </span>
                </div>
              </SelectItem>
            ))}
          </>
        )}

        {/* Sonnet models (balanced) */}
        {sonnetModels.length > 0 && (
          <>
            <div className="px-2 py-1 text-xs font-medium text-linear-text-muted uppercase mt-1">
              Sonnet (Echilibrat)
            </div>
            {sonnetModels.map((model) => (
              <SelectItem key={model.id} value={model.id} className="text-sm">
                <div className="flex items-center justify-between w-full gap-4">
                  <span>
                    {model.name}
                    {model.isDefault && (
                      <span className="ml-2 text-xs text-linear-accent">(implicit)</span>
                    )}
                  </span>
                  <span className="text-xs text-linear-text-muted tabular-nums">
                    {formatCost(model.inputCostPerMillion)} /{' '}
                    {formatCost(model.outputCostPerMillion)}
                  </span>
                </div>
              </SelectItem>
            ))}
          </>
        )}

        {/* Opus models (expensive) */}
        {opusModels.length > 0 && (
          <>
            <div className="px-2 py-1 text-xs font-medium text-linear-text-muted uppercase mt-1">
              Opus (Performant, Scump)
            </div>
            {opusModels.map((model) => (
              <SelectItem key={model.id} value={model.id} className="text-sm">
                <div className="flex items-center justify-between w-full gap-4">
                  <span>{model.name}</span>
                  <span className="text-xs text-linear-text-muted tabular-nums">
                    {formatCost(model.inputCostPerMillion)} /{' '}
                    {formatCost(model.outputCostPerMillion)}
                  </span>
                </div>
              </SelectItem>
            ))}
          </>
        )}
      </SelectContent>
    </Select>
  );
}
