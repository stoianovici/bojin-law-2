/**
 * AI Features Toggles Page
 * OPS-243: Feature Toggles Page
 *
 * Admin page for enabling/disabling AI features, selecting Claude models, and manually triggering batch jobs.
 */

'use client';

import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FeatureCard } from '@/components/admin/ai-ops/FeatureCard';
import { RunNowDialog } from '@/components/admin/ai-ops/RunNowDialog';
import {
  useAIFeatures,
  useAIAvailableModels,
  useToggleFeature,
  useUpdateFeatureModel,
  useTriggerBatchJob,
  type AIFeatureConfig,
} from '@/hooks/useAIFeatures';
import { useNotificationStore } from '@/stores/notificationStore';

// ============================================================================
// Loading Skeleton
// ============================================================================

function FeaturesSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg"
        >
          <div className="flex items-center gap-4">
            <Skeleton className="w-2.5 h-2.5 rounded-full" />
            <div>
              <Skeleton className="h-5 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-6 w-11 rounded-full" />
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function AIFeaturesPage() {
  const { features, batchFeatures, requestFeatures, loading, error, refetch } = useAIFeatures();
  const { models } = useAIAvailableModels();
  const { toggleFeature } = useToggleFeature();
  const { updateModel } = useUpdateFeatureModel();
  const { triggerJob, loading: isTriggering } = useTriggerBatchJob();
  const { addNotification } = useNotificationStore();

  // Track which feature is being toggled, model changed, or triggered
  const [togglingFeature, setTogglingFeature] = useState<string | null>(null);
  const [changingModelFeature, setChangingModelFeature] = useState<string | null>(null);
  const [triggeringFeature, setTriggeringFeature] = useState<string | null>(null);

  // Run Now dialog state
  const [runNowDialog, setRunNowDialog] = useState<{
    open: boolean;
    feature: AIFeatureConfig | null;
  }>({ open: false, feature: null });

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleToggle = async (feature: AIFeatureConfig, enabled: boolean) => {
    setTogglingFeature(feature.feature);
    try {
      await toggleFeature(feature.feature, enabled);
      addNotification({
        type: 'success',
        title: enabled ? 'Funcționalitate activată' : 'Funcționalitate dezactivată',
        message: feature.featureName,
      });
    } catch (err) {
      addNotification({
        type: 'error',
        title: 'Eroare',
        message: err instanceof Error ? err.message : 'Nu s-a putut actualiza funcționalitatea',
      });
    } finally {
      setTogglingFeature(null);
    }
  };

  const handleModelChange = async (feature: AIFeatureConfig, model: string | null) => {
    setChangingModelFeature(feature.feature);
    try {
      await updateModel(feature.feature, model);
      const modelName = model ? models.find((m) => m.id === model)?.name || model : 'implicit';
      addNotification({
        type: 'success',
        title: 'Model actualizat',
        message: `${feature.featureName}: ${modelName}`,
      });
    } catch (err) {
      addNotification({
        type: 'error',
        title: 'Eroare',
        message: err instanceof Error ? err.message : 'Nu s-a putut actualiza modelul',
      });
    } finally {
      setChangingModelFeature(null);
    }
  };

  const handleRunNowClick = (feature: AIFeatureConfig) => {
    setRunNowDialog({ open: true, feature });
  };

  const handleRunNowConfirm = async () => {
    if (!runNowDialog.feature) return;

    const feature = runNowDialog.feature;
    setTriggeringFeature(feature.feature);

    try {
      const result = await triggerJob(feature.feature);
      setRunNowDialog({ open: false, feature: null });

      if (result.status === 'completed') {
        addNotification({
          type: 'success',
          title: 'Job complet',
          message: `${feature.featureName}: ${result.itemsProcessed} elemente procesate`,
        });
      } else if (result.status === 'partial') {
        addNotification({
          type: 'warning',
          title: 'Job parțial complet',
          message: `${feature.featureName}: ${result.itemsProcessed} procesate, ${result.itemsFailed} eșuate`,
        });
      } else if (result.status === 'failed') {
        addNotification({
          type: 'error',
          title: 'Job eșuat',
          message: result.errorMessage || 'Eroare necunoscută',
        });
      }
    } catch (err) {
      addNotification({
        type: 'error',
        title: 'Eroare la pornirea job-ului',
        message: err instanceof Error ? err.message : 'Eroare necunoscută',
      });
    } finally {
      setTriggeringFeature(null);
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  if (error) {
    return (
      <div className="max-w-4xl">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-red-800 font-medium">Eroare la încărcarea funcționalităților</h2>
          <p className="text-red-600 text-sm mt-1">{error.message}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3">
            Încearcă din nou
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Funcționalități AI</h1>
          <p className="text-gray-500 mt-1">
            Activați sau dezactivați funcționalitățile AI și rulați manual procesoarele batch.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Reîmprospătare
        </Button>
      </div>

      {loading && features.length === 0 ? (
        <FeaturesSkeleton />
      ) : (
        <>
          {/* Batch Processors Section */}
          {batchFeatures.length > 0 && (
            <section className="mb-8">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                Procesoare Batch (Noapte)
              </h2>
              <div className="space-y-3">
                {batchFeatures.map((feature) => (
                  <FeatureCard
                    key={feature.id}
                    feature={feature}
                    models={models}
                    onToggle={(enabled) => handleToggle(feature, enabled)}
                    onModelChange={(model) => handleModelChange(feature, model)}
                    onRunNow={() => handleRunNowClick(feature)}
                    isToggling={togglingFeature === feature.feature}
                    isChangingModel={changingModelFeature === feature.feature}
                    isRunning={triggeringFeature === feature.feature}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Request-Time Features Section */}
          {requestFeatures.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                AI la Cerere
              </h2>
              <div className="space-y-3">
                {requestFeatures.map((feature) => (
                  <FeatureCard
                    key={feature.id}
                    feature={feature}
                    models={models}
                    onToggle={(enabled) => handleToggle(feature, enabled)}
                    onModelChange={(model) => handleModelChange(feature, model)}
                    isToggling={togglingFeature === feature.feature}
                    isChangingModel={changingModelFeature === feature.feature}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Empty state */}
          {features.length === 0 && !loading && (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-500">Nu există funcționalități AI configurate.</p>
            </div>
          )}
        </>
      )}

      {/* Run Now Dialog */}
      <RunNowDialog
        open={runNowDialog.open}
        onOpenChange={(open) => {
          if (!open && !isTriggering) {
            setRunNowDialog({ open: false, feature: null });
          }
        }}
        featureName={runNowDialog.feature?.featureName || ''}
        onConfirm={handleRunNowConfirm}
        isRunning={isTriggering}
      />
    </div>
  );
}
