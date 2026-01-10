'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AIFeature, AIFeatureConfigInput, AvailableModel } from '@/hooks/useAdminAI';

// ============================================================================
// Types
// ============================================================================

interface FeatureEditModalProps {
  feature: AIFeature | null;
  availableModels: AvailableModel[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (feature: string, input: AIFeatureConfigInput) => Promise<void>;
  updating: boolean;
}

// ============================================================================
// Inner Form Component (resets state when feature changes via key)
// ============================================================================

function FeatureEditForm({
  feature,
  availableModels,
  onOpenChange,
  onSave,
  updating,
}: Omit<FeatureEditModalProps, 'open'> & { feature: AIFeature }) {
  // Form state initialized from feature
  const [enabled, setEnabled] = useState(feature.enabled);
  const [model, setModel] = useState<string | null>(feature.model);
  const [monthlyBudgetEur, setMonthlyBudgetEur] = useState<string>(
    feature.monthlyBudgetEur?.toString() || ''
  );
  const [dailyLimitEur, setDailyLimitEur] = useState<string>(
    feature.dailyLimitEur?.toString() || ''
  );
  const [schedule, setSchedule] = useState<string>(feature.schedule || '');

  const isBatch = feature.featureType === 'batch';

  const handleSave = async () => {
    const input: AIFeatureConfigInput = {
      enabled,
      model: model || null,
      monthlyBudgetEur: monthlyBudgetEur ? parseFloat(monthlyBudgetEur) : null,
      dailyLimitEur: dailyLimitEur ? parseFloat(dailyLimitEur) : null,
    };

    // Only include schedule for batch features
    if (isBatch) {
      input.schedule = schedule || null;
    }

    await onSave(feature.feature, input);
    onOpenChange(false);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{feature.featureName}</DialogTitle>
      </DialogHeader>

      <div className="space-y-6 py-4">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-linear-sm font-medium text-linear-text-primary">Activat</p>
            <p className="text-linear-xs text-linear-text-muted">
              Activează sau dezactivează această funcționalitate
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        {/* Model Selection */}
        <div className="space-y-2">
          <label className="text-linear-sm font-medium text-linear-text-primary">Model AI</label>
          <Select
            value={model || 'default'}
            onValueChange={(v) => setModel(v === 'default' ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Model implicit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">
                <span className="text-linear-text-muted">Implicit</span>
              </SelectItem>
              {availableModels.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-linear-xs text-linear-text-muted">
            Selectează modelul Claude pentru această funcționalitate
          </p>
        </div>

        {/* Monthly Budget */}
        <div className="space-y-2">
          <label className="text-linear-sm font-medium text-linear-text-primary">
            Buget lunar (EUR)
          </label>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="Nelimitat"
            value={monthlyBudgetEur}
            onChange={(e) => setMonthlyBudgetEur(e.target.value)}
          />
          <p className="text-linear-xs text-linear-text-muted">
            Limită lunară de cost. Lasă gol pentru nelimitat.
          </p>
        </div>

        {/* Daily Limit */}
        <div className="space-y-2">
          <label className="text-linear-sm font-medium text-linear-text-primary">
            Limită zilnică (EUR)
          </label>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="Nelimitat"
            value={dailyLimitEur}
            onChange={(e) => setDailyLimitEur(e.target.value)}
          />
          <p className="text-linear-xs text-linear-text-muted">
            Limită zilnică de cost. Lasă gol pentru nelimitat.
          </p>
        </div>

        {/* Schedule (batch only) */}
        {isBatch && (
          <div className="space-y-2">
            <label className="text-linear-sm font-medium text-linear-text-primary">
              Program (cron)
            </label>
            <Input
              type="text"
              placeholder="0 3 * * *"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
            />
            <p className="text-linear-xs text-linear-text-muted">
              Expresie cron pentru programarea job-ului. Ex: &quot;0 3 * * *&quot; = zilnic la 3:00.
            </p>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={updating}>
          Anulează
        </Button>
        <Button onClick={handleSave} disabled={updating}>
          {updating ? 'Se salvează...' : 'Salvează'}
        </Button>
      </DialogFooter>
    </>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function FeatureEditModal({
  feature,
  availableModels,
  open,
  onOpenChange,
  onSave,
  updating,
}: FeatureEditModalProps) {
  if (!feature) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        {/* Key prop ensures form state resets when feature changes */}
        <FeatureEditForm
          key={feature.feature}
          feature={feature}
          availableModels={availableModels}
          onOpenChange={onOpenChange}
          onSave={onSave}
          updating={updating}
        />
      </DialogContent>
    </Dialog>
  );
}
