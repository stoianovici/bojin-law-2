/**
 * Document Preferences React Hooks
 * Story 5.6: AI Learning and Personalization (Task 32)
 * Hooks for managing user's document structure preferences
 */

import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { useMemo } from 'react';
import type { DocumentStructurePreference } from '@legal-platform/types';

// ====================
// GraphQL Fragments
// ====================

const DOCUMENT_STRUCTURE_PREFERENCE_FRAGMENT = gql`
  fragment DocumentStructurePreferenceFields on DocumentStructurePreference {
    id
    firmId
    userId
    documentType
    preferredSections {
      name
      order
      required
    }
    headerStyle {
      format
      numbering
      includeDate
      includeAuthor
    }
    footerContent
    marginPreferences
    fontPreferences
    usageCount
    lastUsedAt
    createdAt
    updatedAt
  }
`;

// ====================
// Queries
// ====================

const GET_MY_DOCUMENT_PREFERENCES = gql`
  ${DOCUMENT_STRUCTURE_PREFERENCE_FRAGMENT}
  query GetMyDocumentPreferences {
    myDocumentPreferences {
      ...DocumentStructurePreferenceFields
    }
  }
`;

const GET_DOCUMENT_PREFERENCE = gql`
  ${DOCUMENT_STRUCTURE_PREFERENCE_FRAGMENT}
  query GetDocumentPreference($documentType: String!) {
    documentPreference(documentType: $documentType) {
      ...DocumentStructurePreferenceFields
    }
  }
`;

// ====================
// Mutations
// ====================

const SAVE_DOCUMENT_PREFERENCE = gql`
  ${DOCUMENT_STRUCTURE_PREFERENCE_FRAGMENT}
  mutation SaveDocumentPreference($input: DocumentStructureInput!) {
    saveDocumentPreference(input: $input) {
      ...DocumentStructurePreferenceFields
    }
  }
`;

const DELETE_DOCUMENT_PREFERENCE = gql`
  mutation DeleteDocumentPreference($documentType: String!) {
    deleteDocumentPreference(documentType: $documentType)
  }
`;

// ====================
// Types
// ====================

export interface DocumentSection {
  name: string;
  order: number;
  required: boolean;
}

export interface HeaderStyle {
  format: 'numbered' | 'bulleted' | 'plain';
  numbering: 'decimal' | 'roman' | 'alpha';
  includeDate: boolean;
  includeAuthor: boolean;
}

export interface FontPreferences {
  family: string;
  size: number;
  lineHeight: number;
}

