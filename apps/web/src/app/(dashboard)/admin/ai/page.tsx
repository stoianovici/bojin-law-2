'use client';

import {
  Brain,
  DollarSign,
  Activity,
  Zap,
  RefreshCw,
  FileText,
  Scale,
  Tag,
  Database,
  Bot,
  MessageSquare,
  FileSearch,
  CheckCircle,
  ListTodo,
  Mail,
  GitBranch,
  AlertTriangle,
  Sparkles,
  Lightbulb,
  Sun,
  Scissors,
  Palette,
  PenTool,
  FileEdit,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatEur } from '@/lib/currency';
import { useAdminAI, PERIOD_OPTIONS, type AIPeriod } from '@/hooks/useAdminAI';
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
} from '@/components/ui';

// ============================================================================
// AI Service Metadata (Romanian names and icons)
// ============================================================================

interface AIServiceMetadata {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
}

const AI_SERVICE_METADATA: Record<string, AIServiceMetadata> = {
  text_generation: { name: 'Generare text', icon: FileText },
  document_summary: { name: 'Rezumat document', icon: FileText },
  legal_analysis: { name: 'Analiză juridică', icon: Scale },
  classification: { name: 'Clasificare', icon: Tag },
  extraction: { name: 'Extragere', icon: Database },
  embedding: { name: 'Embedding', icon: Bot },
  chat: { name: 'Asistent AI', icon: MessageSquare },
  document_review_analysis: { name: 'Analiză document (revizuire)', icon: FileSearch },
  document_completeness: { name: 'Completitudine documente', icon: CheckCircle },
  task_parsing: { name: 'Parsare sarcini', icon: ListTodo },
  communication_intelligence: { name: 'Inteligență comunicări', icon: Mail },
  thread_analysis: { name: 'Analiză thread email', icon: GitBranch },
  risk_analysis: { name: 'Analiză risc', icon: AlertTriangle },
  pattern_recognition: { name: 'Recunoaștere tipare', icon: Sparkles },
  proactive_suggestion: { name: 'Sugestii proactive', icon: Lightbulb },
  morning_briefing: { name: 'Briefing matinal', icon: Sun },
  snippet_detection: { name: 'Detectare snippet-uri', icon: Scissors },
  snippet_shortcut: { name: 'Shortcut snippet', icon: Zap },
  style_analysis: { name: 'Analiză stil', icon: Palette },
  style_application: { name: 'Aplicare stil', icon: PenTool },
  word_draft: { name: 'Word Draft', icon: FileEdit },
};

const MODEL_OPTIONS = [
  { value: 'haiku', label: 'Haiku', description: 'Rapid, costuri reduse' },
  { value: 'sonnet', label: 'Sonnet', description: 'Echilibrat' },
  { value: 'opus', label: 'Opus', description: 'Performanță maximă' },
];

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

interface ServiceRowProps {
  operationType: string;
  featureName: string;
  calls: number;
  cost: number;
  currentModel: string | null;
  onModelChange: (model: string) => void;
  updating: boolean;
}

