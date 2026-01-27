'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Briefcase, Calendar, Clock, Loader2 } from 'lucide-react';
import { Card, Input, TextArea, Button, BottomSheet, BottomSheetContent } from '@/components/ui';
import { useMutation, useQuery } from '@apollo/client/react';
import { GET_CASES, GET_CALENDAR_EVENTS } from '@/graphql/queries';
import { CREATE_TASK } from '@/graphql/mutations';
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
  paginatedCases: {
    edges: Array<{
      node: CaseOption;
    }>;
  };
}

const eventTypes = [
  { value: 'Meeting', label: 'Întâlnire' },
  { value: 'Deadline', label: 'Termen' },
  { value: 'Hearing', label: 'Ședință' },
  { value: 'Call', label: 'Apel' },
  { value: 'Other', label: 'Altele' },
];

// ============================================
// Page Component
// ============================================

export default function NewEventPage() {
  const router = useRouter();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCase, setSelectedCase] = useState<CaseOption | null>(null);
  const [eventType, setEventType] = useState('Meeting');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  // Sheet states
  const [showCasePicker, setShowCasePicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);

  // Fetch cases for picker
  const { data: casesData, loading: casesLoading } = useQuery<CasesData>(GET_CASES, {
    variables: { status: 'Active' },
    fetchPolicy: 'cache-first',
  });

  // Create event mutation (events are tasks with scheduledDate)
  const [createEvent, { loading: creating }] = useMutation(CREATE_TASK, {
    refetchQueries: [{ query: GET_CALENDAR_EVENTS }],
  });

  const handleSubmit = async () => {
    if (!title.trim() || !scheduledDate) return;

    try {
      await createEvent({
        variables: {
          input: {
            title: title.trim(),
            description: description.trim() || null,
            caseId: selectedCase?.id || null,
            type: eventType,
            priority: 'Normal',
            status: 'Pending',
            scheduledDate,
            scheduledStartTime: scheduledTime || null,
          },
        },
      });
      router.back();
    } catch (error) {
      console.error('Failed to create event:', error);
    }
  };

  const isValid = title.trim().length > 0 && scheduledDate;

  const selectedEventType = eventTypes.find((t) => t.value === eventType);

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
            <h1 className="text-lg font-semibold text-text-primary">Eveniment nou</h1>
          </div>

          <Button onClick={handleSubmit} disabled={!isValid || creating} size="sm">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvează'}
          </Button>
        </div>
      </div>

      {/* Form */}
      <div className="px-6 py-4 space-y-4">
        {/* Title */}
        <div>
          <Input
            label="Titlu"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Subiect eveniment..."
            autoFocus
          />
        </div>

        {/* Event Type */}
        <div>
          <label className="text-sm font-medium text-text-secondary mb-2 block">
            Tip eveniment
          </label>
          <button onClick={() => setShowTypePicker(true)} className="w-full">
            <Card padding="md">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-text-tertiary" />
                <span className="text-text-primary">{selectedEventType?.label}</span>
              </div>
            </Card>
          </button>
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-text-secondary mb-2 block">Data *</label>
            <Card padding="md">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-text-tertiary" />
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="flex-1 bg-transparent text-text-primary placeholder:text-text-tertiary outline-none"
                  required
                />
              </div>
            </Card>
          </div>

          <div>
            <label className="text-sm font-medium text-text-secondary mb-2 block">Ora</label>
            <Card padding="md">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-text-tertiary" />
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="flex-1 bg-transparent text-text-primary placeholder:text-text-tertiary outline-none"
                />
              </div>
            </Card>
          </div>
        </div>

        {/* Case Picker */}
        <div>
          <label className="text-sm font-medium text-text-secondary mb-2 block">Dosar</label>
          <button onClick={() => setShowCasePicker(true)} className="w-full">
            <Card padding="md">
              <div className="flex items-center gap-3">
                <Briefcase className="w-5 h-5 text-text-tertiary" />
                <span className={selectedCase ? 'text-text-primary' : 'text-text-tertiary'}>
                  {selectedCase
                    ? `${selectedCase.caseNumber} - ${selectedCase.title}`
                    : 'Selectează un dosar (opțional)'}
                </span>
              </div>
            </Card>
          </button>
        </div>

        {/* Description */}
        <div>
          <TextArea
            label="Note (opțional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Adaugă detalii..."
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
            <button
              onClick={() => {
                setSelectedCase(null);
                setShowCasePicker(false);
              }}
              className={clsx(
                'w-full flex items-center gap-3 p-4 rounded-lg',
                !selectedCase
                  ? 'bg-accent-muted text-accent'
                  : 'bg-bg-card text-text-primary hover:bg-bg-hover'
              )}
            >
              <span className="font-medium">Fără dosar</span>
            </button>

            {casesLoading ? (
              <div className="p-4 text-center text-text-tertiary">Se încarcă...</div>
            ) : (
              casesData?.paginatedCases.edges.map(({ node: caseItem }) => (
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

      {/* Type Picker Sheet */}
      <BottomSheet
        open={showTypePicker}
        onClose={() => setShowTypePicker(false)}
        title="Tip eveniment"
      >
        <BottomSheetContent>
          <div className="space-y-2">
            {eventTypes.map((type) => (
              <button
                key={type.value}
                onClick={() => {
                  setEventType(type.value);
                  setShowTypePicker(false);
                }}
                className={clsx(
                  'w-full flex items-center gap-3 p-4 rounded-lg',
                  eventType === type.value
                    ? 'bg-accent-muted text-accent'
                    : 'bg-bg-card text-text-primary hover:bg-bg-hover'
                )}
              >
                <span className="font-medium">{type.label}</span>
              </button>
            ))}
          </div>
        </BottomSheetContent>
      </BottomSheet>
    </div>
  );
}
