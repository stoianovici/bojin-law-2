'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { FileText, Loader2, AlertCircle, X, Check } from 'lucide-react';
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
import { useCreateMapa } from '@/hooks/useMapa';
import { useCreateMapaFromTemplate } from '@/hooks/useTemplates';
import { TemplatePicker } from './TemplatePicker';
import type { Mapa, MapaTemplate } from '@/types/mapa';

// ============================================================================
// Types
// ============================================================================

export interface CreateMapaModalProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Case ID to associate the mapa with (for case-level mapa) */
  caseId?: string;
  /** Client ID to associate the mapa with (for client-level mapa) */
  clientId?: string;
  /** Callback when mapa is successfully created */
  onSuccess?: (mapa: Mapa) => void;
}

interface FormErrors {
  name?: string;
}

// ============================================================================
// CreateMapaModal Component
// ============================================================================

export function CreateMapaModal({
  open,
  onOpenChange,
  caseId,
  clientId,
  onSuccess,
}: CreateMapaModalProps) {
  // Debug: log the caseId/clientId being passed
  console.log('[CreateMapaModal] caseId prop:', caseId, 'clientId prop:', clientId);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<MapaTemplate | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);

  // Validation state
  const [errors, setErrors] = useState<FormErrors>({});

  // Hooks
  const { createMapa, loading: creatingMapa, error: createMapaError } = useCreateMapa();
  const {
    createFromTemplate,
    loading: creatingFromTemplate,
    error: createFromTemplateError,
  } = useCreateMapaFromTemplate();

  const isLoading = creatingMapa || creatingFromTemplate;

  // Reset form when modal closes or opens
  useEffect(() => {
    if (!open) {
      // Reset after close animation completes
      const timeout = setTimeout(() => {
        setName('');
        setDescription('');
        setSelectedTemplate(null);
        setErrors({});
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
      newErrors.name = 'Numele trebuie să conțină cel puțin 3 caractere';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [name]);

  // Handle template selection from picker
  const handleTemplateSelect = useCallback(
    (template: MapaTemplate) => {
      setSelectedTemplate(template);
      // Auto-fill name from template if empty
      if (!name.trim()) {
        setName(template.name);
      }
      // Auto-fill description from template if empty
      if (!description.trim() && template.description) {
        setDescription(template.description);
      }
    },
    [name, description]
  );

  // Clear selected template
  const handleClearTemplate = useCallback(() => {
    setSelectedTemplate(null);
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Validate form
      if (!validateForm()) {
        return;
      }

      let newMapa: Mapa | null = null;

      if (selectedTemplate) {
        // Create from template (supports both case-level and client-level)
        newMapa = await createFromTemplate({
          templateId: selectedTemplate.id,
          caseId,
          clientId,
          name: name.trim(),
          description: description.trim() || undefined,
        });
      } else {
        // Create blank mapa
        const input = {
          ...(caseId ? { caseId } : { clientId }),
          name: name.trim(),
          description: description.trim() || undefined,
        };
        console.log('[CreateMapaModal] createMapa input:', JSON.stringify(input, null, 2));
        newMapa = await createMapa(input);
      }

      if (newMapa) {
        // Success - close modal and call callback
        onOpenChange(false);
        onSuccess?.(newMapa);
      }
      // If newMapa is null, the hook will have set the error
    },
    [
      validateForm,
      selectedTemplate,
      createFromTemplate,
      createMapa,
      caseId,
      clientId,
      name,
      description,
      onOpenChange,
      onSuccess,
    ]
  );

  // Get error message from hooks
  const errorMessage = createMapaError?.message || createFromTemplateError?.message || null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="md" data-tutorial="mapa-modal">
          <DialogHeader>
            <DialogTitle>Creează o mapă nouă</DialogTitle>
            <DialogDescription>
              {clientId
                ? 'Creați o mapă nouă pentru a organiza documentele clientului.'
                : 'Creați o mapă nouă pentru a organiza documentele dosarului.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4 px-6">
              {/* Name Field */}
              <div>
                <label
                  htmlFor="mapa-name"
                  className="text-xs text-linear-text-secondary mb-1.5 block font-medium"
                >
                  Nume <span className="text-linear-error">*</span>
                </label>
                <Input
                  id="mapa-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) {
                      setErrors((prev) => ({ ...prev, name: undefined }));
                    }
                  }}
                  placeholder="Introduceți numele mapei..."
                  disabled={isLoading}
                  error={!!errors.name}
                  errorMessage={errors.name}
                  autoFocus
                />
              </div>

              {/* Description Field */}
              <div>
                <label
                  htmlFor="mapa-description"
                  className="text-xs text-linear-text-secondary mb-1.5 block font-medium"
                >
                  Descriere <span className="text-linear-text-muted">(opțional)</span>
                </label>
                <TextArea
                  id="mapa-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Introduceți o descriere pentru această mapă..."
                  disabled={isLoading}
                  rows={2}
                  resize="none"
                />
              </div>

              {/* Template Selection */}
              <div className="pt-2 border-t border-linear-border-subtle">
                <label className="text-xs text-linear-text-secondary mb-1.5 block font-medium">
                  Șablon <span className="text-linear-text-muted">(opțional)</span>
                </label>
                {selectedTemplate ? (
                  // Selected template preview
                  <div
                    className={cn(
                      'p-3 rounded-lg border',
                      'bg-linear-accent/5 border-linear-accent/30'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-medium text-linear-text-primary truncate">
                            {selectedTemplate.name}
                          </h4>
                          {selectedTemplate.isONRC && (
                            <Badge variant="info" size="sm">
                              ONRC
                            </Badge>
                          )}
                        </div>
                        {selectedTemplate.description && (
                          <p className="text-xs text-linear-text-tertiary line-clamp-2 mb-2">
                            {selectedTemplate.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-linear-text-secondary">
                          <span>{selectedTemplate.slotDefinitions?.length ?? 0} sloturi</span>
                          <span className="text-linear-text-muted">|</span>
                          <span>
                            {selectedTemplate.slotDefinitions?.filter((s) => s.required).length ??
                              0}{' '}
                            obligatorii
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearTemplate}
                        disabled={isLoading}
                        className={cn(
                          'p-1 rounded-md text-linear-text-tertiary',
                          'hover:text-linear-text-primary hover:bg-linear-bg-hover',
                          'transition-colors',
                          isLoading && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setTemplatePickerOpen(true)}
                      disabled={isLoading}
                      className="mt-3 w-full"
                    >
                      Schimbă șablonul
                    </Button>
                  </div>
                ) : (
                  // No template selected - show button to open picker
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setTemplatePickerOpen(true)}
                    disabled={isLoading}
                    className="w-full"
                    data-tutorial="select-sablon"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Selectează șablon
                  </Button>
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
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Anulează
              </Button>
              <Button type="submit" disabled={isLoading || !name.trim()} loading={isLoading}>
                {isLoading ? (
                  'Se creează...'
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-1.5" />
                    Creează mapă
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Template Picker Modal */}
      <TemplatePicker
        open={templatePickerOpen}
        onOpenChange={setTemplatePickerOpen}
        onSelect={handleTemplateSelect}
      />
    </>
  );
}

CreateMapaModal.displayName = 'CreateMapaModal';

export default CreateMapaModal;
