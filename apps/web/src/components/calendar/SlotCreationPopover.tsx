'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Briefcase, Building2, Users, Clock, FolderKanban } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { CaseSearchField } from '@/components/forms/fields/CaseSearchField';
import { ClientSearchField } from '@/components/forms/fields/ClientSearchField';
import { TeamMemberSelect, type TeamAssignment } from '@/components/cases/TeamMemberSelect';
import { useTeamMembers } from '@/hooks/mobile/useTeamMembers';
import type { TaskType, TaskPriority } from '@/hooks/mobile/useCreateTask';
import type { EventType } from '@/hooks/useCreateEvent';

// ============================================
// TYPES
// ============================================

interface CaseOption {
  id: string;
  caseNumber: string;
  title: string;
}

interface ClientOption {
  id: string;
  name: string;
}

type Scope = 'case' | 'client' | 'firm';
type TaskLevel = 'case' | 'client' | 'internal';

export interface SlotCreationFormValues {
  type: 'task' | 'event';
  title: string;
  itemType: string; // TaskType or EventType
  duration: number; // minutes (used for events)
  startTime: string; // HH:MM
  scope: Scope;
  case?: CaseOption | null;
  client?: ClientOption | null;
  assigneeId?: string;
  attendees?: TeamAssignment[];
  // Task-specific fields
  priority?: TaskPriority;
  description?: string;
  estimatedHours?: number; // used for tasks
}

export interface SlotCreationPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The type of item to create - decided by context menu */
  itemKind: 'task' | 'event';
  columnDate: Date;
  initialTime: { hour: number; minute: number };
  /** Position of the clicked slot for chat bubble positioning */
  slotPosition: { top: number; left: number; right: number; bottom: number };
  onFormChange: (values: SlotCreationFormValues) => void;
  onSubmit: (values: SlotCreationFormValues) => void;
  isSubmitting?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const TASK_TYPES: { value: TaskType; label: string }[] = [
  { value: 'Research', label: 'Cercetare' },
  { value: 'DocumentCreation', label: 'Creare Document' },
  { value: 'DocumentRetrieval', label: 'Obținere Document' },
  { value: 'CourtDate', label: 'Termen Instanță' },
  { value: 'Meeting', label: 'Întâlnire' },
  { value: 'BusinessTrip', label: 'Deplasare' },
];

const EVENT_TYPES: { value: EventType; label: string; color: string }[] = [
  { value: 'CourtDate', label: 'Termene Instanță', color: '#EF4444' },
  { value: 'Hearing', label: 'Audieri', color: '#EC4899' },
  { value: 'LegalDeadline', label: 'Termene Legale', color: '#F59E0B' },
  { value: 'Meeting', label: 'Întâlniri', color: '#3B82F6' },
  { value: 'Reminder', label: 'Mementouri', color: '#22C55E' },
];

const DURATION_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1h' },
  { value: 90, label: '1h 30m' },
  { value: 120, label: '2h' },
  { value: 180, label: '3h' },
  { value: 240, label: '4h' },
];

// Hours for time picker (6-22)
const HOUR_OPTIONS = Array.from({ length: 17 }, (_, i) => {
  const hour = i + 6;
  return { value: hour.toString(), label: hour.toString().padStart(2, '0') };
});

// Minutes in 15-minute increments
const MINUTE_OPTIONS = [
  { value: '0', label: '00' },
  { value: '15', label: '15' },
  { value: '30', label: '30' },
  { value: '45', label: '45' },
];

// Priority options for tasks
const PRIORITY_OPTIONS: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'Low', label: 'Scăzută', color: 'bg-gray-400' },
  { value: 'Medium', label: 'Medie', color: 'bg-blue-400' },
  { value: 'High', label: 'Ridicată', color: 'bg-amber-400' },
  { value: 'Urgent', label: 'Urgentă', color: 'bg-red-400' },
];

