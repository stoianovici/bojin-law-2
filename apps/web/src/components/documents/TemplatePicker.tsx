'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Search,
  FileText,
  Building2,
  Loader2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Check,
  X,
  PlusCircle,
  Edit,
  XCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Badge,
  Input,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { useTemplates } from '@/hooks/useTemplates';
import type { MapaTemplate, SlotDefinition } from '@/types/mapa';
import { mapaCategories } from '@/types/mapa';
import { ONRC_STRUCTURE, type ONRCCategory, type ONRCSubcategory } from '@/lib/onrc/procedures';

// ============================================================================
// Types
// ============================================================================

export interface TemplatePickerProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Callback when a template is selected */
  onSelect: (template: MapaTemplate) => void;
  /** Optional firm ID for filtering custom templates */
  firmId?: string;
}

type FilterType = 'all' | 'onrc' | 'custom';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get category display name from category ID
 */
function getCategoryName(categoryId: string): string {
  const category = mapaCategories.find((c) => c.id === categoryId);
  return category?.name ?? categoryId;
}

/**
 * Group slot definitions by category
 */
function groupSlotsByCategory(slots: SlotDefinition[]): Record<string, SlotDefinition[]> {
  return slots.reduce(
    (acc, slot) => {
      const category = slot.category || 'diverse';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(slot);
      return acc;
    },
    {} as Record<string, SlotDefinition[]>
  );
}

// ============================================================================
// SlotPreview Component
// ============================================================================

interface SlotPreviewProps {
  slots: SlotDefinition[];
}

