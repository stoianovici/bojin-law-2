'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { DocumentNode } from 'graphql';
import { apolloClient } from '@/lib/apollo-client';

interface QueryResult<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
  refetch: () => Promise<void>;
}

interface QueryOptions {
  variables?: Record<string, unknown>;
  skip?: boolean;
}

export function useQuery<T = unknown>(
  query: DocumentNode,
  options: QueryOptions = {}
): QueryResult<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(!options.skip);
  const [error, setError] = useState<Error | undefined>(undefined);

  // Serialize variables for stable dependency
  const variablesKey = JSON.stringify(options.variables || {});
  const lastFetchKey = useRef<string>('');

  const fetchData = useCallback(
    async (forceRefetch = false) => {
      if (options.skip) {
        setLoading(false);
        return;
      }

      // Create a unique key for this fetch
      const fetchKey = variablesKey;

      // Skip if we already fetched with these exact variables (unless forced)
      if (!forceRefetch && lastFetchKey.current === fetchKey && data !== undefined) {
        return;
      }

      setLoading(true);
      setError(undefined);

      try {
        const result = await apolloClient.query({
          query,
          variables: options.variables,
          fetchPolicy: 'network-only',
        });
        lastFetchKey.current = fetchKey;
        setData(result.data as T);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    },
    [query, variablesKey, options.skip]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  return { data, loading, error, refetch };
}
