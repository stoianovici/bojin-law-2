'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserCheck, Calendar } from 'lucide-react';

export interface Task {
  id: string;
  title: string;
  type: string;
  dueDate: Date;
  priority: string;
}

export interface DelegationManagerProps {
  businessTripTaskId: string;
  availableUsers: Array<{ id: string; firstName: string; lastName: string; email: string }>;
  userTasks: Task[];
  tripStartDate: string;
  tripEndDate: string;
  onCreateDelegation: (data: {
    delegatedTo: string;
    taskIds?: string[];
    startDate: string;
    endDate: string;
    notes?: string;
  }) => Promise<void>;
}

export function DelegationManager({
  businessTripTaskId,
  availableUsers,
  userTasks,
  tripStartDate,
  tripEndDate,
  onCreateDelegation,
}: DelegationManagerProps) {
  const [delegatedTo, setDelegatedTo] = React.useState<string>('');
  const [startDate, setStartDate] = React.useState(tripStartDate);
  const [endDate, setEndDate] = React.useState(tripEndDate);
  const [delegateAll, setDelegateAll] = React.useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = React.useState<Set<string>>(new Set());
  const [notes, setNotes] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const handleSubmit = async () => {
    if (!delegatedTo || !startDate || !endDate) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreateDelegation({
        delegatedTo,
        taskIds: delegateAll ? undefined : Array.from(selectedTaskIds),
        startDate,
        endDate,
        notes,
      });

      // Reset form
      setDelegatedTo('');
      setSelectedTaskIds(new Set());
      setDelegateAll(false);
      setNotes('');
    } catch (error) {
      console.error('Failed to create delegation:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <UserCheck className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Delegation Setup</h3>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        Delegate your tasks to a team member while you're on this business trip.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Delegate To <span className="text-red-500">*</span>
          </label>
          <Select value={delegatedTo} onValueChange={setDelegatedTo}>
            <SelectTrigger>
              <SelectValue placeholder="Select team member" />
            </SelectTrigger>
            <SelectContent>
              {availableUsers.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.firstName} {user.lastName} ({user.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              Start Date <span className="text-red-500">*</span>
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              End Date <span className="text-red-500">*</span>
            </label>
            <Input
              type="date"
              value={endDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center space-x-2 mb-3">
            <input
              type="checkbox"
              id="delegateAll"
              checked={delegateAll}
              onChange={(e) => {
                setDelegateAll(e.target.checked);
                if (e.target.checked) {
                  setSelectedTaskIds(new Set());
                }
              }}
              className="h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="delegateAll" className="text-sm font-medium cursor-pointer">
              Delegate all my tasks during this period
            </label>
          </div>

          {!delegateAll && (
            <div>
              <label className="block text-sm font-medium mb-2">Select Tasks to Delegate</label>
              {userTasks.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center border rounded-lg">
                  No tasks available to delegate
                </p>
              ) : (
                <div className="max-h-64 overflow-y-auto border rounded-lg">
                  {userTasks.map((task) => (
                    <label
                      key={task.id}
                      className="flex items-start p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTaskIds.has(task.id)}
                        onChange={() => toggleTaskSelection(task.id)}
                        className="mt-1 h-4 w-4 rounded border-gray-300"
                      />
                      <div className="ml-3 flex-1">
                        <p className="text-sm font-medium">{task.title}</p>
                        <p className="text-xs text-gray-500">
                          {task.type} • Due: {new Date(task.dueDate).toLocaleDateString()} •
                          Priority: {task.priority}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="delegationNotes" className="block text-sm font-medium mb-1">
            Notes
          </label>
          <Textarea
            id="delegationNotes"
            value={notes}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
            placeholder="Add any special instructions or context for the delegate..."
            rows={3}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              !delegatedTo ||
              !startDate ||
              !endDate ||
              (!delegateAll && selectedTaskIds.size === 0)
            }
          >
            {isSubmitting ? 'Creating Delegation...' : 'Create Delegation'}
          </Button>
        </div>

        {!delegateAll && selectedTaskIds.size > 0 && (
          <p className="text-sm text-gray-600">
            {selectedTaskIds.size} task{selectedTaskIds.size !== 1 ? 's' : ''} selected
          </p>
        )}
      </div>
    </div>
  );
}
