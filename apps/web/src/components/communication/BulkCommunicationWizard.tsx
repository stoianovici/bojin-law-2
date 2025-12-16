/**
 * Bulk Communication Wizard Component
 * Story 5.5: Multi-Channel Communication Hub (AC: 3)
 *
 * Multi-step wizard for creating and sending bulk communications
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  useCreateBulkCommunication,
  useSendBulkCommunication,
  useRecipientTypes,
  useBulkCommunicationStatuses,
  type BulkRecipientType,
  type CommunicationChannel,
  type RecipientFilter,
  type CustomRecipient,
} from '@/hooks/useBulkCommunication';
import { useTemplates, type CommunicationTemplate } from '@/hooks/useCommunicationTemplates';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Users,
  FileText,
  Send,
  Calendar,
  Check,
  AlertCircle,
  Loader2,
  Clock,
  Mail,
  Building,
} from 'lucide-react';
import { RecipientSelector } from './RecipientSelector';
import { BulkProgressIndicator } from './BulkProgressIndicator';

// ============================================================================
// Types
// ============================================================================

interface BulkCommunicationWizardProps {
  caseId?: string;
  onClose?: () => void;
  onComplete?: (id: string) => void;
  className?: string;
}

type WizardStep = 'recipients' | 'compose' | 'review' | 'confirm';

interface WizardState {
  recipientType: BulkRecipientType;
  recipientFilter: RecipientFilter;
  resolvedRecipients: CustomRecipient[];
  templateId?: string;
  subject: string;
  body: string;
  channelType: CommunicationChannel;
  scheduledFor?: string;
  useSchedule: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const STEPS: { id: WizardStep; label: string; icon: React.ReactNode }[] = [
  { id: 'recipients', label: 'Recipients', icon: <Users className="h-4 w-4" /> },
  { id: 'compose', label: 'Compose', icon: <FileText className="h-4 w-4" /> },
  { id: 'review', label: 'Review', icon: <Check className="h-4 w-4" /> },
  { id: 'confirm', label: 'Send', icon: <Send className="h-4 w-4" /> },
];

const INITIAL_STATE: WizardState = {
  recipientType: 'CaseClients',
  recipientFilter: {},
  resolvedRecipients: [],
  subject: '',
  body: '',
  channelType: 'Email',
  useSchedule: false,
};

// ============================================================================
// Component
// ============================================================================

export function BulkCommunicationWizard({
  caseId,
  onClose,
  onComplete,
  className = '',
}: BulkCommunicationWizardProps) {
  // State
  const [currentStep, setCurrentStep] = useState<WizardStep>('recipients');
  const [state, setState] = useState<WizardState>({
    ...INITIAL_STATE,
    recipientFilter: caseId ? { caseIds: [caseId] } : {},
  });
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Hooks
  const { create, loading: creating, error: createError } = useCreateBulkCommunication();
  const { send, loading: sending, error: sendError } = useSendBulkCommunication();
  const { templates } = useTemplates({ channelType: state.channelType });
  const { getRecipientTypeLabel } = useRecipientTypes();
  const { getStatusLabel, getStatusColor } = useBulkCommunicationStatuses();

  const error = createError || sendError;

  // Current step index
  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);

  // Validation
  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 'recipients':
        return state.resolvedRecipients.length > 0;
      case 'compose':
        return state.subject.trim() !== '' && state.body.trim() !== '';
      case 'review':
        return true;
      case 'confirm':
        return !isSending;
      default:
        return false;
    }
  }, [currentStep, state, isSending]);

  // Navigation
  const goNext = useCallback(() => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id);
    }
  }, [currentStepIndex]);

  const goBack = useCallback(() => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id);
    }
  }, [currentStepIndex]);

  // Update state
  const updateState = useCallback((updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  // Handle template selection
  const handleTemplateSelect = useCallback(
    (template: CommunicationTemplate) => {
      updateState({
        templateId: template.id,
        subject: template.subject || '',
        body: template.body,
      });
    },
    [updateState]
  );

  // Handle send
  const handleSend = useCallback(async () => {
    setIsSending(true);

    try {
      // Create bulk communication
      const result = await create({
        caseId,
        templateId: state.templateId,
        subject: state.subject,
        body: state.body,
        channelType: state.channelType,
        recipientType: state.recipientType,
        recipientFilter: state.recipientFilter,
        scheduledFor: state.useSchedule ? state.scheduledFor : undefined,
      });

      setCreatedId(result.id);

      // Send immediately if not scheduled
      if (!state.useSchedule) {
        await send(result.id);
      }

      onComplete?.(result.id);
    } catch (err) {
      setIsSending(false);
    }
  }, [create, send, caseId, state, onComplete]);

  // Save as draft
  const handleSaveDraft = useCallback(async () => {
    try {
      const result = await create({
        caseId,
        templateId: state.templateId,
        subject: state.subject,
        body: state.body,
        channelType: state.channelType,
        recipientType: state.recipientType,
        recipientFilter: state.recipientFilter,
      });

      onComplete?.(result.id);
    } catch (err) {
      // Error handled by hook
    }
  }, [create, caseId, state, onComplete]);

  // If sending/sent, show progress
  if (createdId && isSending) {
    return (
      <div className={`flex flex-col ${className}`}>
        <div className="flex items-center justify-between border-b pb-4">
          <h2 className="text-lg font-semibold text-gray-900">Sending Communications</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 py-8">
          <BulkProgressIndicator id={createdId} onComplete={onClose} />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col ${className}`}
      role="dialog"
      aria-labelledby="wizard-title"
      aria-describedby="wizard-description"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 id="wizard-title" className="text-lg font-semibold text-gray-900">
            Bulk Communication
          </h2>
          <p id="wizard-description" className="text-sm text-gray-500">
            Send messages to multiple recipients at once
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
          aria-label="Close wizard"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Step Indicator */}
      <div className="border-b py-4" role="navigation" aria-label="Wizard steps">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const isActive = step.id === currentStep;
            const isCompleted = index < currentStepIndex;

            return (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => index < currentStepIndex && setCurrentStep(step.id)}
                  disabled={index > currentStepIndex}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : isCompleted
                        ? 'text-blue-600 hover:bg-blue-50'
                        : 'text-gray-400'
                  }`}
                  aria-current={isActive ? 'step' : undefined}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : isCompleted
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {isCompleted ? <Check className="h-3 w-3" /> : index + 1}
                  </span>
                  <span className="hidden sm:inline">{step.label}</span>
                </button>
                {index < STEPS.length - 1 && (
                  <div
                    className={`h-px flex-1 ${
                      index < currentStepIndex ? 'bg-blue-200' : 'bg-gray-200'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
        <div className="sr-only" aria-live="polite">
          Step {currentStepIndex + 1} of {STEPS.length}: {STEPS[currentStepIndex].label}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-4 mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error.message}
        </div>
      )}

      {/* Step Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Step 1: Recipients */}
        {currentStep === 'recipients' && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-900">Select Recipients</h3>
            <RecipientSelector
              recipientType={state.recipientType}
              recipientFilter={state.recipientFilter}
              onRecipientTypeChange={(type) => updateState({ recipientType: type })}
              onFilterChange={(filter) => updateState({ recipientFilter: filter })}
              onRecipientsResolved={(recipients) => updateState({ resolvedRecipients: recipients })}
              caseId={caseId}
            />
            {state.resolvedRecipients.length > 0 && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                <Users className="mr-2 inline h-4 w-4" />
                {state.resolvedRecipients.length} recipient
                {state.resolvedRecipients.length !== 1 ? 's' : ''} selected
              </div>
            )}
          </div>
        )}

        {/* Step 2: Compose */}
        {currentStep === 'compose' && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-900">Compose Message</h3>

            {/* Template Selection */}
            {templates.length > 0 && (
              <div>
                <label className="mb-1 block text-sm text-gray-600">
                  Use a Template (optional)
                </label>
                <select
                  value={state.templateId || ''}
                  onChange={(e) => {
                    const template = templates.find((t) => t.id === e.target.value);
                    if (template) {
                      handleTemplateSelect(template);
                    } else {
                      updateState({ templateId: undefined });
                    }
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Select a template...</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Subject */}
            <div>
              <label htmlFor="subject" className="mb-1 block text-sm font-medium text-gray-700">
                Subject *
              </label>
              <input
                id="subject"
                type="text"
                value={state.subject}
                onChange={(e) => updateState({ subject: e.target.value })}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="Enter subject line"
              />
            </div>

            {/* Body */}
            <div>
              <label htmlFor="body" className="mb-1 block text-sm font-medium text-gray-700">
                Message *
              </label>
              <textarea
                id="body"
                value={state.body}
                onChange={(e) => updateState({ body: e.target.value })}
                required
                rows={8}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="Enter your message..."
              />
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {currentStep === 'review' && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-900">Review Communication</h3>

            {/* Summary */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Users className="mt-0.5 h-4 w-4 text-gray-400" />
                <div>
                  <div className="text-sm font-medium text-gray-700">Recipients</div>
                  <div className="text-sm text-gray-600">
                    {getRecipientTypeLabel(state.recipientType)} - {state.resolvedRecipients.length}{' '}
                    recipient
                    {state.resolvedRecipients.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 text-gray-400" />
                <div>
                  <div className="text-sm font-medium text-gray-700">Subject</div>
                  <div className="text-sm text-gray-600">{state.subject}</div>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div>
              <h4 className="mb-2 text-sm font-medium text-gray-700">Message Preview</h4>
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="whitespace-pre-wrap text-sm text-gray-700">{state.body}</div>
              </div>
            </div>

            {/* Recipient List */}
            <div>
              <h4 className="mb-2 text-sm font-medium text-gray-700">
                Recipients ({state.resolvedRecipients.length})
              </h4>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200">
                {state.resolvedRecipients.map((recipient, index) => (
                  <div
                    key={recipient.id || index}
                    className="flex items-center gap-2 border-b border-gray-100 px-3 py-2 last:border-b-0"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-600">
                      {recipient.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm font-medium text-gray-900">
                        {recipient.name}
                      </div>
                      <div className="truncate text-xs text-gray-500">{recipient.email}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Confirm */}
        {currentStep === 'confirm' && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-900">Confirm & Send</h3>

            {/* Summary Card */}
            <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
              <div className="text-center">
                <div className="mb-2 text-4xl font-bold text-blue-700">
                  {state.resolvedRecipients.length}
                </div>
                <div className="text-sm text-blue-600">
                  {state.resolvedRecipients.length === 1 ? 'Recipient' : 'Recipients'}
                </div>
              </div>
            </div>

            {/* Schedule Option */}
            <div className="rounded-lg border border-gray-200 p-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={state.useSchedule}
                  onChange={(e) => updateState({ useSchedule: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <Clock className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-700">Schedule for later</span>
              </label>

              {state.useSchedule && (
                <div className="mt-3 ml-6">
                  <input
                    type="datetime-local"
                    value={state.scheduledFor || ''}
                    onChange={(e) => updateState({ scheduledFor: e.target.value })}
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Warning */}
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-700">
              <AlertCircle className="mr-2 inline h-4 w-4" />
              {state.useSchedule
                ? 'This communication will be sent at the scheduled time.'
                : 'This communication will be sent immediately after confirmation.'}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t p-4">
        <div>
          {currentStep !== 'recipients' && (
            <button
              onClick={goBack}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {currentStep === 'confirm' ? (
            <>
              <button
                onClick={handleSaveDraft}
                disabled={creating}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Save as Draft
              </button>
              <button
                onClick={handleSend}
                disabled={creating || sending || !canProceed}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {creating || sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : state.useSchedule ? (
                  <Calendar className="h-4 w-4" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {state.useSchedule ? 'Schedule' : 'Send Now'}
              </button>
            </>
          ) : (
            <button
              onClick={goNext}
              disabled={!canProceed}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default BulkCommunicationWizard;
