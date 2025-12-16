/**
 * TaskPatternsManager - Manage learned task creation patterns
 * Story 5.6: AI Learning and Personalization (Task 30)
 * List and edit task patterns with confidence indicators
 */

'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useTaskPatternManagement,
  getTriggerTypeLabel,
  getConfidenceLabel,
  getConfidenceColor,
} from '@/hooks/useTaskPatterns';
import type { TaskCreationPattern } from '@legal-platform/types';

// Icons
const PatternIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="20"
    height="20"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
    />
  </svg>
);

const EditIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
    />
  </svg>
);

const DeleteIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);

const ToggleIcon = ({ active }: { active: boolean }) => (
  <svg
    className="h-4 w-4"
    fill={active ? 'currentColor' : 'none'}
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    {active ? (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    ) : (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    )}
  </svg>
);

// Trigger type colors
const TRIGGER_COLORS: Record<string, string> = {
  case_opened: 'bg-blue-100 text-blue-800',
  document_uploaded: 'bg-green-100 text-green-800',
  email_received: 'bg-purple-100 text-purple-800',
  task_completed: 'bg-orange-100 text-orange-800',
  deadline_approaching: 'bg-red-100 text-red-800',
  time_based: 'bg-gray-100 text-gray-800',
};

interface TaskPatternsManagerProps {
  className?: string;
  showResetButton?: boolean;
}

/**
 * Pattern list item component
 */
