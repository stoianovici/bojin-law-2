/**
 * SnippetLibrary - Grid view of personal snippets
 * Story 5.6: AI Learning and Personalization (Task 25)
 * Displays snippets grouped by category with search, copy, and edit/delete actions
 */

'use client';

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePersonalSnippets } from '@/hooks/usePersonalSnippets';
import type { PersonalSnippet, SnippetCategory } from '@legal-platform/types';

// Icons
const SearchIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="16"
    height="16"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
);

const CopyIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="16"
    height="16"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
    />
  </svg>
);

const EditIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="16"
    height="16"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
    />
  </svg>
);

const TrashIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="16"
    height="16"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);

const PlusIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="16"
    height="16"
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="16"
    height="16"
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

// Category labels and icons
const CATEGORY_CONFIG: Record<SnippetCategory, { label: string; color: string }> = {
  Greeting: { label: 'Salutări', color: 'bg-green-100 text-green-800' },
  Closing: { label: 'Încheieri', color: 'bg-blue-100 text-blue-800' },
  LegalPhrase: { label: 'Expresii Juridice', color: 'bg-purple-100 text-purple-800' },
  ClientResponse: { label: 'Răspunsuri Client', color: 'bg-orange-100 text-orange-800' },
  InternalNote: { label: 'Note Interne', color: 'bg-gray-100 text-gray-800' },
  Custom: { label: 'Personalizate', color: 'bg-yellow-100 text-yellow-800' },
};

export interface SnippetLibraryProps {
  className?: string;
  onEdit?: (snippet: PersonalSnippet) => void;
  onCreateNew?: () => void;
  showCreateButton?: boolean;
}

/**
 * Single snippet item in the grid
 */
function SnippetItem({
  snippet,
  onCopy,
  onEdit,
  onDelete,
  isSelected,
  onSelect,
}: {
  snippet: PersonalSnippet;
  onCopy: (snippet: PersonalSnippet) => void;
  onEdit?: (snippet: PersonalSnippet) => void;
  onDelete: (snippet: PersonalSnippet) => void;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const categoryConfig = CATEGORY_CONFIG[snippet.category];

  const handleCopy = async () => {
    await navigator.clipboard.writeText(snippet.content);
    setCopied(true);
    onCopy(snippet);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      role="gridcell"
      tabIndex={0}
      className={`
        p-4 rounded-lg border bg-card transition-all duration-200
        hover:shadow-md focus:ring-2 focus:ring-primary focus:outline-none
        cursor-pointer
        ${isSelected ? 'ring-2 ring-primary' : ''}
      `}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        } else if (e.key === 'c' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          handleCopy();
        }
      }}
      aria-label={`Snippet: ${snippet.title}`}
      aria-selected={isSelected}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <h4 className="font-medium text-sm truncate" title={snippet.title}>
            {snippet.title}
          </h4>
          <code className="text-xs text-muted-foreground">/{snippet.shortcut}</code>
        </div>
        <Badge className={`text-xs shrink-0 ${categoryConfig.color}`}>{categoryConfig.label}</Badge>
      </div>

      {/* Content preview */}
      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{snippet.content}</p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Folosit de {snippet.usageCount} ori</span>
        {snippet.isAutoDetected && (
          <Badge variant="outline" className="text-xs">
            Auto-detectat
          </Badge>
        )}
      </div>

      {/* Actions */}
      <div
        className="flex items-center gap-1 mt-3 pt-3 border-t"
        role="group"
        aria-label="Acțiuni snippet"
      >
        <Button
          size="sm"
          variant="ghost"
          className="flex-1 h-8"
          onClick={(e) => {
            e.stopPropagation();
            handleCopy();
          }}
          aria-label="Copiază conținutul"
        >
          {copied ? (
            <>
              <CheckIcon className="mr-1 text-green-600" />
              Copiat!
            </>
          ) : (
            <>
              <CopyIcon className="mr-1" />
              Copiază
            </>
          )}
        </Button>
        {onEdit && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(snippet);
            }}
            aria-label="Editează snippet"
          >
            <EditIcon />
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-destructive hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(snippet);
          }}
          aria-label="Șterge snippet"
        >
          <TrashIcon />
        </Button>
      </div>
    </div>
  );
}

/**
 * Empty state component
 */
function EmptyState({
  category,
  onCreateNew,
}: {
  category?: SnippetCategory;
  onCreateNew?: () => void;
}) {
  return (
    <div className="text-center py-12">
      <div className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-full w-full">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      </div>
      <h4 className="text-sm font-medium text-foreground mb-1">
        {category ? `Niciun snippet în ${CATEGORY_CONFIG[category].label}` : 'Niciun snippet găsit'}
      </h4>
      <p className="text-sm text-muted-foreground mb-4">
        {category
          ? 'Creează primul tău snippet în această categorie'
          : 'Creează snippet-uri pentru a le insera rapid în email-uri'}
      </p>
      {onCreateNew && (
        <Button size="sm" onClick={onCreateNew}>
          <PlusIcon className="mr-1" />
          Creează Snippet
        </Button>
      )}
    </div>
  );
}

/**
 * SnippetLibrary displays all personal snippets in a searchable grid
 * grouped by category with tabbed navigation.
 */
