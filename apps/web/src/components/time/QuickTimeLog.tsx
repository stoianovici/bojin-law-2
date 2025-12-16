'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Clock } from 'lucide-react';

export interface QuickTimeLogProps {
  caseId: string;
  taskId: string;
  taskTitle?: string;
  onSubmit: (data: { hours: number; description: string; billable: boolean }) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  compact?: boolean;
}

export function QuickTimeLog({
  caseId,
  taskId,
  taskTitle,
  onSubmit,
  onCancel,
  isLoading = false,
  compact = false,
}: QuickTimeLogProps) {
  const [hoursInput, setHoursInput] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [billable, setBillable] = React.useState(true);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);

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

    const parsedHours = parseHoursInput(hoursInput);
    if (!hoursInput) {
      newErrors.hours = 'Hours is required';
    } else if (parsedHours === null) {
      newErrors.hours = 'Invalid format';
    } else if (parsedHours < 0.25 || parsedHours > 24) {
      newErrors.hours = 'Must be 0.25-24';
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
        hours: parsedHours,
        description: description.trim(),
        billable,
      });

      // Reset form
      setHoursInput('');
      setDescription('');
      setBillable(true);
      setErrors({});
      setShowForm(false);
    } catch (error) {
      setErrors({
        submit: error instanceof Error ? error.message : 'Failed to log time',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setHoursInput('');
    setDescription('');
    setBillable(true);
    setErrors({});
    setShowForm(false);
    onCancel?.();
  };

  // Compact mode: just a button that reveals the form
  if (compact && !showForm) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setShowForm(true)}
        disabled={isLoading}
        className="flex items-center space-x-1"
      >
        <Clock className="h-4 w-4" />
        <span>Log Time</span>
      </Button>
    );
  }

  return (
    <div className="border rounded-md p-4 bg-gray-50">
      {taskTitle && (
        <div className="mb-3 pb-3 border-b">
          <p className="text-sm font-medium text-gray-700">Log time for:</p>
          <p className="text-sm text-gray-600">{taskTitle}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Hours and Billable Row */}
        <div className="flex items-start space-x-3">
          <div className="flex-1">
            <label htmlFor="quick-hours" className="block text-sm font-medium mb-1">
              Hours <span className="text-red-500">*</span>
            </label>
            <Input
              id="quick-hours"
              type="text"
              value={hoursInput}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setHoursInput(e.target.value)
              }
              placeholder="1.5 or 1:30"
              className={errors.hours ? 'border-red-500' : ''}
              disabled={isSubmitting || isLoading}
            />
            {errors.hours && <p className="text-xs text-red-500 mt-1">{errors.hours}</p>}
          </div>

          <div className="flex items-center pt-8">
            <input
              type="checkbox"
              id="quick-billable"
              checked={billable}
              onChange={(e) => setBillable(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              disabled={isSubmitting || isLoading}
            />
            <label htmlFor="quick-billable" className="ml-2 text-sm font-medium">
              Billable
            </label>
          </div>
        </div>

        {/* Description Field */}
        <div>
          <label htmlFor="quick-description" className="block text-sm font-medium mb-1">
            Description <span className="text-red-500">*</span>
          </label>
          <Input
            id="quick-description"
            type="text"
            value={description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
            placeholder="Brief description of work"
            className={errors.description ? 'border-red-500' : ''}
            disabled={isSubmitting || isLoading}
          />
          {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description}</p>}
        </div>

        {/* Submit Error */}
        {errors.submit && (
          <div className="p-2 bg-red-50 border border-red-200 rounded-md">
            <p className="text-xs text-red-600">{errors.submit}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={isSubmitting || isLoading}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isSubmitting || isLoading}>
            {isSubmitting ? 'Logging...' : 'Log Time'}
          </Button>
        </div>
      </form>
    </div>
  );
}
