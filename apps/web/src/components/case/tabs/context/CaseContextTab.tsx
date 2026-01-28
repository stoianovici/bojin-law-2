'use client';

import * as React from 'react';
import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { RefreshCw, Cpu, Lock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { ContextSection } from './ContextSection';
import { CorrectionHistory } from './CorrectionHistory';
import {
  GET_CASE_CONTEXT_FILE,
  ADD_CASE_CONTEXT_CORRECTION,
  UPDATE_CASE_CONTEXT_CORRECTION,
  DELETE_CASE_CONTEXT_CORRECTION,
  REGENERATE_CASE_CONTEXT,
  type CaseContextFile,
  type CorrectionType,
  type UserCorrection,
  type ContextSection as ContextSectionType,
} from '@/graphql/case-context';
import { useAuthStore, isPartnerDb } from '@/store/authStore';

interface CaseContextTabProps {
  caseId: string;
  className?: string;
}

// Available context profiles
const PROFILES = [
  { code: 'word_addin', label: 'Word Add-in' },
  { code: 'email_drafting', label: 'Email AI' },
  { code: 'summary', label: 'Sinteza' },
];

export function CaseContextTab({ caseId, className }: CaseContextTabProps) {
  const [selectedProfile, setSelectedProfile] = useState('word_addin');
  const { user } = useAuthStore();

  // Check if user has permission (Partners/BusinessOwners only)
  const hasPermission = isPartnerDb(user?.dbRole);

  // Query context file
  const { data, loading, error, refetch } = useQuery<{ caseContextFile: CaseContextFile | null }>(
    GET_CASE_CONTEXT_FILE,
    {
      variables: { caseId, profileCode: selectedProfile },
      skip: !hasPermission,
      fetchPolicy: 'network-only',
    }
  );

  // Mutations
  const [addCorrection] = useMutation(ADD_CASE_CONTEXT_CORRECTION);
  const [updateCorrection] = useMutation(UPDATE_CASE_CONTEXT_CORRECTION);
  const [deleteCorrection] = useMutation(DELETE_CASE_CONTEXT_CORRECTION);
  const [regenerateContext, { loading: regenerating }] = useMutation(REGENERATE_CASE_CONTEXT);

  const contextFile = data?.caseContextFile;

  // Handle adding a correction
  const handleAddCorrection = useCallback(
    async (data: {
      sectionId: string;
      correctedValue: string;
      correctionType: CorrectionType;
      reason?: string;
    }) => {
      await addCorrection({
        variables: {
          input: {
            caseId,
            sectionId: data.sectionId,
            correctionType: data.correctionType,
            correctedValue: data.correctedValue,
            reason: data.reason,
          },
        },
      });
      // Refetch to get updated context with correction applied
      await refetch();
    },
    [caseId, addCorrection, refetch]
  );

  // Handle toggling correction active state
  const handleToggleCorrection = useCallback(
    async (correctionId: string, isActive: boolean) => {
      await updateCorrection({
        variables: {
          input: {
            correctionId,
            caseId,
            isActive,
          },
        },
      });
      await refetch();
    },
    [caseId, updateCorrection, refetch]
  );

  // Handle deleting a correction
  const handleDeleteCorrection = useCallback(
    async (correctionId: string) => {
      await deleteCorrection({
        variables: { caseId, correctionId },
      });
      await refetch();
    },
    [caseId, deleteCorrection, refetch]
  );

  // Handle regenerating context
  const handleRegenerate = useCallback(async () => {
    await regenerateContext({ variables: { caseId } });
    await refetch();
  }, [caseId, regenerateContext, refetch]);

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
            Doar partenerii pot vizualiza si edita contextul AI al dosarelor.
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-linear-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-linear-text-secondary">Se incarca contextul AI...</p>
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

  // No context available
  if (!contextFile) {
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
        </div>
      </div>
    );
  }

  // Get corrections grouped by section
  const getCorrectionsBySectionId = (sectionId: string): UserCorrection[] => {
    return contextFile.corrections.filter((c: UserCorrection) => c.sectionId === sectionId);
  };

  return (
    <div className={cn('flex flex-col min-h-0 overflow-hidden', className)}>
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-8 py-4 border-b border-linear-border-subtle">
        {/* Profile selector */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-linear-text-tertiary">Profil:</label>
          <select
            value={selectedProfile}
            onChange={(e) => setSelectedProfile(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-linear-bg-secondary border border-linear-border-subtle text-sm text-linear-text-primary focus:outline-none focus:ring-1 focus:ring-linear-accent"
          >
            {PROFILES.map((profile) => (
              <option key={profile.code} value={profile.code}>
                {profile.label}
              </option>
            ))}
          </select>
        </div>

        {/* Stats and regenerate */}
        <div className="flex items-center gap-4">
          <span className="text-xs text-linear-text-tertiary">
            {contextFile.tokenCount.toLocaleString()} tokeni
          </span>
          <span className="text-xs text-linear-text-tertiary">v{contextFile.version}</span>
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-linear-bg-secondary border border-linear-border-subtle text-sm text-linear-text-secondary hover:bg-linear-bg-hover transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', regenerating && 'animate-spin')} />
            {regenerating ? 'Se regenereaza...' : 'Regenereaza'}
          </button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-8 space-y-4">
          {/* Info banner */}
          <div className="flex items-start gap-3 p-4 rounded-lg bg-linear-accent/5 border border-linear-accent/10">
            <Cpu className="w-5 h-5 text-linear-accent flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-linear-text-primary font-medium">
                Context AI pentru {PROFILES.find((p) => p.code === selectedProfile)?.label}
              </p>
              <p className="text-xs text-linear-text-secondary mt-1">
                Aceasta este informatia pe care AI-ul o vede despre acest dosar. Click pe o sectiune
                pentru a face corectii care vor fi aplicate la viitoarele generari.
              </p>
            </div>
          </div>

          {/* Sections */}
          {contextFile.sections.map((section: ContextSectionType) => (
            <ContextSection
              key={section.id}
              section={section}
              corrections={getCorrectionsBySectionId(section.id)}
              onAddCorrection={handleAddCorrection}
            />
          ))}

          {/* Correction history */}
          {contextFile.corrections.length > 0 && (
            <CorrectionHistory
              corrections={contextFile.corrections}
              onToggleActive={handleToggleCorrection}
              onDelete={handleDeleteCorrection}
              className="mt-6"
            />
          )}

          {/* Generation info footer */}
          <div className="pt-4 text-center">
            <p className="text-[10px] text-linear-text-tertiary">
              Generat: {new Date(contextFile.generatedAt).toLocaleString('ro-RO')} • Valid pana:{' '}
              {new Date(contextFile.validUntil).toLocaleString('ro-RO')}
            </p>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

export default CaseContextTab;