export function SnippetLibrary({
  className = '',
  onEdit,
  onCreateNew,
  showCreateButton = true,
}: SnippetLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SnippetCategory | 'all'>('all');
  const [selectedSnippetId, setSelectedSnippetId] = useState<string | null>(null);
  const [deleteDialogSnippet, setDeleteDialogSnippet] = useState<PersonalSnippet | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);

  const { snippets, snippetsByCategory, loading, error, deleteSnippet, deleting, recordUsage } =
    usePersonalSnippets();

  // Filter snippets based on search and category
  const filteredSnippets = useMemo(() => {
    let result = snippets;

    // Filter by category
    if (selectedCategory !== 'all') {
      result = snippetsByCategory[selectedCategory] || [];
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (s: PersonalSnippet) =>
          s.title.toLowerCase().includes(query) ||
          s.shortcut.toLowerCase().includes(query) ||
          s.content.toLowerCase().includes(query)
      );
    }

    return result;
  }, [snippets, snippetsByCategory, selectedCategory, searchQuery]);

  // Keyboard navigation for grid
  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!filteredSnippets.length) return;

      const currentIndex = selectedSnippetId
        ? filteredSnippets.findIndex((s: PersonalSnippet) => s.id === selectedSnippetId)
        : -1;

      let newIndex = currentIndex;

      switch (e.key) {
        case 'ArrowRight':
          newIndex = Math.min(currentIndex + 1, filteredSnippets.length - 1);
          break;
        case 'ArrowLeft':
          newIndex = Math.max(currentIndex - 1, 0);
          break;
        case 'ArrowDown':
          // Assuming 3 columns
          newIndex = Math.min(currentIndex + 3, filteredSnippets.length - 1);
          break;
        case 'ArrowUp':
          newIndex = Math.max(currentIndex - 3, 0);
          break;
        case 'Home':
          newIndex = 0;
          break;
        case 'End':
          newIndex = filteredSnippets.length - 1;
          break;
        default:
          return;
      }

      if (newIndex !== currentIndex && newIndex >= 0) {
        e.preventDefault();
        setSelectedSnippetId(filteredSnippets[newIndex].id);
        // Focus the new item
        const items = gridRef.current?.querySelectorAll<HTMLElement>('[role="gridcell"]');
        if (items?.[newIndex]) {
          items[newIndex].focus();
        }
      }
    },
    [filteredSnippets, selectedSnippetId]
  );

  const handleCopy = (snippet: PersonalSnippet) => {
    recordUsage(snippet.id);
  };

  const handleDelete = async () => {
    if (deleteDialogSnippet) {
      await deleteSnippet(deleteDialogSnippet.id);
      setDeleteDialogSnippet(null);
      if (selectedSnippetId === deleteDialogSnippet.id) {
        setSelectedSnippetId(null);
      }
    }
  };

  // Category counts for badges
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: snippets.length };
    Object.entries(snippetsByCategory).forEach(([cat, items]) => {
      counts[cat] = items.length;
    });
    return counts;
  }, [snippets, snippetsByCategory]);

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Biblioteca de Snippet-uri</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">Eroare la încărcarea snippet-urilor.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Biblioteca de Snippet-uri</CardTitle>
              <CardDescription>{snippets.length} snippet-uri salvate</CardDescription>
            </div>
            {showCreateButton && onCreateNew && (
              <Button onClick={onCreateNew}>
                <PlusIcon className="mr-1" />
                Snippet Nou
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="relative mb-4">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Caută după titlu, shortcut sau conținut..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              aria-label="Caută snippet-uri"
            />
          </div>

          {/* Category Tabs */}
          <Tabs
            value={selectedCategory}
            onValueChange={(v) => setSelectedCategory(v as SnippetCategory | 'all')}
            className="mb-4"
          >
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="all" className="gap-1">
                Toate
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {categoryCounts.all}
                </Badge>
              </TabsTrigger>
              {(Object.keys(CATEGORY_CONFIG) as SnippetCategory[]).map((cat) => (
                <TabsTrigger key={cat} value={cat} className="gap-1">
                  {CATEGORY_CONFIG[cat].label}
                  {categoryCounts[cat] > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                      {categoryCounts[cat]}
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Grid content for each tab */}
            <TabsContent value={selectedCategory} className="mt-4">
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="p-4 rounded-lg border bg-card animate-pulse">
                      <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                      <div className="h-3 bg-muted rounded w-1/2 mb-3" />
                      <div className="h-12 bg-muted rounded mb-3" />
                      <div className="h-3 bg-muted rounded w-1/3" />
                    </div>
                  ))}
                </div>
              ) : filteredSnippets.length === 0 ? (
                <EmptyState
                  category={selectedCategory !== 'all' ? selectedCategory : undefined}
                  onCreateNew={onCreateNew}
                />
              ) : (
                <div
                  ref={gridRef}
                  role="grid"
                  aria-label="Snippet-uri"
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                  onKeyDown={handleGridKeyDown}
                >
                  {filteredSnippets.map((snippet: PersonalSnippet) => (
                    <SnippetItem
                      key={snippet.id}
                      snippet={snippet}
                      onCopy={handleCopy}
                      onEdit={onEdit}
                      onDelete={setDeleteDialogSnippet}
                      isSelected={selectedSnippetId === snippet.id}
                      onSelect={() => setSelectedSnippetId(snippet.id)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteDialogSnippet}
        onOpenChange={(open) => !open && setDeleteDialogSnippet(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Șterge Snippet</DialogTitle>
            <DialogDescription>
              Ești sigur că vrei să ștergi snippet-ul &quot;
              {deleteDialogSnippet?.title}&quot;? Această acțiune nu poate fi anulată.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogSnippet(null)}
              disabled={deleting}
            >
              Anulează
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Se șterge...' : 'Șterge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

SnippetLibrary.displayName = 'SnippetLibrary';
