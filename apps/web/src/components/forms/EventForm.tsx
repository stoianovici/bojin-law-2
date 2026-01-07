'use client';

import { useState, useCallback } from 'react';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { CaseSearchField } from '@/components/forms/fields/CaseSearchField';
import { TeamMemberSelect, type TeamAssignment } from '@/components/cases/TeamMemberSelect';
import { useCreateEvent, type EventType } from '@/hooks/useCreateEvent';
import { cn } from '@/lib/utils';

interface CaseOption {
  id: string;
  caseNumber: string;
  title: string;
}

interface EventFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  defaults?: {
    date?: string;
    time?: string;
  };
}

interface FormErrors {
  title?: string;
  case?: string;
  type?: string;
  date?: string;
}

const EVENT_TYPES: { value: EventType; label: string; color: string }[] = [
  { value: 'CourtDate', label: 'Termene Instanță', color: '#EF4444' },
  { value: 'Hearing', label: 'Audieri', color: '#EC4899' },
  { value: 'LegalDeadline', label: 'Termene Legale', color: '#F59E0B' },
  { value: 'Meeting', label: 'Întâlniri', color: '#3B82F6' },
  { value: 'Reminder', label: 'Mementouri', color: '#22C55E' },
];

const DURATION_OPTIONS = [
  { value: '30', label: '30 min' },
  { value: '60', label: '1h' },
  { value: '90', label: '1h 30m' },
  { value: '120', label: '2h' },
  { value: '150', label: '2h 30m' },
  { value: '180', label: '3h' },
  { value: '210', label: '3h 30m' },
  { value: '240', label: '4h' },
];

export function EventForm({ onSuccess, onCancel, defaults }: EventFormProps) {
  const t = useTranslations('validation');
  const { createEvent, loading } = useCreateEvent();

  // Form state
  const [title, setTitle] = useState('');
  const [selectedCase, setSelectedCase] = useState<CaseOption | null>(null);
  const [eventType, setEventType] = useState<EventType | ''>('');
  const [date, setDate] = useState(defaults?.date ?? '');
  const [time, setTime] = useState(defaults?.time ?? '');
  const [duration, setDuration] = useState('60'); // Default 1 hour
  const [attendees, setAttendees] = useState<TeamAssignment[]>([]);

  // Validation state
  const [errors, setErrors] = useState<FormErrors>({});
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!title.trim()) {
      newErrors.title = t('titleRequired');
    }

    if (!selectedCase) {
      newErrors.case = t('selectCase');
    }

    if (!eventType) {
      newErrors.type = t('selectType');
    }

    if (!date) {
      newErrors.date = t('dateRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [title, selectedCase, eventType, date, t]);

  // Calculate end time from start time and duration
  const calculateEndTime = (startTime: string, durationMinutes: number): string => {
    if (!startTime) return '';
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasAttemptedSubmit(true);

    if (!validateForm()) {
      return;
    }

    const endTime = time ? calculateEndTime(time, parseInt(duration, 10)) : undefined;

    setSubmitError(null);
    try {
      await createEvent({
        title: title.trim(),
        caseId: selectedCase!.id,
        type: eventType as EventType,
        startDate: date,
        startTime: time || undefined,
        endDate: date, // Same day
        endTime,
        attendeeIds: attendees.length > 0 ? attendees.map((a) => a.userId) : undefined,
      });

      onSuccess?.();
    } catch (error) {
      console.error('Failed to create event:', error);
      const message = error instanceof Error ? error.message : 'A apărut o eroare la crearea evenimentului';
      setSubmitError(message);
    }
  };

  // Re-validate on field changes if user has attempted submit
  React.useEffect(() => {
    if (hasAttemptedSubmit) {
      validateForm();
    }
  }, [hasAttemptedSubmit, validateForm]);

  const inputBaseStyles = cn(
    'flex w-full rounded-md bg-linear-bg-elevated border text-linear-text-primary',
    'placeholder:text-linear-text-muted',
    'focus:outline-none focus:ring-2 focus:ring-linear-accent focus:border-transparent',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'transition-colors duration-150',
    'h-8 text-sm px-3',
    'border-linear-border-subtle'
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Title */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-linear-text-primary">
          Titlu<span className="ml-0.5 text-linear-error">*</span>
        </label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Introduceți titlul evenimentului"
          error={!!errors.title}
          errorMessage={errors.title}
        />
      </div>

      {/* Case */}
      <CaseSearchField
        label="Dosar"
        required
        value={selectedCase}
        onChange={setSelectedCase}
        error={!!errors.case}
        errorMessage={errors.case}
        placeholder="Caută un dosar..."
      />

      {/* Type */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-linear-text-primary">
          Tip<span className="ml-0.5 text-linear-error">*</span>
        </label>
        <Select value={eventType} onValueChange={(value) => setEventType(value as EventType)}>
          <SelectTrigger>
            <SelectValue placeholder="Selectează tipul" />
          </SelectTrigger>
          <SelectContent>
            {EVENT_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: type.color }}
                  />
                  {type.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.type && <p className="mt-1.5 text-xs text-linear-error">{errors.type}</p>}
      </div>

      {/* Date, Time and Duration - same row */}
      <div className="flex gap-2">
        <div className="flex-[1.2]">
          <label className="mb-1.5 block text-sm font-medium text-linear-text-primary">
            Data<span className="ml-0.5 text-linear-error">*</span>
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={cn(
              inputBaseStyles,
              errors.date && 'border-linear-error focus:ring-linear-error'
            )}
          />
        </div>
        <div className="flex-1">
          <label className="mb-1.5 block text-sm font-medium text-linear-text-primary">Ora</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className={inputBaseStyles}
          />
        </div>
        <div className="flex-1">
          <label className="mb-1.5 block text-sm font-medium text-linear-text-primary">
            Durată
          </label>
          <Select value={duration} onValueChange={setDuration}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {errors.date && <p className="-mt-2 text-xs text-linear-error">{errors.date}</p>}

      {/* Attendees */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-linear-text-primary">
          Participanți
        </label>
        <TeamMemberSelect value={attendees} onChange={setAttendees} />
      </div>

      {/* Error display */}
      {submitError && (
        <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3">
          <p className="text-sm text-red-400">{submitError}</p>
        </div>
      )}

      {/* Button row */}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Anulează
        </Button>
        <Button type="submit" loading={loading}>
          Creează eveniment
        </Button>
      </div>
    </form>
  );
}
