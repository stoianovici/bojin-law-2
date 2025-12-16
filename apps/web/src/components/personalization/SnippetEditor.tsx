/**
 * SnippetEditor - Form for creating/editing personal snippets
 * Story 5.6: AI Learning and Personalization (Task 26)
 * Form fields: shortcut, title, content, category with validation and live preview
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateSnippet, useUpdateSnippet } from '@/hooks/usePersonalSnippets';
import type { CreateSnippetInput } from '@/hooks/usePersonalSnippets';
import type { PersonalSnippet, SnippetCategory } from '@legal-platform/types';

// Category options
const CATEGORY_OPTIONS: Array<{
  value: SnippetCategory;
  label: string;
  description: string;
}> = [
  {
    value: 'Greeting',
    label: 'Salutări',
    description: 'Formulări de salut pentru email-uri',
  },
  {
    value: 'Closing',
    label: 'Încheieri',
    description: 'Formulări de încheiere și semnături',
  },
  {
    value: 'LegalPhrase',
    label: 'Expresii Juridice',
    description: 'Termeni și expresii juridice frecvente',
  },
  {
    value: 'ClientResponse',
    label: 'Răspunsuri Client',
    description: 'Răspunsuri standard pentru clienți',
  },
  {
    value: 'InternalNote',
    label: 'Note Interne',
    description: 'Note și comentarii pentru uz intern',
  },
  {
    value: 'Custom',
    label: 'Personalizate',
    description: 'Alte snippet-uri personalizate',
  },
];

// Validation helpers
const SHORTCUT_REGEX = /^[a-zA-Z0-9_-]+$/;
const MAX_SHORTCUT_LENGTH = 50;
const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 5000;

interface ValidationErrors {
  shortcut?: string;
  title?: string;
  content?: string;
  category?: string;
}

function validateSnippet(data: Partial<CreateSnippetInput>): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!data.shortcut) {
    errors.shortcut = 'Shortcut-ul este obligatoriu';
  } else if (!SHORTCUT_REGEX.test(data.shortcut)) {
    errors.shortcut = 'Shortcut-ul poate conține doar litere, cifre, liniuțe și underscore';
  } else if (data.shortcut.length > MAX_SHORTCUT_LENGTH) {
    errors.shortcut = `Shortcut-ul nu poate depăși ${MAX_SHORTCUT_LENGTH} caractere`;
  }

  if (!data.title) {
    errors.title = 'Titlul este obligatoriu';
  } else if (data.title.length > MAX_TITLE_LENGTH) {
    errors.title = `Titlul nu poate depăși ${MAX_TITLE_LENGTH} caractere`;
  }

  if (!data.content) {
    errors.content = 'Conținutul este obligatoriu';
  } else if (data.content.length > MAX_CONTENT_LENGTH) {
    errors.content = `Conținutul nu poate depăși ${MAX_CONTENT_LENGTH} caractere`;
  }

  if (!data.category) {
    errors.category = 'Categoria este obligatorie';
  }

  return errors;
}

export interface SnippetEditorProps {
  snippet?: PersonalSnippet | null;
  onSave?: (snippet: PersonalSnippet) => void;
  onCancel?: () => void;
  className?: string;
}

/**
 * Live preview component showing how the snippet will appear when inserted
 */
function SnippetPreview({ content }: { content: string }) {
  if (!content) {
    return (
      <div className="text-sm text-muted-foreground italic">
        Previzualizarea va apărea aici când adaugi conținut...
      </div>
    );
  }

  return (
    <div
      className="prose prose-sm max-w-none dark:prose-invert"
      dangerouslySetInnerHTML={{
        __html: content
          .replace(/\n/g, '<br />')
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>'),
      }}
    />
  );
}

/**
 * SnippetEditor provides a form for creating or editing personal snippets
 * with real-time validation and live preview.
 */
