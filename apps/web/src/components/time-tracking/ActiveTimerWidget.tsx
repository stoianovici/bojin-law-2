/**
 * ActiveTimerWidget Component
 * Displays running timer with start/pause/stop controls
 */

'use client';

import React from 'react';
import { useTimeTrackingStore } from '../../stores/time-tracking.store';
import type { TimeTaskType } from '@legal-platform/types';

const taskTypes: { value: TimeTaskType; label: string }[] = [
  { value: 'Research', label: 'Cercetare' },
  { value: 'Drafting', label: 'Redactare' },
  { value: 'ClientMeeting', label: 'Întâlnire Client' },
  { value: 'CourtAppearance', label: 'Prezentare Instanță' },
  { value: 'Email', label: 'Email' },
  { value: 'PhoneCall', label: 'Apel Telefonic' },
  { value: 'Administrative', label: 'Administrativ' },
  { value: 'Other', label: 'Altele' },
];

const mockCases = [
  { id: 'case-1', name: 'Dosar Popescu vs. SRL Construct' },
  { id: 'case-2', name: 'Contract Ionescu - Furnizare Servicii' },
  { id: 'case-3', name: 'Litigiu Georgescu - Proprietate' },
  { id: 'case-4', name: 'Advisory Dumitrescu SRL' },
  { id: 'case-5', name: 'Contencios Marin vs. Primărie' },
];

function formatElapsedTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function ActiveTimerWidget() {
  const activeTimer = useTimeTrackingStore((state) => state.activeTimer);
  const startTimer = useTimeTrackingStore((state) => state.startTimer);
  const pauseTimer = useTimeTrackingStore((state) => state.pauseTimer);
  const resumeTimer = useTimeTrackingStore((state) => state.resumeTimer);
  const stopTimer = useTimeTrackingStore((state) => state.stopTimer);
  const addTimeEntry = useTimeTrackingStore((state) => state.addTimeEntry);

  const [showStartDialog, setShowStartDialog] = React.useState(false);
  const [startFormData, setStartFormData] = React.useState({
    caseId: '',
    taskType: '' as TimeTaskType | '',
  });

  // Calculate elapsed time
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);

  React.useEffect(() => {
    if (!activeTimer.isRunning) {
      // Show paused time
      setElapsedSeconds(activeTimer.pausedTime * 60);
      return;
    }

    const calculateElapsed = () => {
      if (!activeTimer.startTime) return 0;

      const now = new Date();
      const diff = Math.floor((now.getTime() - new Date(activeTimer.startTime).getTime()) / 1000);
      return activeTimer.pausedTime * 60 + diff;
    };

    // Update immediately
    setElapsedSeconds(calculateElapsed());

    // Update every second
    const interval = setInterval(() => {
      setElapsedSeconds(calculateElapsed());
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimer]);

  const handleStart = () => {
    if (!startFormData.caseId || !startFormData.taskType) {
      alert('Selectează dosarul și tipul activității');
      return;
    }

    const selectedCase = mockCases.find((c) => c.id === startFormData.caseId);
    if (!selectedCase) return;

    startTimer(startFormData.caseId, selectedCase.name, startFormData.taskType as TimeTaskType);
    setShowStartDialog(false);
    setStartFormData({ caseId: '', taskType: '' });
  };

  const handleStop = () => {
    const entry = stopTimer();
    if (entry) {
      // Add stopped timer as time entry (user can edit description later)
      addTimeEntry(entry);
    }
  };

  const isTimerActive = activeTimer.isRunning || activeTimer.isPaused;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Cronometru Activ</h2>

      {!isTimerActive ? (
        <>
          {!showStartDialog ? (
            <button
              onClick={() => setShowStartDialog(true)}
              className="w-full bg-green-600 text-white px-4 py-3 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 font-medium flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                  clipRule="evenodd"
                />
              </svg>
              Pornește Cronometrul
            </button>
          ) : (
            <div className="space-y-4">
              {/* Case Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dosar *</label>
                <select
                  value={startFormData.caseId}
                  onChange={(e) => setStartFormData({ ...startFormData, caseId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selectează dosarul</option>
                  {mockCases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Task Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tip Activitate *
                </label>
                <select
                  value={startFormData.taskType}
                  onChange={(e) =>
                    setStartFormData({
                      ...startFormData,
                      taskType: e.target.value as TimeTaskType,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selectează tipul</option>
                  {taskTypes.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={handleStart}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 font-medium"
                >
                  Start
                </button>
                <button
                  onClick={() => {
                    setShowStartDialog(false);
                    setStartFormData({ caseId: '', taskType: '' });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  Anulează
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          {/* Timer Display */}
          <div className="text-center">
            <div className="relative inline-flex items-center justify-center">
              {activeTimer.isRunning && (
                <span className="absolute w-3 h-3 bg-green-500 rounded-full animate-ping" />
              )}
              <div
                className={`text-5xl font-mono font-bold ${
                  activeTimer.isRunning ? 'text-green-600' : 'text-gray-400'
                }`}
              >
                {formatElapsedTime(elapsedSeconds)}
              </div>
            </div>
            <div className="mt-2 text-sm text-gray-600">{activeTimer.caseName}</div>
            <div className="text-xs text-gray-500">
              {taskTypes.find((t) => t.value === activeTimer.taskType)?.label}
            </div>
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            {activeTimer.isRunning ? (
              <button
                onClick={pauseTimer}
                className="flex-1 bg-yellow-500 text-white px-4 py-2 rounded-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 font-medium flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                Pauză
              </button>
            ) : (
              <button
                onClick={resumeTimer}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 font-medium flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                    clipRule="evenodd"
                  />
                </svg>
                Continuă
              </button>
            )}
            <button
              onClick={handleStop}
              className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 font-medium flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z"
                  clipRule="evenodd"
                />
              </svg>
              Stop
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
