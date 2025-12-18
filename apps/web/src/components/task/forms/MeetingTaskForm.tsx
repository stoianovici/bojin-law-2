'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { MeetingTaskMetadata } from '@legal-platform/types';

export interface MeetingTaskFormProps {
  value: MeetingTaskMetadata;
  onChange: (value: MeetingTaskMetadata) => void;
  errors?: Record<string, string>;
}

const MEETING_TYPES = ['Client', 'Internal', 'External', 'CourtRelated'] as const;

export function MeetingTaskForm({ value, onChange, errors }: MeetingTaskFormProps) {
  const handleChange = (field: keyof MeetingTaskMetadata, fieldValue: string) => {
    onChange({
      ...value,
      [field]: fieldValue,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="meetingType" className="block text-sm font-medium mb-1">
          Meeting Type <span className="text-red-500">*</span>
        </label>
        <Select
          value={value.meetingType || ''}
          onValueChange={(val: string) =>
            handleChange('meetingType', val as (typeof MEETING_TYPES)[number])
          }
        >
          <SelectTrigger className={errors?.meetingType ? 'border-red-500' : ''}>
            <SelectValue placeholder="Select meeting type" />
          </SelectTrigger>
          <SelectContent>
            {MEETING_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors?.meetingType && <p className="text-sm text-red-500 mt-1">{errors.meetingType}</p>}
      </div>

      <div>
        <label htmlFor="location" className="block text-sm font-medium mb-1">
          Location
        </label>
        <Input
          id="location"
          value={value.location || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            handleChange('location', e.target.value)
          }
          placeholder="Physical location or 'Virtual'"
        />
      </div>

      <div>
        <label htmlFor="virtualMeetingUrl" className="block text-sm font-medium mb-1">
          Virtual Meeting URL
        </label>
        <Input
          id="virtualMeetingUrl"
          type="url"
          value={value.virtualMeetingUrl || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            handleChange('virtualMeetingUrl', e.target.value)
          }
          placeholder="https://meet.example.com/..."
        />
      </div>

      <div>
        <label htmlFor="agenda" className="block text-sm font-medium mb-1">
          Agenda
        </label>
        <Textarea
          id="agenda"
          value={value.agenda || ''}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            handleChange('agenda', e.target.value)
          }
          placeholder="Meeting agenda and topics to discuss"
          rows={4}
        />
      </div>

      <div>
        <label htmlFor="minutesDocumentId" className="block text-sm font-medium mb-1">
          Meeting Minutes Document ID
        </label>
        <Input
          id="minutesDocumentId"
          value={value.minutesDocumentId || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            handleChange('minutesDocumentId', e.target.value)
          }
          placeholder="ID of meeting minutes document (if applicable)"
        />
      </div>

      <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-md text-sm text-blue-900 dark:text-blue-100">
        <p className="font-medium">Attendee Management</p>
        <p className="mt-1">
          After creating this meeting task, you can add internal and external attendees from the
          task details view.
        </p>
      </div>
    </div>
  );
}
