'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TimeEntryInput } from '@legal-platform/types';

export interface TimeEntryFormProps {
  caseId?: string;
  taskId?: string;
  onSubmit: (data: TimeEntryInput) => Promise<void>;
  onCancel?: () => void;
  cases?: Array<{ id: string; title: string; caseNumber: string }>;
  tasks?: Array<{ id: string; title: string; caseId: string }>;
  isLoading?: boolean;
}

export function TimeEntryForm({
  caseId: initialCaseId,
  taskId: initialTaskId,
  onSubmit,
  onCancel,
  cases = [],
  tasks = [],
  isLoading = false,
}: TimeEntryFormProps) {
  const [caseId, setCaseId] = React.useState(initialCaseId || '');
  const [taskId, setTaskId] = React.useState(initialTaskId || '');
  const [date, setDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));
  const [hours, setHours] = React.useState('');
  const [hoursInput, setHoursInput] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [narrative, setNarrative] = React.useState('');
  const [billable, setBillable] = React.useState(true);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Filter tasks by selected case
  const filteredTasks = React.useMemo(() => {
    if (!caseId) return [];
    return tasks.filter((task) => task.caseId === caseId);
  }, [caseId, tasks]);

  // Parse hours input - supports both decimal (1.5) and HH:MM (1:30) formats
  const parseHoursInput = (input: string): number | null => {
    if (!input) return null;

    // Try HH:MM format first
    const timeMatch = input.match(/^(\d{1,2}):(\d{2})$/);
    if (timeMatch) {
      const h = parseInt(timeMatch[1], 10);
      const m = parseInt(timeMatch[2], 10);
      if (m >= 60) return null;
      return h + m / 60;
    }

    // Try decimal format
    const decimal = parseFloat(input);
    if (isNaN(decimal)) return null;

    return decimal;
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!caseId) {
      newErrors.caseId = 'Case is required';
    }

    if (!date) {
      newErrors.date = 'Date is required';
    }

    const parsedHours = parseHoursInput(hoursInput);
    if (!hoursInput) {
      newErrors.hours = 'Hours is required';
    } else if (parsedHours === null) {
      newErrors.hours = 'Invalid hours format. Use decimal (1.5) or HH:MM (1:30)';
    } else if (parsedHours < 0.25 || parsedHours > 24) {
      newErrors.hours = 'Hours must be between 0.25 and 24';
    }

    if (!description.trim()) {
      newErrors.description = 'Description is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const parsedHours = parseHoursInput(hoursInput);
    if (parsedHours === null) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        caseId,
        taskId: taskId || undefined,
        date,
        hours: parsedHours,
        description: description.trim(),
        narrative: narrative.trim() || undefined,
        billable,
      });

      // Reset form
      if (!initialCaseId) setCaseId('');
      if (!initialTaskId) setTaskId('');
      setDate(format(new Date(), 'yyyy-MM-dd'));
      setHours('');
      setHoursInput('');
      setDescription('');
      setNarrative('');
      setBillable(true);
      setErrors({});
    } catch (error) {
      setErrors({
        submit: error instanceof Error ? error.message : 'Failed to create time entry',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Date Field */}
      <div>
        <label htmlFor="date" className="block text-sm font-medium mb-1">
          Date <span className="text-red-500">*</span>
        </label>
        <Input
          id="date"
          type="date"
          value={date}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDate(e.target.value)}
          className={errors.date ? 'border-red-500' : ''}
          disabled={isSubmitting || isLoading}
        />
        {errors.date && <p className="text-sm text-red-500 mt-1">{errors.date}</p>}
      </div>

      {/* Case Selector */}
      {!initialCaseId && (
        <div>
          <label htmlFor="caseId" className="block text-sm font-medium mb-1">
            Case <span className="text-red-500">*</span>
          </label>
          <Select value={caseId} onValueChange={setCaseId} disabled={isSubmitting || isLoading}>
            <SelectTrigger className={errors.caseId ? 'border-red-500' : ''}>
              <SelectValue placeholder="Select a case" />
            </SelectTrigger>
            <SelectContent>
              {cases.map((caseItem) => (
                <SelectItem key={caseItem.id} value={caseItem.id}>
                  {caseItem.caseNumber} - {caseItem.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.caseId && <p className="text-sm text-red-500 mt-1">{errors.caseId}</p>}
        </div>
      )}

      {/* Task Selector (Optional) */}
      {!initialTaskId && (
        <div>
          <label htmlFor="taskId" className="block text-sm font-medium mb-1">
            Task (Optional)
          </label>
          <Select
            value={taskId}
            onValueChange={setTaskId}
            disabled={!caseId || isSubmitting || isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a task (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {filteredTasks.map((task) => (
                <SelectItem key={task.id} value={task.id}>
                  {task.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Hours Field */}
      <div>
        <label htmlFor="hours" className="block text-sm font-medium mb-1">
          Hours <span className="text-red-500">*</span>
        </label>
        <Input
          id="hours"
          type="text"
          value={hoursInput}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHoursInput(e.target.value)}
          placeholder="e.g., 1.5 or 1:30"
          className={errors.hours ? 'border-red-500' : ''}
          disabled={isSubmitting || isLoading}
        />
        <p className="text-xs text-gray-500 mt-1">
          Enter decimal (1.5) or time format (1:30)
        </p>
        {errors.hours && <p className="text-sm text-red-500 mt-1">{errors.hours}</p>}
      </div>

      {/* Description Field */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-1">
          Description <span className="text-red-500">*</span>
        </label>
        <Input
          id="description"
          type="text"
          value={description}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
          placeholder="Brief description of work performed"
          className={errors.description ? 'border-red-500' : ''}
          disabled={isSubmitting || isLoading}
        />
        {errors.description && (
          <p className="text-sm text-red-500 mt-1">{errors.description}</p>
        )}
      </div>

      {/* Narrative Field (Expandable) */}
      <div>
        <label htmlFor="narrative" className="block text-sm font-medium mb-1">
          Billing Narrative (Optional)
        </label>
        <Textarea
          id="narrative"
          value={narrative}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNarrative(e.target.value)}
          placeholder="Detailed billing narrative for client invoice (optional)"
          rows={4}
          disabled={isSubmitting || isLoading}
        />
        <p className="text-xs text-gray-500 mt-1">
          Add detailed context for billing purposes
        </p>
      </div>

      {/* Billable Toggle */}
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="billable"
          checked={billable}
          onChange={(e) => setBillable(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          disabled={isSubmitting || isLoading}
        />
        <label htmlFor="billable" className="text-sm font-medium">
          Billable
        </label>
      </div>

      {/* Submit Error */}
      {errors.submit && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{errors.submit}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end space-x-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting || isLoading}
          >
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting || isLoading}>
          {isSubmitting ? 'Logging Time...' : 'Log Time'}
        </Button>
      </div>
    </form>
  );
}
