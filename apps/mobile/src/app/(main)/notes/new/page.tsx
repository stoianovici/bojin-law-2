'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Briefcase, Loader2 } from 'lucide-react';
import { Card, TextArea, Button, BottomSheet, BottomSheetContent } from '@/components/ui';
import { useNotes } from '@/hooks/useNotes';
import { useQuery } from '@apollo/client/react';
import { GET_CASES } from '@/graphql/queries';
import { clsx } from 'clsx';

// ============================================
// Types
// ============================================

interface CaseOption {
  id: string;
  caseNumber: string;
  title: string;
}

interface CasesData {
  cases: CaseOption[];
}

// ============================================
// Page Component
// ============================================

export default function NewNotePage() {
  const router = useRouter();
  const { create, creating } = useNotes();

  // Form state
  const [selectedCase, setSelectedCase] = useState<CaseOption | null>(null);
  const [content, setContent] = useState('');

  // Sheet states
  const [showCasePicker, setShowCasePicker] = useState(false);

  // Fetch cases for picker
  const { data: casesData, loading: casesLoading } = useQuery<CasesData>(GET_CASES, {
    variables: { status: 'Active' },
    fetchPolicy: 'cache-first',
  });

  const handleSubmit = async () => {
    if (!selectedCase || !content.trim()) return;

    try {
      await create({
        caseId: selectedCase.id,
        content: content.trim(),
      });
      router.back();
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  };

  const isValid = selectedCase && content.trim().length > 0;

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-bg-primary/80 backdrop-blur-lg border-b border-white/5">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 flex items-center justify-center -ml-2"
            >
              <ArrowLeft className="w-5 h-5 text-text-primary" />
            </button>
            <h1 className="text-lg font-semibold text-text-primary">Notă nouă</h1>
          </div>

          <Button onClick={handleSubmit} disabled={!isValid || creating} size="sm">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvează'}
          </Button>
        </div>
      </div>

      {/* Form */}
      <div className="px-6 py-4 space-y-4">
        {/* Case Picker (Required) */}
        <div>
          <label className="text-sm font-medium text-text-secondary mb-2 block">
            Dosar <span className="text-error">*</span>
          </label>
          <button onClick={() => setShowCasePicker(true)} className="w-full">
            <Card padding="md">
              <div className="flex items-center gap-3">
                <Briefcase className="w-5 h-5 text-text-tertiary" />
                <span className={selectedCase ? 'text-text-primary' : 'text-text-tertiary'}>
                  {selectedCase
                    ? `${selectedCase.caseNumber} - ${selectedCase.title}`
                    : 'Selectează un dosar'}
                </span>
              </div>
            </Card>
          </button>
        </div>

        {/* Note Content */}
        <div>
          <TextArea
            label="Conținut"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Scrie nota ta aici..."
            rows={8}
            autoFocus
          />
          <p className="mt-2 text-xs text-text-tertiary">{content.length} caractere</p>
        </div>
      </div>

      {/* Case Picker Sheet */}
      <BottomSheet
        open={showCasePicker}
        onClose={() => setShowCasePicker(false)}
        title="Selectează dosar"
      >
        <BottomSheetContent>
          <div className="space-y-2">
            {casesLoading ? (
              <div className="p-4 text-center text-text-tertiary">Se încarcă...</div>
            ) : (
              casesData?.cases.map((caseItem) => (
                <button
                  key={caseItem.id}
                  onClick={() => {
                    setSelectedCase(caseItem);
                    setShowCasePicker(false);
                  }}
                  className={clsx(
                    'w-full flex items-center gap-3 p-4 rounded-lg text-left',
                    selectedCase?.id === caseItem.id
                      ? 'bg-accent-muted text-accent'
                      : 'bg-bg-card text-text-primary hover:bg-bg-hover'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{caseItem.caseNumber}</p>
                    <p className="text-sm text-text-tertiary truncate">{caseItem.title}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </BottomSheetContent>
      </BottomSheet>
    </div>
  );
}
