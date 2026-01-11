'use client';

import { useState, useMemo } from 'react';
import {
  Brain,
  DollarSign,
  Activity,
  Zap,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Mail,
  FileText,
  Cog,
  Clock,
  Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatEur } from '@/lib/currency';
import {
  useAdminAI,
  PERIOD_OPTIONS,
  type AIPeriod,
  type AvailableModel,
  type AIFeature,
} from '@/hooks/useAdminAI';
import { useAuth } from '@/hooks/useAuth';
import {
  Card,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ScrollArea,
  Switch,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui';
import { FeatureEditModal } from '@/components/admin/FeatureEditModal';

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_ORDER = ['Email', 'Word Add-in', 'Documents', 'Batch Jobs'];

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Email: Mail,
  'Word Add-in': FileText,
  Documents: FileText,
  'Batch Jobs': Cog,
};

// ============================================================================
// Components
// ============================================================================

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  loading?: boolean;
}

function MetricCard({ title, value, icon, trend, loading }: MetricCardProps) {
  return (
    <Card className="p-4 bg-linear-bg-secondary border-linear-border-subtle">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-linear-xs text-linear-text-muted uppercase tracking-wide">{title}</p>
          {loading ? (
            <div className="h-8 w-24 bg-linear-bg-tertiary animate-pulse rounded mt-1" />
          ) : (
            <p className="text-2xl font-semibold text-linear-text-primary mt-1">{value}</p>
          )}
          {trend && <p className="text-linear-xs text-linear-text-tertiary mt-1">{trend}</p>}
        </div>
        <div className="p-2 rounded-lg bg-linear-bg-tertiary text-linear-text-secondary">
          {icon}
        </div>
      </div>
    </Card>
  );
}

interface FeatureRowProps {
  feature: AIFeature;
  currentModel: string | null;
  onToggle: (enabled: boolean) => void;
  onModelChange: (model: string | null) => void;
  onEdit: () => void;
  updating: boolean;
  availableModels: AvailableModel[];
  costData: { cost: number; calls: number } | undefined;
}

