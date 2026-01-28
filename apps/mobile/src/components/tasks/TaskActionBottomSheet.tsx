'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Clock, ChevronRight, ArrowLeft, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { BottomSheet, BottomSheetContent } from '@/components/ui';
import { useTaskTimeLog, type TimeEntry } from '@/hooks/useTaskTimeLog';
import { formatDuration, formatTimeEntryDate } from '@/lib/formatters';
import type { Task } from '@/hooks/useTasks';

// ============================================
// Types
// ============================================

type SheetView = 'menu' | 'time' | 'complete';

interface TaskActionBottomSheetProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onComplete: (taskId: string) => Promise<void>;
}

// ============================================
// Constants
// ============================================

const QUICK_HOURS = [0.25, 0.5, 1, 1.5, 2, 3, 4, 8];

// ============================================
// Component
// ============================================

export function TaskActionBottomSheet({
  task,
  open,
  onClose,
  onComplete,
}: TaskActionBottomSheetProps) {
  const router = useRouter();
  const [view, setView] = useState<SheetView>('menu');
  const [manualHours, setManualHours] = useState('');
  const [completing, setCompleting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedHours, setSelectedHours] = useState<number | null>(null);

  const { entries, totalHours, loading, logging, logTime, refetch } = useTaskTimeLog(
    task?.id ?? null
  );

  // Reset state when sheet opens/closes or task changes
  useEffect(() => {
    if (open) {
      setView('menu');
      setManualHours('');
      setSuccessMessage(null);
      setSelectedHours(null);
    }
  }, [open, task?.id]);

  // Handle complete task without time
  const handleCompleteWithoutTime = async () => {
    if (!task) return;
    setCompleting(true);
    try {
      await onComplete(task.id);
      onClose();
    } finally {
      setCompleting(false);
    }
  };

  // Handle complete task with time
  const handleCompleteWithTime = async () => {
    if (!task) return;

    // Get hours from selection or manual input
    const hours = selectedHours ?? parseFloat(manualHours);
    if (isNaN(hours) || hours <= 0) {
      // No time selected, just complete
      await handleCompleteWithoutTime();
      return;
    }

    setCompleting(true);
    try {
      const description = `Lucru la: ${task.title}`;
      await logTime(hours, description);
      await onComplete(task.id);
      onClose();
    } finally {
      setCompleting(false);
    }
  };

  // Handle quick time log (time view only)
  const handleQuickLog = async (hours: number) => {
    if (!task) return;
    const description = `Lucru la: ${task.title}`;
    await logTime(hours, description);
    setSuccessMessage(`${formatDuration(hours)} înregistrat`);
    setTimeout(() => setSuccessMessage(null), 2000);
  };

  // Handle manual time log (time view only)
  const handleManualLog = async () => {
    const hours = parseFloat(manualHours);
    if (isNaN(hours) || hours <= 0 || !task) return;
    const description = `Lucru la: ${task.title}`;
    await logTime(hours, description);
    setManualHours('');
    setSuccessMessage(`${formatDuration(hours)} înregistrat`);
    setTimeout(() => setSuccessMessage(null), 2000);
  };

  // Handle quick hour selection in complete view
  const handleSelectHours = (hours: number) => {
    setSelectedHours(selectedHours === hours ? null : hours);
    setManualHours('');
  };

  // Handle manual input change in complete view
  const handleManualChange = (value: string) => {
    setManualHours(value);
    setSelectedHours(null);
  };

  // Navigate to task detail
  const handleDetails = () => {
    if (!task) return;
    onClose();
    router.push(`/tasks/${task.id}`);
  };

  if (!task) return null;

  return (
    <BottomSheet open={open} onClose={onClose}>
      <BottomSheetContent className="pb-2">
        {/* Menu View */}
        {view === 'menu' && (
          <MenuView
            task={task}
            totalHours={totalHours}
            onTime={() => setView('time')}
            onComplete={() => setView('complete')}
            onDetails={handleDetails}
          />
        )}

        {/* Time Logging View */}
        {view === 'time' && (
          <TimeView
            task={task}
            entries={entries}
            totalHours={totalHours}
            loading={loading}
            logging={logging}
            manualHours={manualHours}
            successMessage={successMessage}
            onManualHoursChange={setManualHours}
            onQuickLog={handleQuickLog}
            onManualLog={handleManualLog}
            onBack={() => setView('menu')}
          />
        )}

        {/* Complete View with Time Entry */}
        {view === 'complete' && (
          <CompleteView
            task={task}
            totalHours={totalHours}
            selectedHours={selectedHours}
            manualHours={manualHours}
            completing={completing}
            logging={logging}
            onSelectHours={handleSelectHours}
            onManualChange={handleManualChange}
            onComplete={handleCompleteWithTime}
            onSkip={handleCompleteWithoutTime}
            onBack={() => setView('menu')}
          />
        )}
      </BottomSheetContent>
    </BottomSheet>
  );
}

