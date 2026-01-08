'use client';

import { useState, useCallback, useEffect } from 'react';
import { useQuery } from './useGraphQL';
import { apolloClient } from '@/lib/apollo-client';
import {
  GET_TEMPLATES,
  GET_TEMPLATE,
  GET_ONRC_TEMPLATES,
  CREATE_MAPA_FROM_TEMPLATE,
  CREATE_TEMPLATE,
  UPDATE_TEMPLATE,
  DUPLICATE_TEMPLATE,
  SYNC_ONRC_TEMPLATES,
  SYNC_SINGLE_TEMPLATE,
} from '@/graphql/template';
import { MOCK_TEMPLATES, getTemplateById, getONRCTemplates } from '@/lib/mock/templates';
import type { MapaTemplate, Mapa, SlotDefinition } from '@/types/mapa';

// Use mock data in development when backend is not available
const USE_MOCK_DATA = process.env.NODE_ENV === 'development';

// Mutation result types
interface CreateMapaFromTemplateMutationResult {
  createMapaFromTemplate: Mapa;
}

interface CreateTemplateMutationResult {
  createTemplate: MapaTemplate;
}

interface UpdateTemplateMutationResult {
  updateTemplate: MapaTemplate;
}

interface DuplicateTemplateMutationResult {
  duplicateTemplate: MapaTemplate;
}

interface SyncONRCTemplatesMutationResult {
  syncONRCTemplates: {
    success: boolean;
    message: string;
    syncedCount?: number;
    changesDetected?: Array<{
      templateId: string;
      templateName: string;
      slotsAdded: string[];
      slotsRemoved: string[];
    }>;
  };
}

interface SyncSingleTemplateMutationResult {
  syncSingleTemplate: {
    success: boolean;
    message: string;
    template?: MapaTemplate;
    changesDetected: boolean;
    slotsAdded?: string[];
    slotsRemoved?: string[];
  };
}

// ============================================================================
// Query Hooks
// ============================================================================

interface TemplatesQueryResult {
  templates: MapaTemplate[];
}

interface TemplateQueryResult {
  template: MapaTemplate;
}

interface GetTemplatesOptions {
  firmId?: string;
  isONRC?: boolean;
  isActive?: boolean;
}

/**
 * Hook to fetch templates with optional filters
 * Uses our API which returns scraped ONRC templates + firm templates
 */
