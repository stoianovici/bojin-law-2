'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MobileFormPage, MobileTextArea, MobileSelect, InlineError } from '@/components/mobile';
import { useCreateCaseNote, useCases, type NoteColor } from '@/hooks/mobile';
import { cn } from '@/lib/utils';

const NOTE_COLORS: { value: NoteColor; label: string; bg: string; border: string }[] = [
  { value: 'yellow', label: 'Galben', bg: 'bg-yellow-500/20', border: 'border-yellow-500/50' },
  { value: 'blue', label: 'Albastru', bg: 'bg-blue-500/20', border: 'border-blue-500/50' },
  { value: 'green', label: 'Verde', bg: 'bg-green-500/20', border: 'border-green-500/50' },
  { value: 'pink', label: 'Roz', bg: 'bg-pink-500/20', border: 'border-pink-500/50' },
];

export default function NewNotePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preSelectedCaseId = searchParams.get('caseId');

  const { createCaseNote, loading: submitting, error: submitError } = useCreateCaseNote();
  const { cases, loading: casesLoading } = useCases();

  // Form state
  const [caseId, setCaseId] = useState(preSelectedCaseId || '');
  const [content, setContent] = useState('');
  const [color, setColor] = useState<NoteColor>('yellow');

  // Validation
  const isValid = !!(caseId && content.trim().length >= 1);

  // Build options
  const caseOptions = cases.map((c) => ({
    value: c.id,
    label: c.title,
  }));

  const handleSubmit = async () => {
    if (!isValid || submitting) return;

    try {
      const result = await createCaseNote({
        caseId,
        content: content.trim(),
        color,
      });

      if (result) {
        router.push(`/m/cases/${caseId}`);
      }
    } catch (err) {
      console.error('Failed to create note:', err);
    }
  };

  const selectedColorStyle = NOTE_COLORS.find((c) => c.value === color);

  return (
    <MobileFormPage
      title="Notă Nouă"
      onSubmit={handleSubmit}
      submitLabel="Salvează Notă"
      isSubmitting={submitting}
      isValid={isValid}
    >
      <div className="space-y-5">
        <MobileSelect
          label="Dosar *"
          placeholder={casesLoading ? 'Se încarcă...' : 'Selectează dosarul'}
          options={caseOptions}
          value={caseId}
          onChange={(e) => setCaseId(e.target.value)}
        />

        {/* Color Selection */}
        <div className="space-y-2">
          <label className="text-[13px] font-medium text-mobile-text-secondary">Culoare notă</label>
          <div className="flex gap-3">
            {NOTE_COLORS.map((noteColor) => (
              <button
                key={noteColor.value}
                type="button"
                onClick={() => setColor(noteColor.value)}
                className={cn(
                  'w-10 h-10 rounded-lg border-2 transition-all',
                  noteColor.bg,
                  color === noteColor.value
                    ? `${noteColor.border} ring-2 ring-offset-2 ring-offset-mobile-bg-primary ring-white/30`
                    : 'border-transparent'
                )}
                title={noteColor.label}
              />
            ))}
          </div>
        </div>

        {/* Note content with colored background preview */}
        <div className="space-y-2">
          <label className="text-[13px] font-medium text-mobile-text-secondary">
            Conținut notă *
          </label>
          <div
            className={cn(
              'rounded-[12px] border p-4',
              selectedColorStyle?.bg,
              selectedColorStyle?.border
            )}
          >
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Scrie nota aici..."
              className={cn(
                'w-full bg-transparent',
                'text-[15px] text-mobile-text-primary',
                'placeholder:text-mobile-text-tertiary',
                'outline-none resize-none',
                'min-h-[150px]'
              )}
            />
          </div>
        </div>

        {submitError && (
          <InlineError
            message="Nu s-a putut salva nota. Încercați din nou."
            onRetry={handleSubmit}
          />
        )}
      </div>
    </MobileFormPage>
  );
}