// ============================================
// Menu View
// ============================================

interface MenuViewProps {
  task: Task;
  totalHours: number;
  onTime: () => void;
  onComplete: () => void;
  onDetails: () => void;
}

function MenuView({ task, totalHours, onTime, onComplete, onDetails }: MenuViewProps) {
  const isCompleted = task.status === 'Completed';

  return (
    <div className="space-y-2">
      {/* Task title */}
      <div className="mb-4">
        <h3 className="text-base font-semibold text-text-primary line-clamp-2">{task.title}</h3>
        {task.case && <p className="text-sm text-text-tertiary mt-0.5">{task.case.title}</p>}
        {totalHours > 0 && (
          <p className="text-xs text-accent mt-1">Timp pontat: {formatDuration(totalHours)}</p>
        )}
      </div>

      {/* Complete button */}
      {!isCompleted && (
        <ActionButton
          icon={<Check className="w-5 h-5" />}
          label="Finalizează"
          variant="success"
          onClick={onComplete}
        />
      )}

      {/* Log time button */}
      <ActionButton
        icon={<Clock className="w-5 h-5" />}
        label="Pontează"
        variant="accent"
        onClick={onTime}
      />

      {/* Details button */}
      <ActionButton
        icon={<ChevronRight className="w-5 h-5" />}
        label="Detalii"
        variant="default"
        onClick={onDetails}
      />
    </div>
  );
}

// ============================================
// Time View
// ============================================

interface TimeViewProps {
  task: Task;
  entries: TimeEntry[];
  totalHours: number;
  loading: boolean;
  logging: boolean;
  manualHours: string;
  successMessage: string | null;
  onManualHoursChange: (value: string) => void;
  onQuickLog: (hours: number) => void;
  onManualLog: () => void;
  onBack: () => void;
}

