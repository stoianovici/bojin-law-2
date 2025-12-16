/**
 * Template Editor Component
 * Story 5.5: Multi-Channel Communication Hub (AC: 2)
 *
 * Form for creating and editing communication templates
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  useCreateTemplate,
  useUpdateTemplate,
  useTemplateCategories,
  extractTemplateVariables,
  previewTemplate,
  type CommunicationTemplate,
  type CreateTemplateInput,
  type UpdateTemplateInput,
  type TemplateCategory,
  type CommunicationChannel,
  type TemplateVariable,
} from '@/hooks/useCommunicationTemplates';
import { X, Save, Eye, Plus, Trash2, AlertCircle, Loader2, Info, Code } from 'lucide-react';

interface TemplateEditorProps {
  template?: CommunicationTemplate;
  onSave?: (template: CommunicationTemplate) => void;
  onCancel?: () => void;
  className?: string;
}

const CHANNELS: { value: CommunicationChannel; label: string }[] = [
  { value: 'Email', label: 'Email' },
  { value: 'InternalNote', label: 'Internal Note' },
];

export function TemplateEditor({
  template,
  onSave,
  onCancel,
  className = '',
}: TemplateEditorProps) {
  const isEditing = !!template;

  // Form state
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [category, setCategory] = useState<TemplateCategory>(template?.category || 'General');
  const [channelType, setChannelType] = useState<CommunicationChannel>(
    template?.channelType || 'Email'
  );
  const [subject, setSubject] = useState(template?.subject || '');
  const [body, setBody] = useState(template?.body || '');
  const [isGlobal, setIsGlobal] = useState(template?.isGlobal || false);
  const [variables, setVariables] = useState<TemplateVariable[]>(template?.variables || []);

  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [previewValues, setPreviewValues] = useState<Record<string, string>>({});

  // Hooks
  const { create, loading: creating, error: createError } = useCreateTemplate();
  const { update, loading: updating, error: updateError } = useUpdateTemplate();
  const { categories } = useTemplateCategories();

  const loading = creating || updating;
  const error = createError || updateError;

  // Auto-detect variables from body
  useEffect(() => {
    const detected = extractTemplateVariables(body);
    const subjectVars = extractTemplateVariables(subject);
    const allVars = [...new Set([...detected, ...subjectVars])];

    // Add new variables, preserve existing ones
    setVariables((prev) => {
      const existingNames = prev.map((v) => v.name);
      const newVars = allVars
        .filter((name) => !existingNames.includes(name))
        .map((name) => ({
          name,
          description: '',
          required: true,
        }));

      // Remove variables no longer in template
      const filtered = prev.filter((v) => allVars.includes(v.name));

      return [...filtered, ...newVars];
    });
  }, [body, subject]);

  // Initialize preview values
  useEffect(() => {
    const values: Record<string, string> = {};
    variables.forEach((v) => {
      values[v.name] = v.defaultValue || `[${v.name}]`;
    });
    setPreviewValues(values);
  }, [variables]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const input: CreateTemplateInput | UpdateTemplateInput = {
        name,
        description: description || undefined,
        category,
        channelType,
        subject: subject || undefined,
        body,
        variables: variables.map((v) => ({
          name: v.name,
          description: v.description,
          defaultValue: v.defaultValue,
          required: v.required,
        })),
        isGlobal,
      };

      try {
        let savedTemplate: CommunicationTemplate | undefined;

        if (isEditing && template) {
          savedTemplate = await update(template.id, input);
        } else {
          savedTemplate = await create(input as CreateTemplateInput);
        }

        if (savedTemplate) {
          onSave?.(savedTemplate);
        }
      } catch (err) {
        // Error is handled by the hook
      }
    },
    [
      name,
      description,
      category,
      channelType,
      subject,
      body,
      variables,
      isGlobal,
      isEditing,
      template,
      create,
      update,
      onSave,
    ]
  );

  const handleVariableChange = useCallback(
    (index: number, field: keyof TemplateVariable, value: string | boolean) => {
      setVariables((prev) => prev.map((v, i) => (i === index ? { ...v, [field]: value } : v)));
    },
    []
  );

  const insertVariable = useCallback(
    (varName: string) => {
      const textarea = document.getElementById('template-body') as HTMLTextAreaElement;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = `{{${varName}}}`;
      const newBody = body.substring(0, start) + text + body.substring(end);

      setBody(newBody);

      // Restore cursor
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + text.length, start + text.length);
      }, 0);
    },
    [body]
  );

  const previewSubject = previewTemplate(subject, previewValues);
  const previewBody = previewTemplate(body, previewValues);

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          {isEditing ? 'Edit Template' : 'Create Template'}
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm ${
              showPreview
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Eye className="h-4 w-4" />
            Preview
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-1 gap-6">
        {/* Form */}
        <div className="flex-1 space-y-4">
          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              {error.message}
            </div>
          )}

          {/* Name */}
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
              Template Name *
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g., Client Status Update"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-700">
              Description
            </label>
            <input
              id="description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Brief description of when to use this template"
            />
          </div>

          {/* Category and Channel */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="category" className="mb-1 block text-sm font-medium text-gray-700">
                Category *
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value as TemplateCategory)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="channel" className="mb-1 block text-sm font-medium text-gray-700">
                Channel *
              </label>
              <select
                id="channel"
                value={channelType}
                onChange={(e) => setChannelType(e.target.value as CommunicationChannel)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {CHANNELS.map((ch) => (
                  <option key={ch.value} value={ch.value}>
                    {ch.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Subject */}
          {channelType === 'Email' && (
            <div>
              <label htmlFor="subject" className="mb-1 block text-sm font-medium text-gray-700">
                Subject
              </label>
              <input
                id="subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Email subject line"
              />
            </div>
          )}

          {/* Body */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="template-body" className="text-sm font-medium text-gray-700">
                Body *
              </label>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Info className="h-3 w-3" />
                Use {'{{variableName}}'} for placeholders
              </div>
            </div>
            <textarea
              id="template-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={8}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Template body with {{placeholders}}"
            />
          </div>

          {/* Variables */}
          {variables.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-gray-700">
                Variables ({variables.length})
              </h3>
              <div className="space-y-2">
                {variables.map((variable, index) => (
                  <div
                    key={variable.name}
                    className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2"
                  >
                    <Code className="h-4 w-4 text-gray-400" />
                    <span className="min-w-[120px] font-mono text-sm text-gray-700">
                      {'{{'}
                      {variable.name}
                      {'}}'}
                    </span>
                    <input
                      type="text"
                      value={variable.description}
                      onChange={(e) => handleVariableChange(index, 'description', e.target.value)}
                      placeholder="Description"
                      className="flex-1 rounded border border-gray-200 px-2 py-1 text-sm"
                    />
                    <input
                      type="text"
                      value={variable.defaultValue || ''}
                      onChange={(e) => handleVariableChange(index, 'defaultValue', e.target.value)}
                      placeholder="Default"
                      className="w-24 rounded border border-gray-200 px-2 py-1 text-sm"
                    />
                    <label className="flex items-center gap-1 text-xs text-gray-500">
                      <input
                        type="checkbox"
                        checked={variable.required}
                        onChange={(e) => handleVariableChange(index, 'required', e.target.checked)}
                        className="h-3 w-3"
                      />
                      Required
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Global toggle */}
          <div className="flex items-center gap-2">
            <input
              id="isGlobal"
              type="checkbox"
              checked={isGlobal}
              onChange={(e) => setIsGlobal(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="isGlobal" className="text-sm text-gray-700">
              Make available to all users (global template)
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 border-t pt-4">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={loading || !name || !body}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isEditing ? 'Save Changes' : 'Create Template'}
            </button>
          </div>
        </div>

        {/* Preview Panel */}
        {showPreview && (
          <div className="w-96 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h3 className="mb-4 text-sm font-medium text-gray-700">Preview</h3>

            {/* Sample Values */}
            {variables.length > 0 && (
              <div className="mb-4 space-y-2">
                <h4 className="text-xs font-medium uppercase text-gray-500">Sample Values</h4>
                {variables.map((v) => (
                  <div key={v.name} className="flex items-center gap-2">
                    <label className="min-w-[100px] text-xs text-gray-500">{v.name}:</label>
                    <input
                      type="text"
                      value={previewValues[v.name] || ''}
                      onChange={(e) =>
                        setPreviewValues((prev) => ({
                          ...prev,
                          [v.name]: e.target.value,
                        }))
                      }
                      className="flex-1 rounded border border-gray-200 px-2 py-1 text-xs"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Rendered Preview */}
            <div className="rounded border border-gray-200 bg-white p-3">
              {channelType === 'Email' && previewSubject && (
                <div className="mb-2 border-b pb-2">
                  <span className="text-xs text-gray-500">Subject:</span>
                  <p className="font-medium text-gray-900">{previewSubject}</p>
                </div>
              )}
              <div className="whitespace-pre-wrap text-sm text-gray-700">
                {previewBody || '(empty body)'}
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

export default TemplateEditor;