export function useTemplates(options: GetTemplatesOptions = {}) {
  const [templates, setTemplates] = useState<MapaTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (options.isONRC !== undefined) params.set('isONRC', String(options.isONRC));
      if (options.isActive !== undefined) params.set('isActive', String(options.isActive));

      const response = await fetch(`/api/templates?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch templates');

      const data = await response.json();
      setTemplates(data.templates || []);
      setError(undefined);
    } catch (err) {
      // Fall back to mock data on error
      let mockData = MOCK_TEMPLATES;
      if (options.isONRC !== undefined) {
        mockData = mockData.filter((t) => t.isONRC === options.isONRC);
      }
      if (options.isActive !== undefined) {
        mockData = mockData.filter((t) => t.isActive === options.isActive);
      }
      setTemplates(mockData);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [options.isONRC, options.isActive]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return {
    templates,
    loading,
    error,
    refetch: fetchTemplates,
  };
}

/**
 * Hook to fetch a single template by ID
 * Falls back to mock data in development
 */
export function useTemplate(id: string | undefined) {
  const { data, loading, error, refetch } = useQuery<TemplateQueryResult>(GET_TEMPLATE, {
    variables: { id },
    skip: !id,
  });

  // Use mock data as fallback
  const template = data?.template ?? (USE_MOCK_DATA && id ? getTemplateById(id) : undefined);

  return {
    template,
    loading: loading && !USE_MOCK_DATA,
    error: USE_MOCK_DATA ? undefined : error,
    refetch,
  };
}

/**
 * Hook to fetch only ONRC templates (official Romanian templates)
 * Falls back to mock data in development
 */
export function useONRCTemplates() {
  const { data, loading, error, refetch } = useQuery<TemplatesQueryResult>(GET_ONRC_TEMPLATES);

  // Use mock data as fallback
  const templates =
    data?.templates && data.templates.length > 0
      ? data.templates
      : USE_MOCK_DATA
        ? getONRCTemplates()
        : [];

  return {
    templates,
    loading: loading && !USE_MOCK_DATA,
    error: USE_MOCK_DATA ? undefined : error,
    refetch,
  };
}

// ============================================================================
// Mutation Hooks
// ============================================================================

interface CreateMapaFromTemplateOptions {
  templateId: string;
  caseId: string;
  name?: string;
  description?: string;
}

/**
 * Hook to create a new mapa from a template
 */
export function useCreateMapaFromTemplate() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const createFromTemplate = useCallback(
    async (options: CreateMapaFromTemplateOptions): Promise<Mapa | null> => {
      setLoading(true);
      setError(undefined);

      try {
        const result = await apolloClient.mutate<CreateMapaFromTemplateMutationResult>({
          mutation: CREATE_MAPA_FROM_TEMPLATE,
          variables: {
            templateId: options.templateId,
            caseId: options.caseId,
          },
        });
        return result.data?.createMapaFromTemplate ?? null;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { createFromTemplate, loading, error };
}

interface CreateTemplateInput {
  name: string;
  description?: string;
  caseType?: string;
  slotDefinitions: SlotDefinition[];
}

/**
 * Hook to create a new firm template
 */
export function useCreateTemplate() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const createTemplate = useCallback(
    async (input: CreateTemplateInput): Promise<MapaTemplate | null> => {
      setLoading(true);
      setError(undefined);

      try {
        const result = await apolloClient.mutate<CreateTemplateMutationResult>({
          mutation: CREATE_TEMPLATE,
          variables: { input },
        });
        return result.data?.createTemplate ?? null;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { createTemplate, loading, error };
}

interface UpdateTemplateInput {
  name?: string;
  description?: string;
  caseType?: string;
  isActive?: boolean;
  slotDefinitions?: SlotDefinition[];
}

/**
 * Hook to update an existing template
 */
export function useUpdateTemplate() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const updateTemplate = useCallback(
    async (id: string, input: UpdateTemplateInput): Promise<MapaTemplate | null> => {
      setLoading(true);
      setError(undefined);

      try {
        const result = await apolloClient.mutate<UpdateTemplateMutationResult>({
          mutation: UPDATE_TEMPLATE,
          variables: { id, input },
        });
        return result.data?.updateTemplate ?? null;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { updateTemplate, loading, error };
}

/**
 * Hook to duplicate a template
 */
export function useDuplicateTemplate() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const duplicateTemplate = useCallback(
    async (templateId: string, newName: string): Promise<MapaTemplate | null> => {
      setLoading(true);
      setError(undefined);

      try {
        const result = await apolloClient.mutate<DuplicateTemplateMutationResult>({
          mutation: DUPLICATE_TEMPLATE,
          variables: { templateId, newName },
        });
        return result.data?.duplicateTemplate ?? null;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { duplicateTemplate, loading, error };
}

// ============================================================================
// Sync Hooks
// ============================================================================

interface SyncResult {
  success: boolean;
  message: string;
  syncedCount?: number;
  aiEnhancedCount?: number;
  changesDetected?: Array<{
    templateId: string;
    templateName: string;
    slotsAdded: string[];
    slotsRemoved: string[];
  }>;
}

export interface SyncOptions {
  /** Enable full AI analysis of ONRC content (more accurate but slower) */
  useAI?: boolean;
  /** Enrich basic parsing with AI-generated descriptions (faster than full AI) */
  enrichWithAI?: boolean;
}

/**
 * Hook to sync all ONRC templates via our API (scrapes onrc.ro)
 * Supports AI enhancement for better document understanding
 */
export function useSyncONRCTemplates() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const syncAll = useCallback(async (options: SyncOptions = {}): Promise<SyncResult | null> => {
    setLoading(true);
    setError(undefined);

    try {
      // Call our API route that scrapes ONRC
      const response = await fetch('/api/admin/sync-onrc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          useAI: options.useAI,
          enrichWithAI: options.enrichWithAI,
        }),
      });

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: result.success,
        message: result.message,
        syncedCount: result.templates?.length,
        aiEnhancedCount: result.templates?.filter((t: { aiEnhanced?: boolean }) => t.aiEnhanced)
          .length,
        changesDetected:
          result.errors?.length > 0
            ? result.errors.map((e: { procedureId: string; error: string }) => ({
                templateId: e.procedureId,
                templateName: e.procedureId,
                slotsAdded: [],
                slotsRemoved: [],
              }))
            : undefined,
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { syncAll, loading, error };
}

interface SingleSyncResult {
  success: boolean;
  message: string;
  template?: MapaTemplate;
  changesDetected: boolean;
  aiEnhanced?: boolean;
  slotsAdded?: string[];
  slotsRemoved?: string[];
}

/**
 * Hook to sync a single template via our API
 * Supports AI enhancement for better document understanding
 */
export function useSyncTemplate() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const syncTemplate = useCallback(
    async (templateId: string, options: SyncOptions = {}): Promise<SingleSyncResult | null> => {
      setLoading(true);
      setError(undefined);

      try {
        const response = await fetch('/api/admin/sync-onrc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templateId,
            useAI: options.useAI,
            enrichWithAI: options.enrichWithAI,
          }),
        });

        if (!response.ok) {
          throw new Error(`Sync failed: ${response.statusText}`);
        }

        const result = await response.json();
        return {
          success: result.success,
          message: result.message,
          template: result.templates?.[0],
          changesDetected: !!result.errors?.length,
          aiEnhanced: result.aiEnhanced,
          slotsAdded: [],
          slotsRemoved: [],
        };
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { syncTemplate, loading, error };
}

export interface ONRCSyncStatus {
  lastSyncAt: string | null;
  lastSyncSuccess: boolean;
  templateCount: number;
  syncCount: number;
  aiEnhancedCount: number;
}

/**
 * Hook to get ONRC sync status including AI enhancement info
 */
export function useONRCSyncStatus() {
  const [status, setStatus] = useState<ONRCSyncStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/sync-onrc');
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch {
      // Ignore errors, keep existing status
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return { status, loading, refetch: fetchStatus };
}
