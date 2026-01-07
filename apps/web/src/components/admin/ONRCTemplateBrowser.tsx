'use client';

import { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  PlusCircle,
  Edit,
  XCircle,
  FileText,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Badge, Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  ONRC_STRUCTURE,
  type ONRCCategory,
  type ONRCSubcategory,
  type ONRCProcedure,
} from '@/lib/onrc/procedures';
import type { MapaTemplate } from '@/types/mapa';

interface ONRCTemplateBrowserProps {
  templates: MapaTemplate[];
  onSelectTemplate?: (template: MapaTemplate) => void;
  onSyncProcedure?: (procedureId: string) => void;
  syncingProcedures?: Set<string>;
}

// Map category IDs to icons
const categoryIcons: Record<string, React.ReactNode> = {
  inmatriculari: <PlusCircle className="w-4 h-4" />,
  mentiuni: <Edit className="w-4 h-4" />,
  dizolvari: <XCircle className="w-4 h-4" />,
};

export function ONRCTemplateBrowser({
  templates,
  onSelectTemplate,
  onSyncProcedure,
  syncingProcedures = new Set(),
}: ONRCTemplateBrowserProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['inmatriculari'])
  );
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(new Set());

  // Create a map of procedure ID to template
  const templateMap = new Map<string, MapaTemplate>();
  templates.forEach((t) => {
    // Extract procedure ID from template ID (e.g., "onrc-infiintare-srl" -> "infiintare-srl")
    const procedureId = t.id.replace(/^onrc-/, '');
    templateMap.set(procedureId, t);
  });

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

  // Count synced procedures per category/subcategory
  const countSynced = (procedures: ONRCProcedure[]) => {
    return procedures.filter((p) => templateMap.has(p.id)).length;
  };

  return (
    <div className="space-y-1">
      {ONRC_STRUCTURE.map((category) => (
        <CategorySection
          key={category.id}
          category={category}
          isExpanded={expandedCategories.has(category.id)}
          onToggle={() => toggleCategory(category.id)}
          expandedSubcategories={expandedSubcategories}
          onToggleSubcategory={toggleSubcategory}
          templateMap={templateMap}
          onSelectTemplate={onSelectTemplate}
          onSyncProcedure={onSyncProcedure}
          syncingProcedures={syncingProcedures}
          countSynced={countSynced}
        />
      ))}
    </div>
  );
}

interface CategorySectionProps {
  category: ONRCCategory;
  isExpanded: boolean;
  onToggle: () => void;
  expandedSubcategories: Set<string>;
  onToggleSubcategory: (id: string) => void;
  templateMap: Map<string, MapaTemplate>;
  onSelectTemplate?: (template: MapaTemplate) => void;
  onSyncProcedure?: (procedureId: string) => void;
  syncingProcedures: Set<string>;
  countSynced: (procedures: ONRCProcedure[]) => number;
}

