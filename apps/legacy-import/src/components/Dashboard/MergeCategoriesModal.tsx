'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Merge,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Folder,
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
  documentCount: number;
  createdBy: string;
  createdAt: string;
}

interface MergeCategoriesModalProps {
  sessionId: string;
  isOpen: boolean;
  onClose: () => void;
  onMergeComplete: () => void;
  suggestedDuplicates?: string[][];
}

export function MergeCategoriesModal({
  sessionId,
  isOpen,
  onClose,
  onMergeComplete,
  suggestedDuplicates = [],
}: MergeCategoriesModalProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [primaryCategoryId, setPrimaryCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/sync-categories?sessionId=${sessionId}`);
      if (!res.ok) throw new Error('Failed to fetch categories');
      const data = await res.json();
      setCategories(data.categories || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
      setSelectedIds(new Set());
      setPrimaryCategoryId(null);
      setSuccessMessage(null);
    }
  }, [isOpen, fetchCategories]);

  const toggleCategory = (categoryId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(categoryId)) {
      newSelected.delete(categoryId);
      // If we removed the primary, clear it
      if (primaryCategoryId === categoryId) {
        setPrimaryCategoryId(null);
      }
    } else {
      newSelected.add(categoryId);
      // If this is the first selection, make it primary
      if (newSelected.size === 1) {
        setPrimaryCategoryId(categoryId);
      }
    }
    setSelectedIds(newSelected);
  };

  const selectSuggestedGroup = (groupIds: string[]) => {
    setSelectedIds(new Set(groupIds));
    // Set the one with most documents as primary
    const groupCategories = categories.filter((c) => groupIds.includes(c.id));
    const primary = groupCategories.reduce((a, b) =>
      a.documentCount > b.documentCount ? a : b
    );
    setPrimaryCategoryId(primary.id);
  };

  const handleMerge = async () => {
    if (selectedIds.size < 2) {
      setError('Select at least 2 categories to merge');
      return;
    }
    if (!primaryCategoryId) {
      setError('Select a primary category name');
      return;
    }

    try {
      setMerging(true);
      setError(null);

      const sourceIds = Array.from(selectedIds).filter(
        (id) => id !== primaryCategoryId
      );

      const res = await fetch('/api/merge-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          targetCategoryId: primaryCategoryId,
          sourceCategoryIds: sourceIds,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to merge categories');
      }

      const result = await res.json();
      setSuccessMessage(
        `Merged ${result.mergedCount} categories (${result.documentsUpdated} documents updated)`
      );

      // Refresh categories
      await fetchCategories();
      setSelectedIds(new Set());
      setPrimaryCategoryId(null);

      // Notify parent
      onMergeComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Merge failed');
    } finally {
      setMerging(false);
    }
  };

  if (!isOpen) return null;

  const selectedCategories = categories.filter((c) => selectedIds.has(c.id));
  const totalDocs = selectedCategories.reduce(
    (sum, c) => sum + c.documentCount,
    0
  );
  const primaryCategory = categories.find((c) => c.id === primaryCategoryId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Merge className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Unește categorii
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Success Message */}
          {successMessage && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
              <CheckCircle className="h-5 w-5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          )}

          {/* Suggested Duplicates */}
          {suggestedDuplicates.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Duplicate sugerate
              </h3>
              <div className="flex flex-wrap gap-2">
                {suggestedDuplicates.map((group, idx) => {
                  const groupCats = categories.filter((c) =>
                    group.includes(c.id)
                  );
                  if (groupCats.length < 2) return null;

                  return (
                    <button
                      key={idx}
                      onClick={() => selectSuggestedGroup(group)}
                      className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 hover:bg-amber-100"
                    >
                      {groupCats.map((c) => c.name).join(' + ')}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Categories List */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Se încarcă categoriile...</span>
            </div>
          ) : (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Selectează categoriile de unit
              </h3>
              {categories.map((category) => {
                const isSelected = selectedIds.has(category.id);
                const isPrimary = primaryCategoryId === category.id;

                return (
                  <div
                    key={category.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected
                        ? isPrimary
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-blue-300 bg-blue-50/50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => toggleCategory(category.id)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="h-4 w-4 text-blue-600 rounded"
                    />
                    <Folder
                      className={`h-4 w-4 ${
                        isSelected ? 'text-blue-600' : 'text-gray-400'
                      }`}
                    />
                    <span
                      className={`flex-1 font-medium ${
                        isSelected ? 'text-blue-900' : 'text-gray-700'
                      }`}
                    >
                      {category.name}
                    </span>
                    <span className="text-sm text-gray-500">
                      {category.documentCount} doc.
                    </span>
                    {isSelected && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPrimaryCategoryId(category.id);
                        }}
                        className={`px-2 py-1 text-xs rounded ${
                          isPrimary
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        }`}
                      >
                        {isPrimary ? 'Principal' : 'Setează principal'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer with Preview and Actions */}
        <div className="border-t border-gray-200 p-4">
          {selectedIds.size >= 2 && primaryCategory && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-1">
                Previzualizare unificare
              </h4>
              <p className="text-sm text-gray-600">
                Se unifică{' '}
                <span className="font-medium">{selectedIds.size} categorii</span>{' '}
                în{' '}
                <span className="font-medium text-blue-600">
                  &quot;{primaryCategory.name}&quot;
                </span>
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {totalDocs} documente vor fi atribuite la{' '}
                &quot;{primaryCategory.name}&quot;
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Închide
            </button>
            <button
              onClick={handleMerge}
              disabled={selectedIds.size < 2 || !primaryCategoryId || merging}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
                selectedIds.size >= 2 && primaryCategoryId && !merging
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              }`}
            >
              {merging ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Se unifică...
                </>
              ) : (
                <>
                  <Merge className="h-4 w-4" />
                  Unifică selecția
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
