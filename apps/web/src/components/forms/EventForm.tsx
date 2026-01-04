'use client';

import { useState, useCallback } from 'react';
import * as React from 'react';
import { Input } from '@/components/ui/Input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
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

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'Meeting', label: 'Meeting' },
  { value: 'CourtDate', label: 'Court Date' },
  { value: 'Deadline', label: 'Deadline' },
  { value: 'Appointment', label: 'Appointment' },
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

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!selectedCase) {
      newErrors.case = 'Case is required';
    }

    if (!eventType) {
      newErrors.type = 'Event type is required';
    }

    if (!date) {
      newErrors.date = 'Date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [title, selectedCase, eventType, date]);

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
          Title<span className="ml-0.5 text-linear-error">*</span>
        </label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter event title"
          error={!!errors.title}
          errorMessage={errors.title}
        />
      </div>

      {/* Case */}
      <CaseSearchField
        label="Case"
        required
        value={selectedCase}
        onChange={setSelectedCase}
        error={!!errors.case}
        errorMessage={errors.case}
        placeholder="Search for a case..."
      />

      {/* Type */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-linear-text-primary">
          Type<span className="ml-0.5 text-linear-error">*</span>
        </label>
        <Select value={eventType} onValueChange={(value) => setEventType(value as EventType)}>
          <SelectTrigger>
            <SelectValue placeholder="Select event type" />
          </SelectTrigger>
          <SelectContent>
            {EVENT_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
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
            Date<span className="ml-0.5 text-linear-error">*</span>
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
          <label className="mb-1.5 block text-sm font-medium text-linear-text-primary">Time</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className={inputBaseStyles}
          />
        </div>
        <div className="flex-1">
          <label className="mb-1.5 block text-sm font-medium text-linear-text-primary">
            Duration
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
          Attendees
        </label>
        <TeamMemberSelect value={attendees} onChange={setAttendees} />
      </div>

      {/* Button row */}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          Create Event
        </Button>
      </div>
    </form>
  );
}
