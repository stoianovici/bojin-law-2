/**
 * TaskDetailModal Component
 * Modal dialog for creating and editing tasks with type-specific fields
 * Uses Radix UI Dialog for accessibility
 */

'use client';

import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { format } from 'date-fns';
import type { Task, TaskType } from '@legal-platform/types';
import { QuickTimeLog } from '@/components/time/QuickTimeLog';
import { useLogTimeAgainstTask, useTimeEntriesByTask } from '@/hooks/useTimeEntries';
import { TaskComments } from './TaskComments';
import { SubtaskPanel } from './SubtaskPanel';
import { TaskAttachments } from './TaskAttachments';
import { TaskHistoryTimeline } from './TaskHistoryTimeline';

/**
 * Task type labels in Romanian
 */
const TASK_TYPE_OPTIONS: Array<{ value: TaskType; label: string }> = [
  { value: 'Research', label: 'Cercetare' },
  { value: 'DocumentCreation', label: 'Creare Document' },
  { value: 'DocumentRetrieval', label: 'Recuperare Document' },
  { value: 'CourtDate', label: 'Termen Instanță' },
  { value: 'Meeting', label: 'Întâlnire' },
  { value: 'BusinessTrip', label: 'Deplasare' },
];

/**
 * Priority options in Romanian
 */
const PRIORITY_OPTIONS: Array<{ value: Task['priority']; label: string }> = [
  { value: 'Low', label: 'Scăzută' },
  { value: 'Medium', label: 'Medie' },
  { value: 'High', label: 'Ridicată' },
  { value: 'Urgent', label: 'Urgentă' },
];

/**
 * Status options in Romanian
 */
const STATUS_OPTIONS: Array<{ value: Task['status']; label: string }> = [
  { value: 'Pending', label: 'În Așteptare' },
  { value: 'InProgress', label: 'În Progres' },
  { value: 'Completed', label: 'Finalizat' },
  { value: 'Cancelled', label: 'Anulat' },
];

/**
 * Task types that require specific time (Meeting, CourtDate)
 */
const TIME_SPECIFIC_TASK_TYPES: TaskType[] = ['Meeting', 'CourtDate'];

/**
 * Task form data interface
 */
interface TaskFormData {
  type: TaskType;
  title: string;
  description: string;
  assignedTo: string;
  dueDate: string; // yyyy-MM-dd format (date only)
  dueTime: string; // HH:mm format (time only, optional)
  priority: Task['priority'];
  status: Task['status'];
  metadata: Record<string, unknown>;
}

/**
 * TaskDetailModal Props
 */
interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  task?: Task | null;
  onSave: (task: Partial<Task>) => void;
  onDelete?: (taskId: string) => void;
}

/**
 * TaskDetailModal Component
 */
