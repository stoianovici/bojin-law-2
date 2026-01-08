'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { AlertCircle, Check, ChevronDown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
} from '@/components/ui';
import { TextArea } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAddSlot } from '@/hooks/useMapa';
import { mapaCategories } from '@/types/mapa';
import type { MapaSlot, MapaCategoryId } from '@/types/mapa';

// ============================================================================
// Types
// ============================================================================

export interface AddSlotModalProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Mapa ID to add the slot to */
  mapaId: string;
  /** Callback when slot is successfully created */
  onSuccess?: (slot: MapaSlot) => void;
}

interface FormErrors {
  name?: string;
  category?: string;
}

// ============================================================================
// AddSlotModal Component
// ============================================================================

export function AddSlotModal({ open, onOpenChange, mapaId, onSuccess }: AddSlotModalProps) {
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<MapaCategoryId>('diverse');
  const [required, setRequired] = useState(false);

  // Validation state
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Hooks
  const { addSlot, loading, error: addSlotError } = useAddSlot();

  // Reset form when modal closes or opens
  useEffect(() => {
    if (!open) {
      // Reset after close animation completes
      const timeout = setTimeout(() => {
        setName('');
        setDescription('');
        setCategory('diverse');
        setRequired(false);
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
    } else if (trimmedName.length < 2) {
      newErrors.name = 'Numele trebuie sa contina cel putin 2 caractere';
    }

    // Category validation
    if (!category) {
      newErrors.category = 'Categoria este obligatorie';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [name, category]);

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
        const newSlot = await addSlot(mapaId, {
          name: name.trim(),
          description: description.trim() || undefined,
          category,
          required,
        });

        if (newSlot) {
          // Success - close modal and call callback
          onOpenChange(false);
          onSuccess?.(newSlot);
        } else {
          // Mutation returned null - show generic error
          setSubmitError('Adaugarea slotului a esuat. Incercati din nou.');
        }
      } catch (err) {
        // Handle unexpected errors
        setSubmitError(err instanceof Error ? err.message : 'A aparut o eroare neasteptata');
      }
    },
    [validateForm, addSlot, mapaId, name, description, category, required, onOpenChange, onSuccess]
  );

  // Get error message from hooks or submit error
  const errorMessage = submitError || addSlotError?.message || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Adauga slot nou</DialogTitle>
          <DialogDescription>
            Adaugati un slot nou pentru a organiza documentele in mapa.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4 px-6">
            {/* Name Field */}
            <div>
              <label
                htmlFor="slot-name"
                className="text-xs text-linear-text-secondary mb-1.5 block font-medium"
              >
                Nume <span className="text-linear-error">*</span>
              </label>
              <Input
                id="slot-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) {
                    setErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
                placeholder="Introduceti numele slotului..."
                disabled={loading}
                error={!!errors.name}
                errorMessage={errors.name}
                autoFocus
              />
            </div>

            {/* Description Field */}
            <div>
              <label
                htmlFor="slot-description"
                className="text-xs text-linear-text-secondary mb-1.5 block font-medium"
              >
                Descriere <span className="text-linear-text-muted">(optional)</span>
              </label>
              <TextArea
                id="slot-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Introduceti o descriere pentru acest slot..."
                disabled={loading}
                rows={2}
                resize="none"
              />
            </div>

            {/* Category Selector */}
            <div>
              <label
                htmlFor="slot-category"
                className="text-xs text-linear-text-secondary mb-1.5 block font-medium"
              >
                Categorie <span className="text-linear-error">*</span>
              </label>
              <div className="relative">
                <select
                  id="slot-category"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value as MapaCategoryId);
                    if (errors.category) {
                      setErrors((prev) => ({ ...prev, category: undefined }));
                    }
                  }}
                  disabled={loading}
                  className={cn(
                    'w-full h-9 px-3 pr-8 rounded-md',
                    'bg-linear-bg-secondary border border-linear-border-subtle',
                    'text-sm text-linear-text-primary',
                    'focus:outline-none focus:ring-2 focus:ring-linear-accent/50 focus:border-linear-accent',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'appearance-none cursor-pointer',
                    errors.category && 'border-linear-error focus:ring-linear-error/50'
                  )}
                >
                  {mapaCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-linear-text-tertiary pointer-events-none" />
              </div>
              {errors.category && (
                <p className="mt-1 text-xs text-linear-error">{errors.category}</p>
              )}
            </div>

            {/* Required Checkbox */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="slot-required"
                checked={required}
                onChange={(e) => setRequired(e.target.checked)}
                disabled={loading}
                className={cn(
                  'h-4 w-4 rounded border-linear-border-subtle',
                  'bg-linear-bg-secondary text-linear-accent',
                  'focus:ring-2 focus:ring-linear-accent/50 focus:ring-offset-0',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'cursor-pointer'
                )}
              />
              <label
                htmlFor="slot-required"
                className="text-sm text-linear-text-secondary cursor-pointer select-none"
              >
                Obligatoriu
              </label>
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
                'Se adauga...'
              ) : (
                <>
                  <Check className="w-4 h-4 mr-1.5" />
                  Adauga slot
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

AddSlotModal.displayName = 'AddSlotModal';

export default AddSlotModal;
