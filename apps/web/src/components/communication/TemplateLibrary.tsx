/**
 * Template Library Component
 * Story 5.5: Multi-Channel Communication Hub (AC: 2)
 *
 * Displays a grid of available communication templates
 */

'use client';

import React, { useState, useCallback } from 'react';
import {
  useTemplates,
  useTemplateCategories,
  type CommunicationTemplate,
  type TemplateCategory,
  type CommunicationChannel,
} from '@/hooks/useCommunicationTemplates';
import {
  FileText,
  Search,
  Plus,
  Mail,
  MessageCircle,
  Folder,
  Clock,
  ChevronRight,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  Eye,
  Loader2,
} from 'lucide-react';

interface TemplateLibraryProps {
  onSelectTemplate?: (template: CommunicationTemplate) => void;
  onEditTemplate?: (template: CommunicationTemplate) => void;
  onCreateTemplate?: () => void;
  selectedTemplateId?: string;
  channelFilter?: CommunicationChannel;
  className?: string;
}

export function TemplateLibrary({
  onSelectTemplate,
  onEditTemplate,
  onCreateTemplate,
  selectedTemplateId,
  channelFilter,
  className = '',
}: TemplateLibraryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<TemplateCategory | undefined>();
  const [hoveredTemplateId, setHoveredTemplateId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const { templates, loading, error, refetch } = useTemplates({
    searchTerm: searchTerm || undefined,
    category: categoryFilter,
    channelType: channelFilter,
  });

  const { categories, getCategoryLabel, getCategoryColor } = useTemplateCategories();

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  const handleCategoryChange = useCallback((category: TemplateCategory | undefined) => {
    setCategoryFilter(category);
  }, []);

  const handleTemplateClick = useCallback(
    (template: CommunicationTemplate) => {
      onSelectTemplate?.(template);
    },
    [onSelectTemplate]
  );

  const handleMenuAction = useCallback(
    (action: 'edit' | 'duplicate' | 'delete', template: CommunicationTemplate) => {
      setMenuOpenId(null);
      if (action === 'edit') {
        onEditTemplate?.(template);
      }
      // Other actions would be handled here
    },
    [onEditTemplate]
  );

  if (error) {
    return (
      <div className={`rounded-lg border border-red-200 bg-red-50 p-4 ${className}`}>
        <p className="text-sm text-red-600">
          Failed to load templates: {error.message}
        </p>
        <button
          onClick={() => refetch()}
          className="mt-2 text-sm text-red-700 underline hover:no-underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Templates</h2>
          <p className="text-sm text-gray-500">
            {templates.length} {templates.length === 1 ? 'template' : 'templates'}
          </p>
        </div>
        {onCreateTemplate && (
          <button
            onClick={onCreateTemplate}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New Template
          </button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchTerm}
            onChange={handleSearch}
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Category Filter */}
        <select
          value={categoryFilter || ''}
          onChange={(e) =>
            handleCategoryChange(e.target.value ? (e.target.value as TemplateCategory) : undefined)
          }
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      {/* Template Grid */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading && templates.length === 0 ? (
          // Loading skeleton
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg border border-gray-200 p-4"
            >
              <div className="h-5 w-2/3 rounded bg-gray-200" />
              <div className="mt-2 h-4 w-full rounded bg-gray-200" />
              <div className="mt-4 h-16 w-full rounded bg-gray-200" />
            </div>
          ))
        ) : templates.length === 0 ? (
          <div className="col-span-full rounded-lg border border-dashed border-gray-300 p-8 text-center">
            <FileText className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">
              {searchTerm || categoryFilter
                ? 'No templates match your filters'
                : 'No templates yet'}
            </p>
            {onCreateTemplate && (
              <button
                onClick={onCreateTemplate}
                className="mt-4 text-sm text-blue-600 hover:underline"
              >
                Create your first template
              </button>
            )}
          </div>
        ) : (
          templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              isSelected={template.id === selectedTemplateId}
              isHovered={template.id === hoveredTemplateId}
              menuOpen={template.id === menuOpenId}
              onMouseEnter={() => setHoveredTemplateId(template.id)}
              onMouseLeave={() => setHoveredTemplateId(null)}
              onClick={() => handleTemplateClick(template)}
              onMenuToggle={() =>
                setMenuOpenId(menuOpenId === template.id ? null : template.id)
              }
              onMenuAction={(action) => handleMenuAction(action, template)}
              getCategoryLabel={getCategoryLabel}
              getCategoryColor={getCategoryColor}
            />
          ))
        )}
      </div>

      {/* Loading indicator for refetch */}
      {loading && templates.length > 0 && (
        <div className="mt-4 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      )}
    </div>
  );
}

// Template Card Component
interface TemplateCardProps {
  template: CommunicationTemplate;
  isSelected: boolean;
  isHovered: boolean;
  menuOpen: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
  onMenuToggle: () => void;
  onMenuAction: (action: 'edit' | 'duplicate' | 'delete') => void;
  getCategoryLabel: (category: TemplateCategory) => string;
  getCategoryColor: (category: TemplateCategory) => string;
}

function TemplateCard({
  template,
  isSelected,
  isHovered,
  menuOpen,
  onMouseEnter,
  onMouseLeave,
  onClick,
  onMenuToggle,
  onMenuAction,
  getCategoryLabel,
  getCategoryColor,
}: TemplateCardProps) {
  return (
    <article
      className={`group relative rounded-lg border p-4 transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
      }`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      aria-selected={isSelected}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-gray-900">{template.name}</h3>
          <span
            className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${getCategoryColor(
              template.category
            )}`}
          >
            {getCategoryLabel(template.category)}
          </span>
        </div>

        {/* Menu */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMenuToggle();
            }}
            className={`rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 ${
              isHovered || menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-full z-10 mt-1 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => onMenuAction('edit')}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Edit className="h-4 w-4" />
                Edit
              </button>
              <button
                onClick={() => onMenuAction('duplicate')}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Copy className="h-4 w-4" />
                Duplicate
              </button>
              <hr className="my-1" />
              <button
                onClick={() => onMenuAction('delete')}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {template.description && (
        <p className="mt-2 line-clamp-2 text-sm text-gray-500">{template.description}</p>
      )}

      {/* Preview */}
      <div className="mt-3 rounded border border-gray-100 bg-gray-50 p-2">
        <p className="line-clamp-3 text-xs text-gray-600">
          {template.subject && (
            <span className="font-medium">Subject: {template.subject}</span>
          )}
          {template.subject && <br />}
          {template.body.substring(0, 100)}...
        </p>
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-3">
          {/* Channel */}
          <span className="flex items-center gap-1">
            {template.channelType === 'Email' ? (
              <Mail className="h-3 w-3" />
            ) : (
              <MessageCircle className="h-3 w-3" />
            )}
            {template.channelType}
          </span>

          {/* Usage count */}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Used {template.usageCount}x
          </span>
        </div>

        {/* Use button */}
        <span className="flex items-center gap-1 text-blue-600">
          Use
          <ChevronRight className="h-3 w-3" />
        </span>
      </div>

      {/* Global badge */}
      {template.isGlobal && (
        <div className="absolute right-2 top-2">
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
            Global
          </span>
        </div>
      )}
    </article>
  );
}

export default TemplateLibrary;
