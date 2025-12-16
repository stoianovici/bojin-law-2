'use client';

/**
 * Calendar Suggestions Component
 * Story 5.2: Communication Intelligence Engine - Task 19
 *
 * Displays suggested calendar events from AI-extracted deadlines and commitments.
 * Allows users to preview and add events to their Outlook calendar.
 *
 * Accessibility:
 * - role="list" for suggestions list
 * - Checkbox group with role="group" and aria-label for batch selection
 * - aria-describedby linking event preview to source extraction
 * - Loading states with aria-busy="true" and spinner role="status"
 * - Success/error toasts with role="status" and aria-live="polite"
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { format, formatDistanceToNow, isPast, isSameDay } from 'date-fns';
import {
  Calendar,
  Clock,
  Bell,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  CalendarPlus,
  X,
} from 'lucide-react';
import {
  useCalendarSuggestions,
  useCreateCalendarEvent,
  type CalendarSuggestion,
} from '../../hooks/useExtractedItems';

// ============================================================================
// Types
// ============================================================================

interface CalendarSuggestionsProps {
  caseId: string;
  maxItems?: number;
}

interface ToastState {
  message: string;
  type: 'success' | 'error';
  visible: boolean;
}

// ============================================================================
// Priority Badge Component
// ============================================================================

interface PriorityBadgeProps {
  priority: CalendarSuggestion['priority'];
}

function PriorityBadge({ priority }: PriorityBadgeProps) {
  const config = {
    Urgent: { bg: 'bg-red-100', text: 'text-red-800', icon: AlertTriangle },
    High: { bg: 'bg-orange-100', text: 'text-orange-800', icon: Clock },
    Medium: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock },
    Low: { bg: 'bg-gray-100', text: 'text-gray-700', icon: Clock },
  };

  const { bg, text, icon: Icon } = config[priority];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${bg} ${text}`}
      aria-label={`Priority: ${priority}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {priority}
    </span>
  );
}

// ============================================================================
// Source Type Badge Component
// ============================================================================

interface SourceTypeBadgeProps {
  sourceType: CalendarSuggestion['sourceType'];
}

function SourceTypeBadge({ sourceType }: SourceTypeBadgeProps) {
  const config = {
    deadline: { bg: 'bg-orange-50', text: 'text-orange-700', label: 'Deadline' },
    commitment: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Commitment' },
    meeting: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Meeting' },
  };

  const { bg, text, label } = config[sourceType];

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${bg} ${text}`}
    >
      {label}
    </span>
  );
}

// ============================================================================
// Reminder Display Component
// ============================================================================

interface ReminderDisplayProps {
  reminderMinutes: number[];
}

function ReminderDisplay({ reminderMinutes }: ReminderDisplayProps) {
  const formatReminder = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
    return `${Math.floor(minutes / 1440)}d`;
  };

  return (
    <div className="flex items-center gap-1 text-xs text-gray-500">
      <Bell className="h-3 w-3" aria-hidden="true" />
      <span
        aria-label={`Reminders: ${reminderMinutes.map((m) => formatReminder(m)).join(', ')} before`}
      >
        {reminderMinutes.map((m) => formatReminder(m)).join(', ')}
      </span>
    </div>
  );
}

// ============================================================================
// Toast Notification Component
// ============================================================================

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg ${
        type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`}
    >
      {type === 'success' ? (
        <CheckCircle className="h-5 w-5" aria-hidden="true" />
      ) : (
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      )}
      <span>{message}</span>
      <button
        onClick={onClose}
        className="ml-2 p-1 hover:bg-white/50 rounded"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

// ============================================================================
// Suggestion Card Component
// ============================================================================

interface SuggestionCardProps {
  suggestion: CalendarSuggestion;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onAddToCalendar: () => void;
  isAdding: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function SuggestionCard({
  suggestion,
  isSelected,
  onSelect,
  onAddToCalendar,
  isAdding,
  isExpanded,
  onToggleExpand,
}: SuggestionCardProps) {
  const descriptionId = `suggestion-desc-${suggestion.id}`;
  const startDate = new Date(suggestion.startDateTime);
  const isOverdue = isPast(startDate) && !isSameDay(startDate, new Date());

  return (
    <div
      role="listitem"
      className={`border rounded-lg transition-all ${
        isOverdue ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'
      } ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <label className="flex items-center mt-1">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => onSelect(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              aria-label={`Select ${suggestion.title} for batch add`}
            />
          </label>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium text-sm text-gray-900 truncate">{suggestion.title}</h3>
              <div className="flex items-center gap-2 flex-shrink-0">
                <SourceTypeBadge sourceType={suggestion.sourceType} />
                <PriorityBadge priority={suggestion.priority} />
              </div>
            </div>

            {/* Date/Time */}
            <div className="mt-2 flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" aria-hidden="true" />
                <span>
                  {format(startDate, suggestion.isAllDay ? 'MMM d, yyyy' : 'MMM d, yyyy h:mm a')}
                </span>
              </div>
              {suggestion.isAllDay && <span className="text-xs text-gray-500">(All day)</span>}
            </div>

            {/* Time until/overdue */}
            <div
              className={`mt-1 text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}
            >
              {isOverdue
                ? `Overdue by ${formatDistanceToNow(startDate)}`
                : `In ${formatDistanceToNow(startDate)}`}
            </div>

            {/* Reminders */}
            <div className="mt-2">
              <ReminderDisplay reminderMinutes={suggestion.reminderMinutes} />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={onToggleExpand}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
            aria-expanded={isExpanded}
            aria-controls={descriptionId}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3 w-3" aria-hidden="true" />
                Hide details
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" aria-hidden="true" />
                Show details
              </>
            )}
          </button>

          <button
            onClick={onAddToCalendar}
            disabled={isAdding}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label={`Add ${suggestion.title} to calendar`}
            aria-describedby={isExpanded ? descriptionId : undefined}
          >
            {isAdding ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Adding...
              </>
            ) : (
              <>
                <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                Add to Calendar
              </>
            )}
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div id={descriptionId} className="px-4 pb-4 pt-2 border-t border-gray-100 bg-gray-50">
          <h4 className="text-xs font-medium text-gray-700 mb-2">Event Description</h4>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{suggestion.description}</p>
          {suggestion.caseId && (
            <a
              href={`/cases/${suggestion.caseId}`}
              className="mt-3 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              View case
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CalendarSuggestions({ caseId, maxItems }: CalendarSuggestionsProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const [isBatchAdding, setIsBatchAdding] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Fetch suggestions
  const { data, loading, error, refetch } = useCalendarSuggestions(caseId);
  const [createCalendarEvent] = useCreateCalendarEvent();

  const suggestions = data?.calendarSuggestions ?? [];
  const displaySuggestions = maxItems ? suggestions.slice(0, maxItems) : suggestions;

  // Toggle selection
  const toggleSelection = useCallback((id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  }, []);

  // Select all / deselect all
  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === displaySuggestions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displaySuggestions.map((s) => s.id)));
    }
  }, [selectedIds.size, displaySuggestions]);

  // Toggle expansion
  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // Add single event to calendar
  const handleAddToCalendar = useCallback(
    async (suggestionId: string) => {
      setAddingIds((prev) => new Set(prev).add(suggestionId));
      try {
        const result = await createCalendarEvent({
          variables: { suggestionId },
        });

        if (result.data?.createCalendarEvent.success) {
          setToast({
            message: 'Event added to your calendar',
            type: 'success',
            visible: true,
          });
          refetch();
        } else {
          setToast({
            message: result.data?.createCalendarEvent.error || 'Failed to add event',
            type: 'error',
            visible: true,
          });
        }
      } catch (err) {
        setToast({
          message: 'Failed to connect to calendar service',
          type: 'error',
          visible: true,
        });
        console.error('Error adding calendar event:', err);
      } finally {
        setAddingIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(suggestionId);
          return newSet;
        });
      }
    },
    [createCalendarEvent, refetch]
  );

  // Batch add selected events
  const handleBatchAdd = useCallback(async () => {
    if (selectedIds.size === 0) return;

    setIsBatchAdding(true);
    const ids = Array.from(selectedIds);
    let successCount = 0;
    let failCount = 0;

    for (const id of ids) {
      try {
        const result = await createCalendarEvent({
          variables: { suggestionId: id },
        });

        if (result.data?.createCalendarEvent.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    setIsBatchAdding(false);
    setSelectedIds(new Set());

    if (failCount === 0) {
      setToast({
        message: `${successCount} event${successCount !== 1 ? 's' : ''} added to your calendar`,
        type: 'success',
        visible: true,
      });
    } else {
      setToast({
        message: `Added ${successCount}, failed ${failCount} event${failCount !== 1 ? 's' : ''}`,
        type: 'error',
        visible: true,
      });
    }

    refetch();
  }, [selectedIds, createCalendarEvent, refetch]);

  // Dismiss toast
  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  // Loading state
  if (loading && suggestions.length === 0) {
    return (
      <div
        className="p-6 flex items-center justify-center"
        role="status"
        aria-busy="true"
        aria-label="Loading calendar suggestions"
      >
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" aria-hidden="true" />
        <span className="ml-2 text-sm text-gray-600">Loading calendar suggestions...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 bg-red-50 rounded-lg" role="alert">
        <div className="flex items-center gap-2 text-red-800">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          <span className="font-medium">Failed to load calendar suggestions</span>
        </div>
        <button
          onClick={() => refetch()}
          className="mt-2 text-sm text-red-600 hover:underline focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          Try again
        </button>
      </div>
    );
  }

  // Empty state
  if (displaySuggestions.length === 0) {
    return (
      <div className="p-6 text-center">
        <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" aria-hidden="true" />
        <p className="text-sm text-gray-500">No calendar suggestions</p>
        <p className="text-xs text-gray-400 mt-1">
          Calendar events will be suggested from extracted deadlines and commitments
        </p>
      </div>
    );
  }

  const allSelected = selectedIds.size === displaySuggestions.length;
  const someSelected = selectedIds.size > 0;

  return (
    <div className="space-y-4" aria-label="Calendar suggestions panel">
      {/* Header with batch actions */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-500" aria-hidden="true" />
          Calendar Suggestions
          <span className="text-sm font-normal text-gray-500">({displaySuggestions.length})</span>
        </h2>

        {/* Outlook sync status indicator */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <div className="h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
          <span>Connected to Outlook</span>
        </div>
      </div>

      {/* Batch selection controls */}
      {displaySuggestions.length > 1 && (
        <div
          role="group"
          aria-label="Batch selection controls"
          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
        >
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = someSelected && !allSelected;
              }}
              onChange={toggleSelectAll}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              aria-label={allSelected ? 'Deselect all suggestions' : 'Select all suggestions'}
            />
            <span className="text-sm text-gray-700">
              {someSelected ? `${selectedIds.size} selected` : 'Select all'}
            </span>
          </label>

          {someSelected && (
            <button
              onClick={handleBatchAdd}
              disabled={isBatchAdding}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label={`Add ${selectedIds.size} selected events to calendar`}
            >
              {isBatchAdding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Adding {selectedIds.size}...
                </>
              ) : (
                <>
                  <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                  Add {selectedIds.size} to Calendar
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Suggestions list */}
      <div
        ref={listRef}
        role="list"
        aria-label="Calendar event suggestions"
        aria-busy={loading}
        className="space-y-3"
      >
        {displaySuggestions.map((suggestion) => (
          <SuggestionCard
            key={suggestion.id}
            suggestion={suggestion}
            isSelected={selectedIds.has(suggestion.id)}
            onSelect={(selected) => toggleSelection(suggestion.id, selected)}
            onAddToCalendar={() => handleAddToCalendar(suggestion.id)}
            isAdding={addingIds.has(suggestion.id)}
            isExpanded={expandedIds.has(suggestion.id)}
            onToggleExpand={() => toggleExpand(suggestion.id)}
          />
        ))}
      </div>

      {/* Show more link if limited */}
      {maxItems && suggestions.length > maxItems && (
        <div className="text-center">
          <a
            href={`/cases/${caseId}?tab=intelligence`}
            className="text-sm text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            View all {suggestions.length} suggestions
          </a>
        </div>
      )}

      {/* Toast notification */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={dismissToast} />}
    </div>
  );
}

export default CalendarSuggestions;
