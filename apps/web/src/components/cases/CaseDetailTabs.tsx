'use client';

import * as React from 'react';
import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { ContextSection } from '@/components/context/ContextSection';
import { CorrectionHistory } from '@/components/context/CorrectionHistory';
import { CaseComprehension } from './CaseComprehension';
import {
  GET_UNIFIED_CASE_CONTEXT,
  ADD_UNIFIED_CONTEXT_CORRECTION,
  UPDATE_UNIFIED_CONTEXT_CORRECTION,
  DELETE_UNIFIED_CONTEXT_CORRECTION,
  REGENERATE_UNIFIED_CASE_CONTEXT,
  type UnifiedContextResult,
  type CorrectionType,
  type UserCorrection,
  type ContextSection as ContextSectionType,
} from '@/graphql/unified-context';
import { useAuthStore, isAssociateOrAbove } from '@/store/authStore';
import {
  User,
  Users,
  FileText,
  Mail,
  Calendar,
  RefreshCw,
  Lock,
  AlertCircle,
  Cpu,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { type Case } from './index';

// ============================================================================
// Types
// ============================================================================

interface CaseDetailTabsProps {
  caseData: Case;
  userEmail: string;
  onTriggerSync?: () => Promise<void>;
  syncStatus?: 'Pending' | 'Syncing' | 'Completed' | 'Failed' | null;
}

// Tab configuration - mirrors unified context sections
// Note: 'rezumat' uses the new CaseComprehension component (AI-generated narrative)
const TABS = [
  { id: 'rezumat', label: 'Rezumat AI', sectionId: null, icon: Sparkles },
  { id: 'profil', label: 'Profil', sectionId: 'identity', icon: User },
  { id: 'persoane', label: 'Persoane', sectionId: 'people', icon: Users },
  { id: 'documente', label: 'Documente', sectionId: 'documents', icon: FileText },
  { id: 'comunicare', label: 'Comunicare', sectionId: 'communications', icon: Mail },
  { id: 'termene', label: 'Termene', sectionId: 'termene', icon: Calendar },
] as const;

// Available context tiers
const TIERS = [
  { code: 'critical', label: 'Minimal' },
  { code: 'standard', label: 'Standard' },
  { code: 'full', label: 'Complet' },
] as const;

// ============================================================================
// Main Component
// ============================================================================

export function CaseDetailTabs({
  caseData,
  userEmail: _userEmail,
  onTriggerSync,
  syncStatus,
}: CaseDetailTabsProps) {
  const [selectedTier, setSelectedTier] = useState<'critical' | 'standard' | 'full'>('standard');
  const [activeTab, setActiveTab] = useState('rezumat');
  const { user } = useAuthStore();
  const isSyncing = syncStatus === 'Pending' || syncStatus === 'Syncing';

  // Check if user has permission (Associates and above)
  const hasPermission = isAssociateOrAbove(user?.dbRole);

  // Query context
  const { data, loading, error, refetch } = useQuery<{
    unifiedCaseContext: UnifiedContextResult | null;
  }>(GET_UNIFIED_CASE_CONTEXT, {
    variables: { caseId: caseData.id, tier: selectedTier },
    skip: !hasPermission,
    fetchPolicy: 'cache-and-network',
  });

  // Mutations
  const [addCorrection] = useMutation(ADD_UNIFIED_CONTEXT_CORRECTION);
  const [updateCorrection] = useMutation(UPDATE_UNIFIED_CONTEXT_CORRECTION);
  const [deleteCorrection] = useMutation(DELETE_UNIFIED_CONTEXT_CORRECTION);
  const [regenerateContext, { loading: regenerating }] = useMutation(
    REGENERATE_UNIFIED_CASE_CONTEXT
  );

  const contextData = data?.unifiedCaseContext;

  // Handle adding a correction
  const handleAddCorrection = useCallback(
    async (correctionData: {
      sectionId: string;
      correctedValue: string;
      correctionType: CorrectionType;
      reason?: string;
    }) => {
      await addCorrection({
        variables: {
          input: {
            entityType: 'CASE',
            entityId: caseData.id,
            sectionId: correctionData.sectionId,
            correctionType: correctionData.correctionType,
            correctedValue: correctionData.correctedValue,
            reason: correctionData.reason,
          },
        },
      });
      await refetch();
    },
    [caseData.id, addCorrection, refetch]
  );

  // Handle toggling correction active state
  const handleToggleCorrection = useCallback(
    async (correctionId: string, isActive: boolean) => {
      await updateCorrection({
        variables: {
          input: {
            correctionId,
            isActive,
          },
        },
      });
      await refetch();
    },
    [updateCorrection, refetch]
  );

  // Handle deleting a correction
  const handleDeleteCorrection = useCallback(
    async (correctionId: string) => {
      await deleteCorrection({
        variables: { correctionId },
      });
      await refetch();
    },
    [deleteCorrection, refetch]
  );

  // Handle regenerating context
  const handleRegenerate = useCallback(async () => {
    // If sync is available, use it (which will also regenerate context)
    if (onTriggerSync) {
      await onTriggerSync();
    } else {
      await regenerateContext({ variables: { caseId: caseData.id } });
    }
    await refetch();
  }, [caseData.id, onTriggerSync, regenerateContext, refetch]);

  // Get section for a specific tab
  const getSectionForTab = (sectionId: string): ContextSectionType | undefined => {
    return contextData?.sections.find((s) => s.id === sectionId);
  };

  // Get corrections for a specific section
  const getCorrectionsBySectionId = (sectionId: string): UserCorrection[] => {
    return contextData?.corrections.filter((c: UserCorrection) => c.sectionId === sectionId) || [];
  };

  // Permission denied state
  if (!hasPermission) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center px-8">
          <div className="w-14 h-14 rounded-full bg-linear-warning/10 flex items-center justify-center mx-auto mb-5">
            <Lock className="w-7 h-7 text-linear-warning" />
          </div>
          <h3 className="text-base font-medium text-linear-text-primary mb-2">
            Acces restrictionat
          </h3>
          <p className="text-sm text-linear-text-tertiary max-w-sm mx-auto">
            Doar asociatii si partenerii pot vizualiza detaliile dosarului.
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading && !contextData) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-linear-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-linear-text-secondary">Se incarca contextul dosarului...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center px-8">
          <div className="w-14 h-14 rounded-full bg-linear-error/10 flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-7 h-7 text-linear-error" />
          </div>
          <h3 className="text-base font-medium text-linear-text-primary mb-2">
            Eroare la incarcarea contextului
          </h3>
          <p className="text-sm text-linear-text-tertiary max-w-sm mx-auto mb-4">{error.message}</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 rounded-lg bg-linear-accent text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Incearca din nou
          </button>
        </div>
      </div>
    );
  }

  // No context available - offer to sync
  if (!contextData) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center px-8">
          <div className="w-14 h-14 rounded-full bg-linear-accent/10 flex items-center justify-center mx-auto mb-5">
            <Cpu className="w-7 h-7 text-linear-accent" />
          </div>
          <h3 className="text-base font-medium text-linear-text-primary mb-2">
            Contextul nu este disponibil
          </h3>
          <p className="text-sm text-linear-text-tertiary max-w-sm mx-auto mb-4">
            Sincronizeaza dosarul pentru a genera contextul AI.
          </p>
          {onTriggerSync && (
            <button
              onClick={handleRegenerate}
              disabled={isSyncing || regenerating}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-linear-accent text-white font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <RefreshCw className={cn('w-4 h-4', (isSyncing || regenerating) && 'animate-spin')} />
              {isSyncing || regenerating ? 'Se sincronizeaza...' : 'Sincronizeaza dosarul'}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header with tier selector and regenerate */}
      <div className="flex-shrink-0 flex items-center justify-between px-8 py-3 border-b border-linear-border-subtle bg-linear-bg-primary">
        {/* Tier selector */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-linear-text-tertiary">Nivel detaliu:</label>
          <select
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value as 'critical' | 'standard' | 'full')}
            className="px-3 py-1.5 rounded-lg bg-linear-bg-secondary border border-linear-border-subtle text-sm text-linear-text-primary focus:outline-none focus:ring-1 focus:ring-linear-accent"
          >
            {TIERS.map((tier) => (
              <option key={tier.code} value={tier.code}>
                {tier.label}
              </option>
            ))}
          </select>
        </div>

        {/* Stats and regenerate */}
        <div className="flex items-center gap-4">
          <span className="text-xs text-linear-text-tertiary">
            {contextData.tokenCount.toLocaleString()} tokeni
          </span>
          <span className="text-xs text-linear-text-tertiary">v{contextData.version}</span>
          <button
            onClick={handleRegenerate}
            disabled={regenerating || isSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-linear-bg-secondary border border-linear-border-subtle text-sm text-linear-text-secondary hover:bg-linear-bg-hover transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={cn('w-3.5 h-3.5', (regenerating || isSyncing) && 'animate-spin')}
            />
            {regenerating || isSyncing ? 'Se actualizeaza...' : 'Actualizeaza'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList variant="underline" className="px-8 border-b border-linear-border-subtle">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            // "rezumat" tab doesn't need content check - it uses CaseComprehension
            const isRezumat = tab.id === 'rezumat';
            const section = tab.sectionId ? getSectionForTab(tab.sectionId) : null;
            const hasContent = isRezumat || (section && section.content.trim().length > 0);

            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className={cn(
                  'flex items-center gap-1.5',
                  !hasContent && 'opacity-50',
                  isRezumat && 'text-linear-accent'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Tab content */}
        {/* Rezumat tab - uses CaseComprehension component */}
        <TabsContent value="rezumat" className="flex-1 flex flex-col min-h-0 mt-0">
          <CaseComprehension caseId={caseData.id} className="m-4" />
        </TabsContent>

        {/* Other tabs - use ScrollArea with ContextSection */}
        {TABS.filter((tab) => tab.id !== 'rezumat').map((tab) => {
          const section = tab.sectionId ? getSectionForTab(tab.sectionId) : null;
          const corrections = tab.sectionId ? getCorrectionsBySectionId(tab.sectionId) : [];

          return (
            <TabsContent key={tab.id} value={tab.id} className="flex-1 mt-0">
              <ScrollArea className="h-full">
                <div className="p-8">
                  {section && section.content.trim() ? (
                    <ContextSection
                      section={section}
                      corrections={corrections}
                      onAddCorrection={handleAddCorrection}
                    />
                  ) : (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center">
                        <div className="w-12 h-12 rounded-full bg-linear-bg-tertiary flex items-center justify-center mx-auto mb-3">
                          <tab.icon className="w-6 h-6 text-linear-text-tertiary" />
                        </div>
                        <p className="text-sm text-linear-text-tertiary">
                          Nicio informatie disponibila in sectiunea {tab.label}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Correction history (shown below tab content) */}
                  {contextData && contextData.corrections.length > 0 && (
                    <CorrectionHistory
                      corrections={contextData.corrections.filter(
                        (c: UserCorrection) => c.sectionId === tab.sectionId
                      )}
                      onToggleActive={handleToggleCorrection}
                      onDelete={handleDeleteCorrection}
                      className="mt-6"
                    />
                  )}

                  {/* Generation info footer */}
                  {contextData && (
                    <div className="pt-4 text-center">
                      <p className="text-[10px] text-linear-text-tertiary">
                        Generat: {new Date(contextData.generatedAt).toLocaleString('ro-RO')} • Valid
                        pana: {new Date(contextData.validUntil).toLocaleString('ro-RO')}
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

export default CaseDetailTabs;
