'use client';

import { useState } from 'react';
import { RefreshCw, Search, Plus, FileText, Building2, LayoutGrid, List } from 'lucide-react';
import { Button, Input, Badge, Tabs, TabsList, TabsTrigger, ScrollArea } from '@/components/ui';
import { useTemplates, useSyncONRCTemplates, useSyncTemplate } from '@/hooks/useTemplates';
import { TemplateCard } from '@/components/admin/TemplateCard';
import { TemplateSyncStatus } from '@/components/admin/TemplateSyncStatus';
import { ONRCTemplateBrowser } from '@/components/admin/ONRCTemplateBrowser';
import { getTotalProcedureCount } from '@/lib/onrc/procedures';
import type { MapaTemplate } from '@/types/mapa';

export default function AdminTemplatesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'onrc' | 'firm'>('onrc');
  const [viewMode, setViewMode] = useState<'tree' | 'grid'>('tree');
  const [syncingProcedures, setSyncingProcedures] = useState<Set<string>>(new Set());

  // Fetch templates
  const { templates, loading, error, refetch } = useTemplates();
  const { syncAll, loading: syncing } = useSyncONRCTemplates();
  const { syncTemplate } = useSyncTemplate();

  // Filter templates based on tab and search
  const filteredTemplates = templates.filter((template) => {
    // Tab filter
    if (activeTab === 'onrc' && !template.isONRC) return false;
    if (activeTab === 'firm' && template.isONRC) return false;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        template.name.toLowerCase().includes(query) ||
        template.description?.toLowerCase().includes(query)
      );
    }

    return true;
  });

  // Count templates by type
  const onrcCount = templates.filter((t) => t.isONRC).length;
  const firmCount = templates.filter((t) => !t.isONRC).length;
  const totalONRCProcedures = getTotalProcedureCount();

  // Handle full sync
  const handleSync = async () => {
    const result = await syncAll({ useAI: true });
    if (result?.success) {
      refetch();
    }
  };

  // Handle single procedure sync
  const handleSyncProcedure = async (procedureId: string) => {
    setSyncingProcedures((prev) => new Set(prev).add(procedureId));
    try {
      const result = await syncTemplate(procedureId, { useAI: true });
      if (result?.success) {
        refetch();
      }
    } finally {
      setSyncingProcedures((prev) => {
        const next = new Set(prev);
        next.delete(procedureId);
        return next;
      });
    }
  };

  // Handle template actions
  const handleViewTemplate = (template: MapaTemplate) => {
    console.log('View template:', template.id);
    // TODO: Navigate to template detail or open modal
  };

  const handleDuplicateTemplate = (template: MapaTemplate) => {
    console.log('Duplicate template:', template.id);
    // TODO: Open duplicate modal
  };

  // Determine sync status
  const getSyncStatus = (): 'synced' | 'syncing' | 'error' | 'needs-review' => {
    if (syncing) return 'syncing';
    const recentSync = templates.find((t) => t.isONRC && t.lastSynced);
    if (!recentSync) return 'needs-review';
    return 'synced';
  };

  const getLastSynced = (): string | undefined => {
    const onrcTemplates = templates.filter((t) => t.isONRC && t.lastSynced);
    if (onrcTemplates.length === 0) return undefined;
    return onrcTemplates.reduce(
      (latest, t) => {
        if (!latest) return t.lastSynced;
        return new Date(t.lastSynced!) > new Date(latest) ? t.lastSynced : latest;
      },
      undefined as string | undefined
    );
  };

  return (
    <div className="flex flex-col h-full bg-linear-bg-primary">
      {/* Header */}
      <header className="px-6 py-4 border-b border-linear-border-subtle">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-linear-text-primary">Templates</h1>
            <p className="text-sm text-linear-text-tertiary mt-1">
              Manage document binder templates for your firm
            </p>
          </div>
          <div className="flex items-center gap-3">
            <TemplateSyncStatus status={getSyncStatus()} lastSynced={getLastSynced()} />
            <Button variant="secondary" size="sm" onClick={handleSync} disabled={syncing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              Sync All ONRC
            </Button>
            <Button variant="primary" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              New Template
            </Button>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="px-6 py-4 border-b border-linear-border-subtle bg-linear-bg-secondary">
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-linear-text-muted" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList>
              <TabsTrigger value="onrc">
                <Building2 className="w-3.5 h-3.5 mr-1.5" />
                ONRC
                <Badge variant="default" className="ml-2">
                  {onrcCount}/{totalONRCProcedures}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="firm">
                <FileText className="w-3.5 h-3.5 mr-1.5" />
                Firm Templates
                <Badge variant="default" className="ml-2">
                  {firmCount}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* View mode toggle (only for ONRC tab) */}
          {activeTab === 'onrc' && (
            <div className="flex items-center gap-1 border border-linear-border-subtle rounded-md p-0.5">
              <button
                onClick={() => setViewMode('tree')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'tree'
                    ? 'bg-linear-bg-tertiary text-linear-text-primary'
                    : 'text-linear-text-muted hover:text-linear-text-secondary'
                }`}
                title="Tree view"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-linear-bg-tertiary text-linear-text-primary'
                    : 'text-linear-text-muted hover:text-linear-text-secondary'
                }`}
                title="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-linear-text-muted">Loading templates...</div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-linear-error">Error loading templates: {error.message}</div>
            </div>
          ) : activeTab === 'onrc' && viewMode === 'tree' ? (
            // ONRC Tree View - matches onrc.ro structure
            <ONRCTemplateBrowser
              templates={filteredTemplates}
              onSelectTemplate={handleViewTemplate}
              onSyncProcedure={handleSyncProcedure}
              syncingProcedures={syncingProcedures}
            />
          ) : filteredTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <FileText className="w-12 h-12 text-linear-text-muted mb-4" />
              <p className="text-linear-text-secondary mb-2">No templates found</p>
              <p className="text-sm text-linear-text-muted">
                {searchQuery
                  ? 'Try a different search term'
                  : activeTab === 'onrc'
                    ? 'Click "Sync All ONRC" to import templates from onrc.ro'
                    : 'Create your first template to get started'}
              </p>
            </div>
          ) : (
            // Grid View
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onView={() => handleViewTemplate(template)}
                  onDuplicate={() => handleDuplicateTemplate(template)}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
