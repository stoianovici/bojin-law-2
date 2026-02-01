'use client';

import * as React from 'react';
import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { ScrollArea } from '@/components/ui/ScrollArea';
import {
  GET_CASE_COMPREHENSION,
  GENERATE_CASE_COMPREHENSION,
  ADD_COMPREHENSION_CORRECTION,
  UPDATE_COMPREHENSION_CORRECTION,
  DELETE_COMPREHENSION_CORRECTION,
  type CaseComprehension as CaseComprehensionType,
  type ComprehensionCorrection,
  type ComprehensionCorrectionType,
  type ComprehensionTier,
  type DataMapSource,
} from '@/graphql/case-comprehension';
import { useAuthStore, isAssociateOrAbove } from '@/store/authStore';
import {
  RefreshCw,
  Lock,
  AlertCircle,
  Cpu,
  AlertTriangle,
  FileText,
  Mail,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  History,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Plus,
  X,
  Save,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface CaseComprehensionProps {
  caseId: string;
  className?: string;
}

// ============================================================================
// Markdown Rendering
// ============================================================================

function renderInlineFormatting(text: string): React.ReactNode {
  if (!text.includes('**')) return text;

  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-medium text-linear-text-primary">
        {part}
      </strong>
    ) : (
      part
    )
  );
}

function renderMarkdown(content: string): React.ReactNode {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];
  let inList = false;

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="space-y-1.5 my-2">
          {currentList}
        </ul>
      );
      currentList = [];
      inList = false;
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Empty line
    if (!trimmed) {
      flushList();
      elements.push(<div key={index} className="h-2" />);
      return;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      flushList();
      const [, hashes, headingText] = headingMatch;
      const level = hashes.length;
      elements.push(
        <h4
          key={index}
          className={cn(
            'font-semibold text-linear-text-primary',
            level === 1 && 'text-base mt-4 mb-2',
            level === 2 && 'text-sm mt-3 mb-1.5',
            level >= 3 && 'text-xs mt-2 mb-1 uppercase tracking-wider text-linear-text-secondary'
          )}
        >
          {headingText}
        </h4>
      );
      return;
    }

    // Warning/urgent indicators
    if (trimmed.includes('⚠️')) {
      flushList();
      elements.push(
        <div
          key={index}
          className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 my-2"
        >
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-200">
            {renderInlineFormatting(trimmed.replace('⚠️', '').trim())}
          </p>
        </div>
      );
      return;
    }

    // List items
    if (trimmed.startsWith('- ')) {
      inList = true;
      const itemContent = trimmed.slice(2);
      currentList.push(
        <li key={index} className="flex gap-2 text-sm">
          <span className="text-linear-accent shrink-0 mt-px">•</span>
          <span className="text-linear-text-secondary">{renderInlineFormatting(itemContent)}</span>
        </li>
      );
      return;
    }

    // Nested list items
    if (line.match(/^\s{2,}- /) && inList) {
      const nestedContent = trimmed.slice(2);
      currentList.push(
        <li key={index} className="ml-5 flex gap-2 text-sm text-linear-text-tertiary">
          <span className="text-linear-text-quaternary shrink-0">◦</span>
          <span>{renderInlineFormatting(nestedContent)}</span>
        </li>
      );
      return;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <p key={index} className="text-sm text-linear-text-secondary leading-relaxed">
        {renderInlineFormatting(trimmed)}
      </p>
    );
  });

  flushList();
  return elements;
}

// ============================================================================
// Sub-components
// ============================================================================

// Staleness Banner
function StalenessBanner({
  onRegenerate,
  isRegenerating,
}: {
  onRegenerate: () => void;
  isRegenerating: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-amber-500/10 border-b border-amber-500/20">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
        <span className="text-sm text-amber-200">
          Informatiile pot fi invechite. Au aparut modificari in dosar.
        </span>
      </div>
      <button
        onClick={onRegenerate}
        disabled={isRegenerating}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-200 text-sm font-medium hover:bg-amber-500/30 transition-colors disabled:opacity-50"
      >
        <RefreshCw className={cn('w-3.5 h-3.5', isRegenerating && 'animate-spin')} />
        {isRegenerating ? 'Se actualizeaza...' : 'Actualizeaza'}
      </button>
    </div>
  );
}

