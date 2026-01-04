'use client';

import { useState, useCallback, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  TextArea,
} from '@/components/ui';
import { useUpdateMapa } from '@/hooks/useMapa';
import type { Mapa } from '@/types/mapa';

// ============================================================================
// Types
// ============================================================================

export interface EditMapaModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal open state changes */
  onOpenChange: (open: boolean) => void;
  /** The mapa to edit */
  mapa: Mapa;
  /** Optional callback on successful update */
  onSuccess?: (mapa: Mapa) => void;
}

// ============================================================================
// Validation
// ============================================================================

interface FormErrors {
  name?: string;
}

function validateForm(name: string): FormErrors {
  const errors: FormErrors = {};

  if (!name.trim()) {
    errors.name = 'Numele este obligatoriu';
  } else if (name.trim().length < 3) {
    errors.name = 'Numele trebuie sa aiba cel putin 3 caractere';
  }

  return errors;
}

// ============================================================================
// Component
// ============================================================================

export function EditMapaModal({ open, onOpenChange, mapa, onSuccess }: EditMapaModalProps) {
  // Form state - pre-populated with existing values
  const [name, setName] = useState(mapa.name);
  const [description, setDescription] = useState(mapa.description || '');

  // Validation state
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // API state
  const { updateMapa, loading, error: apiError } = useUpdateMapa();

  // Reset form when mapa changes or modal opens
  useEffect(() => {
    if (open) {
      setName(mapa.name);
      setDescription(mapa.description || '');
      setErrors({});
      setTouched({});
    }
  }, [open, mapa]);

  // Handle field blur for validation
  const handleBlur = useCallback(
    (field: string) => {
      setTouched((prev) => ({ ...prev, [field]: true }));

      if (field === 'name') {
        const fieldErrors = validateForm(name);
        setErrors((prev) => ({ ...prev, name: fieldErrors.name }));
      }
    },
    [name]
  );

  // Handle name change with live validation
  const handleNameChange = useCallback(
    (value: string) => {
      setName(value);

      // Clear error when user starts typing (if previously touched)
      if (touched.name) {
        const fieldErrors = validateForm(value);
        setErrors((prev) => ({ ...prev, name: fieldErrors.name }));
      }
    },
    [touched.name]
  );

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Validate all fields
      const formErrors = validateForm(name);
      setErrors(formErrors);
      setTouched({ name: true });

      // Don't submit if there are errors
      if (Object.keys(formErrors).length > 0) {
        return;
      }

      // Prepare update input - only send changed fields
      const input: { name?: string; description?: string } = {};

      if (name.trim() !== mapa.name) {
        input.name = name.trim();
      }

      if (description.trim() !== (mapa.description || '')) {
        input.description = description.trim() || undefined;
      }

      // Skip API call if nothing changed
      if (Object.keys(input).length === 0) {
        onOpenChange(false);
        return;
      }

      // Call update mutation
      const result = await updateMapa(mapa.id, input);

      if (result) {
        // Optimistic update - create updated mapa object
        const updatedMapa: Mapa = {
          ...mapa,
          name: name.trim(),
          description: description.trim() || undefined,
          updatedAt: new Date().toISOString(),
        };

        // Call success callback
        onSuccess?.(updatedMapa);

        // Close modal
        onOpenChange(false);
      }
    },
    [name, description, mapa, updateMapa, onSuccess, onOpenChange]
  );

  // Handle cancel
  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  // Check if form has changes
  const hasChanges = name.trim() !== mapa.name || description.trim() !== (mapa.description || '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Editeaza Mapa</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {/* Name Field */}
          <div>
            <label htmlFor="mapa-name" className="text-xs text-linear-text-secondary mb-1.5 block">
              Nume <span className="text-linear-error">*</span>
            </label>
            <Input
              id="mapa-name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              onBlur={() => handleBlur('name')}
              placeholder="Numele mapei"
              disabled={loading}
              error={touched.name && !!errors.name}
              errorMessage={touched.name ? errors.name : undefined}
              autoFocus
            />
          </div>

          {/* Description Field */}
          <div>
            <label
              htmlFor="mapa-description"
              className="text-xs text-linear-text-secondary mb-1.5 block"
            >
              Descriere
            </label>
            <TextArea
              id="mapa-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrierea mapei (optional)"
              disabled={loading}
              rows={3}
              resize="vertical"
            />
          </div>

          {/* API Error Display */}
          {apiError && (
            <div
              className={cn(
                'p-3 rounded-lg text-sm',
                'bg-linear-error/10 border border-linear-error/30',
                'text-linear-error'
              )}
            >
              {apiError.message || 'A aparut o eroare. Va rugam incercati din nou.'}
            </div>
          )}
        </form>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={handleCancel} disabled={loading}>
            Anuleaza
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={loading || !hasChanges || (touched.name && !!errors.name)}
            loading={loading}
          >
            {loading ? 'Se salveaza...' : 'Salveaza'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

EditMapaModal.displayName = 'EditMapaModal';

export default EditMapaModal;
