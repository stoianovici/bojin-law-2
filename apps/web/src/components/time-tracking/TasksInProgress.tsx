/**
 * TasksInProgress Component
 * Displays active tasks with quick time tracking actions
 * Fetches real data from GraphQL API
 */

'use client';

import React from 'react';
import { useTimeTrackingStore } from '../../stores/time-tracking.store';
import { useMyTasks } from '../../hooks/useTasks';
import type { TimeTaskType, Task, TaskType } from '@legal-platform/types';

// Map TaskType to TimeTaskType for time tracking
function mapTaskTypeToTimeTaskType(taskType: TaskType): TimeTaskType {
  const mapping: Record<TaskType, TimeTaskType> = {
    Research: 'Research',
    DocumentCreation: 'Drafting',
    DocumentRetrieval: 'Administrative',
    Meeting: 'ClientMeeting',
    CourtDate: 'CourtAppearance',
    BusinessTrip: 'Other',
  };
  return mapping[taskType] || 'Other';
}

// Map priority from API format to component format
function mapPriority(priority: string): 'high' | 'medium' | 'low' {
  const normalized = priority.toLowerCase();
  if (normalized === 'urgent' || normalized === 'high') return 'high';
  if (normalized === 'medium') return 'medium';
  return 'low';
}

interface TaskInProgress {
  id: string;
  title: string;
  caseId: string;
  caseName: string;
  priority: 'high' | 'medium' | 'low';
  dueDate: Date;
  assignee: string;
  suggestedTimeTaskType: TimeTaskType;
}

const taskTypeLabels: Record<TimeTaskType, string> = {
  Research: 'Cercetare',
  Drafting: 'Redactare',
  ClientMeeting: 'Întâlnire Client',
  CourtAppearance: 'Prezentare Instanță',
  Email: 'Email',
  PhoneCall: 'Apel Telefonic',
  Administrative: 'Administrativ',
  Other: 'Altele',
};

const priorityConfig = {
  high: { label: 'Prioritate Ridicată', color: 'bg-red-100 text-red-700 border-red-200' },
  medium: { label: 'Prioritate Medie', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  low: { label: 'Prioritate Scăzută', color: 'bg-green-100 text-green-700 border-green-200' },
};

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Astăzi';
  if (diffDays === 1) return 'Mâine';
  if (diffDays === -1) return 'Ieri';
  if (diffDays < 0) return `${Math.abs(diffDays)} zile întârziere`;
  if (diffDays <= 7) return `În ${diffDays} zile`;

  return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
}

