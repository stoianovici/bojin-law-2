'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { AlertCircle, Check, Plus, Trash2, GripVertical } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Checkbox,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui';
import { TextArea } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useCreateTemplate } from '@/hooks/useTemplates';
import type { MapaTemplate, SlotDefinition } from '@/types/mapa';
import { mapaCategories } from '@/types/mapa';

// ============================================================================
// Types
// ============================================================================

export interface CreateTemplateModalProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Callback when template is successfully created */
  onSuccess?: (template: MapaTemplate) => void;
}

interface FormErrors {
  name?: string;
  slots?: string;
}

interface SlotFormData {
  id: string; // Local ID for React keys
  name: string;
  category: string;
  required: boolean;
  description: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateSlotId(): string {
  return `slot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function createEmptySlot(): SlotFormData {
  return {
    id: generateSlotId(),
    name: '',
    category: 'diverse',
    required: false,
    description: '',
  };
}

// ============================================================================
// SlotEditor Component
// ============================================================================

interface SlotEditorProps {
  slot: SlotFormData;
  index: number;
  onChange: (slot: SlotFormData) => void;
  onRemove: () => void;
  disabled: boolean;
}

function SlotEditor({ slot, index, onChange, onRemove, disabled }: SlotEditorProps) {
  return (
    <div
      className={cn('p-3 rounded-lg border bg-linear-bg-primary', 'border-linear-border-subtle')}
    >
      <div className="flex items-start gap-3">
        {/* Drag handle placeholder (for future drag-to-reorder) */}
        <div className="pt-2 text-linear-text-muted cursor-grab">
          <GripVertical className="w-4 h-4" />
        </div>

        <div className="flex-1 space-y-3">
          {/* Slot header */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-linear-text-secondary">Slot {index + 1}</span>
            <button
              type="button"
              onClick={onRemove}
              disabled={disabled}
              className={cn(
                'p-1 rounded text-linear-text-tertiary',
                'hover:text-linear-error hover:bg-linear-error/10',
                'transition-colors',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
              title="Elimina slot"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Slot name and category row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-linear-text-secondary mb-1 block">
                Nume <span className="text-linear-error">*</span>
              </label>
              <Input
                value={slot.name}
                onChange={(e) => onChange({ ...slot, name: e.target.value })}
                placeholder="Nume document..."
                disabled={disabled}
                size="sm"
              />
            </div>
            <div>
              <label className="text-xs text-linear-text-secondary mb-1 block">Categorie</label>
              <Select
                value={slot.category}
                onValueChange={(value) => onChange({ ...slot, category: value })}
                disabled={disabled}
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {mapaCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-linear-text-secondary mb-1 block">
              Descriere <span className="text-linear-text-muted">(optional)</span>
            </label>
            <Input
              value={slot.description}
              onChange={(e) => onChange({ ...slot, description: e.target.value })}
              placeholder="Descriere document..."
              disabled={disabled}
              size="sm"
            />
          </div>

          {/* Required checkbox */}
          <div className="flex items-center gap-2">
            <Checkbox
              id={`slot-required-${slot.id}`}
              checked={slot.required}
              onCheckedChange={(checked) => onChange({ ...slot, required: checked === true })}
              disabled={disabled}
            />
            <label
              htmlFor={`slot-required-${slot.id}`}
              className="text-xs text-linear-text-secondary cursor-pointer"
            >
              Document obligatoriu
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CreateTemplateModal Component
// ============================================================================

export function CreateTemplateModal({ open, onOpenChange, onSuccess }: CreateTemplateModalProps) {
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [caseType, setCaseType] = useState('');
  const [slots, setSlots] = useState<SlotFormData[]>([]);

  // Validation state
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Hook
  const { createTemplate, loading, error: createError } = useCreateTemplate();

  // Reset form when modal closes or opens
  useEffect(() => {
    if (!open) {
      // Reset after close animation completes
      const timeout = setTimeout(() => {
        setName('');
        setDescription('');
        setCaseType('');
        setSlots([]);
        setErrors({});
        setSubmitError(null);
      }, 150);
      return () => clearTimeout(timeout);
    }
  }, [open]);

  // Validate form
  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    // Name validation
    const trimmedName = name.trim();
    if (!trimmedName) {
      newErrors.name = 'Numele este obligatoriu';
    } else if (trimmedName.length < 3) {
      newErrors.name = 'Numele trebuie sa contina cel putin 3 caractere';
    }

    // Validate slots have names
    const slotsWithoutNames = slots.filter((s) => !s.name.trim());
    if (slotsWithoutNames.length > 0) {
      newErrors.slots = 'Toate sloturile trebuie sa aiba un nume';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [name, slots]);

  // Add a new slot
  const handleAddSlot = useCallback(() => {
    setSlots((prev) => [...prev, createEmptySlot()]);
  }, []);

  // Update a slot
  const handleSlotChange = useCallback((index: number, updatedSlot: SlotFormData) => {
    setSlots((prev) => {
      const newSlots = [...prev];
      newSlots[index] = updatedSlot;
      return newSlots;
    });
  }, []);

  // Remove a slot
  const handleSlotRemove = useCallback((index: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError(null);

      // Validate form
      if (!validateForm()) {
        return;
      }

      try {
        // Convert form slots to SlotDefinition format
        const slotDefinitions: SlotDefinition[] = slots.map((slot, index) => ({
          name: slot.name.trim(),
          description: slot.description.trim() || undefined,
          category: slot.category,
          required: slot.required,
          order: index,
        }));

        const newTemplate = await createTemplate({
          name: name.trim(),
          description: description.trim() || undefined,
          caseType: caseType.trim() || undefined,
          slotDefinitions,
        });

        if (newTemplate) {
          // Success - close modal and call callback
          onOpenChange(false);
          onSuccess?.(newTemplate);
        } else {
          // Mutation returned null - show generic error
          setSubmitError('Crearea sablonului a esuat. Incercati din nou.');
        }
      } catch (err) {
        // Handle unexpected errors
        setSubmitError(err instanceof Error ? err.message : 'A aparut o eroare neasteptata');
      }
    },
    [validateForm, slots, createTemplate, name, description, caseType, onOpenChange, onSuccess]
  );

  // Get error message from hook or submit error
  const errorMessage = submitError || createError?.message || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Creeaza sablon nou</DialogTitle>
          <DialogDescription>
            Creeaza un sablon personalizat pentru firma ta cu sloturi de documente predefinite.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4 px-6 max-h-[60vh] overflow-y-auto">
            {/* Name Field */}
            <div>
              <label
                htmlFor="template-name"
                className="text-xs text-linear-text-secondary mb-1.5 block font-medium"
              >
                Nume <span className="text-linear-error">*</span>
              </label>
              <Input
                id="template-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) {
                    setErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
                placeholder="Introduceti numele sablonului..."
                disabled={loading}
                error={!!errors.name}
                errorMessage={errors.name}
                autoFocus
              />
            </div>

            {/* Description Field */}
            <div>
              <label
                htmlFor="template-description"
                className="text-xs text-linear-text-secondary mb-1.5 block font-medium"
              >
                Descriere <span className="text-linear-text-muted">(optional)</span>
              </label>
              <TextArea
                id="template-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Introduceti o descriere pentru acest sablon..."
                disabled={loading}
                rows={2}
                resize="none"
              />
            </div>

            {/* Case Type Field */}
            <div>
              <label
                htmlFor="template-case-type"
                className="text-xs text-linear-text-secondary mb-1.5 block font-medium"
              >
                Tip dosar <span className="text-linear-text-muted">(optional)</span>
              </label>
              <Input
                id="template-case-type"
                value={caseType}
                onChange={(e) => setCaseType(e.target.value)}
                placeholder="Ex: Litigii comerciale, Insolvent..."
                disabled={loading}
              />
            </div>

            {/* Slot Definitions Section */}
            <div className="pt-2 border-t border-linear-border-subtle">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs text-linear-text-secondary font-medium">
                  Sloturi documente
                </label>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleAddSlot}
                  disabled={loading}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Adauga slot
                </Button>
              </div>

              {slots.length === 0 ? (
                <div
                  className={cn(
                    'p-4 rounded-lg border-2 border-dashed',
                    'border-linear-border-subtle',
                    'text-center'
                  )}
                >
                  <p className="text-sm text-linear-text-tertiary">
                    Niciun slot definit. Adauga sloturi pentru a defini structura sablonului.
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleAddSlot}
                    disabled={loading}
                    className="mt-3"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Adauga primul slot
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {slots.map((slot, index) => (
                    <SlotEditor
                      key={slot.id}
                      slot={slot}
                      index={index}
                      onChange={(updated) => handleSlotChange(index, updated)}
                      onRemove={() => handleSlotRemove(index)}
                      disabled={loading}
                    />
                  ))}
                </div>
              )}

              {errors.slots && <p className="mt-2 text-xs text-linear-error">{errors.slots}</p>}
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
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Anuleaza
            </Button>
            <Button type="submit" disabled={loading || !name.trim()} loading={loading}>
              {loading ? (
                'Se creeaza...'
              ) : (
                <>
                  <Check className="w-4 h-4 mr-1.5" />
                  Creeaza sablon
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

CreateTemplateModal.displayName = 'CreateTemplateModal';

export default CreateTemplateModal;
