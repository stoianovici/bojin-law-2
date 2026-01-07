'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { CalendarEvent, CalendarEventType } from './types';
import { eventColors, eventTypeLabels } from './types';
import { format } from 'date-fns';

// ====================================================================
// EventModal - Create or edit calendar events
// ====================================================================

interface EventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: CalendarEvent | null;
  defaultDate?: Date;
  defaultHour?: number;
  onSave: (event: Partial<CalendarEvent>) => void;
  onDelete?: (eventId: string) => void;
}

const eventTypes: CalendarEventType[] = [
  'court',
  'hearing',
  'deadline',
  'meeting',
  'task',
  'reminder',
];

export function EventModal({
  open,
  onOpenChange,
  event,
  defaultDate,
  defaultHour,
  onSave,
  onDelete,
}: EventModalProps) {
  const isEditing = !!event;
  const [title, setTitle] = React.useState('');
  const [type, setType] = React.useState<CalendarEventType>('meeting');
  const [date, setDate] = React.useState('');
  const [startTime, setStartTime] = React.useState('09:00');
  const [endTime, setEndTime] = React.useState('10:00');
  const [isAllDay, setIsAllDay] = React.useState(false);
  const [location, setLocation] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  // Reset form when modal opens
  React.useEffect(() => {
    if (open) {
      if (event) {
        // Editing existing event
        setTitle(event.title);
        setType(event.type);
        setDate(format(event.startTime, 'yyyy-MM-dd'));
        setStartTime(format(event.startTime, 'HH:mm'));
        setEndTime(format(event.endTime, 'HH:mm'));
        setIsAllDay(event.isAllDay || false);
        setLocation(event.location || '');
        setDescription(event.description || '');
      } else {
        // Creating new event
        const baseDate = defaultDate || new Date();
        const hour = defaultHour ?? 9;
        setTitle('');
        setType('meeting');
        setDate(format(baseDate, 'yyyy-MM-dd'));
        setStartTime(`${String(hour).padStart(2, '0')}:00`);
        setEndTime(`${String(hour + 1).padStart(2, '0')}:00`);
        setIsAllDay(false);
        setLocation('');
        setDescription('');
      }
    }
  }, [open, event, defaultDate, defaultHour]);

  const handleSubmit = async () => {
    if (!title.trim() || !date) return;

    setLoading(true);
    try {
      const [startHour, startMin] = startTime.split(':').map(Number);
      const [endHour, endMin] = endTime.split(':').map(Number);
      const startDate = new Date(date);
      startDate.setHours(startHour, startMin, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(endHour, endMin, 0, 0);

      onSave({
        id: event?.id,
        title: title.trim(),
        type,
        startTime: startDate,
        endTime: endDate,
        isAllDay,
        location: location.trim() || undefined,
        description: description.trim() || undefined,
      });

      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (event?.id && onDelete) {
      onDelete(event.id);
      onOpenChange(false);
    }
  };

  // Handle keyboard shortcut (⌘+Enter)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/80 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
          )}
        />

        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
            'w-[520px] max-w-[90vw] max-h-[90vh]',
            'bg-linear-bg-secondary border border-linear-border-subtle rounded-xl',
            'shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]',
            'overflow-hidden flex flex-col',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
          )}
          onKeyDown={handleKeyDown}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-linear-border-subtle px-5 py-4">
            <DialogPrimitive.Title className="text-[15px] font-semibold text-linear-text-primary">
              {isEditing ? 'Editează Eveniment' : 'Eveniment Nou'}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-md',
                  'text-linear-text-tertiary hover:bg-linear-bg-hover hover:text-linear-text-primary',
                  'transition-colors'
                )}
              >
                <X className="h-4 w-4" />
              </button>
            </DialogPrimitive.Close>
          </div>

          {/* Body */}
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {/* Title */}
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-linear-text-tertiary">
                Titlu
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Numele evenimentului"
                autoFocus
              />
            </div>

            {/* Event Type */}
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-linear-text-tertiary">
                Tip Eveniment
              </label>
              <div className="flex flex-wrap gap-2">
                {eventTypes.map((t) => {
                  const colors = eventColors[t];
                  const isSelected = type === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={cn(
                        'flex items-center gap-2 rounded-md border px-3 py-1.5 text-[13px]',
                        'transition-all',
                        isSelected
                          ? 'border-linear-accent bg-linear-accent/10 text-linear-text-primary'
                          : 'border-linear-border-subtle hover:border-linear-border-default'
                      )}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: colors.border }}
                      />
                      {eventTypeLabels[t]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-linear-text-tertiary">
                  Data
                </label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <label className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-linear-text-tertiary">
                  Toată ziua
                  <input
                    type="checkbox"
                    checked={isAllDay}
                    onChange={(e) => setIsAllDay(e.target.checked)}
                    className="h-4 w-4 rounded border-linear-border-subtle bg-linear-bg-tertiary"
                  />
                </label>
              </div>
            </div>

            {/* Time Range */}
            {!isAllDay && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-linear-text-tertiary">
                    Ora Început
                  </label>
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-linear-text-tertiary">
                    Ora Sfârșit
                  </label>
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
              </div>
            )}

            {/* Location */}
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-linear-text-tertiary">
                Locație
              </label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ex: Tribunalul București, Sala 5"
              />
            </div>

            {/* Description */}
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-linear-text-tertiary">
                Descriere
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalii suplimentare..."
                rows={3}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-linear-border-subtle bg-linear-bg-tertiary px-5 py-4">
            <div className="flex items-center gap-1 text-xs text-linear-text-muted">
              <kbd className="rounded border border-linear-border-subtle bg-linear-bg-hover px-1.5 py-0.5 text-[11px] text-linear-text-tertiary">
                ⌘
              </kbd>
              <span>+</span>
              <kbd className="rounded border border-linear-border-subtle bg-linear-bg-hover px-1.5 py-0.5 text-[11px] text-linear-text-tertiary">
                Enter
              </kbd>
              <span className="ml-1">salvează</span>
            </div>

            <div className="flex items-center gap-2.5">
              {isEditing && onDelete && (
                <Button variant="danger" onClick={handleDelete}>
                  Șterge
                </Button>
              )}
              <DialogPrimitive.Close asChild>
                <Button variant="secondary">Anulează</Button>
              </DialogPrimitive.Close>
              <Button variant="primary" onClick={handleSubmit} loading={loading}>
                {isEditing ? 'Salvează' : 'Creează'}
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ====================================================================
// EventDetailModal - View event details (read-only with edit/delete)
// ====================================================================

interface EventDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEvent | null;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (eventId: string) => void;
}

