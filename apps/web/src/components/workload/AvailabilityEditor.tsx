'use client';

/**
 * Availability Editor Component
 * Story 4.5: Team Workload Management
 *
 * AC: 1, 5 - Schedule OOO, vacation, reduced hours with auto-reassign option
 */

import { useState } from 'react';
import { Calendar, Clock, User, AlertTriangle, X } from 'lucide-react';
import type {
  UserAvailability,
  AvailabilityType,
  CreateAvailabilityInput,
} from '@legal-platform/types';

interface AvailabilityEditorProps {
  availability?: UserAvailability | null;
  teamMembers: Array<{ id: string; firstName: string; lastName: string }>;
  onSave: (input: CreateAvailabilityInput) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
}

const AVAILABILITY_TYPES: Array<{
  value: AvailabilityType;
  label: string;
  description: string;
}> = [
  {
    value: 'Vacation',
    label: 'Vacation',
    description: 'Planned time off - tasks can be auto-reassigned',
  },
  {
    value: 'OutOfOffice',
    label: 'Out of Office',
    description: 'Fully unavailable for the period',
  },
  {
    value: 'SickLeave',
    label: 'Sick Leave',
    description: 'Unplanned absence - urgent tasks will be reassigned',
  },
  {
    value: 'ReducedHours',
    label: 'Reduced Hours',
    description: 'Working fewer hours than usual',
  },
  {
    value: 'Training',
    label: 'Training / Conference',
    description: 'Attending training or conference',
  },
];

export function AvailabilityEditor({
  availability,
  teamMembers,
  onSave,
  onDelete,
  onClose,
  isLoading = false,
}: AvailabilityEditorProps) {
  const [formData, setFormData] = useState<CreateAvailabilityInput>({
    availabilityType: availability?.availabilityType || 'Vacation',
    startDate: availability?.startDate
      ? new Date(availability.startDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    endDate: availability?.endDate
      ? new Date(availability.endDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    hoursPerDay: availability?.hoursPerDay,
    reason: availability?.reason || '',
    autoReassign: availability?.autoReassign ?? true,
    delegateTo: availability?.delegateTo,
  });

  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate dates
    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      setError('End date must be after start date');
      return;
    }

    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save availability');
    }
  };

  const handleDelete = async () => {
    if (!availability?.id || !onDelete) return;

    if (window.confirm('Are you sure you want to delete this availability?')) {
      try {
        await onDelete(availability.id);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete availability');
      }
    }
  };

  const isReducedHours = formData.availabilityType === 'ReducedHours';
  const showAutoReassign = ['Vacation', 'OutOfOffice', 'SickLeave'].includes(
    formData.availabilityType
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {availability ? 'Edit Availability' : 'Schedule Time Off'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-red-700 text-sm">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type
            </label>
            <div className="space-y-2">
              {AVAILABILITY_TYPES.map((type) => (
                <label
                  key={type.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    formData.availabilityType === type.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="availabilityType"
                    value={type.value}
                    checked={formData.availabilityType === type.value}
                    onChange={(e) =>
                      setFormData((prev: typeof weeklyCapacity) => ({
                        ...prev,
                        availabilityType: e.target.value as AvailabilityType,
                      }))
                    }
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-gray-900">{type.label}</div>
                    <div className="text-sm text-gray-500">{type.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData((prev: typeof weeklyCapacity) => ({ ...prev, startDate: e.target.value }))
                  }
                  className="w-full pl-10 pr-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) =>
                    setFormData((prev: typeof weeklyCapacity) => ({ ...prev, endDate: e.target.value }))
                  }
                  className="w-full pl-10 pr-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Hours per Day (for ReducedHours) */}
          {isReducedHours && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hours per Day
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="number"
                  min="0"
                  max="8"
                  step="0.5"
                  value={formData.hoursPerDay || ''}
                  onChange={(e) =>
                    setFormData((prev: typeof weeklyCapacity) => ({
                      ...prev,
                      hoursPerDay: e.target.value ? parseFloat(e.target.value) : undefined,
                    }))
                  }
                  placeholder="e.g., 4"
                  className="w-full pl-10 pr-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason (optional)
            </label>
            <textarea
              value={formData.reason}
              onChange={(e) =>
                setFormData((prev: typeof weeklyCapacity) => ({ ...prev, reason: e.target.value }))
              }
              rows={2}
              placeholder="Brief description of the reason..."
              className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Auto-Reassign Option */}
          {showAutoReassign && (
            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.autoReassign}
                  onChange={(e) =>
                    setFormData((prev: typeof weeklyCapacity) => ({
                      ...prev,
                      autoReassign: e.target.checked,
                    }))
                  }
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  Automatically reassign urgent tasks during this period
                </span>
              </label>

              {/* Delegate Selection */}
              {formData.autoReassign && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Preferred Delegate (optional)
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <select
                      value={formData.delegateTo || ''}
                      onChange={(e) =>
                        setFormData((prev: typeof weeklyCapacity) => ({
                          ...prev,
                          delegateTo: e.target.value || undefined,
                        }))
                      }
                      className="w-full pl-10 pr-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Auto-select best available</option>
                      {teamMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.firstName} {member.lastName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            {availability?.id && onDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isLoading}
                className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md disabled:opacity-50"
              >
                Delete
              </button>
            ) : (
              <div />
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? 'Saving...' : availability ? 'Update' : 'Schedule'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
