/**
 * CreateTaskModal Component
 * OPS-265: Minimal task creation modal
 *
 * Clean, focused modal for creating tasks with:
 * - Required case selection (CaseCombobox)
 * - Title, due date, estimated hours fields
 * - Collapsible description
 * - Inline subtask builder
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, ChevronDown, ChevronUp, Loader2, Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { clsx } from 'clsx';

import { CaseCombobox } from './CaseCombobox';
import { SubtaskBuilder, type SubtaskDraft } from './SubtaskBuilder';
import {
  useCreateTaskWithSubtasks,
  type CreateTaskInput,
} from '../../hooks/useCreateTaskWithSubtasks';
import { useAuth } from '../../contexts/AuthContext';

// ============================================================================
// Types
// ============================================================================

export interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after successful task creation */
  onSuccess?: () => void;
  /** Pre-select a case ID */
  defaultCaseId?: string;
}

interface FormState {
  caseId: string | null;
  title: string;
  dueDate: string;
  estimatedHours: string;
  description: string;
}

interface FormErrors {
  caseId?: string;
  title?: string;
  dueDate?: string;
  estimatedHours?: string;
}

// ============================================================================
// Component
// ============================================================================

export function CreateTaskModal({
  isOpen,
  onClose,
  onSuccess,
  defaultCaseId,
}: CreateTaskModalProps) {
  const { user } = useAuth();
  const { createTaskWithSubtasks, loading } = useCreateTaskWithSubtasks();

  // Form state
  const [form, setForm] = useState<FormState>({
    caseId: defaultCaseId || null,
    title: '',
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    estimatedHours: '',
    description: '',
  });

  const [subtasks, setSubtasks] = useState<SubtaskDraft[]>([]);
  const [showDescription, setShowDescription] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setForm({
        caseId: defaultCaseId || null,
        title: '',
        dueDate: format(new Date(), 'yyyy-MM-dd'),
        estimatedHours: '',
        description: '',
      });
      setSubtasks([]);
      setShowDescription(false);
      setErrors({});
    }
  }, [isOpen, defaultCaseId]);

  // ============================================================================
  // Form Handlers
  // ============================================================================

  const updateField = useCallback(
    <K extends keyof FormState>(field: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      // Clear error when field changes
      if (errors[field as keyof FormErrors]) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field as keyof FormErrors];
          return next;
        });
      }
    },
    [errors]
  );

  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!form.caseId) {
      newErrors.caseId = 'Selectați un dosar';
    }

    if (!form.title.trim()) {
      newErrors.title = 'Introduceți un titlu';
    }

    if (!form.dueDate) {
      newErrors.dueDate = 'Selectați o dată';
    }

    if (!form.estimatedHours || parseFloat(form.estimatedHours) <= 0) {
      newErrors.estimatedHours = 'Introduceți timpul estimat';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!validate()) return;
      if (!user?.id) return;

      const taskInput: CreateTaskInput = {
        caseId: form.caseId!,
        type: 'Research', // Default type
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        assignedTo: user.id,
        dueDate: form.dueDate,
        priority: 'Medium',
        estimatedHours: parseFloat(form.estimatedHours),
      };

      try {
        await createTaskWithSubtasks(taskInput, subtasks);
        onSuccess?.();
        onClose();
      } catch (err) {
        // Error is handled by the hook, but we could show a toast here
        console.error('Failed to create task:', err);
      }
    },
    [form, subtasks, user?.id, validate, createTaskWithSubtasks, onSuccess, onClose]
  );

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in duration-200" />
        <Dialog.Content
          className={clsx(
            'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
            'bg-white rounded-xl shadow-2xl z-50',
            'w-full max-w-md',
            'animate-in fade-in slide-in-from-bottom-4 duration-200',
            'focus:outline-none'
          )}
          onEscapeKeyDown={onClose}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              Sarcină Nouă
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Închide"
              >
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
            {/* Case Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Dosar <span className="text-red-500">*</span>
              </label>
              <CaseCombobox
                value={form.caseId}
                onChange={(caseId) => updateField('caseId', caseId)}
                required
              />
              {errors.caseId && <p className="mt-1 text-sm text-red-600">{errors.caseId}</p>}
            </div>

            {/* Title */}
            <div>
              <label
                htmlFor="task-title"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Titlu <span className="text-red-500">*</span>
              </label>
              <input
                id="task-title"
                type="text"
                value={form.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="Descrieți sarcina..."
                className={clsx(
                  'w-full px-3 py-2.5 text-sm border rounded-lg',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                  'transition-colors',
                  errors.title
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-200 hover:border-gray-300'
                )}
                disabled={loading}
              />
              {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
            </div>

            {/* Due Date & Estimated Hours Row */}
            <div className="grid grid-cols-2 gap-3">
              {/* Due Date */}
              <div>
                <label
                  htmlFor="task-due-date"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Termen <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="task-due-date"
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => updateField('dueDate', e.target.value)}
                    className={clsx(
                      'w-full pl-9 pr-3 py-2.5 text-sm border rounded-lg',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                      'transition-colors',
                      errors.dueDate
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                    disabled={loading}
                  />
                </div>
                {errors.dueDate && <p className="mt-1 text-sm text-red-600">{errors.dueDate}</p>}
              </div>

              {/* Estimated Hours */}
              <div>
                <label
                  htmlFor="task-hours"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Timp estimat <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="task-hours"
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={form.estimatedHours}
                    onChange={(e) => updateField('estimatedHours', e.target.value)}
                    placeholder="2"
                    className={clsx(
                      'w-full pl-9 pr-12 py-2.5 text-sm border rounded-lg',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                      'transition-colors',
                      errors.estimatedHours
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                    disabled={loading}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                    ore
                  </span>
                </div>
                {errors.estimatedHours && (
                  <p className="mt-1 text-sm text-red-600">{errors.estimatedHours}</p>
                )}
              </div>
            </div>

            {/* Collapsible Description */}
            <div>
              <button
                type="button"
                onClick={() => setShowDescription(!showDescription)}
                className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                {showDescription ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                {showDescription ? 'Ascunde descrierea' : 'Adaugă descriere'}
              </button>

              {showDescription && (
                <div className="mt-2 animate-in slide-in-from-top-2 duration-150">
                  <textarea
                    value={form.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    placeholder="Descriere opțională..."
                    rows={3}
                    className={clsx(
                      'w-full px-3 py-2.5 text-sm border rounded-lg',
                      'border-gray-200 hover:border-gray-300',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                      'resize-none transition-colors'
                    )}
                    disabled={loading}
                  />
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-gray-100 pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Sub-sarcini</h4>
              <SubtaskBuilder subtasks={subtasks} onChange={setSubtasks} disabled={loading} />
            </div>
          </form>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className={clsx(
                'px-4 py-2 text-sm font-medium text-gray-700',
                'border border-gray-300 rounded-lg',
                'hover:bg-gray-100 transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              Anulează
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={loading}
              className={clsx(
                'px-4 py-2 text-sm font-medium text-white',
                'bg-blue-600 rounded-lg',
                'hover:bg-blue-700 transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'flex items-center gap-2'
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creare...
                </>
              ) : (
                'Creează'
              )}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

CreateTaskModal.displayName = 'CreateTaskModal';

export default CreateTaskModal;