function FeatureRow({
  feature,
  currentModel,
  onToggle,
  onModelChange,
  onEdit,
  updating,
  availableModels,
  costData,
}: FeatureRowProps) {
  const isBatch = feature.featureType === 'batch';
  const cost = costData?.cost || 0;

  // Parse schedule to show time (e.g., "0 3 * * *" -> "3:00")
  const scheduleTime = useMemo(() => {
    if (!feature.schedule) return null;
    const parts = feature.schedule.split(' ');
    if (parts.length >= 2) {
      const minute = parts[0].padStart(2, '0');
      const hour = parts[1].padStart(2, '0');
      return `${hour}:${minute}`;
    }
    return null;
  }, [feature.schedule]);

  return (
    <div className="flex items-center py-3 px-4 hover:bg-linear-bg-tertiary/50 transition-colors border-b border-linear-border-subtle last:border-b-0">
      {/* Toggle */}
      <div className="w-12">
        <Switch checked={feature.enabled} onCheckedChange={onToggle} disabled={updating} />
      </div>

      {/* Name + Schedule for batch */}
      <div className="flex-1 min-w-0">
        <p className="text-linear-sm font-medium text-linear-text-primary truncate">
          {feature.featureName}
        </p>
        {isBatch && scheduleTime && (
          <div className="flex items-center gap-1 mt-0.5">
            <Clock className="h-3 w-3 text-linear-text-muted" />
            <span className="text-linear-xs text-linear-text-muted">{scheduleTime}</span>
          </div>
        )}
      </div>

      {/* Model Selection */}
      <div className="w-40 mr-4">
        <Select
          value={currentModel || 'default'}
          onValueChange={(value) => onModelChange(value === 'default' ? null : value)}
          disabled={updating || !feature.enabled}
        >
          <SelectTrigger className="h-8 text-linear-sm">
            <SelectValue placeholder="Implicit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">
              <span className="text-linear-text-muted">Implicit</span>
            </SelectItem>
            {availableModels.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Cost */}
      <div className="w-20 text-right mr-4">
        <p className="text-linear-sm text-linear-text-secondary">{formatEur(cost)}</p>
      </div>

      {/* Edit Button */}
      <div className="w-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="h-8 w-8 p-0"
          disabled={updating}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface FeatureCategorySectionProps {
  category: string;
  features: AIFeature[];
  overridesMap: Map<string, string>;
  costsByFeature: { feature: string; cost: number; calls: number }[];
  availableModels: AvailableModel[];
  onToggle: (feature: string, enabled: boolean) => void;
  onModelChange: (feature: string, model: string | null) => void;
  onEdit: (feature: AIFeature) => void;
  updating: boolean;
  defaultOpen?: boolean;
}

function FeatureCategorySection({
  category,
  features,
  overridesMap,
  costsByFeature,
  availableModels,
  onToggle,
  onModelChange,
  onEdit,
  updating,
  defaultOpen = true,
}: FeatureCategorySectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = CATEGORY_ICONS[category] || Cog;

  const enabledCount = features.filter((f) => f.enabled).length;
  const totalCost = features.reduce((acc, f) => {
    const cost = costsByFeature.find((c) => c.feature === f.feature)?.cost || 0;
    return acc + cost;
  }, 0);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="bg-linear-bg-secondary border-linear-border-subtle overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full p-4 hover:bg-linear-bg-tertiary/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded bg-linear-bg-tertiary text-linear-text-secondary">
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-linear-sm font-medium text-linear-text-primary uppercase tracking-wide">
                {category}
              </span>
              <Badge variant="default" className="text-linear-xs">
                {enabledCount}/{features.length}
              </Badge>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-linear-sm text-linear-text-muted">{formatEur(totalCost)}</span>
              {open ? (
                <ChevronDown className="h-4 w-4 text-linear-text-muted" />
              ) : (
                <ChevronRight className="h-4 w-4 text-linear-text-muted" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-linear-border-subtle">
            {/* Table Header */}
            <div className="flex items-center py-2 px-4 bg-linear-bg-tertiary/50 border-b border-linear-border-subtle">
              <div className="w-12">
                <p className="text-linear-xs font-medium text-linear-text-muted uppercase">On</p>
              </div>
              <div className="flex-1">
                <p className="text-linear-xs font-medium text-linear-text-muted uppercase">
                  Funcționalitate
                </p>
              </div>
              <div className="w-40 mr-4">
                <p className="text-linear-xs font-medium text-linear-text-muted uppercase">Model</p>
              </div>
              <div className="w-20 text-right mr-4">
                <p className="text-linear-xs font-medium text-linear-text-muted uppercase">Cost</p>
              </div>
              <div className="w-10" />
            </div>

            {/* Feature Rows */}
            {features.map((feature) => (
              <FeatureRow
                key={feature.id}
                feature={feature}
                currentModel={overridesMap.get(feature.feature) || feature.model}
                onToggle={(enabled) => onToggle(feature.feature, enabled)}
                onModelChange={(model) => onModelChange(feature.feature, model)}
                onEdit={() => onEdit(feature)}
                updating={updating}
                availableModels={availableModels}
                costData={costsByFeature.find((c) => c.feature === feature.feature)}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function AdminAIDashboardPage() {
  const { user } = useAuth();
  const {
    period,
    setPeriod,
    overview,
    features,
    overrides,
    costsByFeature,
    availableModels,
    loading,
    updating,
    error,
    updateModelOverride,
    deleteModelOverride,
    updateFeatureConfig,
    refetchAll,
  } = useAdminAI();

  const [editingFeature, setEditingFeature] = useState<AIFeature | null>(null);

  // Build a map of overrides by operation type
  const overridesMap = useMemo(
    () => new Map(overrides.map((o) => [o.operationType, o.model])),
    [overrides]
  );

  // Group features by category
  const featuresByCategory = useMemo(() => {
    const grouped: Record<string, AIFeature[]> = {};
    for (const feature of features) {
      const category = feature.category || 'Other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(feature);
    }
    return grouped;
  }, [features]);

  // Check for admin role
  if (user?.role !== 'ADMIN') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Brain className="h-12 w-12 text-linear-text-muted mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-linear-text-primary">Acces restricționat</h2>
          <p className="text-linear-text-muted mt-1">
            Această pagină este disponibilă doar pentru administratori.
          </p>
        </div>
      </div>
    );
  }

  // Handle toggle
  const handleToggle = async (feature: string, enabled: boolean) => {
    await updateFeatureConfig(feature, { enabled });
  };

  // Handle model change
  const handleModelChange = async (feature: string, model: string | null) => {
    if (model) {
      await updateModelOverride(feature, model);
    } else {
      await deleteModelOverride(feature);
    }
  };

  // Handle edit save
  const handleEditSave = async (
    feature: string,
    input: Parameters<typeof updateFeatureConfig>[1]
  ) => {
    await updateFeatureConfig(feature, input);
  };

  // Calculate cache hit rate (placeholder - would need real data)
  const cacheHitRate = overview?.successRate ? Math.round(overview.successRate) : 0;

  return (
    <div className="flex flex-col h-full w-full bg-linear-bg-primary">
      {/* Header */}
      <header className="px-6 py-4 border-b border-linear-border-subtle">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-linear-accent/10">
              <Brain className="h-5 w-5 text-linear-accent" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-linear-text-primary">Dashboard AI</h1>
              <p className="text-sm text-linear-text-tertiary">
                Monitorizare utilizare și configurare funcționalități AI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Period Selector */}
            <Select value={period} onValueChange={(v) => setPeriod(v as AIPeriod)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Refresh Button */}
            <button
              onClick={refetchAll}
              disabled={loading}
              className={cn(
                'p-2 rounded-lg border border-linear-border-subtle',
                'text-linear-text-secondary hover:text-linear-text-primary',
                'hover:bg-linear-bg-tertiary transition-colors',
                loading && 'opacity-50 cursor-not-allowed'
              )}
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* Error Display */}
          {error && (
            <div className="p-4 rounded-lg bg-linear-error/10 border border-linear-error/20">
              <p className="text-linear-sm text-linear-error">
                Eroare la încărcarea datelor: {error.message}
              </p>
            </div>
          )}

          {/* Overview Metrics */}
          <section>
            <h2 className="text-linear-sm font-medium text-linear-text-muted uppercase tracking-wide mb-4">
              Prezentare generală
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard
                title="Cost Total"
                value={formatEur(overview?.totalCost || 0)}
                icon={<DollarSign className="h-5 w-5" />}
                trend={
                  overview?.projectedMonthEnd
                    ? `Proiectat: ${formatEur(overview.projectedMonthEnd)}`
                    : undefined
                }
                loading={loading}
              />
              <MetricCard
                title="Cereri"
                value={overview?.totalCalls?.toLocaleString() || '0'}
                icon={<Activity className="h-5 w-5" />}
                loading={loading}
              />
              <MetricCard
                title="Rata de succes"
                value={`${cacheHitRate}%`}
                icon={<Zap className="h-5 w-5" />}
                loading={loading}
              />
            </div>
          </section>

          {/* Features by Category */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-linear-sm font-medium text-linear-text-muted uppercase tracking-wide">
                Funcționalități AI
              </h2>
              <Badge variant="default" className="text-linear-xs">
                {features.length} funcționalități
              </Badge>
            </div>

            {loading ? (
              <div className="p-8 text-center">
                <RefreshCw className="h-6 w-6 animate-spin text-linear-text-muted mx-auto mb-2" />
                <p className="text-linear-sm text-linear-text-muted">Se încarcă...</p>
              </div>
            ) : features.length === 0 ? (
              <Card className="p-8 text-center bg-linear-bg-secondary border-linear-border-subtle">
                <Brain className="h-8 w-8 text-linear-text-muted mx-auto mb-2" />
                <p className="text-linear-sm text-linear-text-muted">
                  Nu există funcționalități AI configurate
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {CATEGORY_ORDER.filter((cat) => featuresByCategory[cat]?.length > 0).map(
                  (category) => (
                    <FeatureCategorySection
                      key={category}
                      category={category}
                      features={featuresByCategory[category]}
                      overridesMap={overridesMap}
                      costsByFeature={costsByFeature}
                      availableModels={availableModels}
                      onToggle={handleToggle}
                      onModelChange={handleModelChange}
                      onEdit={setEditingFeature}
                      updating={updating}
                    />
                  )
                )}
              </div>
            )}
          </section>
        </div>
      </ScrollArea>

      {/* Edit Modal */}
      <FeatureEditModal
        feature={editingFeature}
        availableModels={availableModels}
        open={editingFeature !== null}
        onOpenChange={(open) => !open && setEditingFeature(null)}
        onSave={handleEditSave}
        updating={updating}
      />
    </div>
  );
}