export function TasksInProgress() {
  const addTimeEntry = useTimeTrackingStore((state) => state.addTimeEntry);

  // Fetch in-progress tasks from API
  const { tasks: apiTasks, loading, error } = useMyTasks({ statuses: ['InProgress'] });

  // Transform API tasks to component format
  const tasksInProgress: TaskInProgress[] = React.useMemo(() => {
    return apiTasks.map((task: Task) => ({
      id: task.id,
      title: task.title,
      caseId: task.caseId,
      caseName: task.case?.title || 'Necunoscut',
      priority: mapPriority(task.priority),
      dueDate: new Date(task.dueDate),
      assignee: task.assignee
        ? `${task.assignee.firstName} ${task.assignee.lastName}`
        : 'Neasignat',
      suggestedTimeTaskType: mapTaskTypeToTimeTaskType(task.type),
    }));
  }, [apiTasks]);

  const [showQuickEntry, setShowQuickEntry] = React.useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = React.useState(60); // Default 1 hour
  const pickerRef = React.useRef<HTMLDivElement>(null);

  // Generate duration options in 15-minute increments (up to 8 hours)
  const durationOptions = React.useMemo(() => {
    const options = [];
    for (let i = 15; i <= 480; i += 15) {
      const hours = Math.floor(i / 60);
      const mins = i % 60;
      const label = hours > 0 ? (mins > 0 ? `${hours}h ${mins}min` : `${hours}h`) : `${mins}min`;
      options.push({ value: i, label });
    }
    return options;
  }, []);

  // Auto-scroll to selected item when picker opens
  React.useEffect(() => {
    if (showQuickEntry && pickerRef.current) {
      const selectedIndex = durationOptions.findIndex((opt) => opt.value === selectedDuration);
      if (selectedIndex >= 0) {
        const scrollTop = selectedIndex * 40 - 80; // 40px per item, center it
        pickerRef.current.scrollTop = Math.max(0, scrollTop);
      }
    }
  }, [showQuickEntry, selectedDuration, durationOptions]);

  const handleCompleteTask = (task: TaskInProgress, durationMinutes: number) => {
    // TODO: Get userId and userName from auth context
    addTimeEntry({
      userId: '', // Should come from auth context
      userName: '', // Should come from auth context
      caseId: task.caseId,
      caseName: task.caseName,
      taskType: task.suggestedTimeTaskType,
      date: new Date(),
      duration: durationMinutes,
      description: task.title,
      isBillable: true,
    });

    // Reset
    setShowQuickEntry(null);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Sarcini în Lucru</h2>
        <p className="text-sm text-gray-500 mt-1">Adaugă pontaj rapid pentru sarcinile active</p>
      </div>

      {/* Tasks List */}
      <div className="divide-y divide-gray-200">
        {/* Loading state */}
        {loading && (
          <div className="px-6 py-8 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 mt-2">Se încarcă...</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="px-6 py-4">
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
              Eroare la încărcarea sarcinilor: {error.message}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && tasksInProgress.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <p className="text-gray-500">Nu există sarcini în lucru</p>
          </div>
        ) : null}

        {/* Tasks */}
        {!loading &&
          !error &&
          tasksInProgress.length > 0 &&
          tasksInProgress.map((task) => (
            <div key={task.id} className="px-6 py-4 hover:bg-gray-50">
              {/* Task Info */}
              <div className="mb-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-900 mb-1">{task.title}</h3>
                    <p className="text-xs text-gray-600">{task.caseName}</p>
                  </div>
                  <span
                    className={`ml-3 px-2 py-1 text-xs font-medium rounded border ${
                      priorityConfig[task.priority].color
                    }`}
                  >
                    {priorityConfig[task.priority].label}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    {formatRelativeDate(task.dueDate)}
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                      />
                    </svg>
                    {taskTypeLabels[task.suggestedTimeTaskType]}
                  </span>
                </div>
              </div>

              {/* Quick Actions */}
              {showQuickEntry === task.id ? (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Selectează durata
                  </label>

                  {/* Mobile-style picker */}
                  <div className="relative bg-gray-50 rounded-lg p-4 border border-gray-200">
                    {/* Selected value display */}
                    <div className="text-center mb-3">
                      <span className="text-3xl font-semibold text-gray-900">
                        {durationOptions.find((opt) => opt.value === selectedDuration)?.label ||
                          '1h'}
                      </span>
                    </div>

                    {/* Scrollable picker */}
                    <div className="relative h-48 overflow-hidden">
                      {/* Highlight band */}
                      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-12 bg-blue-50 border-y-2 border-blue-200 pointer-events-none rounded-md z-0" />

                      {/* Scrollable list */}
                      <div
                        ref={pickerRef}
                        className="relative z-10 h-full overflow-y-auto px-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-gray-400"
                        style={{
                          scrollbarWidth: 'thin',
                          scrollbarColor: '#cbd5e1 transparent',
                        }}
                      >
                        <div className="py-16">
                          {durationOptions.map((option) => (
                            <button
                              key={option.value}
                              onClick={() => setSelectedDuration(option.value)}
                              className={`w-full py-2 text-center transition-all ${
                                selectedDuration === option.value
                                  ? 'text-xl font-semibold text-blue-600'
                                  : 'text-base text-gray-500 hover:text-gray-900'
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        handleCompleteTask(task, selectedDuration);
                        setSelectedDuration(60); // Reset to default
                      }}
                      className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium"
                    >
                      Confirmă
                    </button>
                    <button
                      onClick={() => {
                        setShowQuickEntry(null);
                        setSelectedDuration(60); // Reset to default
                      }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                    >
                      Anulează
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowQuickEntry(task.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Finalizează Sarcina
                  </button>
                  <button
                    onClick={() => setShowQuickEntry(task.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    Adaugă Intrare
                  </button>
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