// Task level options
const TASK_LEVEL_OPTIONS: { value: TaskLevel; label: string; icon: React.ReactNode }[] = [
  { value: 'case', label: 'Dosar', icon: <FolderKanban className="w-4 h-4" /> },
  { value: 'client', label: 'Client', icon: <Building2 className="w-4 h-4" /> },
  { value: 'internal', label: 'Intern', icon: <Users className="w-4 h-4" /> },
];

// Estimated hours options (matching CreateTaskModal)
const HOUR_ESTIMATE_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 16, 24, 40];
const MINUTE_ESTIMATE_OPTIONS = [0, 15, 30, 45];

// ============================================
// HELPERS
// ============================================

function formatTime(hour: number, minute: number): string {
  // Snap to nearest 15-minute increment
  const snappedMinute = Math.round(minute / 15) * 15;
  const adjustedHour = snappedMinute === 60 ? hour + 1 : hour;
  const finalMinute = snappedMinute === 60 ? 0 : snappedMinute;
  return `${adjustedHour.toString().padStart(2, '0')}:${finalMinute.toString().padStart(2, '0')}`;
}

// ============================================
// COMPONENT
// ============================================

const POPOVER_WIDTH = 420;
const POPOVER_PADDING = 16;
const ARROW_SIZE = 10;