// Data Map Sources
function DataMapSources({
  sources,
  isExpanded,
  onToggle,
}: {
  sources: DataMapSource[];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  if (!sources || sources.length === 0) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'document':
        return FileText;
      case 'email_thread':
        return Mail;
      case 'task':
        return CheckSquare;
      default:
        return FileText;
    }
  };

  return (
    <div className="border-t border-linear-border-subtle">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-linear-bg-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-linear-text-tertiary" />
          <span className="text-sm font-medium text-linear-text-primary">Surse utilizate</span>
          <span className="px-2 py-0.5 rounded-full bg-linear-bg-tertiary text-linear-text-tertiary text-[10px]">
            {sources.length}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-linear-text-tertiary" />
        ) : (
          <ChevronDown className="w-4 h-4 text-linear-text-tertiary" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-2">
          {sources.map((source) => {
            const Icon = getIcon(source.type);
            return (
              <div
                key={source.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-linear-bg-tertiary"
              >
                <Icon className="w-4 h-4 text-linear-text-tertiary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-linear-text-primary truncate">
                    {source.title}
                  </p>
                  {source.topics.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {source.topics.slice(0, 3).map((topic, i) => (
                        <span
                          key={i}
                          className="px-1.5 py-0.5 rounded bg-linear-bg-secondary text-[10px] text-linear-text-tertiary"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  )}
                  {source.excerpt && (
                    <p className="mt-1 text-xs text-linear-text-tertiary line-clamp-2">
                      {source.excerpt}
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-linear-text-quaternary shrink-0">
                  ~{source.tokenEstimate} tok
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Correction History for Comprehension
function ComprehensionCorrectionHistory({
  corrections,
  onToggle,
  onDelete,
}: {
  corrections: ComprehensionCorrection[];
  onToggle: (id: string, isActive: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const activeCount = corrections.filter((c) => c.isActive).length;

  if (corrections.length === 0) return null;

  const handleToggle = async (id: string, currentState: boolean) => {
    setProcessingId(id);
    try {
      await onToggle(id, !currentState);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sigur doresti sa stergi aceasta corectie?')) return;
    setProcessingId(id);
    try {
      await onDelete(id);
    } finally {
      setProcessingId(null);
    }
  };

  const typeColors: Record<ComprehensionCorrectionType, string> = {
    OVERRIDE: 'bg-blue-500/10 text-blue-400',
    APPEND: 'bg-green-500/10 text-green-400',
    REMOVE: 'bg-red-500/10 text-red-400',
    NOTE: 'bg-yellow-500/10 text-yellow-400',
  };

  return (
    <div className="border-t border-linear-border-subtle">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-linear-bg-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-linear-text-tertiary" />
          <span className="text-sm font-medium text-linear-text-primary">Corectii</span>
          <span className="px-2 py-0.5 rounded-full bg-linear-accent/10 text-linear-accent text-[10px] font-medium">
            {activeCount} active din {corrections.length}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-linear-text-tertiary" />
        ) : (
          <ChevronDown className="w-4 h-4 text-linear-text-tertiary" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-linear-border-subtle">
          {corrections.map((correction) => (
            <div
              key={correction.id}
              className={cn(
                'flex items-start gap-3 px-4 py-3 border-b border-linear-border-subtle last:border-b-0',
                !correction.isActive && 'opacity-50'
              )}
            >
              <button
                onClick={() => handleToggle(correction.id, correction.isActive)}
                disabled={processingId === correction.id}
                className="mt-0.5 p-1 rounded hover:bg-linear-bg-hover transition-colors disabled:opacity-50"
              >
                {correction.isActive ? (
                  <ToggleRight className="w-5 h-5 text-linear-accent" />
                ) : (
                  <ToggleLeft className="w-5 h-5 text-linear-text-tertiary" />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded text-[10px] font-medium',
                      typeColors[correction.correctionType]
                    )}
                  >
                    {correction.correctionType}
                  </span>
                </div>
                <p className="text-xs text-linear-text-tertiary mb-1 line-clamp-1">
                  Ancorat la: &ldquo;{correction.anchorText.slice(0, 50)}...&rdquo;
                </p>
                <p className="text-sm text-linear-text-secondary line-clamp-2">
                  {correction.correctedValue}
                </p>
                {correction.reason && (
                  <p className="mt-1 text-xs text-linear-text-tertiary italic">
                    Motiv: {correction.reason}
                  </p>
                )}
                <p className="mt-1.5 text-[10px] text-linear-text-tertiary">
                  {new Date(correction.createdAt).toLocaleString('ro-RO')}
                  {correction.appliedAt && (
                    <span className="ml-2 text-linear-accent">• Aplicat</span>
                  )}
                </p>
              </div>

              <button
                onClick={() => handleDelete(correction.id)}
                disabled={processingId === correction.id}
                className="mt-0.5 p-1.5 rounded hover:bg-red-500/10 text-linear-text-tertiary hover:text-red-400 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Add Correction Dialog
function AddCorrectionDialog({
  onAdd,
  onCancel,
}: {
  onAdd: (data: {
    anchorText: string;
    correctionType: ComprehensionCorrectionType;
    correctedValue: string;
    reason?: string;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [anchorText, setAnchorText] = useState('');
  const [correctionType, setCorrectionType] = useState<ComprehensionCorrectionType>('NOTE');
  const [correctedValue, setCorrectedValue] = useState('');
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!anchorText.trim() || !correctedValue.trim()) return;
    setIsSaving(true);
    try {
      await onAdd({
        anchorText: anchorText.trim(),
        correctionType,
        correctedValue: correctedValue.trim(),
        reason: reason.trim() || undefined,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const types: { code: ComprehensionCorrectionType; label: string; description: string }[] = [
    { code: 'OVERRIDE', label: 'Inlocuieste', description: 'Inlocuieste textul ancorat' },
    { code: 'APPEND', label: 'Adauga', description: 'Adauga dupa textul ancorat' },
    { code: 'REMOVE', label: 'Sterge', description: 'Marcheaza ca eliminat' },
    { code: 'NOTE', label: 'Nota', description: 'Adauga o nota pentru AI' },
  ];

  return (
    <div className="border-t border-linear-border-subtle p-4 bg-linear-bg-tertiary">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium text-linear-text-primary">Adauga corectie</h4>
        <button onClick={onCancel} className="p-1 rounded hover:bg-linear-bg-hover">
          <X className="w-4 h-4 text-linear-text-tertiary" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-[11px] font-medium text-linear-text-tertiary uppercase tracking-wider mb-2">
            Text ancorat (ce text sa corecteze)
          </label>
          <input
            type="text"
            value={anchorText}
            onChange={(e) => setAnchorText(e.target.value)}
            placeholder="Selecteaza sau scrie textul din narativ..."
            className="w-full px-3 py-2 rounded-lg bg-linear-bg-primary border border-linear-border-subtle text-sm text-linear-text-primary placeholder-linear-text-tertiary focus:outline-none focus:ring-1 focus:ring-linear-accent"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-linear-text-tertiary uppercase tracking-wider mb-2">
            Tip corectie
          </label>
          <div className="flex flex-wrap gap-2">
            {types.map((type) => (
              <button
                key={type.code}
                onClick={() => setCorrectionType(type.code)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  correctionType === type.code
                    ? 'bg-linear-accent text-white'
                    : 'bg-linear-bg-secondary text-linear-text-secondary hover:bg-linear-bg-hover'
                )}
                title={type.description}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-linear-text-tertiary uppercase tracking-wider mb-2">
            Valoare corecta
          </label>
          <textarea
            value={correctedValue}
            onChange={(e) => setCorrectedValue(e.target.value)}
            placeholder="Ce ar trebui sa fie in loc..."
            className="w-full min-h-[80px] px-3 py-2 rounded-lg bg-linear-bg-primary border border-linear-border-subtle text-sm text-linear-text-primary placeholder-linear-text-tertiary resize-y focus:outline-none focus:ring-1 focus:ring-linear-accent"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-linear-text-tertiary uppercase tracking-wider mb-2">
            Motiv (optional)
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="De ce faci aceasta corectie?"
            className="w-full px-3 py-2 rounded-lg bg-linear-bg-primary border border-linear-border-subtle text-sm text-linear-text-primary placeholder-linear-text-tertiary focus:outline-none focus:ring-1 focus:ring-linear-accent"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium text-linear-text-secondary hover:bg-linear-bg-hover transition-colors"
          >
            Anuleaza
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !anchorText.trim() || !correctedValue.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-linear-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 inline-block mr-1.5 animate-spin" />
                Se salveaza...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 inline-block mr-1.5" />
                Salveaza
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CaseComprehension({ caseId, className }: CaseComprehensionProps) {
  const [showSources, setShowSources] = useState(false);
  const [showAddCorrection, setShowAddCorrection] = useState(false);
  const { user } = useAuthStore();

  const hasPermission = isAssociateOrAbove(user?.dbRole);

  // Query comprehension - always use FULL tier
  const { data, loading, error, refetch } = useQuery<{
    caseComprehension: CaseComprehensionType | null;
  }>(GET_CASE_COMPREHENSION, {
    variables: { caseId, tier: 'FULL' as ComprehensionTier },
    skip: !hasPermission,
    fetchPolicy: 'cache-and-network',
  });

  // Mutations
  const [generateComprehension, { loading: generating }] = useMutation(GENERATE_CASE_COMPREHENSION);
  const [addCorrection] = useMutation(ADD_COMPREHENSION_CORRECTION);
  const [updateCorrection] = useMutation(UPDATE_COMPREHENSION_CORRECTION);
  const [deleteCorrection] = useMutation(DELETE_COMPREHENSION_CORRECTION);

  const comprehension = data?.caseComprehension;

  // Get full content (always use complete tier)
  const getContent = () => {
    if (!comprehension) return '';
    return comprehension.currentPicture;
  };

  const getTokenCount = () => {
    if (!comprehension) return 0;
    return comprehension.tokensFull;
  };

  // Handlers
  const handleGenerate = useCallback(async () => {
    await generateComprehension({ variables: { caseId } });
    await refetch();
  }, [caseId, generateComprehension, refetch]);

  const handleAddCorrection = useCallback(
    async (data: {
      anchorText: string;
      correctionType: ComprehensionCorrectionType;
      correctedValue: string;
      reason?: string;
    }) => {
      await addCorrection({
        variables: {
          input: {
            caseId,
            anchorText: data.anchorText,
            correctionType: data.correctionType,
            correctedValue: data.correctedValue,
            reason: data.reason,
          },
        },
      });
      await refetch();
      setShowAddCorrection(false);
    },
    [caseId, addCorrection, refetch]
  );

  const handleToggleCorrection = useCallback(
    async (id: string, isActive: boolean) => {
      await updateCorrection({ variables: { id, isActive } });
      await refetch();
    },
    [updateCorrection, refetch]
  );

  const handleDeleteCorrection = useCallback(
    async (id: string) => {
      await deleteCorrection({ variables: { id } });
      await refetch();
    },
    [deleteCorrection, refetch]
  );

  // Permission denied
  if (!hasPermission) {
    return (
      <div className={cn('flex-1 flex items-center justify-center', className)}>
        <div className="text-center px-8">
          <div className="w-14 h-14 rounded-full bg-linear-warning/10 flex items-center justify-center mx-auto mb-5">
            <Lock className="w-7 h-7 text-linear-warning" />
          </div>
          <h3 className="text-base font-medium text-linear-text-primary mb-2">
            Acces restrictionat
          </h3>
          <p className="text-sm text-linear-text-tertiary max-w-sm mx-auto">
            Doar asociatii si partenerii pot vizualiza contextul AI.
          </p>
        </div>
      </div>
    );
  }

  // Loading
  if (loading && !comprehension) {
    return (
      <div className={cn('flex-1 flex items-center justify-center', className)}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-linear-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-linear-text-secondary">Se incarca contextul...</p>
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className={cn('flex-1 flex items-center justify-center', className)}>
        <div className="text-center px-8">
          <div className="w-14 h-14 rounded-full bg-linear-error/10 flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-7 h-7 text-linear-error" />
          </div>
          <h3 className="text-base font-medium text-linear-text-primary mb-2">Eroare</h3>
          <p className="text-sm text-linear-text-tertiary max-w-sm mx-auto mb-4">{error.message}</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 rounded-lg bg-linear-accent text-white text-sm font-medium hover:opacity-90"
          >
            Incearca din nou
          </button>
        </div>
      </div>
    );
  }

  // No comprehension - offer to generate
  if (!comprehension) {
    return (
      <div className={cn('flex-1 flex items-center justify-center', className)}>
        <div className="text-center px-8">
          <div className="w-14 h-14 rounded-full bg-linear-accent/10 flex items-center justify-center mx-auto mb-5">
            <Sparkles className="w-7 h-7 text-linear-accent" />
          </div>
          <h3 className="text-base font-medium text-linear-text-primary mb-2">
            Context AI nedisponibil
          </h3>
          <p className="text-sm text-linear-text-tertiary max-w-sm mx-auto mb-4">
            Genereaza un rezumat inteligent al dosarului pentru a intelege rapid situatia curenta.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-linear-accent text-white font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Cpu className={cn('w-4 h-4', generating && 'animate-pulse')} />
            {generating ? 'Se genereaza...' : 'Genereaza context AI'}
          </button>
        </div>
      </div>
    );
  }

  // Main content
  return (
    <div
      className={cn(
        'flex-1 flex flex-col min-h-0 overflow-hidden bg-linear-bg-secondary rounded-lg border border-linear-border-subtle',
        className
      )}
    >
      {/* Staleness banner */}
      {comprehension.isStale && (
        <StalenessBanner onRegenerate={handleGenerate} isRegenerating={generating} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-linear-border-subtle">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-linear-accent" />
          <span className="text-sm font-medium text-linear-text-primary">Context AI</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] text-linear-text-tertiary">
            {getTokenCount().toLocaleString()} tokeni • v{comprehension.version}
          </span>
          <button
            onClick={() => setShowAddCorrection(!showAddCorrection)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-linear-bg-tertiary text-xs text-linear-text-secondary hover:bg-linear-bg-hover transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Corectie
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-linear-bg-tertiary text-xs text-linear-text-secondary hover:bg-linear-bg-hover transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', generating && 'animate-spin')} />
            {generating ? 'Se actualizeaza...' : 'Actualizeaza'}
          </button>
        </div>
      </div>

      {/* Add correction form */}
      {showAddCorrection && (
        <AddCorrectionDialog
          onAdd={handleAddCorrection}
          onCancel={() => setShowAddCorrection(false)}
        />
      )}

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-1">{renderMarkdown(getContent())}</div>
      </ScrollArea>

      {/* Data map sources */}
      <DataMapSources
        sources={comprehension.dataMap.sources}
        isExpanded={showSources}
        onToggle={() => setShowSources(!showSources)}
      />

      {/* Correction history */}
      <ComprehensionCorrectionHistory
        corrections={comprehension.corrections}
        onToggle={handleToggleCorrection}
        onDelete={handleDeleteCorrection}
      />

      {/* Footer */}
      <div className="px-4 py-2 border-t border-linear-border-subtle text-center">
        <p className="text-[10px] text-linear-text-tertiary">
          Generat: {new Date(comprehension.generatedAt).toLocaleString('ro-RO')} • Valid pana:{' '}
          {new Date(comprehension.validUntil).toLocaleString('ro-RO')}
        </p>
      </div>
    </div>
  );
}

export default CaseComprehension;
