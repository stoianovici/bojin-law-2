'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Plus, Check, Search } from 'lucide-react';
import { useDocumentStore } from '@/stores/documentStore';
import type { Category } from '@/stores/documentStore';

interface CategorySelectorProps {
  selectedCategoryId: string | null;
  onSelect: (categoryId: string, categoryName: string) => void;
  onCreateCategory: (name: string) => Promise<Category>;
  disabled?: boolean;
}

export function CategorySelector({
  selectedCategoryId,
  onSelect,
  onCreateCategory,
  disabled = false,
}: CategorySelectorProps) {
  const categories = useDocumentStore((s) => s.categories);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const newCategoryInputRef = useRef<HTMLInputElement>(null);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  // Filter categories based on search
  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort by document count (most used first)
  const sortedCategories = [...filteredCategories].sort(
    (a, b) => b.documentCount - a.documentCount
  );

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsCreating(false);
        setSearchQuery('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Focus new category input when creating
  useEffect(() => {
    if (isCreating && newCategoryInputRef.current) {
      newCategoryInputRef.current.focus();
    }
  }, [isCreating]);

  const handleToggle = useCallback(() => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
      setSearchQuery('');
      setIsCreating(false);
      setError(null);
    }
  }, [disabled]);

  const handleSelect = useCallback((category: Category) => {
    onSelect(category.id, category.name);
    setIsOpen(false);
    setSearchQuery('');
  }, [onSelect]);

  const handleCreateClick = useCallback(() => {
    setIsCreating(true);
    setNewCategoryName(searchQuery);
  }, [searchQuery]);

  const handleCreateSubmit = useCallback(async () => {
    const name = newCategoryName.trim();
    if (!name) {
      setError('Category name is required');
      return;
    }

    // Check for duplicate
    if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      setError('Category already exists');
      return;
    }

    try {
      const newCategory = await onCreateCategory(name);
      onSelect(newCategory.id, newCategory.name);
      setIsOpen(false);
      setIsCreating(false);
      setNewCategoryName('');
      setSearchQuery('');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create category');
    }
  }, [newCategoryName, categories, onCreateCategory, onSelect]);

  // Keyboard shortcuts for quick selection (1-9)
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!isOpen) return;

      const num = parseInt(event.key);
      if (num >= 1 && num <= 9 && num <= sortedCategories.length) {
        event.preventDefault();
        handleSelect(sortedCategories[num - 1]);
      }

      if (event.key === 'Escape') {
        setIsOpen(false);
        setIsCreating(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, sortedCategories, handleSelect]);

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger Button */}
      <button
        onClick={handleToggle}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between px-4 py-2.5 rounded-lg border
          transition-colors
          ${disabled
            ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
            : 'bg-white border-gray-300 hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
          }
        `}
      >
        <span className={selectedCategory ? 'text-gray-900' : 'text-gray-500'}>
          {selectedCategory?.name || 'Selectează categoria...'}
        </span>
        <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-80 overflow-hidden">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Caută sau tastează pentru a filtra..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          {/* Create New Category Form */}
          {isCreating ? (
            <div className="p-3 border-b border-gray-100">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Nume categorie nouă
              </label>
              <div className="flex gap-2">
                <input
                  ref={newCategoryInputRef}
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateSubmit();
                    if (e.key === 'Escape') setIsCreating(false);
                  }}
                  placeholder="ex. Contract, Notificare"
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-400"
                />
                <button
                  onClick={handleCreateSubmit}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                >
                  Creează
                </button>
              </div>
              {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
            </div>
          ) : null}

          {/* Category List */}
          <div className="max-h-48 overflow-y-auto">
            {sortedCategories.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                {searchQuery ? 'Nu există categorii care să corespundă' : 'Nu există categorii încă'}
              </div>
            ) : (
              sortedCategories.map((category, index) => (
                <button
                  key={category.id}
                  onClick={() => handleSelect(category)}
                  className={`
                    w-full flex items-center justify-between px-4 py-2.5 text-left
                    hover:bg-gray-50 transition-colors
                    ${selectedCategoryId === category.id ? 'bg-blue-50' : ''}
                  `}
                >
                  <div className="flex items-center gap-2">
                    {index < 9 && (
                      <span className="w-5 h-5 flex items-center justify-center text-xs bg-gray-100 rounded text-gray-500">
                        {index + 1}
                      </span>
                    )}
                    <span className="text-gray-900">{category.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      {category.documentCount} doc.
                    </span>
                    {selectedCategoryId === category.id && (
                      <Check className="h-4 w-4 text-blue-600" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Add New Category Button */}
          {!isCreating && (
            <button
              onClick={handleCreateClick}
              className="w-full flex items-center gap-2 px-4 py-3 text-blue-600 hover:bg-blue-50 border-t border-gray-100"
            >
              <Plus className="h-4 w-4" />
              <span className="text-sm font-medium">
                {searchQuery ? `Creează "${searchQuery}"` : 'Adaugă categorie nouă'}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