function CategorySection({
  category,
  isExpanded,
  onToggle,
  expandedSubcategories,
  onToggleSubcategory,
  templateMap,
  onSelectTemplate,
  onSyncProcedure,
  syncingProcedures,
  countSynced,
}: CategorySectionProps) {
  const allProcedures = category.subcategories.flatMap((s) => s.procedures);
  const syncedCount = countSynced(allProcedures);
  const totalCount = allProcedures.length;

  return (
    <div className="border border-linear-border-subtle rounded-lg overflow-hidden">
      {/* Category Header */}
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
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
        <div className="flex-1 min-w-0">
          <div className="font-medium text-linear-text-primary">{category.name}</div>
          <div className="text-xs text-linear-text-muted truncate">{category.description}</div>
        </div>
        <Badge
          variant={syncedCount === totalCount ? 'success' : 'default'}
          className="flex-shrink-0"
        >
          {syncedCount}/{totalCount}
        </Badge>
      </button>

      {/* Subcategories */}
      {isExpanded && (
        <div className="border-t border-linear-border-subtle">
          {category.subcategories.map((subcategory) => (
            <SubcategorySection
              key={subcategory.id}
              subcategory={subcategory}
              isExpanded={expandedSubcategories.has(subcategory.id)}
              onToggle={() => onToggleSubcategory(subcategory.id)}
              templateMap={templateMap}
              onSelectTemplate={onSelectTemplate}
              onSyncProcedure={onSyncProcedure}
              syncingProcedures={syncingProcedures}
              countSynced={countSynced}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface SubcategorySectionProps {
  subcategory: ONRCSubcategory;
  isExpanded: boolean;
  onToggle: () => void;
  templateMap: Map<string, MapaTemplate>;
  onSelectTemplate?: (template: MapaTemplate) => void;
  onSyncProcedure?: (procedureId: string) => void;
  syncingProcedures: Set<string>;
  countSynced: (procedures: ONRCProcedure[]) => number;
}

function SubcategorySection({
  subcategory,
  isExpanded,
  onToggle,
  templateMap,
  onSelectTemplate,
  onSyncProcedure,
  syncingProcedures,
  countSynced,
}: SubcategorySectionProps) {
  const syncedCount = countSynced(subcategory.procedures);
  const totalCount = subcategory.procedures.length;

  return (
    <div className="border-b border-linear-border-subtle last:border-b-0">
      {/* Subcategory Header */}
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-2.5 pl-8 text-left transition-colors',
          'hover:bg-linear-bg-tertiary',
          isExpanded ? 'bg-linear-bg-quaternary' : ''
        )}
      >
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-linear-text-muted flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-linear-text-muted flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-linear-text-secondary">{subcategory.name}</div>
        </div>
        <Badge
          variant={syncedCount === totalCount ? 'success' : 'default'}
          className="flex-shrink-0 text-xs"
        >
          {syncedCount}/{totalCount}
        </Badge>
      </button>

      {/* Procedures */}
      {isExpanded && (
        <div className="bg-linear-bg-primary">
          {subcategory.procedures.map((procedure) => (
            <ProcedureRow
              key={procedure.id}
              procedure={procedure}
              template={templateMap.get(procedure.id)}
              onSelect={onSelectTemplate}
              onSync={onSyncProcedure}
              isSyncing={syncingProcedures.has(procedure.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ProcedureRowProps {
  procedure: ONRCProcedure;
  template?: MapaTemplate;
  onSelect?: (template: MapaTemplate) => void;
  onSync?: (procedureId: string) => void;
  isSyncing: boolean;
}

function ProcedureRow({ procedure, template, onSelect, onSync, isSyncing }: ProcedureRowProps) {
  const isSynced = !!template;
  const slotCount = template?.slotDefinitions?.length || 0;

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-2.5 pl-14 border-t border-linear-border-subtle first:border-t-0',
        'hover:bg-linear-bg-secondary transition-colors',
        isSynced && onSelect ? 'cursor-pointer' : ''
      )}
      onClick={() => isSynced && template && onSelect?.(template)}
    >
      {/* Status icon */}
      <div className="flex-shrink-0">
        {isSyncing ? (
          <Loader2 className="w-4 h-4 text-linear-accent animate-spin" />
        ) : isSynced ? (
          <Check className="w-4 h-4 text-linear-success" />
        ) : (
          <AlertCircle className="w-4 h-4 text-linear-text-muted" />
        )}
      </div>

      {/* Procedure info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm text-linear-text-primary truncate">{procedure.name}</div>
        <div className="text-xs text-linear-text-muted truncate">{procedure.description}</div>
      </div>

      {/* Slot count or sync button */}
      {isSynced ? (
        <Badge variant="info" className="flex-shrink-0 text-xs">
          <FileText className="w-3 h-3 mr-1" />
          {slotCount} documente
        </Badge>
      ) : onSync ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onSync(procedure.id);
          }}
          disabled={isSyncing}
          className="text-xs"
        >
          Sync
        </Button>
      ) : null}
    </div>
  );
}
