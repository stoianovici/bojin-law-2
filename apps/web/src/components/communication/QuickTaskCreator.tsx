'use client';

import { useState, useEffect } from 'react';
import type { Task, TaskType } from '@legal-platform/types';
import { X } from 'lucide-react';

interface QuickTaskCreatorProps {
  extractedItemType: 'deadline' | 'commitment' | 'actionItem';
  extractedItemId: string;
  threadId: string;
  messageId: string;
  caseId: string;
  // Pre-fill data
  prefillTitle?: string;
  prefillDescription?: string;
  prefillDueDate?: Date;
  prefillPriority?: 'Low' | 'Medium' | 'High' | 'Urgent';
  prefillAssignedTo?: string;
  // Callbacks
  onSave: (taskData: Partial<Task>) => void;
  onCancel: () => void;
}

// Map extracted item types to Task types
const ITEM_TYPE_TO_TASK_TYPE: Record<string, TaskType> = {
  deadline: 'CourtDate',
  commitment: 'Meeting',
  actionItem: 'Research',
};

export function QuickTaskCreator({
  extractedItemType,
  extractedItemId,
  threadId,
  messageId,
  caseId,
  prefillTitle = '',
  prefillDescription = '',
  prefillDueDate,
  prefillPriority = 'Medium',
  prefillAssignedTo,
  onSave,
  onCancel,
}: QuickTaskCreatorProps) {
  const [taskType, setTaskType] = useState<TaskType>(
    ITEM_TYPE_TO_TASK_TYPE[extractedItemType] || 'Research'
  );
  const [title, setTitle] = useState(prefillTitle);
  const [description, setDescription] = useState(prefillDescription);
  const [assignedTo, setAssignedTo] = useState(prefillAssignedTo || 'current-user');
  const [dueDate, setDueDate] = useState(
    prefillDueDate ? prefillDueDate.toISOString().split('T')[0] : ''
  );
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High' | 'Urgent'>(prefillPriority);
  const [errors, setErrors] = useState<{ title?: string; dueDate?: string }>({});

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [title, dueDate, onCancel]); // eslint-disable-line react-hooks/exhaustive-deps

  const validateForm = () => {
    const newErrors: { title?: string; dueDate?: string } = {};

    if (!title.trim()) {
      newErrors.title = 'Titlul este obligatoriu';
    }

    if (!dueDate) {
      newErrors.dueDate = 'Data scadenței este obligatorie';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) {
      return;
    }

    const taskData: Partial<Task> = {
      caseId,
      type: taskType,
      title: title.trim(),
      description: description.trim(),
      assignedTo,
      dueDate: new Date(dueDate),
      priority,
      status: 'Pending',
      metadata: {
        sourceMessageId: messageId,
        sourceThreadId: threadId,
        extractedItemId,
        extractedItemType,
      },
    };

    onSave(taskData);
  };

  return (
    <div className="border border-blue-300 rounded-lg bg-blue-50 p-3 space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-sm">Creează Task</h4>
        <button
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700"
          aria-label="Anulează"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Task Type */}
      <div>
        <label htmlFor="task-type" className="block text-xs font-medium mb-1">Tip Task:</label>
        <select
          id="task-type"
          value={taskType}
          onChange={(e) => setTaskType(e.target.value as TaskType)}
          className="w-full border rounded px-2 py-1.5 text-sm bg-white"
        >
          <option value="Research">Research</option>
          <option value="DocumentCreation">Creare Document</option>
          <option value="DocumentRetrieval">Obținere Document</option>
          <option value="CourtDate">Termen Instanță</option>
          <option value="Meeting">Întâlnire</option>
          <option value="BusinessTrip">Deplasare</option>
        </select>
      </div>

      {/* Title */}
      <div>
        <label htmlFor="task-title" className="block text-xs font-medium mb-1">
          Titlu: <span className="text-red-500">*</span>
        </label>
        <input
          id="task-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titlul task-ului..."
          className={`w-full border rounded px-2 py-1.5 text-sm ${
            errors.title ? 'border-red-500' : ''
          }`}
        />
        {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
      </div>

      {/* Description */}
      <div>
        <label htmlFor="task-description" className="block text-xs font-medium mb-1">Descriere:</label>
        <textarea
          id="task-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Detalii despre task..."
          className="w-full border rounded px-2 py-1.5 text-sm h-20 resize-none"
        />
      </div>

      {/* Assigned To */}
      <div>
        <label htmlFor="task-assigned-to" className="block text-xs font-medium mb-1">Atribuit către:</label>
        <select
          id="task-assigned-to"
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          className="w-full border rounded px-2 py-1.5 text-sm bg-white"
        >
          <option value="current-user">Eu (Utilizator curent)</option>
          <option value="user-1">Mihai Bojin</option>
          <option value="user-2">Elena Popescu</option>
          <option value="user-3">Ion Georgescu</option>
        </select>
      </div>

      {/* Due Date */}
      <div>
        <label htmlFor="task-due-date" className="block text-xs font-medium mb-1">
          Scadență: <span className="text-red-500">*</span>
        </label>
        <input
          id="task-due-date"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className={`w-full border rounded px-2 py-1.5 text-sm ${
            errors.dueDate ? 'border-red-500' : ''
          }`}
        />
        {errors.dueDate && <p className="text-xs text-red-500 mt-1">{errors.dueDate}</p>}
      </div>

      {/* Priority */}
      <div>
        <label htmlFor="task-priority" className="block text-xs font-medium mb-1">Prioritate:</label>
        <select
          id="task-priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value as 'Low' | 'Medium' | 'High' | 'Urgent')}
          className="w-full border rounded px-2 py-1.5 text-sm bg-white"
        >
          <option value="Low">Scăzută</option>
          <option value="Medium">Medie</option>
          <option value="High">Înaltă</option>
          <option value="Urgent">Urgentă</option>
        </select>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-2">
        <button
          onClick={handleSave}
          className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium"
        >
          Salvează Task
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
        >
          Anulează
        </button>
      </div>

      <p className="text-xs text-gray-600 italic">
        Apasă Ctrl+Enter pentru a salva, Esc pentru a anula
      </p>
    </div>
  );
}