function SlotPreview({ slots }: SlotPreviewProps) {
  const groupedSlots = useMemo(() => groupSlotsByCategory(slots), [slots]);
  const categories = Object.keys(groupedSlots);

  if (slots.length === 0) {
    return (
      <div className="text-center py-8 text-linear-text-tertiary">
        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No slot definitions</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {categories.map((categoryId) => {
        const categorySlots = groupedSlots[categoryId];
        const categoryName = getCategoryName(categoryId);

        return (
          <div key={categoryId}>
            <h4 className="text-xs font-medium text-linear-text-tertiary uppercase tracking-wider mb-2">
              {categoryName}
            </h4>
            <div className="space-y-1">
              {categorySlots.map((slot, index) => (
                <div
                  key={`${slot.name}-${index}`}
                  className="flex items-start gap-2 py-1.5 px-2 rounded-md bg-linear-bg-tertiary"
                >
                  <div
                    className={cn(
                      'w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5',
                      slot.required ? 'bg-linear-error' : 'bg-linear-text-muted'
                    )}
                  />
                  <span className="text-sm text-linear-text-primary flex-1">{slot.name}</span>
                  {slot.required && (
                    <Badge variant="error" size="sm" className="flex-shrink-0">
                      Required
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Category Icons
// ============================================================================

const categoryIcons: Record<string, React.ReactNode> = {
  inmatriculari: <PlusCircle className="w-4 h-4" />,
  mentiuni: <Edit className="w-4 h-4" />,
  dizolvari: <XCircle className="w-4 h-4" />,
};

// ============================================================================
// ONRCHierarchicalList Component - Hierarchical template browser
// ============================================================================

interface ONRCHierarchicalListProps {
  templates: MapaTemplate[];
  selectedTemplate: MapaTemplate | null;
  onSelect: (template: MapaTemplate) => void;
  searchQuery: string;
}

function ONRCHierarchicalList({
  templates,
  selectedTemplate,
  onSelect,
  searchQuery,
}: ONRCHierarchicalListProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['inmatriculari', 'mentiuni'])
  );
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(
    new Set(['persoane-juridice', 'mentiuni-pj'])
  );

  // Create a map of procedure ID to template
  const templateMap = useMemo(() => {
    const map = new Map<string, MapaTemplate>();
    templates.forEach((t) => {
      const procedureId = t.id.replace(/^onrc-/, '');
      map.set(procedureId, t);
    });
    return map;
  }, [templates]);

  // If searching, show flat list
  if (searchQuery.trim()) {
    return (
      <div className="space-y-2">
        {templates.map((template) => (
          <TemplateListItem
            key={template.id}
            template={template}
            isSelected={selectedTemplate?.id === template.id}
            onClick={() => onSelect(template)}
          />
        ))}
      </div>
    );
  }

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const toggleSubcategory = (subcategoryId: string) => {
    setExpandedSubcategories((prev) => {
      const next = new Set(prev);
      if (next.has(subcategoryId)) {
        next.delete(subcategoryId);
      } else {
        next.add(subcategoryId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {ONRC_STRUCTURE.map((category) => {
        const isExpanded = expandedCategories.has(category.id);
        const categoryTemplates = category.subcategories.flatMap((sub) =>
          sub.procedures.map((p) => templateMap.get(p.id)).filter((t): t is MapaTemplate => !!t)
        );
        const syncedCount = categoryTemplates.length;
        const totalCount = category.subcategories.reduce(
          (sum, sub) => sum + sub.procedures.length,
          0
        );

        return (
          <div
            key={category.id}
            className="border border-linear-border-subtle rounded-lg overflow-hidden"
          >
            {/* Category Header */}
            <button
              onClick={() => toggleCategory(category.id)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-left transition-colors',
                'hover:bg-linear-bg-tertiary',
                isExpanded ? 'bg-linear-bg-secondary' : 'bg-linear-bg-primary'
              )}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-linear-text-muted flex-shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-linear-text-muted flex-shrink-0" />
              )}
              <span className="text-linear-text-secondary">{categoryIcons[category.id]}</span>
              <span className="flex-1 font-medium text-sm text-linear-text-primary">
                {category.name}
              </span>
              <Badge variant={syncedCount > 0 ? 'success' : 'default'} size="sm">
                {syncedCount}/{totalCount}
              </Badge>
            </button>

            {/* Subcategories */}
            {isExpanded && (
              <div className="border-t border-linear-border-subtle">
                {category.subcategories.map((subcategory) => {
                  const isSubExpanded = expandedSubcategories.has(subcategory.id);
                  const subTemplates = subcategory.procedures
                    .map((p) => templateMap.get(p.id))
                    .filter((t): t is MapaTemplate => !!t);
                  const subSyncedCount = subTemplates.length;
                  const subTotalCount = subcategory.procedures.length;

                  if (subTotalCount === 0) return null;

                  return (
                    <div
                      key={subcategory.id}
                      className="border-b border-linear-border-subtle last:border-b-0"
                    >
                      {/* Subcategory Header */}
                      <button
                        onClick={() => toggleSubcategory(subcategory.id)}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 pl-8 text-left transition-colors',
                          'hover:bg-linear-bg-tertiary',
                          isSubExpanded ? 'bg-linear-bg-quaternary' : ''
                        )}
                      >
                        {isSubExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-linear-text-muted" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-linear-text-muted" />
                        )}
                        <span className="flex-1 text-sm text-linear-text-secondary">
                          {subcategory.name}
                        </span>
                        <Badge variant="default" size="sm">
                          {subSyncedCount}/{subTotalCount}
                        </Badge>
                      </button>

                      {/* Procedures/Templates */}
                      {isSubExpanded && (
                        <div className="bg-linear-bg-primary">
                          {subcategory.procedures.map((procedure) => {
                            const template = templateMap.get(procedure.id);
                            const isSelected = selectedTemplate?.id === template?.id;

                            return (
                              <button
                                key={procedure.id}
                                onClick={() => template && onSelect(template)}
                                disabled={!template}
                                className={cn(
                                  'w-full flex items-center gap-2 px-3 py-2 pl-14 text-left',
                                  'border-t border-linear-border-subtle first:border-t-0',
                                  'transition-colors',
                                  template
                                    ? 'hover:bg-linear-bg-secondary cursor-pointer'
                                    : 'opacity-50 cursor-not-allowed',
                                  isSelected &&
                                    'bg-linear-accent/5 border-l-2 border-l-linear-accent'
                                )}
                              >
                                {/* Status icon */}
                                <div className="flex-shrink-0">
                                  {template ? (
                                    isSelected ? (
                                      <div className="w-4 h-4 rounded-full bg-linear-accent flex items-center justify-center">
                                        <Check className="w-2.5 h-2.5 text-white" />
                                      </div>
                                    ) : (
                                      <Check className="w-4 h-4 text-linear-success" />
                                    )
                                  ) : (
                                    <AlertCircle className="w-4 h-4 text-linear-text-muted" />
                                  )}
                                </div>

                                {/* Procedure info */}
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm text-linear-text-primary truncate">
                                    {procedure.name}
                                  </div>
                                </div>

                                {/* Slot count */}
                                {template && (
                                  <span className="text-xs text-linear-text-muted flex-shrink-0">
                                    {template.slotDefinitions?.length || 0} docs
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// TemplateListItem Component
// ============================================================================

interface TemplateListItemProps {
  template: MapaTemplate;
  isSelected: boolean;
  onClick: () => void;
}

function TemplateListItem({ template, isSelected, onClick }: TemplateListItemProps) {
  const slotCount = template.slotDefinitions?.length ?? 0;
  const requiredCount = template.slotDefinitions?.filter((s) => s.required).length ?? 0;

  return (
    <button
      type="button"
      className={cn(
        'w-full text-left p-3 rounded-lg border transition-all duration-150',
        'hover:border-linear-border-default hover:bg-linear-bg-hover',
        isSelected
          ? 'border-linear-accent bg-linear-accent/5 ring-1 ring-linear-accent'
          : 'border-linear-border-subtle bg-linear-bg-secondary'
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
            template.isONRC
              ? 'bg-linear-accent/10 text-linear-accent'
              : 'bg-linear-bg-tertiary text-linear-text-secondary'
          )}
        >
          {template.isONRC ? <Building2 className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-linear-text-primary truncate">
              {template.name}
            </h3>
            {template.isONRC && (
              <Badge variant="info" size="sm">
                ONRC
              </Badge>
            )}
            {template.isLocked && (
              <Badge variant="warning" size="sm">
                Locked
              </Badge>
            )}
          </div>

          {template.description && (
            <p className="text-xs text-linear-text-tertiary mt-0.5 line-clamp-2">
              {template.description}
            </p>
          )}

          {/* Stats */}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-linear-text-secondary">
              {slotCount} {slotCount === 1 ? 'slot' : 'slots'}
            </span>
            {requiredCount > 0 && (
              <span className="text-xs text-linear-text-tertiary">{requiredCount} required</span>
            )}
            {template.usageCount > 0 && (
              <span className="text-xs text-linear-text-muted">Used {template.usageCount}x</span>
            )}
          </div>
        </div>

        {/* Selection indicator */}
        <div className="flex-shrink-0 self-center">
          {isSelected ? (
            <div className="w-5 h-5 rounded-full bg-linear-accent flex items-center justify-center">
              <Check className="w-3 h-3 text-white" />
            </div>
          ) : (
            <ChevronRight className="w-5 h-5 text-linear-text-muted" />
          )}
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// TemplatePicker Component
// ============================================================================

export function TemplatePicker({ open, onOpenChange, onSelect, firmId }: TemplatePickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<MapaTemplate | null>(null);

  // Fetch templates
  const { templates, loading, error } = useTemplates({
    firmId,
    isActive: true,
  });

  // Filter templates based on search and filter type
  const filteredTemplates = useMemo(() => {
    let result = templates;

    // Apply filter type
    if (filterType === 'onrc') {
      result = result.filter((t) => t.isONRC);
    } else if (filterType === 'custom') {
      result = result.filter((t) => !t.isONRC);
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query) ||
          t.caseType?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [templates, filterType, searchQuery]);

  // Handle template selection
  const handleTemplateClick = useCallback((template: MapaTemplate) => {
    setSelectedTemplate((prev) => (prev?.id === template.id ? null : template));
  }, []);

  // Handle confirm selection
  const handleConfirm = useCallback(() => {
    if (selectedTemplate) {
      onSelect(selectedTemplate);
      onOpenChange(false);
      // Reset state
      setSelectedTemplate(null);
      setSearchQuery('');
      setFilterType('all');
    }
  }, [selectedTemplate, onSelect, onOpenChange]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    onOpenChange(false);
    // Reset state
    setSelectedTemplate(null);
    setSearchQuery('');
    setFilterType('all');
  }, [onOpenChange]);

  // Count templates by type
  const templateCounts = useMemo(() => {
    const onrcCount = templates.filter((t) => t.isONRC).length;
    const customCount = templates.filter((t) => !t.isONRC).length;
    return { all: templates.length, onrc: onrcCount, custom: customCount };
  }, [templates]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="full" className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Template</DialogTitle>
          <DialogDescription>
            Choose a template to create a new document binder (mapa).
          </DialogDescription>
        </DialogHeader>

        {/* Search Input */}
        <div className="px-6 pb-4">
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftAddon={<Search className="w-4 h-4" />}
            rightAddon={
              searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="hover:text-linear-text-primary transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : undefined
            }
          />
        </div>

        {/* Main Content - fixed height to enable scrolling */}
        <div className="px-6 pb-4">
          <Tabs value={filterType} onValueChange={(value) => setFilterType(value as FilterType)}>
            {/* Filter Tabs */}
            <TabsList variant="pills" className="mb-4">
              <TabsTrigger value="all">All ({templateCounts.all})</TabsTrigger>
              <TabsTrigger value="onrc">ONRC ({templateCounts.onrc})</TabsTrigger>
              <TabsTrigger value="custom">Custom ({templateCounts.custom})</TabsTrigger>
            </TabsList>

            {/* Template List and Preview - explicit height */}
            <div className="flex gap-4 h-[50vh]">
              {/* Template List */}
              <div className="flex-1 min-w-0 overflow-y-auto pr-2">
                <TabsContent value="all" className="mt-0">
                  <TemplateList
                    templates={filteredTemplates}
                    selectedTemplate={selectedTemplate}
                    onSelect={handleTemplateClick}
                    loading={loading}
                    error={error}
                  />
                </TabsContent>
                <TabsContent value="onrc" className="mt-0">
                  {loading ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-linear-accent" />
                        <span className="text-sm text-linear-text-secondary">
                          Loading templates...
                        </span>
                      </div>
                    </div>
                  ) : error ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="flex flex-col items-center gap-3 text-center">
                        <div className="w-12 h-12 rounded-full bg-linear-error/10 flex items-center justify-center">
                          <AlertCircle className="w-6 h-6 text-linear-error" />
                        </div>
                        <div>
                          <h4 className="font-medium text-linear-text-primary">
                            Failed to load templates
                          </h4>
                          <p className="text-sm text-linear-text-secondary mt-1">{error.message}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <ONRCHierarchicalList
                      templates={filteredTemplates}
                      selectedTemplate={selectedTemplate}
                      onSelect={handleTemplateClick}
                      searchQuery={searchQuery}
                    />
                  )}
                </TabsContent>
                <TabsContent value="custom" className="mt-0">
                  <TemplateList
                    templates={filteredTemplates}
                    selectedTemplate={selectedTemplate}
                    onSelect={handleTemplateClick}
                    loading={loading}
                    error={error}
                  />
                </TabsContent>
              </div>

              {/* Preview Panel */}
              <div className="w-96 flex-shrink-0 border-l border-linear-border-subtle pl-4 flex flex-col">
                <h3 className="text-sm font-medium text-linear-text-primary mb-3 flex-shrink-0">
                  Slot Definitions
                </h3>
                <div className="flex-1 overflow-y-auto pr-2">
                  {selectedTemplate ? (
                    <div>
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-linear-text-primary">
                          {selectedTemplate.name}
                        </h4>
                        {selectedTemplate.description && (
                          <p className="text-xs text-linear-text-tertiary mt-1">
                            {selectedTemplate.description}
                          </p>
                        )}
                      </div>
                      <SlotPreview slots={selectedTemplate.slotDefinitions ?? []} />
                    </div>
                  ) : (
                    <div className="text-center py-8 text-linear-text-muted">
                      <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Select a template to preview its slot definitions</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Tabs>
        </div>

        {/* Footer */}
        <DialogFooter>
          <Button variant="secondary" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedTemplate}>
            Select Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// TemplateList Component
// ============================================================================

interface TemplateListProps {
  templates: MapaTemplate[];
  selectedTemplate: MapaTemplate | null;
  onSelect: (template: MapaTemplate) => void;
  loading: boolean;
  error: Error | undefined;
}

function TemplateList({
  templates,
  selectedTemplate,
  onSelect,
  loading,
  error,
}: TemplateListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-linear-accent" />
          <span className="text-sm text-linear-text-secondary">Loading templates...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-linear-error/10 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-linear-error" />
          </div>
          <div>
            <h4 className="font-medium text-linear-text-primary">Failed to load templates</h4>
            <p className="text-sm text-linear-text-secondary mt-1">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-linear-bg-tertiary flex items-center justify-center">
            <FileText className="w-6 h-6 text-linear-text-muted" />
          </div>
          <div>
            <h4 className="font-medium text-linear-text-primary">No templates found</h4>
            <p className="text-sm text-linear-text-secondary mt-1">
              Try adjusting your search or filter
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 pr-2">
      {templates.map((template) => (
        <TemplateListItem
          key={template.id}
          template={template}
          isSelected={selectedTemplate?.id === template.id}
          onClick={() => onSelect(template)}
        />
      ))}
    </div>
  );
}

TemplatePicker.displayName = 'TemplatePicker';

export default TemplatePicker;