export interface MarginPreferences {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface DocumentStructureInput {
  documentType: string;
  sections: DocumentSection[];
  headerStyle: HeaderStyle;
  footerContent?: string;
  marginPreferences?: MarginPreferences;
  fontPreferences?: FontPreferences;
}

// ====================
// Hooks
// ====================

/**
 * Hook to get all document structure preferences
 */
export function useDocumentPreferences() {
  const { data, loading, error, refetch } = useQuery<{
    myDocumentPreferences: DocumentStructurePreference[];
  }>(GET_MY_DOCUMENT_PREFERENCES, {
    fetchPolicy: 'cache-and-network',
  });

  const preferences = data?.myDocumentPreferences ?? [];

  // Group by document type for easy lookup
  const preferencesByType = useMemo(() => {
    const map: Record<string, DocumentStructurePreference> = {};
    preferences.forEach((pref: DocumentStructurePreference) => {
      map[pref.documentType] = pref;
    });
    return map;
  }, [preferences]);

  // Get configured document types
  const configuredTypes = useMemo(() => {
    return preferences.map((p: DocumentStructurePreference) => p.documentType);
  }, [preferences]);

  // Most used preference
  const mostUsed = useMemo(() => {
    if (preferences.length === 0) return null;
    return [...preferences].sort((a, b) => b.usageCount - a.usageCount)[0];
  }, [preferences]);

  return {
    preferences,
    preferencesByType,
    configuredTypes,
    mostUsed,
    loading,
    error,
    refetch,
    count: preferences.length,
  };
}

/**
 * Hook to get a specific document preference by type
 */
export function useDocumentPreference(documentType: string) {
  const { data, loading, error, refetch } = useQuery<{
    documentPreference: DocumentStructurePreference | null;
  }>(GET_DOCUMENT_PREFERENCE, {
    variables: { documentType },
    skip: !documentType,
    fetchPolicy: 'cache-first',
  });

  return {
    preference: data?.documentPreference ?? null,
    loading,
    error,
    refetch,
    hasPreference: !!data?.documentPreference,
  };
}

/**
 * Hook to save a document structure preference
 */
export function useSaveDocumentPreference() {
  const [save, { loading, error }] = useMutation<
    { saveDocumentPreference: DocumentStructurePreference },
    { input: DocumentStructureInput }
  >(SAVE_DOCUMENT_PREFERENCE, {
    refetchQueries: ['GetMyDocumentPreferences'],
    awaitRefetchQueries: true,
  });

  const savePreference = async (input: DocumentStructureInput) => {
    // Validate sections have unique orders
    const orders = new Set(input.sections.map((s) => s.order));
    if (orders.size !== input.sections.length) {
      throw new Error('Secțiunile trebuie să aibă ordini unice');
    }

    const result = await save({ variables: { input } });
    return result.data?.saveDocumentPreference;
  };

  return {
    savePreference,
    loading,
    error,
  };
}

/**
 * Hook to delete a document preference
 */
export function useDeleteDocumentPreference() {
  const [deleteMutation, { loading, error }] = useMutation<
    { deleteDocumentPreference: boolean },
    { documentType: string }
  >(DELETE_DOCUMENT_PREFERENCE, {
    refetchQueries: ['GetMyDocumentPreferences'],
    awaitRefetchQueries: true,
  });

  const deletePreference = async (documentType: string) => {
    const result = await deleteMutation({ variables: { documentType } });
    return result.data?.deleteDocumentPreference ?? false;
  };

  return {
    deletePreference,
    loading,
    error,
  };
}

/**
 * Combined hook for document preference management
 * Use in settings/personalization pages
 */
export function useDocumentPreferenceManagement() {
  const {
    preferences,
    preferencesByType,
    configuredTypes,
    mostUsed,
    loading: preferencesLoading,
    error: preferencesError,
    refetch,
    count,
  } = useDocumentPreferences();

  const {
    savePreference,
    loading: saving,
    error: saveError,
  } = useSaveDocumentPreference();

  const {
    deletePreference,
    loading: deleting,
    error: deleteError,
  } = useDeleteDocumentPreference();

  return {
    // Data
    preferences,
    preferencesByType,
    configuredTypes,
    mostUsed,
    count,

    // Loading states
    loading: preferencesLoading,
    saving,
    deleting,

    // Errors
    error: preferencesError || saveError || deleteError,

    // Actions
    savePreference,
    deletePreference,
    refetch,
  };
}

// ====================
// Helper Functions
// ====================

/**
 * Get default section structure for a document type
 */
export function getDefaultSections(documentType: string): DocumentSection[] {
  const defaults: Record<string, DocumentSection[]> = {
    Contract: [
      { name: 'Părțile contractante', order: 1, required: true },
      { name: 'Obiectul contractului', order: 2, required: true },
      { name: 'Durata contractului', order: 3, required: false },
      { name: 'Prețul și modalitatea de plată', order: 4, required: true },
      { name: 'Obligațiile părților', order: 5, required: true },
      { name: 'Răspunderea contractuală', order: 6, required: false },
      { name: 'Forța majoră', order: 7, required: false },
      { name: 'Clauze finale', order: 8, required: true },
    ],
    Motion: [
      { name: 'Instanța', order: 1, required: true },
      { name: 'Dosarul nr.', order: 2, required: true },
      { name: 'Părțile', order: 3, required: true },
      { name: 'Obiectul cererii', order: 4, required: true },
      { name: 'Motivarea în fapt', order: 5, required: true },
      { name: 'Motivarea în drept', order: 6, required: true },
      { name: 'Probe', order: 7, required: false },
      { name: 'Cereri', order: 8, required: true },
    ],
    Letter: [
      { name: 'Antet', order: 1, required: false },
      { name: 'Data', order: 2, required: true },
      { name: 'Destinatar', order: 3, required: true },
      { name: 'Referință', order: 4, required: false },
      { name: 'Corp scrisoare', order: 5, required: true },
      { name: 'Încheiere', order: 6, required: true },
      { name: 'Semnătură', order: 7, required: true },
    ],
    Memorandum: [
      { name: 'De la', order: 1, required: true },
      { name: 'Către', order: 2, required: true },
      { name: 'Subiect', order: 3, required: true },
      { name: 'Dată', order: 4, required: true },
      { name: 'Introducere', order: 5, required: true },
      { name: 'Analiza faptelor', order: 6, required: true },
      { name: 'Analiza juridică', order: 7, required: true },
      { name: 'Concluzii', order: 8, required: true },
      { name: 'Recomandări', order: 9, required: false },
    ],
  };

  return (
    defaults[documentType] || [
      { name: 'Introducere', order: 1, required: true },
      { name: 'Conținut', order: 2, required: true },
      { name: 'Concluzie', order: 3, required: true },
    ]
  );
}

/**
 * Get default header style
 */
export function getDefaultHeaderStyle(): HeaderStyle {
  return {
    format: 'numbered',
    numbering: 'decimal',
    includeDate: true,
    includeAuthor: false,
  };
}

/**
 * Get available document types
 */
export function getAvailableDocumentTypes(): string[] {
  return [
    'Contract',
    'Motion',
    'Letter',
    'Memorandum',
    'Brief',
    'Agreement',
    'Notice',
    'Report',
    'Custom',
  ];
}

/**
 * Format document type for display
 */
export function formatDocumentType(type: string): string {
  const labels: Record<string, string> = {
    Contract: 'Contract',
    Motion: 'Cerere/Întâmpinare',
    Letter: 'Scrisoare',
    Memorandum: 'Memoriu',
    Brief: 'Sinteză',
    Agreement: 'Acord',
    Notice: 'Notificare',
    Report: 'Raport',
    Custom: 'Personalizat',
  };
  return labels[type] || type;
}
