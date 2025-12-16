/**
 * Personal Snippets React Hooks
 * Story 5.6: AI Learning and Personalization (Task 24)
 * Hooks for managing user's personal snippets and suggestions
 */

import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { useCallback, useMemo } from 'react';
import type { PersonalSnippet, SnippetCategory, SnippetSuggestion } from '@legal-platform/types';

// ====================
// GraphQL Fragments
// ====================

const PERSONAL_SNIPPET_FRAGMENT = gql`
  fragment PersonalSnippetFields on PersonalSnippet {
    id
    firmId
    userId
    shortcut
    title
    content
    category
    usageCount
    lastUsedAt
    isAutoDetected
    createdAt
    updatedAt
  }
`;

const SNIPPET_SUGGESTION_FRAGMENT = gql`
  fragment SnippetSuggestionFields on SnippetSuggestion {
    content
    suggestedTitle
    suggestedShortcut
    category
    occurrenceCount
    confidence
  }
`;

// ====================
// Queries
// ====================

const GET_MY_SNIPPETS = gql`
  ${PERSONAL_SNIPPET_FRAGMENT}
  query GetMySnippets($category: SnippetCategory) {
    mySnippets(category: $category) {
      ...PersonalSnippetFields
    }
  }
`;

const GET_SNIPPET = gql`
  ${PERSONAL_SNIPPET_FRAGMENT}
  query GetSnippet($id: ID!) {
    snippet(id: $id) {
      ...PersonalSnippetFields
    }
  }
`;

const SEARCH_SNIPPETS = gql`
  ${PERSONAL_SNIPPET_FRAGMENT}
  query SearchSnippets($query: String!) {
    searchSnippets(query: $query) {
      ...PersonalSnippetFields
    }
  }
`;

const GET_SNIPPET_SUGGESTIONS = gql`
  ${SNIPPET_SUGGESTION_FRAGMENT}
  query GetSnippetSuggestions {
    snippetSuggestions {
      ...SnippetSuggestionFields
    }
  }
`;

// ====================
// Mutations
// ====================

const CREATE_SNIPPET = gql`
  ${PERSONAL_SNIPPET_FRAGMENT}
  mutation CreateSnippet($input: CreateSnippetInput!) {
    createSnippet(input: $input) {
      ...PersonalSnippetFields
    }
  }
`;

const UPDATE_SNIPPET = gql`
  ${PERSONAL_SNIPPET_FRAGMENT}
  mutation UpdateSnippet($id: ID!, $input: UpdateSnippetInput!) {
    updateSnippet(id: $id, input: $input) {
      ...PersonalSnippetFields
    }
  }
`;

const DELETE_SNIPPET = gql`
  mutation DeleteSnippet($id: ID!) {
    deleteSnippet(id: $id)
  }
`;

const RECORD_SNIPPET_USAGE = gql`
  ${PERSONAL_SNIPPET_FRAGMENT}
  mutation RecordSnippetUsage($id: ID!) {
    recordSnippetUsage(id: $id) {
      ...PersonalSnippetFields
    }
  }
`;

const ACCEPT_SNIPPET_SUGGESTION = gql`
  ${PERSONAL_SNIPPET_FRAGMENT}
  mutation AcceptSnippetSuggestion(
    $content: String!
    $shortcut: String!
    $title: String!
    $category: SnippetCategory!
  ) {
    acceptSnippetSuggestion(
      content: $content
      shortcut: $shortcut
      title: $title
      category: $category
    ) {
      ...PersonalSnippetFields
    }
  }
`;

const DISMISS_SNIPPET_SUGGESTION = gql`
  mutation DismissSnippetSuggestion($content: String!) {
    dismissSnippetSuggestion(content: $content)
  }
`;

// ====================
// Types
// ====================

export interface CreateSnippetInput {
  shortcut: string;
  title: string;
  content: string;
  category: SnippetCategory;
}

export interface UpdateSnippetInput {
  shortcut?: string;
  title?: string;
  content?: string;
  category?: SnippetCategory;
}

// ====================
// Hooks
// ====================

