'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Mail, Calendar, Send, AlertCircle, User, FileText, Clock } from 'lucide-react';
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
import { useCreateDocumentRequest } from '@/hooks/useMapa';
import type { MapaSlot, DocumentRequest } from '@/types/mapa';

// ============================================================================
// Types
// ============================================================================

export interface RequestDocumentModalProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** The slot to request a document for */
  slot: MapaSlot;
  /** Callback when request is successfully created */
  onSuccess?: (request: DocumentRequest) => void;
}

interface FormErrors {
  email?: string;
  dueDate?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Validates email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Gets default due date (7 days from now)
 */
function getDefaultDueDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().split('T')[0];
}

/**
 * Formats date for display
 */
function formatDateForDisplay(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ro-RO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ============================================================================
// RequestDocumentModal Component
// ============================================================================

export function RequestDocumentModal({
  open,
  onOpenChange,
  slot,
  onSuccess,
}: RequestDocumentModalProps) {
  // Form state
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [dueDate, setDueDate] = useState(getDefaultDueDate);

  // Validation state
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Preview state
  const [showPreview, setShowPreview] = useState(false);

  // API hook
  const { createRequest, loading, error: apiError } = useCreateDocumentRequest();

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      const timeout = setTimeout(() => {
        setEmail('');
        setName('');
        setMessage('');
        setDueDate(getDefaultDueDate());
        setErrors({});
        setTouched({});
        setSubmitError(null);
        setShowPreview(false);
      }, 150);
      return () => clearTimeout(timeout);
    }
  }, [open]);

  // Validate form
  const validateForm = useCallback((): FormErrors => {
    const newErrors: FormErrors = {};

    // Email validation
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      newErrors.email = 'Adresa de email este obligatorie';
    } else if (!isValidEmail(trimmedEmail)) {
      newErrors.email = 'Adresa de email nu este valida';
    }

    // Due date validation
    if (!dueDate) {
      newErrors.dueDate = 'Data limita este obligatorie';
    } else {
      const selectedDate = new Date(dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        newErrors.dueDate = 'Data limita trebuie sa fie in viitor';
      }
    }

    return newErrors;
  }, [email, dueDate]);

  // Handle field blur for validation
  const handleBlur = useCallback(
    (field: string) => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      const formErrors = validateForm();
      setErrors((prev) => ({ ...prev, [field]: formErrors[field as keyof FormErrors] }));
    },
    [validateForm]
  );

  // Handle email change with live validation
  const handleEmailChange = useCallback(
    (value: string) => {
      setEmail(value);
      if (touched.email) {
        const trimmedValue = value.trim();
        if (!trimmedValue) {
          setErrors((prev) => ({ ...prev, email: 'Adresa de email este obligatorie' }));
        } else if (!isValidEmail(trimmedValue)) {
          setErrors((prev) => ({ ...prev, email: 'Adresa de email nu este valida' }));
        } else {
          setErrors((prev) => ({ ...prev, email: undefined }));
        }
      }
    },
    [touched.email]
  );

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError(null);

      // Validate all fields
      const formErrors = validateForm();
      setErrors(formErrors);
      setTouched({ email: true, dueDate: true });

      // Don't submit if there are errors
      if (Object.keys(formErrors).length > 0) {
        return;
      }

      // Create the request
      const result = await createRequest({
        slotId: slot.id,
        recipientEmail: email.trim(),
        recipientName: name.trim() || undefined,
        message: message.trim() || undefined,
        dueDate: dueDate,
      });

      if (result) {
        // Success - close modal and call callback
        onOpenChange(false);
        onSuccess?.(result);
      } else {
        // Show error
        setSubmitError('Nu s-a putut trimite solicitarea. Va rugam incercati din nou.');
      }
    },
    [validateForm, createRequest, slot.id, email, name, message, dueDate, onOpenChange, onSuccess]
  );

  // Calculate minimum date (today)
  const minDate = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  // Get error message
  const errorMessage = submitError || apiError?.message || null;

  // Check if form is valid for submission
  const isFormValid = email.trim() && isValidEmail(email.trim()) && dueDate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Solicita Document</DialogTitle>
          <DialogDescription>Trimite o solicitare pentru documentul necesar.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4 px-6">
            {/* Slot Info */}
            <div
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg',
                'bg-linear-bg-tertiary border border-linear-border-subtle'
              )}
            >
              <FileText className="w-5 h-5 text-linear-accent flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-linear-text-primary">{slot.name}</h4>
                {slot.description && (
                  <p className="text-xs text-linear-text-tertiary mt-0.5 line-clamp-2">
                    {slot.description}
                  </p>
                )}
                {slot.required && (
                  <span className="inline-block mt-1.5 text-xs text-linear-warning font-medium">
                    Document obligatoriu
                  </span>
                )}
              </div>
            </div>

            {/* Email Field */}
            <div>
              <label
                htmlFor="recipient-email"
                className="text-xs text-linear-text-secondary mb-1.5 block font-medium"
              >
                Email destinatar <span className="text-linear-error">*</span>
              </label>
              <Input
                id="recipient-email"
                type="email"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                onBlur={() => handleBlur('email')}
                placeholder="exemplu@email.com"
                disabled={loading}
                error={touched.email && !!errors.email}
                errorMessage={touched.email ? errors.email : undefined}
                leftAddon={<Mail className="w-4 h-4" />}
                autoFocus
              />
            </div>

            {/* Name Field (optional) */}
            <div>
              <label
                htmlFor="recipient-name"
                className="text-xs text-linear-text-secondary mb-1.5 block font-medium"
              >
                Nume destinatar <span className="text-linear-text-muted">(optional)</span>
              </label>
              <Input
                id="recipient-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Numele persoanei"
                disabled={loading}
                leftAddon={<User className="w-4 h-4" />}
              />
            </div>

            {/* Due Date Field */}
            <div>
              <label
                htmlFor="due-date"
                className="text-xs text-linear-text-secondary mb-1.5 block font-medium"
              >
                Data limita <span className="text-linear-error">*</span>
              </label>
              <Input
                id="due-date"
                type="date"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  if (touched.dueDate) {
                    const selectedDate = new Date(e.target.value);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (selectedDate < today) {
                      setErrors((prev) => ({
                        ...prev,
                        dueDate: 'Data limita trebuie sa fie in viitor',
                      }));
                    } else {
                      setErrors((prev) => ({ ...prev, dueDate: undefined }));
                    }
                  }
                }}
                onBlur={() => handleBlur('dueDate')}
                min={minDate}
                disabled={loading}
                error={touched.dueDate && !!errors.dueDate}
                errorMessage={touched.dueDate ? errors.dueDate : undefined}
                leftAddon={<Calendar className="w-4 h-4" />}
              />
            </div>

            {/* Message Field (optional) */}
            <div>
              <label
                htmlFor="request-message"
                className="text-xs text-linear-text-secondary mb-1.5 block font-medium"
              >
                Mesaj personalizat <span className="text-linear-text-muted">(optional)</span>
              </label>
              <TextArea
                id="request-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Adaugati un mesaj pentru destinatar..."
                disabled={loading}
                rows={3}
                resize="none"
              />
            </div>

            {/* Preview Toggle */}
            {isFormValid && !showPreview && (
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                className={cn(
                  'w-full text-left text-sm text-linear-accent hover:text-linear-accent-hover',
                  'flex items-center gap-2 py-2 transition-colors'
                )}
              >
                <Clock className="w-4 h-4" />
                Previzualizeaza solicitarea
              </button>
            )}

            {/* Preview Section */}
            {showPreview && (
              <div
                className={cn(
                  'p-4 rounded-lg border',
                  'bg-linear-bg-tertiary border-linear-border-subtle'
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-linear-text-primary">
                    Previzualizare solicitare
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowPreview(false)}
                    className="text-xs text-linear-text-tertiary hover:text-linear-text-secondary"
                  >
                    Ascunde
                  </button>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex gap-2">
                    <span className="text-linear-text-tertiary">Catre:</span>
                    <span className="text-linear-text-primary">
                      {name.trim() ? `${name.trim()} <${email.trim()}>` : email.trim()}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-linear-text-tertiary">Document:</span>
                    <span className="text-linear-text-primary">{slot.name}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-linear-text-tertiary">Termen:</span>
                    <span className="text-linear-text-primary">
                      {formatDateForDisplay(dueDate)}
                    </span>
                  </div>
                  {message.trim() && (
                    <div className="pt-2 border-t border-linear-border-subtle mt-2">
                      <span className="text-linear-text-tertiary block mb-1">Mesaj:</span>
                      <p className="text-linear-text-secondary whitespace-pre-wrap">
                        {message.trim()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

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
            <Button type="submit" disabled={loading || !isFormValid} loading={loading}>
              {loading ? (
                'Se trimite...'
              ) : (
                <>
                  <Send className="w-4 h-4 mr-1.5" />
                  Trimite solicitarea
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

RequestDocumentModal.displayName = 'RequestDocumentModal';

export default RequestDocumentModal;