export function EventDetailModal({
  open,
  onOpenChange,
  event,
  onEdit,
  onDelete,
}: EventDetailModalProps) {
  if (!event) return null;

  const colors = eventColors[event.type];

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/80 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
          )}
        />

        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
            'w-[400px] max-w-[90vw]',
            'bg-linear-bg-secondary border border-linear-border-subtle rounded-xl',
            'shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]',
            'overflow-hidden',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
          )}
        >
          {/* Colored Header */}
          <div
            className="border-b px-5 py-4"
            style={{ borderBottomColor: colors.border, backgroundColor: colors.bg }}
          >
            <div className="flex items-start justify-between">
              <div>
                <span
                  className="mb-1 inline-block rounded px-2 py-0.5 text-[11px] font-medium"
                  style={{ backgroundColor: colors.border, color: 'white' }}
                >
                  {eventTypeLabels[event.type]}
                </span>
                <DialogPrimitive.Title
                  className="text-lg font-semibold"
                  style={{ color: colors.text }}
                >
                  {event.title}
                </DialogPrimitive.Title>
              </div>
              <DialogPrimitive.Close asChild>
                <button
                  type="button"
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-md',
                    'hover:bg-white/10 transition-colors'
                  )}
                  style={{ color: colors.text }}
                >
                  <X className="h-4 w-4" />
                </button>
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* Body */}
          <div className="space-y-4 px-5 py-5">
            {/* Date and Time */}
            <div className="flex items-start gap-3">
              <svg
                className="mt-0.5 h-5 w-5 flex-shrink-0 text-linear-text-muted"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <div>
                <div className="text-sm text-linear-text-primary">
                  {format(event.startTime, 'EEEE, d MMMM yyyy')}
                </div>
                {event.isAllDay ? (
                  <div className="text-sm text-linear-text-secondary">Toată ziua</div>
                ) : (
                  <div className="text-sm text-linear-text-secondary">
                    {format(event.startTime, 'HH:mm')} - {format(event.endTime, 'HH:mm')}
                  </div>
                )}
              </div>
            </div>

            {/* Location */}
            {event.location && (
              <div className="flex items-start gap-3">
                <svg
                  className="mt-0.5 h-5 w-5 flex-shrink-0 text-linear-text-muted"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <div className="text-sm text-linear-text-primary">{event.location}</div>
              </div>
            )}

            {/* Case Link */}
            {event.caseName && (
              <div className="flex items-start gap-3">
                <svg
                  className="mt-0.5 h-5 w-5 flex-shrink-0 text-linear-text-muted"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <div className="text-sm text-linear-accent hover:underline cursor-pointer">
                  {event.caseName}
                </div>
              </div>
            )}

            {/* Description */}
            {event.description && (
              <div className="flex items-start gap-3">
                <svg
                  className="mt-0.5 h-5 w-5 flex-shrink-0 text-linear-text-muted"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h7"
                  />
                </svg>
                <div className="text-sm text-linear-text-secondary">{event.description}</div>
              </div>
            )}

            {/* Assignee */}
            {event.assigneeName && (
              <div className="flex items-start gap-3">
                <svg
                  className="mt-0.5 h-5 w-5 flex-shrink-0 text-linear-text-muted"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                <div className="flex items-center gap-2">
                  {event.assigneeInitials && (
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                      style={{ backgroundColor: event.assigneeColor || '#6366f1' }}
                    >
                      {event.assigneeInitials}
                    </span>
                  )}
                  <span className="text-sm text-linear-text-primary">{event.assigneeName}</span>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2.5 border-t border-linear-border-subtle bg-linear-bg-tertiary px-5 py-4">
            <Button
              variant="danger"
              onClick={() => {
                onDelete(event.id);
                onOpenChange(false);
              }}
            >
              Șterge
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                onEdit(event);
                onOpenChange(false);
              }}
            >
              Editează
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
