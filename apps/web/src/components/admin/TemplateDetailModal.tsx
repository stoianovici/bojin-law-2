'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  Lock,
  Loader2,
  AlertCircle,
  Check,
  Copy,
  Trash2,
  Edit,
  X,
  Plus,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Badge,
} from '@/components/ui';
import { TextArea } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useUpdateTemplate, useDuplicateTemplate, useDeleteTemplate } from '@/hooks/useTemplates';
import type { MapaTemplate, SlotDefinition } from '@/types/mapa';
import { mapaCategories } from '@/types/mapa';

// ============================================================================
// Types
// ============================================================================

export interface TemplateDetailModalProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** The template to display */
  template: MapaTemplate;
  /** Callback when template is updated */
  onTemplateUpdated?: (template: MapaTemplate) => void;
  /** Callback when template is duplicated */
  onTemplateDuplicated?: (template: MapaTemplate) => void;
  /** Callback when template is deleted */
  onTemplateDeleted?: () => void;
}

interface FormErrors {
  name?: string;
  duplicateName?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getCategoryName(categoryId: string | undefined): string {
  if (!categoryId) return 'Necategorizat';
  const category = mapaCategories.find((c) => c.id === categoryId);
  return category?.name ?? categoryId;
}

function groupSlotsByCategory(slots: SlotDefinition[]): Map<string, SlotDefinition[]> {
  const grouped = new Map<string, SlotDefinition[]>();

  slots.forEach((slot) => {
    const category = slot.category || 'uncategorized';
    const existing = grouped.get(category) || [];
    grouped.set(category, [...existing, slot]);
  });

  return grouped;
}

// ============================================================================
// Slot Editor Component
// ============================================================================

interface SlotEditorProps {
  slot: SlotDefinition;
  index: number;
  onUpdate: (index: number, slot: SlotDefinition) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
}

function SlotEditor({ slot, index, onUpdate, onRemove, disabled }: SlotEditorProps) {
  return (
    <div className="flex items-start gap-3 p-3 bg-linear-bg-tertiary rounded-lg">
      <div className="flex-1 space-y-2">
        <Input
          value={slot.name}
          onChange={(e) => onUpdate(index, { ...slot, name: e.target.value })}
          placeholder="Nume slot"
          disabled={disabled}
          size="sm"
        />
        <Input
          value={slot.description || ''}
          onChange={(e) => onUpdate(index, { ...slot, description: e.target.value })}
          placeholder="Descriere (optional)"
          disabled={disabled}
          size="sm"
        />
        <div className="flex items-center gap-3">
          <select
            value={slot.category || ''}
            onChange={(e) => onUpdate(index, { ...slot, category: e.target.value })}
            disabled={disabled}
            className={cn(
              'flex-1 h-7 text-xs px-2.5 rounded-md',
              'bg-linear-bg-elevated border border-linear-border-subtle',
              'text-linear-text-primary',
              'focus:outline-none focus:ring-2 focus:ring-linear-accent focus:border-transparent',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <option value="">Selecteaza categorie</option>
            {mapaCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-linear-text-secondary">
            <input
              type="checkbox"
              checked={slot.required}
              onChange={(e) => onUpdate(index, { ...slot, required: e.target.checked })}
              disabled={disabled}
              className="w-3.5 h-3.5"
            />
            Obligatoriu
          </label>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onRemove(index)}
        disabled={disabled}
        className="text-linear-text-muted hover:text-linear-error flex-shrink-0"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}

// ============================================================================
// Slots Display Component (Read-only)
// ============================================================================

interface SlotsDisplayProps {
  slots: SlotDefinition[];
}

function SlotsDisplay({ slots }: SlotsDisplayProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const groupedSlots = useMemo(() => groupSlotsByCategory(slots), [slots]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Sort categories by the order they appear in mapaCategories
  const sortedCategories = Array.from(groupedSlots.keys()).sort((a, b) => {
    const aIndex = mapaCategories.findIndex((c) => c.id === a);
    const bIndex = mapaCategories.findIndex((c) => c.id === b);
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });

  return (
    <div className="space-y-2">
      {sortedCategories.map((category) => {
        const categorySlots = groupedSlots.get(category) || [];
        const isExpanded = expandedCategories.has(category);
        const requiredCount = categorySlots.filter((s) => s.required).length;

        return (
          <div
            key={category}
            className="border border-linear-border-subtle rounded-lg overflow-hidden"
          >
            {/* Category Header */}
            <button
              onClick={() => toggleCategory(category)}
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
              <span className="flex-1 text-sm font-medium text-linear-text-primary">
                {getCategoryName(category)}
              </span>
              <Badge variant="default" size="sm">
                {categorySlots.length} {categorySlots.length === 1 ? 'slot' : 'sloturi'}
              </Badge>
              {requiredCount > 0 && (
                <Badge variant="warning" size="sm">
                  {requiredCount} obligatorii
                </Badge>
              )}
            </button>

            {/* Slots List */}
            {isExpanded && (
              <div className="border-t border-linear-border-subtle">
                {categorySlots
                  .sort((a, b) => a.order - b.order)
                  .map((slot, idx) => (
                    <div
                      key={`${slot.name}-${idx}`}
                      className={cn(
                        'px-4 py-2.5 flex items-start justify-between gap-3',
                        'border-b border-linear-border-subtle last:border-b-0',
                        'hover:bg-linear-bg-tertiary/50 transition-colors'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-linear-text-primary">{slot.name}</span>
                          {slot.required && (
                            <Badge variant="warning" size="sm">
                              Obligatoriu
                            </Badge>
                          )}
                        </div>
                        {slot.description && (
                          <p className="text-xs text-linear-text-tertiary mt-0.5">
                            {slot.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Duplicate Modal Component
// ============================================================================

interface DuplicateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateName: string;
  onConfirm: (newName: string) => void;
  loading?: boolean;
  error?: string;
}

function DuplicateModal({
  open,
  onOpenChange,
  templateName,
  onConfirm,
  loading,
  error,
}: DuplicateModalProps) {
  const [newName, setNewName] = useState(`${templateName} (copie)`);

  // Use onOpenChange to reset name instead of useEffect
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setNewName(`${templateName} (copie)`);
      }
      onOpenChange(nextOpen);
    },
    [templateName, onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Duplica sablon</DialogTitle>
          <DialogDescription>
            Introduceti numele pentru noul sablon. Toate sloturile vor fi copiate.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label
              htmlFor="duplicate-name"
              className="text-xs text-linear-text-secondary mb-1.5 block font-medium"
            >
              Nume sablon nou <span className="text-linear-error">*</span>
            </label>
            <Input
              id="duplicate-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Introduceti numele..."
              disabled={loading}
              autoFocus
            />
          </div>

          {error && (
            <div
              className={cn(
                'flex items-start gap-2 p-3 rounded-lg',
                'bg-linear-error/10 border border-linear-error/30'
              )}
            >
              <AlertCircle className="w-4 h-4 text-linear-error flex-shrink-0 mt-0.5" />
              <p className="text-sm text-linear-error">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            Anuleaza
          </Button>
          <Button onClick={() => onConfirm(newName)} disabled={loading || !newName.trim()}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Se duplica...
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-1.5" />
                Duplica
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Delete Confirmation Modal Component
// ============================================================================

interface DeleteConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateName: string;
  onConfirm: () => void;
  loading?: boolean;
  error?: string;
}

function DeleteConfirmModal({
  open,
  onOpenChange,
  templateName,
  onConfirm,
  loading,
  error,
}: DeleteConfirmModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Sterge sablon</DialogTitle>
          <DialogDescription>
            Sunteti sigur ca doriti sa stergeti sablonul &quot;{templateName}&quot;? Aceasta actiune
            nu poate fi anulata.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="px-6">
            <div
              className={cn(
                'flex items-start gap-2 p-3 rounded-lg',
                'bg-linear-error/10 border border-linear-error/30'
              )}
            >
              <AlertCircle className="w-4 h-4 text-linear-error flex-shrink-0 mt-0.5" />
              <p className="text-sm text-linear-error">{error}</p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            Anuleaza
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Se sterge...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-1.5" />
                Sterge
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Main TemplateDetailModal Component
// ============================================================================

export function TemplateDetailModal({
  open,
  onOpenChange,
  template,
  onTemplateUpdated,
  onTemplateDuplicated,
  onTemplateDeleted,
}: TemplateDetailModalProps) {
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(template.name);
  const [editedDescription, setEditedDescription] = useState(template.description || '');
  const [editedSlots, setEditedSlots] = useState<SlotDefinition[]>(template.slotDefinitions);

  // Modal states
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Validation state
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Hooks
  const { updateTemplate, loading: updating, error: updateError } = useUpdateTemplate();
  const { duplicateTemplate, loading: duplicating, error: duplicateError } = useDuplicateTemplate();
  const { deleteTemplate, loading: deleting, error: deleteError } = useDeleteTemplate();

  const isLocked = template.isONRC || template.isLocked;

  // Handle open state change to reset form
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setIsEditing(false);
        setEditedName(template.name);
        setEditedDescription(template.description || '');
        setEditedSlots([...template.slotDefinitions]);
        setErrors({});
        setSubmitError(null);
      }
      onOpenChange(nextOpen);
    },
    [template, onOpenChange]
  );

  // Cancel editing
  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditedName(template.name);
    setEditedDescription(template.description || '');
    setEditedSlots([...template.slotDefinitions]);
    setErrors({});
    setSubmitError(null);
  }, [template]);

  // Validate form
  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    const trimmedName = editedName.trim();
    if (!trimmedName) {
      newErrors.name = 'Numele este obligatoriu';
    } else if (trimmedName.length < 3) {
      newErrors.name = 'Numele trebuie sa contina cel putin 3 caractere';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [editedName]);

  // Save changes
  const handleSave = useCallback(async () => {
    if (!validateForm()) return;

    setSubmitError(null);

    try {
      const result = await updateTemplate(template.id, {
        name: editedName.trim(),
        description: editedDescription.trim() || undefined,
        slotDefinitions: editedSlots.map((slot, index) => ({
          ...slot,
          order: index,
        })),
      });

      if (result) {
        setIsEditing(false);
        onTemplateUpdated?.(result);
      } else {
        setSubmitError('Actualizarea sablonului a esuat. Incercati din nou.');
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'A aparut o eroare neasteptata');
    }
  }, [
    validateForm,
    updateTemplate,
    template.id,
    editedName,
    editedDescription,
    editedSlots,
    onTemplateUpdated,
  ]);

  // Duplicate template
  const handleDuplicate = useCallback(
    async (newName: string) => {
      try {
        const result = await duplicateTemplate(template.id, newName);

        if (result) {
          setDuplicateModalOpen(false);
          onTemplateDuplicated?.(result);
        }
      } catch {
        // Error is handled by the hook
      }
    },
    [duplicateTemplate, template.id, onTemplateDuplicated]
  );

  // Delete template
  const handleDelete = useCallback(async () => {
    try {
      const success = await deleteTemplate(template.id);

      if (success) {
        setDeleteModalOpen(false);
        onOpenChange(false);
        onTemplateDeleted?.();
      }
    } catch {
      // Error is handled by the hook
    }
  }, [deleteTemplate, template.id, onOpenChange, onTemplateDeleted]);

  // Slot management
  const handleUpdateSlot = useCallback((index: number, updatedSlot: SlotDefinition) => {
    setEditedSlots((prev) => {
      const next = [...prev];
      next[index] = updatedSlot;
      return next;
    });
  }, []);

  const handleRemoveSlot = useCallback((index: number) => {
    setEditedSlots((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddSlot = useCallback(() => {
    setEditedSlots((prev) => [
      ...prev,
      {
        name: '',
        description: '',
        category: '',
        required: false,
        order: prev.length,
      },
    ]);
  }, []);

  // Error message
  const errorMessage = submitError || updateError?.message || null;

  // Format dates
  const formattedCreatedAt = template.createdAt
    ? new Date(template.createdAt).toLocaleDateString('ro-RO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  const formattedUpdatedAt = template.updatedAt
    ? new Date(template.updatedAt).toLocaleDateString('ro-RO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  const formattedLastSynced = template.lastSynced
    ? new Date(template.lastSynced).toLocaleDateString('ro-RO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent size="lg" className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle className="flex-1">{template.name}</DialogTitle>
              {template.isONRC && (
                <Badge variant="info" size="sm">
                  ONRC
                </Badge>
              )}
              {isLocked && <Lock className="w-4 h-4 text-linear-text-muted" />}
            </div>
            {template.description && <DialogDescription>{template.description}</DialogDescription>}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {/* Metadata Section */}
            <div className="flex flex-wrap gap-4 text-xs text-linear-text-secondary">
              {template.caseType && (
                <div>
                  <span className="text-linear-text-muted">Tip caz: </span>
                  <span className="text-linear-text-primary">{template.caseType}</span>
                </div>
              )}
              <div>
                <span className="text-linear-text-muted">Utilizari: </span>
                <span className="text-linear-text-primary">{template.usageCount}</span>
              </div>
              {formattedCreatedAt && (
                <div>
                  <span className="text-linear-text-muted">Creat la: </span>
                  <span className="text-linear-text-primary">{formattedCreatedAt}</span>
                </div>
              )}
              {formattedUpdatedAt && (
                <div>
                  <span className="text-linear-text-muted">Actualizat la: </span>
                  <span className="text-linear-text-primary">{formattedUpdatedAt}</span>
                </div>
              )}
              {formattedLastSynced && (
                <div>
                  <span className="text-linear-text-muted">Ultima sincronizare: </span>
                  <span className="text-linear-text-primary">{formattedLastSynced}</span>
                </div>
              )}
            </div>

            {/* Edit Mode: Name and Description */}
            {isEditing && (
              <div className="space-y-4 pb-4 border-b border-linear-border-subtle">
                <div>
                  <label
                    htmlFor="template-name"
                    className="text-xs text-linear-text-secondary mb-1.5 block font-medium"
                  >
                    Nume <span className="text-linear-error">*</span>
                  </label>
                  <Input
                    id="template-name"
                    value={editedName}
                    onChange={(e) => {
                      setEditedName(e.target.value);
                      if (errors.name) {
                        setErrors((prev) => ({ ...prev, name: undefined }));
                      }
                    }}
                    placeholder="Introduceti numele sablonului..."
                    disabled={updating}
                    error={!!errors.name}
                    errorMessage={errors.name}
                  />
                </div>

                <div>
                  <label
                    htmlFor="template-description"
                    className="text-xs text-linear-text-secondary mb-1.5 block font-medium"
                  >
                    Descriere <span className="text-linear-text-muted">(optional)</span>
                  </label>
                  <TextArea
                    id="template-description"
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    placeholder="Introduceti o descriere..."
                    disabled={updating}
                    rows={2}
                    resize="none"
                  />
                </div>
              </div>
            )}

            {/* Slots Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-linear-text-primary">
                  Sloturi ({isEditing ? editedSlots.length : template.slotDefinitions.length})
                </h3>
                {isEditing && (
                  <Button variant="secondary" size="sm" onClick={handleAddSlot} disabled={updating}>
                    <Plus className="w-4 h-4 mr-1.5" />
                    Adauga slot
                  </Button>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-3">
                  {editedSlots.map((slot, index) => (
                    <SlotEditor
                      key={`${slot.name}-${index}`}
                      slot={slot}
                      index={index}
                      onUpdate={handleUpdateSlot}
                      onRemove={handleRemoveSlot}
                      disabled={updating}
                    />
                  ))}
                  {editedSlots.length === 0 && (
                    <div className="text-center py-8 text-linear-text-muted text-sm">
                      Nu exista sloturi. Adaugati primul slot.
                    </div>
                  )}
                </div>
              ) : (
                <SlotsDisplay slots={template.slotDefinitions} />
              )}
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div
                className={cn(
                  'flex items-start gap-2 p-3 rounded-lg',
                  'bg-linear-error/10 border border-linear-error/30'
                )}
              >
                <AlertCircle className="w-4 h-4 text-linear-error flex-shrink-0 mt-0.5" />
                <p className="text-sm text-linear-error">{errorMessage}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="border-t border-linear-border-subtle">
            {isEditing ? (
              // Edit mode actions
              <>
                <Button variant="secondary" onClick={handleCancelEdit} disabled={updating}>
                  <X className="w-4 h-4 mr-1.5" />
                  Anuleaza
                </Button>
                <Button onClick={handleSave} disabled={updating}>
                  {updating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      Se salveaza...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-1.5" />
                      Salveaza
                    </>
                  )}
                </Button>
              </>
            ) : (
              // View mode actions
              <>
                {/* Delete button (firm templates only) */}
                {!isLocked && (
                  <Button
                    variant="ghost"
                    onClick={() => setDeleteModalOpen(true)}
                    className="text-linear-error hover:text-linear-error hover:bg-linear-error/10 mr-auto"
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    Sterge
                  </Button>
                )}

                {/* Duplicate button (all templates) */}
                <Button variant="secondary" onClick={() => setDuplicateModalOpen(true)}>
                  <Copy className="w-4 h-4 mr-1.5" />
                  Duplica
                </Button>

                {/* Edit button (firm templates only) */}
                {!isLocked && (
                  <Button onClick={() => setIsEditing(true)}>
                    <Edit className="w-4 h-4 mr-1.5" />
                    Editeaza
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Modal */}
      <DuplicateModal
        open={duplicateModalOpen}
        onOpenChange={setDuplicateModalOpen}
        templateName={template.name}
        onConfirm={handleDuplicate}
        loading={duplicating}
        error={duplicateError?.message}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        templateName={template.name}
        onConfirm={handleDelete}
        loading={deleting}
        error={deleteError?.message}
      />
    </>
  );
}

TemplateDetailModal.displayName = 'TemplateDetailModal';

export default TemplateDetailModal;
