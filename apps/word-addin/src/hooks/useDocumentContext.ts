/**
 * useDocumentContext Hook
 * Detects if the current document is linked to the platform.
 *
 * Strategy:
 * 1. Check localStorage cache (fast)
 * 2. Lookup by SharePoint URL/filename via API
 * 3. Cache result in localStorage for future loads
 *
 * This allows the add-in to:
 * - Skip context selection for documents opened from the app
 * - Update existing documents instead of creating new ones
 * - Show appropriate UI (edit mode vs create mode)
 */

import { useState, useEffect, useCallback } from 'react';
import { getDocumentUrl, getDocumentFileName } from '../services/word-api';
import { apiClient } from '../services/api-client';

// ============================================================================
// Types
// ============================================================================

export interface DocumentContext {
  documentId: string;
  fileName: string;
  // Case context (optional - not present for client inbox documents)
  caseId?: string;
  caseNumber?: string;
  // Client context (always present)
  clientId?: string;
  clientName?: string;
}

export type DocumentMode = 'loading' | 'create' | 'edit';

export interface UseDocumentContextResult {
  mode: DocumentMode;
  context: DocumentContext | null;
  setContext: (ctx: DocumentContext) => void;
  clearContext: () => void;
  refresh: () => Promise<void>;
}

// LocalStorage key prefix for document context cache
const CACHE_PREFIX = 'bojin_doc_ctx_';

// ============================================================================
// Cache Helpers
// ============================================================================

function getCacheKey(url: string | null, fileName: string | null): string | null {
  // Use URL if available, otherwise filename
  if (url) {
    // Extract the unique part from SharePoint URL (sourcedoc GUID or path)
    try {
      const urlObj = new URL(url);
      const sourcedoc = urlObj.searchParams.get('sourcedoc');
      if (sourcedoc) {
        return CACHE_PREFIX + sourcedoc.replace(/[{}]/g, '').toLowerCase();
      }
      // Fallback to pathname
      return CACHE_PREFIX + urlObj.pathname.replace(/[^a-zA-Z0-9]/g, '_');
    } catch {
      return CACHE_PREFIX + url.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 100);
    }
  }
  if (fileName) {
    return CACHE_PREFIX + 'file_' + fileName.replace(/[^a-zA-Z0-9.]/g, '_');
  }
  return null;
}

function getFromCache(key: string): DocumentContext | null {
  try {
    const cached = localStorage.getItem(key);
    if (cached) {
      const parsed = JSON.parse(cached);
      // Validate structure
      if (parsed.documentId && parsed.caseId) {
        console.log('[useDocumentContext] Found in cache:', parsed);
        return parsed as DocumentContext;
      }
    }
  } catch (err) {
    console.warn('[useDocumentContext] Cache read error:', err);
  }
  return null;
}

function saveToCache(key: string, ctx: DocumentContext): void {
  try {
    localStorage.setItem(key, JSON.stringify(ctx));
    console.log('[useDocumentContext] Saved to cache:', key);
  } catch (err) {
    console.warn('[useDocumentContext] Cache write error:', err);
  }
}

function clearFromCache(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore
  }
}

// ============================================================================
// Hook
// ============================================================================

export function useDocumentContext(): UseDocumentContextResult {
  const [mode, setMode] = useState<DocumentMode>('loading');
  const [context, setContextState] = useState<DocumentContext | null>(null);
  const [cacheKey, setCacheKey] = useState<string | null>(null);

  // Load context from cache or API lookup
  const loadContext = useCallback(async () => {
    try {
      console.log('[useDocumentContext] Loading context...');

      // Get document identifiers
      const docUrl = await getDocumentUrl();
      const docFileName = await getDocumentFileName();

      console.log('[useDocumentContext] Document info:', { docUrl, docFileName });

      const key = getCacheKey(docUrl, docFileName);
      setCacheKey(key);

      // Step 1: Check localStorage cache (fast)
      if (key) {
        const cached = getFromCache(key);
        if (cached) {
          setContextState(cached);
          setMode('edit');
          console.log('[useDocumentContext] Edit mode - from cache');
          return;
        }
      }

      // Step 2: API lookup by URL/filename
      if (docUrl || docFileName) {
        console.log('[useDocumentContext] Looking up by URL/filename...');
        try {
          const lookupResult = await apiClient.lookupCaseByDocument({
            url: docUrl || undefined,
            path: docFileName || undefined,
          });

          console.log('[useDocumentContext] Lookup result:', lookupResult);

          // Found document in platform - enter edit mode (with case or client context)
          if (lookupResult.document && (lookupResult.case || lookupResult.client)) {
            const ctx: DocumentContext = {
              documentId: lookupResult.document.id,
              fileName: lookupResult.document.fileName,
              // Case context (if available)
              caseId: lookupResult.case?.id,
              caseNumber: lookupResult.case?.caseNumber,
              // Client context (if available)
              clientId: lookupResult.client?.id,
              clientName: lookupResult.client?.name,
            };
            setContextState(ctx);
            setMode('edit');
            console.log('[useDocumentContext] Edit mode - from API lookup', ctx);

            // Cache for future loads
            if (key) {
              saveToCache(key, ctx);
            }
            return;
          }
        } catch (lookupErr) {
          console.warn('[useDocumentContext] URL lookup failed:', lookupErr);
        }
      }

      // Step 3: No context found - create mode
      setContextState(null);
      setMode('create');
      console.log('[useDocumentContext] Create mode - new document');
    } catch (err) {
      console.warn('[useDocumentContext] Failed to load context:', err);
      // Default to create mode on error
      setContextState(null);
      setMode('create');
    }
  }, []);

  // Set context (after saving a new document) - updates cache
  const setContext = useCallback(
    (ctx: DocumentContext) => {
      setContextState(ctx);
      setMode('edit');

      // Update cache
      if (cacheKey) {
        saveToCache(cacheKey, ctx);
      }

      console.log('[useDocumentContext] Context set', ctx);
    },
    [cacheKey]
  );

  // Clear context (start fresh)
  const clearContext = useCallback(() => {
    setContextState(null);
    setMode('create');

    // Clear cache
    if (cacheKey) {
      clearFromCache(cacheKey);
    }

    console.log('[useDocumentContext] Context cleared');
  }, [cacheKey]);

  // Load on mount
  useEffect(() => {
    loadContext();
  }, [loadContext]);

  return {
    mode,
    context,
    setContext,
    clearContext,
    refresh: loadContext,
  };
}