function TimeView({
  task,
  entries,
  totalHours,
  loading,
  logging,
  manualHours,
  successMessage,
  onManualHoursChange,
  onQuickLog,
  onManualLog,
  onBack,
}: TimeViewProps) {
  return (
    <div className="space-y-4">
      {/* Header with back button */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-bg-hover transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-text-secondary" />
        </button>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-text-primary">Pontează</h3>
          <p className="text-sm text-text-tertiary truncate">{task.title}</p>
        </div>
      </div>

      {/* Success message */}
      {successMessage && (
        <div className="bg-success/15 text-success text-sm font-medium py-2 px-3 rounded-lg text-center">
          {successMessage}
        </div>
      )}

      {/* Quick hours grid */}
      <div>
        <p className="text-xs text-text-tertiary mb-2">Ore</p>
        <div className="grid grid-cols-4 gap-2">
          {QUICK_HOURS.map((hours) => (
            <button
              key={hours}
              onClick={() => onQuickLog(hours)}
              disabled={logging}
              className={clsx(
                'py-2.5 rounded-lg text-sm font-medium transition-colors',
                'bg-bg-card hover:bg-bg-hover active:bg-accent/20',
                'text-text-primary',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {hours}
            </button>
          ))}
        </div>
      </div>

      {/* Manual input */}
      <div>
        <p className="text-xs text-text-tertiary mb-2">Sau introdu manual</p>
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="decimal"
            value={manualHours}
            onChange={(e) => onManualHoursChange(e.target.value)}
            placeholder="Ore..."
            className={clsx(
              'flex-1 py-2.5 px-3 rounded-lg text-sm',
              'bg-bg-card text-text-primary placeholder:text-text-tertiary',
              'border border-border focus:border-accent focus:outline-none'
            )}
          />
          <button
            onClick={onManualLog}
            disabled={logging || !manualHours || parseFloat(manualHours) <= 0}
            className={clsx(
              'px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
              'bg-accent text-white',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {logging ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvează'}
          </button>
        </div>
      </div>

      {/* Time history */}
      {(entries.length > 0 || loading) && (
        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-text-secondary">Timp pontat</p>
            {totalHours > 0 && (
              <p className="text-xs text-text-tertiary">
                Total:{' '}
                <span className="text-text-primary font-medium">{formatDuration(totalHours)}</span>
              </p>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-text-tertiary" />
            </div>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {entries.slice(0, 5).map((entry) => (
                <div key={entry.id} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-text-secondary">
                    {formatTimeEntryDate(entry.date)}
                  </span>
                  <span className="text-sm font-medium text-text-primary">
                    {formatDuration(entry.hours)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// Complete View (with optional time entry)
// ============================================

interface CompleteViewProps {
  task: Task;
  totalHours: number;
  selectedHours: number | null;
  manualHours: string;
  completing: boolean;
  logging: boolean;
  onSelectHours: (hours: number) => void;
  onManualChange: (value: string) => void;
  onComplete: () => void;
  onSkip: () => void;
  onBack: () => void;
}

function CompleteView({
  task,
  totalHours,
  selectedHours,
  manualHours,
  completing,
  logging,
  onSelectHours,
  onManualChange,
  onComplete,
  onSkip,
  onBack,
}: CompleteViewProps) {
  const hasTimeSelected = selectedHours !== null || (manualHours && parseFloat(manualHours) > 0);
  const isProcessing = completing || logging;

  return (
    <div className="space-y-4">
      {/* Header with back button */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-bg-hover transition-colors"
          disabled={isProcessing}
        >
          <ArrowLeft className="w-5 h-5 text-text-secondary" />
        </button>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-text-primary">Finalizează sarcina</h3>
          <p className="text-sm text-text-tertiary truncate">{task.title}</p>
        </div>
      </div>

      {/* Existing time info */}
      {totalHours > 0 && (
        <div className="bg-accent/10 text-accent text-sm py-2 px-3 rounded-lg">
          Timp deja pontat: {formatDuration(totalHours)}
        </div>
      )}

      {/* Quick hours grid */}
      <div>
        <p className="text-xs text-text-tertiary mb-2">Adaugă timp (opțional)</p>
        <div className="grid grid-cols-4 gap-2">
          {QUICK_HOURS.map((hours) => (
            <button
              key={hours}
              onClick={() => onSelectHours(hours)}
              disabled={isProcessing}
              className={clsx(
                'py-2.5 rounded-lg text-sm font-medium transition-colors',
                selectedHours === hours
                  ? 'bg-accent text-white'
                  : 'bg-bg-card hover:bg-bg-hover text-text-primary',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {hours}
            </button>
          ))}
        </div>
      </div>

      {/* Manual input */}
      <div>
        <p className="text-xs text-text-tertiary mb-2">Sau introdu manual</p>
        <input
          type="number"
          inputMode="decimal"
          value={manualHours}
          onChange={(e) => onManualChange(e.target.value)}
          placeholder="Ore..."
          disabled={isProcessing}
          className={clsx(
            'w-full py-2.5 px-3 rounded-lg text-sm',
            'bg-bg-card text-text-primary placeholder:text-text-tertiary',
            'border border-border focus:border-accent focus:outline-none',
            'disabled:opacity-50'
          )}
        />
      </div>

      {/* Action buttons */}
      <div className="space-y-2 pt-2">
        {/* Complete with time */}
        <button
          onClick={onComplete}
          disabled={isProcessing}
          className={clsx(
            'w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-medium transition-colors',
            'bg-success text-white',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {isProcessing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Check className="w-5 h-5" />
          )}
          {hasTimeSelected
            ? `Finalizează (+${formatDuration(selectedHours ?? parseFloat(manualHours))})`
            : 'Finalizează'}
        </button>

        {/* Skip time entry */}
        {!hasTimeSelected && (
          <button
            onClick={onSkip}
            disabled={isProcessing}
            className={clsx(
              'w-full py-3 text-sm text-text-tertiary hover:text-text-secondary transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            Finalizează fără pontaj
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================
// Action Button
// ============================================

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  variant: 'success' | 'accent' | 'default';
  onClick: () => void;
  disabled?: boolean;
}

function ActionButton({ icon, label, variant, onClick, disabled }: ActionButtonProps) {
  const variantClasses = {
    success: 'bg-success/15 text-success hover:bg-success/25',
    accent: 'bg-accent/15 text-accent hover:bg-accent/25',
    default: 'bg-bg-card text-text-primary hover:bg-bg-hover',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'w-full flex items-center gap-3 py-3.5 px-4 rounded-xl transition-colors',
        variantClasses[variant],
        'disabled:opacity-50 disabled:cursor-not-allowed'
      )}
    >
      {icon}
      <span className="text-base font-medium">{label}</span>
    </button>
  );
}
