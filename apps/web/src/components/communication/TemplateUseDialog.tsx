/**
 * Template Use Dialog Component
 * Story 5.5: Multi-Channel Communication Hub (AC: 2)
 *
 * Dialog for filling in template variables and inserting rendered content
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  useRenderTemplate,
  previewTemplate,
  type CommunicationTemplate,
  type TemplateVariable,
  type RenderedTemplate,
} from '@/hooks/useCommunicationTemplates';
import {
  X,
  FileText,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle,
  Info,
  Sparkles,
} from 'lucide-react';

interface TemplateUseDialogProps {
  template: CommunicationTemplate;
  isOpen: boolean;
  onClose: () => void;
  onInsert: (rendered: RenderedTemplate) => void;
  caseContext?: {
    clientName?: string;
    caseNumber?: string;
    caseTitle?: string;
    attorneyName?: string;
    firmName?: string;
  };
  className?: string;
}

export function TemplateUseDialog({
  template,
  isOpen,
  onClose,
  onInsert,
  caseContext,
  className = '',
}: TemplateUseDialogProps) {
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  const { render, loading, error } = useRenderTemplate();

  // Initialize values from defaults and context
  useEffect(() => {
    const values: Record<string, string> = {};

    template.variables.forEach((v) => {
      // Try to auto-fill from context
      const autoValue = getAutoFillValue(v.name, caseContext);
      values[v.name] = autoValue || v.defaultValue || '';
    });

    setVariableValues(values);
    setSubmitted(false);
  }, [template, caseContext]);

  // Check if all required variables are filled
  const missingRequired = useMemo(() => {
    return template.variables
      .filter((v) => v.required)
      .filter((v) => !variableValues[v.name]?.trim())
      .map((v) => v.name);
  }, [template.variables, variableValues]);

  const canSubmit = missingRequired.length === 0;

  // Live preview
  const previewSubject = useMemo(
    () => previewTemplate(template.subject || '', variableValues),
    [template.subject, variableValues]
  );

  const previewBody = useMemo(
    () => previewTemplate(template.body, variableValues),
    [template.body, variableValues]
  );

  const handleValueChange = useCallback((name: string, value: string) => {
    setVariableValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    try {
      setSubmitted(true);
      const rendered = await render(template.id, variableValues);
      if (rendered) {
        onInsert(rendered);
      }
    } catch (err) {
      setSubmitted(false);
    }
  }, [canSubmit, render, template.id, variableValues, onInsert]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canSubmit) {
        handleSubmit();
      }
    },
    [onClose, canSubmit, handleSubmit]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <div
        className={`relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 id="dialog-title" className="text-lg font-semibold text-gray-900">
                Use Template
              </h2>
              <p className="text-sm text-gray-500">{template.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex max-h-[calc(90vh-140px)] overflow-hidden">
          {/* Variables Form */}
          <div className="flex-1 overflow-y-auto border-r p-6">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-700">
              <Sparkles className="h-4 w-4 text-yellow-500" />
              Fill in the details
            </h3>

            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                {error.message}
              </div>
            )}

            {template.variables.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
                <Info className="h-4 w-4" />
                This template has no variables. Click Insert to use it as-is.
              </div>
            ) : (
              <div className="space-y-4">
                {template.variables.map((variable) => (
                  <VariableInput
                    key={variable.name}
                    variable={variable}
                    value={variableValues[variable.name] || ''}
                    onChange={(value) => handleValueChange(variable.name, value)}
                    autoFilled={isAutoFilled(variable.name, caseContext)}
                  />
                ))}
              </div>
            )}

            {/* Missing required warning */}
            {missingRequired.length > 0 && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-700">
                <AlertCircle className="mt-0.5 h-4 w-4" />
                <div>
                  <span className="font-medium">Missing required fields: </span>
                  {missingRequired.join(', ')}
                </div>
              </div>
            )}
          </div>

          {/* Preview */}
          {showPreview && (
            <div className="w-[45%] overflow-y-auto bg-gray-50 p-6">
              <h3 className="mb-4 text-sm font-medium text-gray-700">Preview</h3>

              <div className="rounded-lg border border-gray-200 bg-white">
                {template.channelType === 'Email' && template.subject && (
                  <div className="border-b px-4 py-3">
                    <span className="text-xs font-medium uppercase text-gray-400">Subject</span>
                    <p className="mt-1 font-medium text-gray-900">
                      {previewSubject || '(empty subject)'}
                    </p>
                  </div>
                )}
                <div className="p-4">
                  <span className="text-xs font-medium uppercase text-gray-400">Body</span>
                  <div className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
                    {previewBody || '(empty body)'}
                  </div>
                </div>
              </div>

              {/* Highlighted placeholders */}
              {missingRequired.length > 0 && (
                <p className="mt-4 text-xs text-gray-500">
                  Unfilled placeholders are shown as {'{{variable}}'} in the preview.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-6 py-4">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showPreview}
              onChange={(e) => setShowPreview(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            Show preview
          </label>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || loading || submitted}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading || submitted ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Insert Content
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Variable Input Component
interface VariableInputProps {
  variable: TemplateVariable;
  value: string;
  onChange: (value: string) => void;
  autoFilled: boolean;
}

function VariableInput({ variable, value, onChange, autoFilled }: VariableInputProps) {
  const isLongText =
    variable.name.toLowerCase().includes('body') ||
    variable.name.toLowerCase().includes('message') ||
    variable.name.toLowerCase().includes('content');

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">
          {formatVariableName(variable.name)}
          {variable.required && <span className="ml-1 text-red-500">*</span>}
        </label>
        {autoFilled && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <Sparkles className="h-3 w-3" />
            Auto-filled
          </span>
        )}
      </div>
      {variable.description && <p className="mb-1 text-xs text-gray-500">{variable.description}</p>}
      {isLongText ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className={`w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
            autoFilled ? 'border-green-300 bg-green-50' : 'border-gray-300'
          }`}
          placeholder={
            variable.defaultValue || `Enter ${formatVariableName(variable.name).toLowerCase()}`
          }
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
            autoFilled ? 'border-green-300 bg-green-50' : 'border-gray-300'
          }`}
          placeholder={
            variable.defaultValue || `Enter ${formatVariableName(variable.name).toLowerCase()}`
          }
        />
      )}
    </div>
  );
}

// Helper functions

function formatVariableName(name: string): string {
  // Convert camelCase or snake_case to Title Case
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\s/, '')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function getAutoFillValue(
  name: string,
  context?: {
    clientName?: string;
    caseNumber?: string;
    caseTitle?: string;
    attorneyName?: string;
    firmName?: string;
  }
): string | undefined {
  if (!context) return undefined;

  const lowerName = name.toLowerCase();

  if (lowerName.includes('client') && lowerName.includes('name')) {
    return context.clientName;
  }
  if (lowerName.includes('case') && lowerName.includes('number')) {
    return context.caseNumber;
  }
  if (lowerName.includes('case') && lowerName.includes('title')) {
    return context.caseTitle;
  }
  if (lowerName.includes('attorney') || lowerName.includes('lawyer')) {
    return context.attorneyName;
  }
  if (lowerName.includes('firm')) {
    return context.firmName;
  }

  return undefined;
}

function isAutoFilled(
  name: string,
  context?: {
    clientName?: string;
    caseNumber?: string;
    caseTitle?: string;
    attorneyName?: string;
    firmName?: string;
  }
): boolean {
  return !!getAutoFillValue(name, context);
}

export default TemplateUseDialog;
