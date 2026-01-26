'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Briefcase, Clock, Calendar, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Card, Input, TextArea, Button, BottomSheet, BottomSheetContent } from '@/components/ui';
import { useTimeEntry } from '@/hooks/useTimeEntry';
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
// Quick Hour Options
// ============================================

const QUICK_HOURS = [0.25, 0.5, 1, 1.5, 2, 3, 4, 8];

// ============================================
// Page Component
// ============================================

export default function NewTimeEntryPage() {
  const router = useRouter();
  const { create, creating } = useTimeEntry();

  // Form state
  const [selectedCase, setSelectedCase] = useState<CaseOption | null>(null);
  const [hours, setHours] = useState<string>('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Sheet states
  const [showCasePicker, setShowCasePicker] = useState(false);
  const [showHoursPicker, setShowHoursPicker] = useState(false);

  // Fetch cases for picker
  const { data: casesData, loading: casesLoading } = useQuery<CasesData>(GET_CASES, {
    variables: { status: 'Active' },
    fetchPolicy: 'cache-first',
  });

  const handleSubmit = async () => {
    if (!selectedCase || !hours || parseFloat(hours) <= 0) return;

    try {
      await create({
        caseId: selectedCase.id,
        hours: parseFloat(hours),
        description: description.trim(),
        date,
      });
      router.back();
    } catch (error) {
      console.error('Failed to create time entry:', error);
    }
  };

  const handleQuickHour = (value: number) => {
    setHours(value.toString());
    setShowHoursPicker(false);
  };

  const isValid = selectedCase && hours && parseFloat(hours) > 0;

  const formatHoursDisplay = (h: string) => {
    if (!h) return 'Selectează ore';
    const val = parseFloat(h);
    if (val === 1) return '1 oră';
    return `${val} ore`;
  };

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
            <h1 className="text-lg font-semibold text-text-primary">Timp nou</h1>
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

        {/* Hours Picker */}
        <div>
          <label className="text-sm font-medium text-text-secondary mb-2 block">
            Ore <span className="text-error">*</span>
          </label>
          <button onClick={() => setShowHoursPicker(true)} className="w-full">
            <Card padding="md">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-text-tertiary" />
                <span className={hours ? 'text-text-primary' : 'text-text-tertiary'}>
                  {formatHoursDisplay(hours)}
                </span>
              </div>
            </Card>
          </button>
        </div>

        {/* Date */}
        <div>
          <label className="text-sm font-medium text-text-secondary mb-2 block">Data</label>
          <Card padding="md">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-text-tertiary" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="flex-1 bg-transparent text-text-primary placeholder:text-text-tertiary outline-none"
              />
            </div>
          </Card>
        </div>

        {/* Description */}
        <div>
          <TextArea
            label="Descriere (opțional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ce ai lucrat?"
            rows={3}
          />
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

      {/* Hours Picker Sheet */}
      <BottomSheet
        open={showHoursPicker}
        onClose={() => setShowHoursPicker(false)}
        title="Selectează ore"
      >
        <BottomSheetContent>
          <div className="space-y-4">
            {/* Quick options */}
            <div className="grid grid-cols-4 gap-2">
              {QUICK_HOURS.map((h) => (
                <button
                  key={h}
                  onClick={() => handleQuickHour(h)}
                  className={clsx(
                    'py-3 rounded-lg font-medium text-sm',
                    parseFloat(hours) === h
                      ? 'bg-accent text-white'
                      : 'bg-bg-card text-text-primary hover:bg-bg-hover'
                  )}
                >
                  {h}h
                </button>
              ))}
            </div>

            {/* Manual input */}
            <div className="pt-2 border-t border-white/5">
              <Input
                label="Sau introdu manual"
                type="number"
                step="0.25"
                min="0"
                max="24"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="0.00"
                rightIcon={<span className="text-text-tertiary text-sm">ore</span>}
              />
            </div>

            <Button onClick={() => setShowHoursPicker(false)} fullWidth variant="secondary">
              Confirmă
            </Button>
          </div>
        </BottomSheetContent>
      </BottomSheet>
    </div>
  );
}