export function SlotCreationPopover({
  open,
  onOpenChange,
  itemKind,
  columnDate,
  initialTime,
  slotPosition,
  onFormChange,
  onSubmit,
  isSubmitting = false,
}: SlotCreationPopoverProps) {
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const titleInputRef = React.useRef<HTMLInputElement>(null);
  const [position, setPosition] = React.useState<{
    x: number;
    y: number;
    side: 'left' | 'right';
    arrowY: number;
  }>({ x: 0, y: 0, side: 'right', arrowY: 50 });

  // Calculate position based on slot position
  React.useEffect(() => {
    if (!open) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const popoverHeight = Math.min(500, viewportHeight - POPOVER_PADDING * 2); // Estimate

    // Prefer right side, fall back to left
    const rightSpace = viewportWidth - slotPosition.right;
    const leftSpace = slotPosition.left;

    let x: number;
    let side: 'left' | 'right';

    if (rightSpace >= POPOVER_WIDTH + POPOVER_PADDING + ARROW_SIZE) {
      // Position to the right of the slot
      x = slotPosition.right + ARROW_SIZE;
      side = 'right';
    } else if (leftSpace >= POPOVER_WIDTH + POPOVER_PADDING + ARROW_SIZE) {
      // Position to the left of the slot
      x = slotPosition.left - POPOVER_WIDTH - ARROW_SIZE;
      side = 'left';
    } else {
      // Not enough space on either side, position to the right but allow overlap
      x = Math.min(
        slotPosition.right + ARROW_SIZE,
        viewportWidth - POPOVER_WIDTH - POPOVER_PADDING
      );
      side = 'right';
    }

    // Vertical positioning: align with slot center, clamped to viewport
    const slotCenterY = (slotPosition.top + slotPosition.bottom) / 2;
    let y = slotCenterY - popoverHeight / 2;

    // Clamp to viewport
    y = Math.max(POPOVER_PADDING, Math.min(y, viewportHeight - popoverHeight - POPOVER_PADDING));

    // Calculate arrow position relative to popover
    const arrowY = Math.max(20, Math.min(slotCenterY - y, popoverHeight - 20));

    setPosition({ x, y, side, arrowY });
  }, [open, slotPosition]);

  // Form state
  const [title, setTitle] = React.useState('');
  const [itemType, setItemType] = React.useState<string>(
    itemKind === 'task' ? 'Research' : 'CourtDate'
  );
  const [duration, setDuration] = React.useState(60);
  const [startTime, setStartTime] = React.useState(
    formatTime(initialTime.hour, initialTime.minute)
  );
  const [scope, setScope] = React.useState<Scope>('case');
  const [selectedCase, setSelectedCase] = React.useState<CaseOption | null>(null);
  const [selectedClient, setSelectedClient] = React.useState<ClientOption | null>(null);
  const [assigneeId, setAssigneeId] = React.useState('');
  const [attendees, setAttendees] = React.useState<TeamAssignment[]>([]);
  const [priority, setPriority] = React.useState<TaskPriority>('Medium');
  const [description, setDescription] = React.useState('');
  // Task-specific: level and estimated duration
  const [taskLevel, setTaskLevel] = React.useState<TaskLevel>('case');
  const [estimatedHours, setEstimatedHours] = React.useState(0);
  const [estimatedMinutes, setEstimatedMinutes] = React.useState(0);

  // Team members for assignee selection
  const { members: teamMembers } = useTeamMembers();

  // Reset form when popover opens or itemKind changes
  React.useEffect(() => {
    if (open) {
      setTitle('');
      setItemType(itemKind === 'task' ? 'Research' : 'CourtDate');
      setDuration(60);
      setStartTime(formatTime(initialTime.hour, initialTime.minute));
      setScope('case');
      setSelectedCase(null);
      setSelectedClient(null);
      setAssigneeId('');
      setAttendees([]);
      setPriority('Medium');
      setDescription('');
      setTaskLevel('case');
      setEstimatedHours(0);
      setEstimatedMinutes(0);

      // Focus title input after a short delay
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
    }
  }, [open, itemKind, initialTime]);

  // Notify parent of form changes
  React.useEffect(() => {
    if (open) {
      const totalEstimatedHours = estimatedHours + estimatedMinutes / 60;
      onFormChange({
        type: itemKind,
        title,
        itemType,
        duration,
        startTime,
        scope,
        case: selectedCase,
        client: selectedClient,
        assigneeId: assigneeId || undefined,
        attendees: attendees.length > 0 ? attendees : undefined,
        priority: itemKind === 'task' ? priority : undefined,
        description: itemKind === 'task' && description ? description : undefined,
        estimatedHours: itemKind === 'task' ? totalEstimatedHours : undefined,
      });
    }
  }, [
    open,
    itemKind,
    title,
    itemType,
    duration,
    startTime,
    scope,
    selectedCase,
    selectedClient,
    assigneeId,
    attendees,
    priority,
    description,
    estimatedHours,
    estimatedMinutes,
    onFormChange,
  ]);

  // Handle scope change (for events)
  const handleScopeChange = (newScope: Scope) => {
    setScope(newScope);
    if (newScope !== 'case') setSelectedCase(null);
    if (newScope !== 'client') setSelectedClient(null);
  };

  // Handle task level change (for tasks)
  const handleTaskLevelChange = (newLevel: TaskLevel) => {
    setTaskLevel(newLevel);
    // Map task level to scope for the form values
    const scopeMap: Record<TaskLevel, Scope> = {
      case: 'case',
      client: 'client',
      internal: 'firm',
    };
    setScope(scopeMap[newLevel]);
    if (newLevel !== 'case') setSelectedCase(null);
    if (newLevel !== 'client') setSelectedClient(null);
  };

  // Handle submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Validation based on scope
    if (scope === 'case' && !selectedCase) return;
    if (scope === 'client' && !selectedClient) return;
    // Tasks require an assignee
    if (itemKind === 'task' && !assigneeId) return;

    const totalEstimatedHours = estimatedHours + estimatedMinutes / 60;

    onSubmit({
      type: itemKind,
      title: title.trim(),
      itemType,
      duration,
      startTime,
      scope,
      case: selectedCase,
      client: selectedClient,
      assigneeId: assigneeId || undefined,
      attendees: attendees.length > 0 ? attendees : undefined,
      priority: itemKind === 'task' ? priority : undefined,
      description: itemKind === 'task' && description ? description : undefined,
      estimatedHours: itemKind === 'task' ? totalEstimatedHours : undefined,
    });
  };

  // Handle escape key
  React.useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  // Click outside to close
  React.useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        // Check if click is on a portal (dropdown, etc.)
        const target = e.target as HTMLElement;
        if (
          target.closest('[role="listbox"]') ||
          target.closest('[data-radix-popper-content-wrapper]')
        ) {
          return;
        }
        onOpenChange(false);
      }
    };

    // Delay to prevent immediate close from the triggering click
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, onOpenChange]);

  if (!open || typeof document === 'undefined') return null;

  const types = itemKind === 'task' ? TASK_TYPES : EVENT_TYPES;
  const isTask = itemKind === 'task';

  // Validation checks for submit button
  const canSubmit =
    title.trim() &&
    (scope === 'firm' ||
      (scope === 'case' && selectedCase) ||
      (scope === 'client' && selectedClient)) &&
    (!isTask ||
      (assigneeId &&
        (taskLevel === 'internal' ||
          (taskLevel === 'case' && selectedCase) ||
          (taskLevel === 'client' && selectedClient))));

  return createPortal(
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Backdrop */}
      <div className="absolute inset-0 pointer-events-auto" onClick={() => onOpenChange(false)} />

      {/* Popover - positioned like a chat bubble next to the slot */}
      <div
        ref={popoverRef}
        className={cn(
          'fixed w-[420px] max-h-[85vh] overflow-y-auto pointer-events-auto',
          'bg-linear-bg-elevated border border-linear-border-subtle rounded-lg shadow-xl'
        )}
        style={{
          left: position.x,
          top: position.y,
          transformOrigin:
            position.side === 'right' ? `left ${position.arrowY}px` : `right ${position.arrowY}px`,
          animation: 'popover-grow 200ms ease-out forwards',
        }}
      >
        <style>{`
          @keyframes popover-grow {
            from {
              opacity: 0;
              transform: scale(0.9);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}</style>
        {/* Arrow pointing to the slot */}
        <div
          className={cn(
            'absolute w-0 h-0',
            position.side === 'right'
              ? 'left-0 -translate-x-full border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent border-r-[10px] border-r-linear-border-subtle'
              : 'right-0 translate-x-full border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent border-l-[10px] border-l-linear-border-subtle'
          )}
          style={{ top: position.arrowY - 10 }}
        />
        <div
          className={cn(
            'absolute w-0 h-0',
            position.side === 'right'
              ? 'left-0 -translate-x-[calc(100%-1px)] border-t-[9px] border-t-transparent border-b-[9px] border-b-transparent border-r-[9px] border-r-linear-bg-elevated'
              : 'right-0 translate-x-[calc(100%-1px)] border-t-[9px] border-t-transparent border-b-[9px] border-b-transparent border-l-[9px] border-l-linear-bg-elevated'
          )}
          style={{ top: position.arrowY - 9 }}
        />
        <form onSubmit={handleSubmit}>
          {isTask ? (
            /* ============================================
               TASK FORM - Matches CreateTaskModal structure
               ============================================ */
            <>
              {/* Title Input - Hero style */}
              <div className="px-4 pt-3 pb-3 border-b border-linear-border-subtle">
                <input
                  ref={titleInputRef}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ce trebuie făcut?"
                  className={cn(
                    'w-full text-base font-medium bg-transparent border-0',
                    'text-linear-text-primary placeholder:text-linear-text-muted',
                    'focus:outline-none focus:ring-0'
                  )}
                />
              </div>

              {/* Quick Actions Row */}
              <div className="px-4 py-2.5 border-b border-linear-border-subtle bg-linear-bg-tertiary/30">
                <div className="flex items-center justify-center gap-3">
                  {/* Priority */}
                  <div className="flex items-center gap-1.5">
                    <div
                      className={cn(
                        'w-2 h-2 rounded-full',
                        PRIORITY_OPTIONS.find((p) => p.value === priority)?.color
                      )}
                    />
                    <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                      <SelectTrigger className="h-7 text-xs border-0 bg-transparent px-1 hover:bg-linear-bg-hover w-auto">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <span className="flex items-center gap-2">
                              <span className={cn('w-2 h-2 rounded-full', opt.color)} />
                              {opt.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-px h-4 bg-linear-border-subtle" />

                  {/* Task Type */}
                  <div className="flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-linear-text-tertiary" />
                    <Select value={itemType} onValueChange={setItemType}>
                      <SelectTrigger className="h-7 text-xs border-0 bg-transparent px-1 hover:bg-linear-bg-hover w-auto">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-px h-4 bg-linear-border-subtle" />

                  {/* Estimated Duration */}
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-linear-text-tertiary" />
                    <Select
                      value={estimatedHours.toString()}
                      onValueChange={(v) => setEstimatedHours(parseInt(v, 10))}
                    >
                      <SelectTrigger className="h-7 text-xs border-0 bg-transparent px-1 hover:bg-linear-bg-hover w-[44px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HOUR_ESTIMATE_OPTIONS.map((h) => (
                          <SelectItem key={h} value={h.toString()}>
                            {h}h
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={estimatedMinutes.toString()}
                      onValueChange={(v) => setEstimatedMinutes(parseInt(v, 10))}
                    >
                      <SelectTrigger className="h-7 text-xs border-0 bg-transparent px-1 hover:bg-linear-bg-hover w-[52px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MINUTE_ESTIMATE_OPTIONS.map((m) => (
                          <SelectItem key={m} value={m.toString()}>
                            {m}min
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="px-4 py-3 border-b border-linear-border-subtle">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalii suplimentare..."
                  rows={2}
                  className={cn(
                    'w-full px-3 py-2 text-sm rounded-md resize-none',
                    'bg-linear-bg-tertiary border border-linear-border-subtle',
                    'text-linear-text-primary placeholder:text-linear-text-muted',
                    'focus:outline-none focus:ring-2 focus:ring-linear-accent focus:border-transparent',
                    'transition-colors'
                  )}
                />
              </div>

              {/* Task Level + Target Selection */}
              <div className="px-4 py-3 border-b border-linear-border-subtle">
                <div className="flex items-center gap-2">
                  {/* Task Level Dropdown */}
                  <Select
                    value={taskLevel}
                    onValueChange={(v) => handleTaskLevelChange(v as TaskLevel)}
                  >
                    <SelectTrigger className="w-[120px] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_LEVEL_OPTIONS.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          <span className="flex items-center gap-2">
                            {level.icon}
                            {level.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Case Search */}
                  {taskLevel === 'case' && (
                    <div className="flex-1">
                      <CaseSearchField
                        value={selectedCase}
                        onChange={setSelectedCase}
                        placeholder="Caută un dosar..."
                      />
                    </div>
                  )}

                  {/* Client Search */}
                  {taskLevel === 'client' && (
                    <div className="flex-1">
                      <ClientSearchField
                        value={selectedClient}
                        onChange={setSelectedClient}
                        placeholder="Caută un client..."
                      />
                    </div>
                  )}

                  {/* Internal */}
                  {taskLevel === 'internal' && (
                    <div className="flex-1 flex items-center h-9 px-3 rounded-md bg-linear-bg-tertiary border border-linear-border-subtle">
                      <span className="text-xs text-linear-text-tertiary">Sarcină internă</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Assignee */}
              <div className="px-4 py-3">
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Selectează responsabil..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.firstName} {member.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end px-4 py-2.5 border-t border-linear-border-subtle">
                <Button
                  type="submit"
                  size="sm"
                  disabled={!canSubmit || isSubmitting}
                  loading={isSubmitting}
                >
                  Creează
                </Button>
              </div>
            </>
          ) : (
            /* ============================================
               EVENT FORM - Original structure
               ============================================ */
            <>
              {/* Content */}
              <div className="p-3 space-y-3">
                {/* Title Input */}
                <div>
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Titlu eveniment..."
                    className={cn(
                      'w-full h-9 px-3 text-sm rounded-md',
                      'bg-linear-bg-tertiary border border-linear-border-subtle',
                      'text-linear-text-primary placeholder:text-linear-text-muted',
                      'focus:outline-none focus:ring-2 focus:ring-linear-accent focus:border-transparent',
                      'transition-colors'
                    )}
                  />
                </div>

                {/* Scope Selector */}
                <div className="flex rounded-md bg-linear-bg-tertiary p-0.5 gap-0.5">
                  <button
                    type="button"
                    onClick={() => handleScopeChange('case')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs transition-all',
                      scope === 'case'
                        ? 'bg-linear-bg-elevated text-linear-text-primary shadow-sm'
                        : 'text-linear-text-secondary hover:text-linear-text-primary'
                    )}
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    Dosar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScopeChange('client')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs transition-all',
                      scope === 'client'
                        ? 'bg-linear-bg-elevated text-linear-text-primary shadow-sm'
                        : 'text-linear-text-secondary hover:text-linear-text-primary'
                    )}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    Client
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScopeChange('firm')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs transition-all',
                      scope === 'firm'
                        ? 'bg-linear-bg-elevated text-linear-text-primary shadow-sm'
                        : 'text-linear-text-secondary hover:text-linear-text-primary'
                    )}
                  >
                    <Users className="w-3.5 h-3.5" />
                    Firmă
                  </button>
                </div>

                {/* Case Search - shown when scope is 'case' */}
                {scope === 'case' && (
                  <CaseSearchField
                    value={selectedCase}
                    onChange={setSelectedCase}
                    placeholder="Caută dosar..."
                  />
                )}

                {/* Client Search - shown when scope is 'client' */}
                {scope === 'client' && (
                  <ClientSearchField
                    value={selectedClient}
                    onChange={setSelectedClient}
                    placeholder="Caută client..."
                  />
                )}

                {/* Firm scope info */}
                {scope === 'firm' && (
                  <div className="rounded-md bg-linear-bg-tertiary border border-linear-border-subtle p-2.5">
                    <p className="text-xs text-linear-text-secondary">
                      Eveniment la nivel de firmă, fără asociere cu un dosar sau client.
                    </p>
                  </div>
                )}

                {/* Type Selector */}
                <Select value={itemType} onValueChange={setItemType}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Selectează tipul" />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: type.color }}
                          />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Time + Duration Row */}
                <div className="flex gap-2">
                  {/* Hour */}
                  <Select
                    value={parseInt(startTime.split(':')[0] || '9', 10).toString()}
                    onValueChange={(h) => {
                      const mins = startTime.split(':')[1] || '00';
                      setStartTime(`${h.padStart(2, '0')}:${mins}`);
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm w-16">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOUR_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="flex items-center text-linear-text-tertiary">:</span>
                  {/* Minutes */}
                  <Select
                    value={parseInt(startTime.split(':')[1] || '0', 10).toString()}
                    onValueChange={(m) => {
                      const hrs = startTime.split(':')[0] || '09';
                      setStartTime(`${hrs}:${m.padStart(2, '0')}`);
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm w-16">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MINUTE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Duration */}
                  <Select
                    value={duration.toString()}
                    onValueChange={(v) => setDuration(parseInt(v, 10))}
                  >
                    <SelectTrigger className="h-9 text-sm w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATION_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value.toString()}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Attendees */}
                <TeamMemberSelect value={attendees} onChange={setAttendees} />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end px-3 py-2 border-t border-linear-border-subtle">
                <Button
                  type="submit"
                  size="sm"
                  disabled={!canSubmit || isSubmitting}
                  loading={isSubmitting}
                >
                  Creează
                </Button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>,
    document.body
  );
}