/**
 * Hook to get all personal snippets, optionally filtered by category
 */
export function useSnippets(category?: SnippetCategory) {
  const { data, loading, error, refetch } = useQuery<{
    mySnippets: PersonalSnippet[];
  }>(GET_MY_SNIPPETS, {
    variables: category ? { category } : {},
    fetchPolicy: 'cache-and-network',
  });

  const snippets = data?.mySnippets ?? [];

  // Group snippets by category for easy access
  const snippetsByCategory = useMemo(() => {
    const groups: Record<SnippetCategory, PersonalSnippet[]> = {
      Greeting: [],
      Closing: [],
      LegalPhrase: [],
      ClientResponse: [],
      InternalNote: [],
      Custom: [],
    };

    snippets.forEach((snippet: PersonalSnippet) => {
      if (groups[snippet.category]) {
        groups[snippet.category].push(snippet);
      }
    });

    return groups;
  }, [snippets]);

  // Most used snippets (top 5)
  const mostUsed = useMemo(() => {
    return [...snippets].sort((a, b) => b.usageCount - a.usageCount).slice(0, 5);
  }, [snippets]);

  // Recently used snippets (top 5)
  const recentlyUsed = useMemo(() => {
    return [...snippets]
      .filter((s) => s.lastUsedAt)
      .sort((a, b) => new Date(b.lastUsedAt!).getTime() - new Date(a.lastUsedAt!).getTime())
      .slice(0, 5);
  }, [snippets]);

  return {
    snippets,
    snippetsByCategory,
    mostUsed,
    recentlyUsed,
    loading,
    error,
    refetch,
    count: snippets.length,
  };
}

/**
 * Hook to get a single snippet by ID
 */