export function TaskDetailModal({ isOpen, onClose, task, onSave, onDelete }: TaskDetailModalProps) {
  const isEditMode = Boolean(task);

  // Form state
  const [formData, setFormData] = useState<TaskFormData>({
    type: 'Research',
    title: '',
    description: '',
    assignedTo: 'user-1', // Mock user ID
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    dueTime: '',
    priority: 'Medium',
    status: 'Pending',
    metadata: {},
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [activeCollabTab, setActiveCollabTab] = useState<
    'comments' | 'subtasks' | 'attachments' | 'history'
  >('comments');

  // Time tracking hooks
  const [logTimeAgainstTask, { loading: loggingTime }] = useLogTimeAgainstTask();
  const { data: timeEntriesData } = useTimeEntriesByTask(task?.id || '');

  /**
   * Initialize form data when task changes
   */
  useEffect(() => {
    if (task) {
      const taskDate = new Date(task.dueDate);
      // Only extract time for time-specific task types (Meeting, CourtDate)
      const isTimeSpecific = TIME_SPECIFIC_TASK_TYPES.includes(task.type);
      const hasTime =
        isTimeSpecific && (taskDate.getUTCHours() !== 0 || taskDate.getUTCMinutes() !== 0);
      const timeValue = hasTime ? format(taskDate, 'HH:mm') : '';

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({
        type: task.type,
        title: task.title,
        description: task.description,
        assignedTo: task.assignedTo,
        dueDate: format(taskDate, 'yyyy-MM-dd'),
        dueTime: timeValue,
        priority: task.priority,
        status: task.status,
        metadata: task.metadata || {},
      });
    } else {
      // Reset form for new task
      setFormData({
        type: 'Research',
        title: '',
        description: '',
        assignedTo: 'user-1',
        dueDate: format(new Date(), 'yyyy-MM-dd'),
        dueTime: '',
        priority: 'Medium',
        status: 'Pending',
        metadata: {},
      });
    }

    setErrors({});
    setShowDeleteConfirm(false);
    setShowQuickLog(false);
  }, [task, isOpen]);

  /**
   * Calculate total logged hours
   */
  const totalLoggedHours =
    timeEntriesData?.timeEntriesByTask?.reduce(
      (total: number, entry: { hours: number }) => total + entry.hours,
      0
    ) || 0;

  /**
   * Handle quick time log submission
   */
  const handleTimeLogSubmit = async (data: {
    hours: number;
    description: string;
    billable: boolean;
  }) => {
    if (!task) return;

    await logTimeAgainstTask({
      variables: {
        taskId: task.id,
        hours: data.hours,
        description: data.description,
        billable: data.billable,
      },
    });

    setShowQuickLog(false);
  };

  /**
   * Update form field
   */
  const updateField = (field: keyof TaskFormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  /**
   * Update metadata field
   */
  const updateMetadata = (key: string, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      metadata: { ...prev.metadata, [key]: value },
    }));
  };

  /**
   * Validate form
   */
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Titlul este obligatoriu';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Descrierea este obligatorie';
    }

    if (!formData.dueDate) {
      newErrors.dueDate = 'Data scadenței este obligatorie';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Check if current task type requires time
   */
  const requiresTime = TIME_SPECIFIC_TASK_TYPES.includes(formData.type);

  /**
   * Handle save
   */
  const handleSave = () => {
    if (!validateForm()) return;

    // Combine date and time into a single Date object
    let dueDateTime: Date;
    if (formData.dueTime && requiresTime) {
      // Time-specific task: combine date and time
      const [hours, minutes] = formData.dueTime.split(':').map(Number);
      dueDateTime = new Date(formData.dueDate);
      dueDateTime.setHours(hours, minutes, 0, 0);
    } else {
      // Date-only task: set to midnight
      dueDateTime = new Date(formData.dueDate);
      dueDateTime.setHours(0, 0, 0, 0);
    }

    const taskData: Partial<Task> = {
      ...formData,
      dueDate: dueDateTime,
    };

    if (task) {
      taskData.id = task.id;
    }

    onSave(taskData);
    onClose();
  };

  /**
   * Handle delete
   */
  const handleDelete = () => {
    if (task && onDelete) {
      onDelete(task.id);
      onClose();
    }
  };

  /**
   * Render type-specific fields based on selected TaskType
   */
  const renderTypeSpecificFields = () => {
    switch (formData.type) {
      case 'Research':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subiect Cercetare
              </label>
              <input
                type="text"
                value={(formData.metadata.researchTopic as string) || ''}
                onChange={(e) => updateMetadata('researchTopic', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: Jurisprudență CEDO privind..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Domeniu Juridic
              </label>
              <input
                type="text"
                value={(formData.metadata.legalArea as string) || ''}
                onChange={(e) => updateMetadata('legalArea', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: Drept Civil, Drept Penal"
              />
            </div>
          </div>
        );

      case 'DocumentCreation':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tip Document</label>
              <input
                type="text"
                value={(formData.metadata.documentType as string) || ''}
                onChange={(e) => updateMetadata('documentType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: Contract, Cerere, Memoriu"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nume Client</label>
              <input
                type="text"
                value={(formData.metadata.clientName as string) || ''}
                onChange={(e) => updateMetadata('clientName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: Ion Popescu"
              />
            </div>
          </div>
        );

      case 'DocumentRetrieval':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nume Document</label>
              <input
                type="text"
                value={(formData.metadata.documentName as string) || ''}
                onChange={(e) => updateMetadata('documentName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: Certificat fiscal client"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Locație Sursă</label>
              <input
                type="text"
                value={(formData.metadata.sourceLocation as string) || ''}
                onChange={(e) => updateMetadata('sourceLocation', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: Arhiva Cabinet, Primărie"
              />
            </div>
          </div>
        );

      case 'CourtDate':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nume Instanță</label>
              <input
                type="text"
                value={(formData.metadata.courtName as string) || ''}
                onChange={(e) => updateMetadata('courtName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: Judecătoria Sector 1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tip Ședință</label>
              <input
                type="text"
                value={(formData.metadata.hearingType as string) || ''}
                onChange={(e) => updateMetadata('hearingType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: Fond, Apel, Recurs"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Număr Dosar</label>
              <input
                type="text"
                value={(formData.metadata.caseNumber as string) || ''}
                onChange={(e) => updateMetadata('caseNumber', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: 1234/2025"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Locație</label>
              <input
                type="text"
                value={(formData.metadata.location as string) || ''}
                onChange={(e) => updateMetadata('location', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: Sala 12"
              />
            </div>
          </div>
        );

      case 'Meeting':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tip Întâlnire</label>
              <input
                type="text"
                value={(formData.metadata.meetingType as string) || ''}
                onChange={(e) => updateMetadata('meetingType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: Consultare Client, Negociere"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Locație</label>
              <input
                type="text"
                value={(formData.metadata.location as string) || ''}
                onChange={(e) => updateMetadata('location', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: Cabinet, Sediu Client, Online"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Participanți</label>
              <input
                type="text"
                value={(formData.metadata.attendees as string) || ''}
                onChange={(e) => updateMetadata('attendees', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: Ion Popescu, Maria Ionescu"
              />
            </div>
          </div>
        );

      case 'BusinessTrip':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Destinație</label>
              <input
                type="text"
                value={(formData.metadata.destination as string) || ''}
                onChange={(e) => updateMetadata('destination', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: Cluj-Napoca, Timișoara"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Scop</label>
              <input
                type="text"
                value={(formData.metadata.purpose as string) || ''}
                onChange={(e) => updateMetadata('purpose', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: Participare la termen"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cazare</label>
              <input
                type="text"
                value={(formData.metadata.accommodation as string) || ''}
                onChange={(e) => updateMetadata('accommodation', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: Hotel Continental"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto z-50 p-6"
          onEscapeKeyDown={onClose}
        >
          {/* Modal header */}
          <div className="flex items-center justify-between mb-6">
            <Dialog.Title className="text-xl font-bold text-gray-900">
              {isEditMode ? 'Editare Sarcină' : 'Sarcină Nouă'}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Închide"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </Dialog.Close>
          </div>

          {/* Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
            className="space-y-6"
          >
            {/* Task Type */}
            <div>
              <label htmlFor="taskType" className="block text-sm font-medium text-gray-700 mb-1">
                Tip Sarcină <span className="text-red-500">*</span>
              </label>
              <select
                id="taskType"
                value={formData.type}
                onChange={(e) => updateField('type', e.target.value as TaskType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {TASK_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                Titlu <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                type="text"
                value={formData.title}
                onChange={(e) => updateField('title', e.target.value)}
                className={`w-full px-3 py-2 border ${errors.title ? 'border-red-500' : 'border-gray-300'} rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                placeholder="Introduceți titlul sarcinii"
              />
              {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Descriere <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                value={formData.description ?? ''}
                onChange={(e) => updateField('description', e.target.value)}
                rows={4}
                className={`w-full px-3 py-2 border ${errors.description ? 'border-red-500' : 'border-gray-300'} rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                placeholder="Descrieți sarcina în detaliu"
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description}</p>
              )}
            </div>

            {/* Due Date and Time */}
            <div>
              <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-1">
                {requiresTime ? 'Data și Ora' : 'Data Scadenței'}{' '}
                <span className="text-red-500">*</span>
              </label>
              <div className={`flex gap-3 ${requiresTime ? '' : ''}`}>
                {/* Date input - always shown */}
                <input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => updateField('dueDate', e.target.value)}
                  className={`${requiresTime ? 'flex-1' : 'w-full'} px-3 py-2 border ${errors.dueDate ? 'border-red-500' : 'border-gray-300'} rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                />
                {/* Time input - only for Meeting and CourtDate */}
                {requiresTime && (
                  <input
                    id="dueTime"
                    type="time"
                    value={formData.dueTime}
                    onChange={(e) => updateField('dueTime', e.target.value)}
                    className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="HH:mm"
                  />
                )}
              </div>
              {errors.dueDate && <p className="mt-1 text-sm text-red-600">{errors.dueDate}</p>}
              {!requiresTime && (
                <p className="mt-1 text-xs text-gray-500">
                  Sarcinile de tip cercetare, documente și deplasări nu necesită oră specifică.
                </p>
              )}
            </div>

            {/* Priority */}
            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
                Prioritate
              </label>
              <select
                id="priority"
                value={formData.priority}
                onChange={(e) => updateField('priority', e.target.value as Task['priority'])}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => updateField('status', e.target.value as Task['status'])}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Type-specific fields */}
            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Detalii Specifice</h3>
              {renderTypeSpecificFields()}
            </div>

            {/* Time Tracking Section (only show in edit mode) */}
            {isEditMode && task && (
              <div className="pt-4 border-t border-gray-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">Timp Înregistrat</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600">
                      Total:{' '}
                      <span className="font-medium text-gray-900">
                        {totalLoggedHours.toFixed(2)}h
                      </span>
                    </span>
                    {!showQuickLog && (
                      <button
                        type="button"
                        onClick={() => setShowQuickLog(true)}
                        className="px-3 py-1 text-sm border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 transition-colors font-medium"
                      >
                        Înregistrează Timp
                      </button>
                    )}
                  </div>
                </div>

                {showQuickLog && (
                  <QuickTimeLog
                    caseId={task.caseId}
                    taskId={task.id}
                    taskTitle={task.title}
                    onSubmit={handleTimeLogSubmit}
                    onCancel={() => setShowQuickLog(false)}
                    isLoading={loggingTime}
                  />
                )}
              </div>
            )}

            {/* Collaboration Sections (Story 4.6) - only show in edit mode */}
            {isEditMode && task && (
              <div className="pt-4 border-t border-gray-200">
                {/* Tab Navigation */}
                <div className="flex border-b border-gray-200 mb-4">
                  {[
                    { key: 'comments', label: 'Comentarii' },
                    { key: 'subtasks', label: 'Sub-sarcini' },
                    { key: 'attachments', label: 'Atașamente' },
                    { key: 'history', label: 'Istoric' },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveCollabTab(tab.key as typeof activeCollabTab)}
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        activeCollabTab === tab.key
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="min-h-[200px]">
                  {activeCollabTab === 'comments' && (
                    <TaskComments taskId={task.id} currentUserId="current-user-id" />
                  )}
                  {activeCollabTab === 'subtasks' && (
                    <SubtaskPanel parentTaskId={task.id} caseId={task.caseId} />
                  )}
                  {activeCollabTab === 'attachments' && (
                    <TaskAttachments taskId={task.id} currentUserId="current-user-id" />
                  )}
                  {activeCollabTab === 'history' && <TaskHistoryTimeline taskId={task.id} />}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <div>
                {isEditMode && onDelete && (
                  <>
                    {!showDeleteConfirm ? (
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-md transition-colors font-medium"
                      >
                        Șterge Sarcina
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Sigur doriți să ștergeți?</span>
                        <button
                          type="button"
                          onClick={handleDelete}
                          className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
                        >
                          Da, Șterge
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowDeleteConfirm(false)}
                          className="px-3 py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm font-medium"
                        >
                          Anulează
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors font-medium"
                >
                  Anulează
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
                >
                  {isEditMode ? 'Salvează Modificările' : 'Creează Sarcina'}
                </button>
              </div>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default TaskDetailModal;