function PatternItem({
  pattern,
  onEdit,
  onDelete,
  onToggle,
  isToggling,
}: {
  pattern: TaskCreationPattern;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  isToggling: boolean;
}) {
  const template = pattern.taskTemplate as {
    type?: string;
    titleTemplate?: string;
    priority?: string;
    estimatedHours?: number;
  };

  return (
    <div
      className={`
        p-4 border rounded-lg transition-all
        ${pattern.isActive ? 'border-border bg-background' : 'border-muted bg-muted/30 opacity-60'}
      `}
      role="listitem"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Pattern name and badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium text-sm">{pattern.patternName}</h4>
            <Badge
              variant="outline"
              className={TRIGGER_COLORS[pattern.triggerType] || 'bg-gray-100'}
            >
              {getTriggerTypeLabel(pattern.triggerType)}
            </Badge>
            {!pattern.isActive && <Badge variant="secondary">Dezactivat</Badge>}
          </div>

          {/* Task template preview */}
          <div className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium">Creează task:</span>{' '}
            {template?.titleTemplate || 'Template nedefinit'}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span>
              Declanșări: <strong>{pattern.occurrenceCount}</strong>
            </span>
            <span className={getConfidenceColor(pattern.confidence)}>
              Încredere: <strong>{getConfidenceLabel(pattern.confidence)}</strong> (
              {Math.round(pattern.confidence * 100)}%)
            </span>
            {template?.priority && (
              <span>
                Prioritate: <strong>{template.priority}</strong>
              </span>
            )}
            {template?.estimatedHours && (
              <span>
                Durată estimată: <strong>{template.estimatedHours}h</strong>
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            disabled={isToggling}
            title={pattern.isActive ? 'Dezactivează' : 'Activează'}
            aria-label={
              pattern.isActive
                ? `Dezactivează pattern-ul ${pattern.patternName}`
                : `Activează pattern-ul ${pattern.patternName}`
            }
          >
            <ToggleIcon active={pattern.isActive} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            title="Editează"
            aria-label={`Editează pattern-ul ${pattern.patternName}`}
          >
            <EditIcon />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-destructive hover:text-destructive"
            title="Șterge"
            aria-label={`Șterge pattern-ul ${pattern.patternName}`}
          >
            <DeleteIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Pattern edit dialog
 */
function PatternEditDialog({
  pattern,
  open,
  onClose,
  onSave,
  loading,
}: {
  pattern: TaskCreationPattern | null;
  open: boolean;
  onClose: () => void;
  onSave: (input: { titleTemplate: string; priority: string; estimatedHours?: number }) => void;
  loading: boolean;
}) {
  const template = pattern?.taskTemplate as {
    type?: string;
    titleTemplate?: string;
    descriptionTemplate?: string;
    priority?: string;
    estimatedHours?: number;
  };

  const [titleTemplate, setTitleTemplate] = useState(template?.titleTemplate || '');
  const [priority, setPriority] = useState(template?.priority || 'Medium');
  const [estimatedHours, setEstimatedHours] = useState<string>(
    template?.estimatedHours?.toString() || ''
  );

  // Reset form when pattern changes
  React.useEffect(() => {
    if (pattern) {
      const tmpl = pattern.taskTemplate as {
        titleTemplate?: string;
        priority?: string;
        estimatedHours?: number;
      };
      setTitleTemplate(tmpl?.titleTemplate || '');
      setPriority(tmpl?.priority || 'Medium');
      setEstimatedHours(tmpl?.estimatedHours?.toString() || '');
    }
  }, [pattern]);

  const handleSave = () => {
    onSave({
      titleTemplate,
      priority,
      estimatedHours: estimatedHours ? parseFloat(estimatedHours) : undefined,
    });
  };

  if (!pattern) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editează Pattern</DialogTitle>
          <DialogDescription>
            Modifică template-ul task-ului pentru pattern-ul &ldquo;{pattern.patternName}&rdquo;
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium" htmlFor="titleTemplate">
              Template titlu
            </label>
            <Input
              id="titleTemplate"
              value={titleTemplate}
              onChange={(e) => setTitleTemplate(e.target.value)}
              placeholder="ex: Revizuire {documentType}"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Folosește {'{variablă}'} pentru substituții dinamice
            </p>
          </div>

          <div>
            <label className="text-sm font-medium" htmlFor="priority">
              Prioritate
            </label>
            <select
              id="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="Low">Scăzută</option>
              <option value="Medium">Medie</option>
              <option value="High">Înaltă</option>
              <option value="Urgent">Urgentă</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium" htmlFor="estimatedHours">
              Durată estimată (ore)
            </label>
            <Input
              id="estimatedHours"
              type="number"
              min="0"
              step="0.5"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
              placeholder="ex: 2.5"
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Anulează
          </Button>
          <Button onClick={handleSave} disabled={loading || !titleTemplate}>
            {loading ? 'Se salvează...' : 'Salvează'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Delete confirmation dialog
 */
function DeleteConfirmDialog({
  pattern,
  open,
  onClose,
  onConfirm,
  loading,
}: {
  pattern: TaskCreationPattern | null;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  if (!pattern) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Șterge Pattern</DialogTitle>
          <DialogDescription>
            Ești sigur că vrei să ștergi pattern-ul &ldquo;{pattern.patternName}&rdquo;? Această
            acțiune nu poate fi anulată.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Anulează
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading ? 'Se șterge...' : 'Șterge'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Main TaskPatternsManager component
 */
export function TaskPatternsManager({
  className = '',
  showResetButton = true,
}: TaskPatternsManagerProps) {
  const {
    patterns,
    patternsByTrigger,
    loading,
    error,
    updating,
    toggling,
    deleting,
    resetting,
    updatePattern,
    togglePattern,
    deletePattern,
    resetPatterns,
    count,
    activeCount,
  } = useTaskPatternManagement();

  const [selectedPattern, setSelectedPattern] = useState<TaskCreationPattern | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [filterTrigger, setFilterTrigger] = useState<string>('all');

  // Get unique trigger types for tabs
  const triggerTypes = useMemo(() => {
    return Object.keys(patternsByTrigger);
  }, [patternsByTrigger]);

  // Filtered patterns
  const displayPatterns = useMemo(() => {
    if (filterTrigger === 'all') return patterns;
    return patternsByTrigger[filterTrigger] || [];
  }, [patterns, patternsByTrigger, filterTrigger]);

  const handleEdit = (pattern: TaskCreationPattern) => {
    setSelectedPattern(pattern);
    setEditDialogOpen(true);
  };

  const handleDelete = (pattern: TaskCreationPattern) => {
    setSelectedPattern(pattern);
    setDeleteDialogOpen(true);
  };

  const handleToggle = async (pattern: TaskCreationPattern) => {
    await togglePattern(pattern);
  };

  const handleSaveEdit = async (input: {
    titleTemplate: string;
    priority: string;
    estimatedHours?: number;
  }) => {
    if (!selectedPattern) return;

    await updatePattern(selectedPattern.id, {
      taskTemplate: input,
    });
    setEditDialogOpen(false);
    setSelectedPattern(null);
  };

  const handleConfirmDelete = async () => {
    if (!selectedPattern) return;

    await deletePattern(selectedPattern.id);
    setDeleteDialogOpen(false);
    setSelectedPattern(null);
  };

  const handleReset = async () => {
    await resetPatterns();
    setResetDialogOpen(false);
  };

  if (loading && patterns.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-pulse text-muted-foreground">Se încarcă pattern-urile...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-destructive">
            <p>Eroare la încărcarea pattern-urilor</p>
            <p className="text-sm">{error.message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={className}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <PatternIcon className="text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Pattern-uri Task</CardTitle>
              <p className="text-sm text-muted-foreground">
                {activeCount} active din {count} pattern-uri
              </p>
            </div>
          </div>
          {showResetButton && count > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setResetDialogOpen(true)}
              disabled={resetting}
              className="text-destructive border-destructive/50 hover:bg-destructive/10"
            >
              Resetează toate
            </Button>
          )}
        </CardHeader>

        <CardContent>
          {patterns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <PatternIcon className="mx-auto mb-3 h-12 w-12 opacity-50" />
              <p>Nu există pattern-uri învățate încă</p>
              <p className="text-sm mt-1">
                AI-ul va învăța pattern-uri din modul tău de a crea task-uri
              </p>
            </div>
          ) : (
            <>
              {/* Filter tabs */}
              {triggerTypes.length > 1 && (
                <Tabs value={filterTrigger} onValueChange={setFilterTrigger} className="mb-4">
                  <TabsList>
                    <TabsTrigger value="all">Toate ({patterns.length})</TabsTrigger>
                    {triggerTypes.map((trigger) => (
                      <TabsTrigger key={trigger} value={trigger}>
                        {getTriggerTypeLabel(trigger)} ({patternsByTrigger[trigger]?.length || 0})
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              )}

              {/* Pattern list */}
              <div className="space-y-3" role="list" aria-label="Listă pattern-uri task">
                {displayPatterns.map((pattern: TaskCreationPattern) => (
                  <PatternItem
                    key={pattern.id}
                    pattern={pattern}
                    onEdit={() => handleEdit(pattern)}
                    onDelete={() => handleDelete(pattern)}
                    onToggle={() => handleToggle(pattern)}
                    isToggling={toggling}
                  />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <PatternEditDialog
        pattern={selectedPattern}
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setSelectedPattern(null);
        }}
        onSave={handleSaveEdit}
        loading={updating}
      />

      {/* Delete Dialog */}
      <DeleteConfirmDialog
        pattern={selectedPattern}
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setSelectedPattern(null);
        }}
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />

      {/* Reset Dialog */}
      <Dialog
        open={resetDialogOpen}
        onOpenChange={(isOpen) => !isOpen && setResetDialogOpen(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resetează toate Pattern-urile</DialogTitle>
            <DialogDescription>
              Ești sigur că vrei să ștergi toate pattern-urile învățate? AI-ul va trebui să le
              re-învețe din nou. Această acțiune nu poate fi anulată.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
              Anulează
            </Button>
            <Button variant="destructive" onClick={handleReset} disabled={resetting}>
              {resetting ? 'Se resetează...' : 'Resetează'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

TaskPatternsManager.displayName = 'TaskPatternsManager';

/**
 * Compact version for dashboard widgets
 */
export function TaskPatternsCard({ className = '' }: { className?: string }) {
  const { patterns, activeCount, mostTriggered, loading } = useTaskPatternManagement();

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="animate-pulse h-20" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <PatternIcon className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-medium">Pattern-uri Task</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Pattern-uri active</span>
          <span className="font-medium">
            {activeCount} / {patterns.length}
          </span>
        </div>

        {mostTriggered.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Cele mai folosite</p>
            <div className="space-y-1">
              {mostTriggered.slice(0, 3).map((pattern: TaskCreationPattern) => (
                <div key={pattern.id} className="flex items-center justify-between text-xs">
                  <span className="truncate">{pattern.patternName}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {pattern.occurrenceCount}x
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {patterns.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Niciun pattern învățat încă
          </p>
        )}
      </CardContent>
    </Card>
  );
}

TaskPatternsCard.displayName = 'TaskPatternsCard';