export function SnippetEditor({ snippet, onSave, onCancel, className = '' }: SnippetEditorProps) {
  const isEditing = !!snippet;

  // Form state
  const [formData, setFormData] = useState<CreateSnippetInput>({
    shortcut: snippet?.shortcut ?? '',
    title: snippet?.title ?? '',
    content: snippet?.content ?? '',
    category: snippet?.category ?? 'Custom',
  });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Mutations
  const { createSnippet, loading: creating, error: createError } = useCreateSnippet();
  const { updateSnippet, loading: updating, error: updateError } = useUpdateSnippet();

  const isLoading = creating || updating;

  // Reset form when snippet changes
  useEffect(() => {
    if (snippet) {
      setFormData({
        shortcut: snippet.shortcut,
        title: snippet.title,
        content: snippet.content,
        category: snippet.category,
      });
      setErrors({});
      setTouched({});
      setSubmitError(null);
    }
  }, [snippet]);

  // Validate on change
  useEffect(() => {
    if (Object.keys(touched).length > 0) {
      const newErrors = validateSnippet(formData);
      setErrors(newErrors);
    }
  }, [formData, touched]);

  // Handle field changes
  const handleChange = useCallback((field: keyof CreateSnippetInput, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setTouched((prev) => ({ ...prev, [field]: true }));
    setSubmitError(null);
  }, []);

  // Handle blur for validation
  const handleBlur = useCallback((field: keyof CreateSnippetInput) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  // Generate shortcut suggestion from title
  const suggestShortcut = useCallback(() => {
    if (formData.title && !formData.shortcut) {
      const suggested = formData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 20);
      setFormData((prev) => ({ ...prev, shortcut: suggested }));
      setTouched((prev) => ({ ...prev, shortcut: true }));
    }
  }, [formData.title, formData.shortcut]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const validationErrors = validateSnippet(formData);
    setErrors(validationErrors);
    setTouched({
      shortcut: true,
      title: true,
      content: true,
      category: true,
    });

    if (Object.keys(validationErrors).length > 0) {
      // Announce errors to screen readers
      const errorMessage = Object.values(validationErrors).join('. ');
      setSubmitError(`Erori de validare: ${errorMessage}`);
      return;
    }

    try {
      let result: PersonalSnippet | undefined;

      if (isEditing && snippet) {
        result = await updateSnippet(snippet.id, formData);
      } else {
        result = await createSnippet(formData);
      }

      if (result && onSave) {
        onSave(result);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'A apărut o eroare la salvarea snippet-ului';
      setSubmitError(message);
    }
  };

  // Check for API errors
  const apiError = createError || updateError;
  const displayError = submitError || (apiError ? apiError.message : null);

  return (
    <Card className={className}>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>{isEditing ? 'Editează Snippet' : 'Snippet Nou'}</CardTitle>
          <CardDescription>
            {isEditing
              ? 'Modifică detaliile snippet-ului existent'
              : 'Creează un snippet nou pentru inserare rapidă'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Error announcement for screen readers */}
          {displayError && (
            <div
              role="alert"
              aria-live="polite"
              className="p-3 rounded-md bg-destructive/10 text-destructive text-sm"
            >
              {displayError}
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            {/* Left column: Form fields */}
            <div className="space-y-4">
              {/* Title */}
              <div className="space-y-2">
                <label
                  htmlFor="snippet-title"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Titlu <span className="text-destructive">*</span>
                </label>
                <Input
                  id="snippet-title"
                  type="text"
                  placeholder="Ex: Salut formal client nou"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  onBlur={() => {
                    handleBlur('title');
                    suggestShortcut();
                  }}
                  aria-invalid={touched.title && !!errors.title}
                  aria-describedby={errors.title ? 'title-error' : undefined}
                  maxLength={MAX_TITLE_LENGTH}
                />
                {touched.title && errors.title && (
                  <p id="title-error" className="text-xs text-destructive">
                    {errors.title}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {formData.title.length}/{MAX_TITLE_LENGTH} caractere
                </p>
              </div>

              {/* Shortcut */}
              <div className="space-y-2">
                <label
                  htmlFor="snippet-shortcut"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Shortcut <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    /
                  </span>
                  <Input
                    id="snippet-shortcut"
                    type="text"
                    placeholder="salut-formal"
                    value={formData.shortcut}
                    onChange={(e) =>
                      handleChange('shortcut', e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))
                    }
                    onBlur={() => handleBlur('shortcut')}
                    className="pl-7"
                    aria-invalid={touched.shortcut && !!errors.shortcut}
                    aria-describedby={errors.shortcut ? 'shortcut-error' : 'shortcut-hint'}
                    maxLength={MAX_SHORTCUT_LENGTH}
                  />
                </div>
                {touched.shortcut && errors.shortcut ? (
                  <p id="shortcut-error" className="text-xs text-destructive">
                    {errors.shortcut}
                  </p>
                ) : (
                  <p id="shortcut-hint" className="text-xs text-muted-foreground">
                    Tastează /{formData.shortcut || 'shortcut'} pentru a insera rapid
                  </p>
                )}
              </div>

              {/* Category */}
              <div className="space-y-2">
                <label
                  htmlFor="snippet-category"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Categorie <span className="text-destructive">*</span>
                </label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => handleChange('category', value as SnippetCategory)}
                >
                  <SelectTrigger
                    id="snippet-category"
                    aria-invalid={touched.category && !!errors.category}
                  >
                    <SelectValue placeholder="Selectează categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div>
                          <span className="font-medium">{option.label}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {option.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {touched.category && errors.category && (
                  <p className="text-xs text-destructive">{errors.category}</p>
                )}
              </div>

              {/* Content */}
              <div className="space-y-2">
                <label
                  htmlFor="snippet-content"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Conținut <span className="text-destructive">*</span>
                </label>
                <Textarea
                  id="snippet-content"
                  placeholder="Scrie conținutul snippet-ului aici..."
                  value={formData.content}
                  onChange={(e) => handleChange('content', e.target.value)}
                  onBlur={() => handleBlur('content')}
                  rows={6}
                  aria-invalid={touched.content && !!errors.content}
                  aria-describedby={errors.content ? 'content-error' : 'content-hint'}
                  maxLength={MAX_CONTENT_LENGTH}
                />
                {touched.content && errors.content ? (
                  <p id="content-error" className="text-xs text-destructive">
                    {errors.content}
                  </p>
                ) : (
                  <p id="content-hint" className="text-xs text-muted-foreground">
                    {formData.content.length}/{MAX_CONTENT_LENGTH} caractere. Suportă **bold** și
                    *italic*.
                  </p>
                )}
              </div>
            </div>

            {/* Right column: Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Previzualizare</span>
                {formData.category && (
                  <Badge variant="outline">
                    {CATEGORY_OPTIONS.find((o) => o.value === formData.category)?.label ??
                      formData.category}
                  </Badge>
                )}
              </div>
              <div className="min-h-[200px] p-4 rounded-lg border bg-muted/30">
                <SnippetPreview content={formData.content} />
              </div>
              {formData.shortcut && (
                <p className="text-xs text-muted-foreground text-center">
                  Inserează cu <code className="bg-muted px-1 rounded">/{formData.shortcut}</code>
                </p>
              )}
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              Anulează
            </Button>
          )}
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Se salvează...' : isEditing ? 'Salvează Modificările' : 'Creează Snippet'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

SnippetEditor.displayName = 'SnippetEditor';

/**
 * Dialog version of SnippetEditor for modal usage
 */
export function SnippetEditorDialog({
  open,
  onOpenChange,
  snippet,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snippet?: PersonalSnippet | null;
  onSave?: (snippet: PersonalSnippet) => void;
}) {
  const handleSave = (saved: PersonalSnippet) => {
    onSave?.(saved);
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="snippet-editor-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative z-10 w-full max-w-3xl mx-4 max-h-[90vh] overflow-auto">
        <SnippetEditor snippet={snippet} onSave={handleSave} onCancel={() => onOpenChange(false)} />
      </div>
    </div>
  );
}

SnippetEditorDialog.displayName = 'SnippetEditorDialog';