function ServiceRow({
  operationType,
  featureName,
  calls,
  cost,
  currentModel,
  onModelChange,
  updating,
}: ServiceRowProps) {
  const metadata = AI_SERVICE_METADATA[operationType];
  const Icon = metadata?.icon || Brain;
  const displayName = metadata?.name || featureName;

  return (
    <div className="flex items-center py-3 px-4 hover:bg-linear-bg-tertiary/50 transition-colors border-b border-linear-border-subtle last:border-b-0">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="p-1.5 rounded bg-linear-bg-tertiary text-linear-text-secondary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-linear-sm font-medium text-linear-text-primary truncate">
            {displayName}
          </p>
          <p className="text-linear-xs text-linear-text-muted">{operationType}</p>
        </div>
      </div>

      <div className="w-24 text-right">
        <p className="text-linear-sm text-linear-text-secondary">{calls.toLocaleString()}</p>
        <p className="text-linear-xs text-linear-text-muted">cereri</p>
      </div>

      <div className="w-24 text-right">
        <p className="text-linear-sm text-linear-text-secondary">{formatEur(cost * 100)}</p>
        <p className="text-linear-xs text-linear-text-muted">cost</p>
      </div>

      <div className="w-36 ml-4">
        <Select
          value={currentModel || 'default'}
          onValueChange={(value) => onModelChange(value === 'default' ? '' : value)}
          disabled={updating}
        >
          <SelectTrigger className="h-8 text-linear-sm">
            <SelectValue placeholder="Model implicit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">
              <span className="text-linear-text-muted">Implicit</span>
            </SelectItem>
            {MODEL_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex items-center justify-between w-full gap-2">
                  <span>{option.label}</span>
                  <span className="text-linear-xs text-linear-text-muted">
                    {option.description}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
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
    loading,
    updating,
    error,
    updateModelOverride,
    deleteModelOverride,
    refetchAll,
  } = useAdminAI();

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

  // Build a map of overrides by operation type
  const overridesMap = new Map(overrides.map((o) => [o.operationType, o.model]));

  // Build service data from features and costs
  const serviceData = features.map((feature) => {
    const costData = costsByFeature.find((c) => c.feature === feature.feature);
    return {
      operationType: feature.feature,
      featureName: feature.featureName,
      calls: costData?.calls || 0,
      cost: costData?.cost || 0,
      currentModel: overridesMap.get(feature.feature) || feature.model,
    };
  });

  // Handle model change
  const handleModelChange = async (operationType: string, model: string) => {
    if (model) {
      await updateModelOverride(operationType, model);
    } else {
      await deleteModelOverride(operationType);
    }
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
                Monitorizare utilizare și configurare modele AI
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
                value={formatEur((overview?.totalCost || 0) * 100)}
                icon={<DollarSign className="h-5 w-5" />}
                trend={
                  overview?.projectedMonthEnd
                    ? `Proiectat: ${formatEur(overview.projectedMonthEnd * 100)}`
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

          {/* Service Usage Table */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-linear-sm font-medium text-linear-text-muted uppercase tracking-wide">
                Utilizare per serviciu
              </h2>
              <Badge variant="default" className="text-linear-xs">
                {features.length} servicii
              </Badge>
            </div>

            <Card className="bg-linear-bg-secondary border-linear-border-subtle overflow-hidden">
              {/* Table Header */}
              <div className="flex items-center py-2 px-4 bg-linear-bg-tertiary/50 border-b border-linear-border-subtle">
                <div className="flex-1 min-w-0">
                  <p className="text-linear-xs font-medium text-linear-text-muted uppercase">
                    Serviciu
                  </p>
                </div>
                <div className="w-24 text-right">
                  <p className="text-linear-xs font-medium text-linear-text-muted uppercase">
                    Cereri
                  </p>
                </div>
                <div className="w-24 text-right">
                  <p className="text-linear-xs font-medium text-linear-text-muted uppercase">
                    Cost
                  </p>
                </div>
                <div className="w-36 ml-4">
                  <p className="text-linear-xs font-medium text-linear-text-muted uppercase">
                    Model
                  </p>
                </div>
              </div>

              {/* Table Body */}
              {loading ? (
                <div className="p-8 text-center">
                  <RefreshCw className="h-6 w-6 animate-spin text-linear-text-muted mx-auto mb-2" />
                  <p className="text-linear-sm text-linear-text-muted">Se încarcă...</p>
                </div>
              ) : serviceData.length === 0 ? (
                <div className="p-8 text-center">
                  <Brain className="h-8 w-8 text-linear-text-muted mx-auto mb-2" />
                  <p className="text-linear-sm text-linear-text-muted">
                    Nu există servicii AI configurate
                  </p>
                </div>
              ) : (
                <div>
                  {serviceData.map((service) => (
                    <ServiceRow
                      key={service.operationType}
                      operationType={service.operationType}
                      featureName={service.featureName}
                      calls={service.calls}
                      cost={service.cost}
                      currentModel={service.currentModel}
                      onModelChange={(model) => handleModelChange(service.operationType, model)}
                      updating={updating}
                    />
                  ))}
                </div>
              )}
            </Card>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