export function useSnippet(id: string) {
  const { data, loading, error, refetch } = useQuery<{
    snippet: PersonalSnippet | null;
  }>(GET_SNIPPET, {
    variables: { id },
    skip: !id,
    fetchPolicy: 'cache-first',
  });

  return {
    snippet: data?.snippet ?? null,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook to search snippets by shortcut, title, or content
 */
export function useSearchSnippets() {
  const { data, loading, refetch } = useQuery<{
    searchSnippets: PersonalSnippet[];
  }>(SEARCH_SNIPPETS, {
    skip: true, // Only run when called manually
    fetchPolicy: 'network-only',
  });

  const searchSnippets = useCallback(
    async (query: string) => {
      if (!query || query.length < 2) {
        return [];
      }
      const result = await refetch({ query });
      return result.data?.searchSnippets ?? [];
    },
    [refetch]
  );

  return {
    results: data?.searchSnippets ?? [],
    loading,
    searchSnippets,
  };
}

/**
 * Hook to create a new snippet
 */
export function useCreateSnippet() {
  const [create, { loading, error }] = useMutation<
    { createSnippet: PersonalSnippet },
    { input: CreateSnippetInput }
  >(CREATE_SNIPPET, {
    refetchQueries: ['GetMySnippets'],
    awaitRefetchQueries: true,
  });

  const createSnippet = async (input: CreateSnippetInput) => {
    // Validate shortcut format
    if (!/^[a-zA-Z0-9_-]+$/.test(input.shortcut)) {
      throw new Error('Shortcut-ul poate conține doar litere, cifre, liniuțe și underscore');
    }

    if (input.shortcut.length > 50) {
      throw new Error('Shortcut-ul nu poate depăși 50 de caractere');
    }

    const result = await create({ variables: { input } });
    return result.data?.createSnippet;
  };

  return {
    createSnippet,
    loading,
    error,
  };
}

/**
 * Hook to update an existing snippet
 */
export function useUpdateSnippet() {
  const [update, { loading, error }] = useMutation<
    { updateSnippet: PersonalSnippet },
    { id: string; input: UpdateSnippetInput }
  >(UPDATE_SNIPPET, {
    refetchQueries: ['GetMySnippets'],
  });

  const updateSnippet = async (id: string, input: UpdateSnippetInput) => {
    // Validate shortcut format if provided
    if (input.shortcut && !/^[a-zA-Z0-9_-]+$/.test(input.shortcut)) {
      throw new Error('Shortcut-ul poate conține doar litere, cifre, liniuțe și underscore');
    }

    const result = await update({ variables: { id, input } });
    return result.data?.updateSnippet;
  };

  return {
    updateSnippet,
    loading,
    error,
  };
}

/**
 * Hook to delete a snippet
 */
export function useDeleteSnippet() {
  const [deleteMutation, { loading, error }] = useMutation<
    { deleteSnippet: boolean },
    { id: string }
  >(DELETE_SNIPPET, {
    refetchQueries: ['GetMySnippets'],
    awaitRefetchQueries: true,
  });

  const deleteSnippet = async (id: string) => {
    const result = await deleteMutation({ variables: { id } });
    return result.data?.deleteSnippet ?? false;
  };

  return {
    deleteSnippet,
    loading,
    error,
  };
}

/**
 * Hook to record snippet usage (called when snippet is inserted)
 */
export function useRecordSnippetUsage() {
  const [record, { loading }] = useMutation<
    { recordSnippetUsage: PersonalSnippet },
    { id: string }
  >(RECORD_SNIPPET_USAGE, {
    // Don't refetch list on usage - optimistic update is enough
    optimisticResponse: ({ id }: { id: string }) => ({
      recordSnippetUsage: {
        __typename: 'PersonalSnippet',
        id,
        usageCount: 0, // Will be corrected by server response
        lastUsedAt: new Date().toISOString(),
        // Fill with placeholder values that will be overwritten
        firmId: '',
        userId: '',
        shortcut: '',
        title: '',
        content: '',
        category: 'Custom',
        isAutoDetected: false,
        createdAt: '',
        updatedAt: '',
      },
    }),
  });

  const recordUsage = async (id: string) => {
    try {
      await record({ variables: { id } });
    } catch {
      // Silently fail - usage tracking is not critical
      console.debug('Failed to record snippet usage');
    }
  };

  return {
    recordUsage,
    loading,
  };
}

/**
 * Hook to get AI-suggested snippets
 */
export function useSnippetSuggestions() {
  const { data, loading, error, refetch } = useQuery<{
    snippetSuggestions: SnippetSuggestion[];
  }>(GET_SNIPPET_SUGGESTIONS, {
    fetchPolicy: 'cache-and-network',
    // Poll every 5 minutes for new suggestions
    pollInterval: 5 * 60 * 1000,
  });

  const suggestions = data?.snippetSuggestions ?? [];

  // Sort by confidence
  const sortedSuggestions = useMemo(() => {
    return [...suggestions].sort((a, b) => b.confidence - a.confidence);
  }, [suggestions]);

  return {
    suggestions: sortedSuggestions,
    loading,
    error,
    refetch,
    count: suggestions.length,
  };
}

/**
 * Hook to accept a snippet suggestion (creates a new snippet from it)
 */
export function useAcceptSnippetSuggestion() {
  const [accept, { loading, error }] = useMutation<
    { acceptSnippetSuggestion: PersonalSnippet },
    { content: string; shortcut: string; title: string; category: SnippetCategory }
  >(ACCEPT_SNIPPET_SUGGESTION, {
    refetchQueries: ['GetMySnippets', 'GetSnippetSuggestions'],
    awaitRefetchQueries: true,
  });

  const acceptSuggestion = async (
    suggestion: SnippetSuggestion,
    customizations?: { shortcut?: string; title?: string }
  ) => {
    const result = await accept({
      variables: {
        content: suggestion.content,
        shortcut: customizations?.shortcut ?? suggestion.suggestedShortcut,
        title: customizations?.title ?? suggestion.suggestedTitle,
        category: suggestion.category,
      },
    });
    return result.data?.acceptSnippetSuggestion;
  };

  return {
    acceptSuggestion,
    loading,
    error,
  };
}

/**
 * Hook to dismiss a snippet suggestion
 */
export function useDismissSnippetSuggestion() {
  const [dismiss, { loading, error }] = useMutation<
    { dismissSnippetSuggestion: boolean },
    { content: string }
  >(DISMISS_SNIPPET_SUGGESTION, {
    refetchQueries: ['GetSnippetSuggestions'],
  });

  const dismissSuggestion = async (content: string) => {
    const result = await dismiss({ variables: { content } });
    return result.data?.dismissSnippetSuggestion ?? false;
  };

  return {
    dismissSuggestion,
    loading,
    error,
  };
}

/**
 * Combined hook for complete snippet management
 * Use in settings/personalization pages
 */
export function usePersonalSnippets(category?: SnippetCategory) {
  const {
    snippets,
    snippetsByCategory,
    mostUsed,
    recentlyUsed,
    loading: snippetsLoading,
    error: snippetsError,
    refetch: refetchSnippets,
    count,
  } = useSnippets(category);

  const {
    suggestions,
    loading: suggestionsLoading,
    error: suggestionsError,
    refetch: refetchSuggestions,
    count: suggestionsCount,
  } = useSnippetSuggestions();

  const { searchSnippets, loading: searching, results: searchResults } = useSearchSnippets();

  const { createSnippet, loading: creating, error: createError } = useCreateSnippet();
  const { updateSnippet, loading: updating, error: updateError } = useUpdateSnippet();
  const { deleteSnippet, loading: deleting, error: deleteError } = useDeleteSnippet();
  const { recordUsage, loading: recordingUsage } = useRecordSnippetUsage();
  const { acceptSuggestion, loading: accepting, error: acceptError } = useAcceptSnippetSuggestion();
  const {
    dismissSuggestion,
    loading: dismissing,
    error: dismissError,
  } = useDismissSnippetSuggestion();

  return {
    // Snippets data
    snippets,
    snippetsByCategory,
    mostUsed,
    recentlyUsed,
    count,

    // Suggestions data
    suggestions,
    suggestionsCount,

    // Search
    searchSnippets,
    searchResults,
    searching,

    // Loading states
    loading: snippetsLoading || suggestionsLoading,
    creating,
    updating,
    deleting,
    accepting,
    dismissing,
    recordingUsage,

    // Errors
    error:
      snippetsError ||
      suggestionsError ||
      createError ||
      updateError ||
      deleteError ||
      acceptError ||
      dismissError,

    // Actions
    createSnippet,
    updateSnippet,
    deleteSnippet,
    recordUsage,
    acceptSuggestion,
    dismissSuggestion,
    refetchSnippets,
    refetchSuggestions,
  };
}

/**
 * Hook for snippet autocomplete in text editors
 * Watches for shortcut patterns (e.g., "/greeting") and suggests matching snippets
 */
export function useSnippetAutocomplete(text: string, cursorPosition: number) {
  const { snippets } = useSnippets();
  const { recordUsage } = useRecordSnippetUsage();

  // Find if user is typing a shortcut (starts with /)
  const autocompleteData = useMemo(() => {
    // Look backwards from cursor to find potential shortcut
    const textBeforeCursor = text.substring(0, cursorPosition);
    const match = textBeforeCursor.match(/\/([a-zA-Z0-9_-]*)$/);

    if (!match) {
      return { isActive: false, query: '', matches: [], startPos: 0 };
    }

    const query = match[1].toLowerCase();
    const startPos = cursorPosition - match[0].length;

    // Find matching snippets
    const matches = snippets.filter(
      (s: PersonalSnippet) =>
        s.shortcut.toLowerCase().includes(query) || s.title.toLowerCase().includes(query)
    );

    return {
      isActive: true,
      query,
      matches: matches.slice(0, 5), // Limit to 5 suggestions
      startPos,
    };
  }, [text, cursorPosition, snippets]);

  const insertSnippet = useCallback(
    (snippet: PersonalSnippet) => {
      // Record usage
      recordUsage(snippet.id);

      // Return the replacement data
      return {
        startPos: autocompleteData.startPos,
        endPos: cursorPosition,
        content: snippet.content,
      };
    },
    [autocompleteData.startPos, cursorPosition, recordUsage]
  );

  return {
    ...autocompleteData,
    insertSnippet,
  };
}
