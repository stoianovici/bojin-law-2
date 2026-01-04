'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, X, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSearch } from '@/hooks/mobile';
import { InlineError } from '@/components/mobile';
import { SearchResultSkeleton } from '@/components/mobile/skeletons';

// Recent searches
const recentSearches = ['popescu', 'contract', 'termen instanta'];

// Filter chips (visual only for now - backend doesn't support type filtering yet)
const filters = [
  { id: 'all', label: 'Toate' },
  { id: 'cases', label: 'Dosare' },
];

function highlightText(text: string, query: string) {
  if (!query) return text;
  // Escape special regex characters in the query
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-[rgba(59,130,246,0.15)] text-mobile-accent rounded-[2px] px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export default function MobileSearchPage() {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const { results, loading, error, search } = useSearch({ limit: 20 });
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const handleSearchChange = useCallback(
    (value: string) => {
      setQuery(value);

      // Clear previous timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      // Debounce the search
      if (value.trim()) {
        debounceTimeoutRef.current = setTimeout(() => {
          search(value);
        }, 300);
      }
    },
    [search]
  );

  // Filter results based on active filter (currently only cases are returned from backend)
  const filteredResults = activeFilter === 'all' || activeFilter === 'cases' ? results : [];

  const handleCancel = () => {
    setQuery('');
  };

  return (
    <div className="animate-fadeIn min-h-screen">
      {/* Search Header */}
      <header className="sticky top-0 z-40 px-6 pt-12 pb-4 bg-mobile-bg-primary">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex-1 flex items-center gap-3 px-4 py-3 rounded-[12px]',
              'bg-mobile-bg-elevated border',
              query ? 'border-mobile-accent' : 'border-mobile-border'
            )}
          >
            <Search
              className="w-[18px] h-[18px] text-mobile-text-tertiary flex-shrink-0"
              strokeWidth={2}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Caută..."
              autoFocus
              className="flex-1 bg-transparent text-[15px] text-mobile-text-primary placeholder:text-mobile-text-tertiary outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="w-5 h-5 flex items-center justify-center bg-mobile-bg-hover rounded-full flex-shrink-0"
              >
                <X className="w-3 h-3 text-mobile-text-tertiary" strokeWidth={3} />
              </button>
            )}
          </div>
          <button
            onClick={handleCancel}
            className="text-[14px] text-mobile-accent whitespace-nowrap"
          >
            Anulează
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="px-6 pb-24">
        {/* Quick Filters */}
        <div className="mb-8">
          <div className="flex gap-2 overflow-x-auto">
            {filters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={cn(
                  'px-3 py-2 rounded-full text-[13px] whitespace-nowrap',
                  'border transition-all duration-150',
                  activeFilter === filter.id
                    ? 'bg-[rgba(59,130,246,0.15)] border-mobile-accent text-mobile-accent'
                    : 'bg-mobile-bg-elevated border-mobile-border text-mobile-text-secondary hover:border-mobile-text-tertiary'
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Recent Searches (when no query) */}
        {!query && (
          <section className="mb-8">
            <h2 className="text-[11px] font-normal uppercase tracking-[0.1em] text-mobile-text-tertiary mb-4">
              Căutări recente
            </h2>
            <div>
              {recentSearches.map((recentSearch, i) => (
                <button
                  key={i}
                  onClick={() => handleSearchChange(recentSearch)}
                  className="flex items-center gap-3 w-full py-3 -mx-6 px-6 text-left hover:bg-mobile-bg-elevated transition-colors"
                >
                  <Search className="w-4 h-4 text-mobile-text-tertiary" strokeWidth={2} />
                  <span className="text-[15px] text-mobile-text-secondary">{recentSearch}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Search Results */}
        {query && (
          <div className="space-y-8">
            {/* Loading State */}
            {loading && (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <SearchResultSkeleton key={i} />
                ))}
              </div>
            )}

            {/* Error State */}
            {error && (
              <InlineError message="Eroare la cautare" onRetry={() => query && search(query)} />
            )}

            {/* Cases */}
            {!loading && !error && filteredResults.length > 0 && (
              <section>
                <h2 className="text-[11px] font-normal uppercase tracking-[0.1em] text-mobile-text-tertiary mb-4">
                  Dosare
                </h2>
                {filteredResults.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 py-4 -mx-6 px-6 border-b border-mobile-border-subtle last:border-b-0 cursor-pointer hover:bg-mobile-bg-elevated transition-colors"
                  >
                    <div className="w-9 h-9 rounded-[8px] bg-mobile-bg-card border border-mobile-border flex items-center justify-center flex-shrink-0">
                      <Folder
                        className="w-[18px] h-[18px] text-mobile-text-secondary"
                        strokeWidth={2}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-normal text-mobile-text-primary mb-0.5">
                        {highlightText(item.title, query)}
                      </p>
                      <p className="text-[13px] text-mobile-text-secondary">
                        {item.type}
                        {item.client?.name ? ` - ${item.client.name}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {/* No Results */}
            {!loading && !error && filteredResults.length === 0 && results.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="w-12 h-12 text-mobile-text-tertiary mb-4" />
                <p className="text-[15px] font-normal text-mobile-text-secondary mb-1">
                  Niciun rezultat pentru &ldquo;{query}&rdquo;
                </p>
                <p className="text-[13px] text-mobile-text-tertiary">Incearca sa cauti altceva</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
