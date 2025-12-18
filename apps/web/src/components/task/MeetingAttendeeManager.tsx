'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { UserPlus, X, Check, Clock, XCircle, User } from 'lucide-react';

export interface TaskAttendee {
  id: string;
  taskId: string;
  userId?: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  externalName?: string;
  externalEmail?: string;
  isOrganizer: boolean;
  response: 'Pending' | 'Accepted' | 'Declined' | 'Tentative';
}

export interface MeetingAttendeeManagerProps {
  taskId: string;
  attendees: TaskAttendee[];
  availableUsers?: Array<{ id: string; firstName: string; lastName: string; email: string }>;
  onAddAttendee: (attendee: {
    userId?: string;
    externalName?: string;
    externalEmail?: string;
    isOrganizer: boolean;
  }) => Promise<void>;
  onRemoveAttendee: (attendeeId: string) => Promise<void>;
  onUpdateResponse?: (attendeeId: string, response: TaskAttendee['response']) => Promise<void>;
}

type AttendeeType = 'internal' | 'external';

export function MeetingAttendeeManager({
  taskId: _taskId,
  attendees,
  availableUsers = [],
  onAddAttendee,
  onRemoveAttendee,
  onUpdateResponse: _onUpdateResponse,
}: MeetingAttendeeManagerProps) {
  const [attendeeType, setAttendeeType] = React.useState<AttendeeType>('internal');
  const [selectedUserId, setSelectedUserId] = React.useState<string>('');
  const [externalName, setExternalName] = React.useState('');
  const [externalEmail, setExternalEmail] = React.useState('');
  const [isOrganizer, setIsOrganizer] = React.useState(false);
  const [isAdding, setIsAdding] = React.useState(false);

  const handleAddAttendee = async () => {
    if (attendeeType === 'internal' && !selectedUserId) {
      return;
    }
    if (attendeeType === 'external' && (!externalName || !externalEmail)) {
      return;
    }

    setIsAdding(true);
    try {
      await onAddAttendee({
        userId: attendeeType === 'internal' ? selectedUserId : undefined,
        externalName: attendeeType === 'external' ? externalName : undefined,
        externalEmail: attendeeType === 'external' ? externalEmail : undefined,
        isOrganizer,
      });

      // Reset form
      setSelectedUserId('');
      setExternalName('');
      setExternalEmail('');
      setIsOrganizer(false);
    } catch (error) {
      console.error('Failed to add attendee:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const getResponseBadge = (response: TaskAttendee['response']) => {
    switch (response) {
      case 'Accepted':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <Check className="w-3 h-3 mr-1" />
            Accepted
          </Badge>
        );
      case 'Declined':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <XCircle className="w-3 h-3 mr-1" />
            Declined
          </Badge>
        );
      case 'Tentative':
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            <Clock className="w-3 h-3 mr-1" />
            Tentative
          </Badge>
        );
      case 'Pending':
      default:
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-4">
        <h3 className="text-sm font-medium mb-3">Add Attendee</h3>

        <div className="space-y-3">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={attendeeType === 'internal' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAttendeeType('internal')}
            >
              Internal User
            </Button>
            <Button
              type="button"
              variant={attendeeType === 'external' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAttendeeType('external')}
            >
              External Guest
            </Button>
          </div>

          {attendeeType === 'internal' ? (
            <div>
              <label className="block text-sm font-medium mb-1">Select User</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a user" />
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
          ) : (
            <div className="space-y-2">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <Input
                  value={externalName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setExternalName(e.target.value)
                  }
                  placeholder="External attendee name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <Input
                  type="email"
                  value={externalEmail}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setExternalEmail(e.target.value)
                  }
                  placeholder="email@example.com"
                />
              </div>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isOrganizer"
              checked={isOrganizer}
              onChange={(e) => setIsOrganizer(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="isOrganizer" className="text-sm cursor-pointer">
              Mark as organizer
            </label>
          </div>

          <Button
            type="button"
            onClick={handleAddAttendee}
            disabled={
              isAdding ||
              (attendeeType === 'internal' && !selectedUserId) ||
              (attendeeType === 'external' && (!externalName || !externalEmail))
            }
            size="sm"
            className="w-full"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Add Attendee
          </Button>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3">Attendees ({attendees.length})</h3>

        {attendees.length === 0 ? (
          <div className="text-center py-8 border rounded-lg bg-gray-50">
            <User className="w-8 h-8 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-500">No attendees added yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {attendees.map((attendee) => (
              <div
                key={attendee.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">
                      {attendee.user
                        ? `${attendee.user.firstName} ${attendee.user.lastName}`
                        : attendee.externalName}
                    </p>
                    {attendee.isOrganizer && (
                      <Badge variant="outline" className="text-xs">
                        Organizer
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {attendee.user?.email || attendee.externalEmail}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {getResponseBadge(attendee.response)}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveAttendee(attendee.id)}
                    className="h-8 w-8 p-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
