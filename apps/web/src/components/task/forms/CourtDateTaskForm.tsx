'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { CourtDateTaskMetadata } from '@legal-platform/types';

export interface CourtDateTaskFormProps {
  value: CourtDateTaskMetadata;
  onChange: (value: CourtDateTaskMetadata) => void;
  errors?: Record<string, string>;
}

export function CourtDateTaskForm({ value, onChange, errors }: CourtDateTaskFormProps) {
  const handleChange = (field: keyof CourtDateTaskMetadata, fieldValue: string) => {
    onChange({
      ...value,
      [field]: fieldValue,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="courtName" className="block text-sm font-medium mb-1">
          Court Name <span className="text-red-500">*</span>
        </label>
        <Input
          id="courtName"
          value={value.courtName || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('courtName', e.target.value)}
          placeholder="e.g., Superior Court of California"
          className={errors?.courtName ? 'border-red-500' : ''}
        />
        {errors?.courtName && <p className="text-sm text-red-500 mt-1">{errors.courtName}</p>}
      </div>

      <div>
        <label htmlFor="courtRoom" className="block text-sm font-medium mb-1">
          Courtroom
        </label>
        <Input
          id="courtRoom"
          value={value.courtRoom || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('courtRoom', e.target.value)}
          placeholder="e.g., Room 302"
        />
      </div>

      <div>
        <label htmlFor="caseNumber" className="block text-sm font-medium mb-1">
          Court Case Number <span className="text-red-500">*</span>
        </label>
        <Input
          id="caseNumber"
          value={value.caseNumber || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('caseNumber', e.target.value)}
          placeholder="e.g., CV-2024-001234"
          className={errors?.caseNumber ? 'border-red-500' : ''}
        />
        {errors?.caseNumber && <p className="text-sm text-red-500 mt-1">{errors.caseNumber}</p>}
      </div>

      <div>
        <label htmlFor="hearingType" className="block text-sm font-medium mb-1">
          Hearing Type <span className="text-red-500">*</span>
        </label>
        <Input
          id="hearingType"
          value={value.hearingType || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('hearingType', e.target.value)}
          placeholder="e.g., Hearing, Trial, Motion, Arraignment"
          className={errors?.hearingType ? 'border-red-500' : ''}
        />
        {errors?.hearingType && <p className="text-sm text-red-500 mt-1">{errors.hearingType}</p>}
      </div>

      <div>
        <label htmlFor="judge" className="block text-sm font-medium mb-1">
          Judge
        </label>
        <Input
          id="judge"
          value={value.judge || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('judge', e.target.value)}
          placeholder="Judge name"
        />
      </div>

      <div>
        <label htmlFor="preparationNotes" className="block text-sm font-medium mb-1">
          Preparation Notes
        </label>
        <Textarea
          id="preparationNotes"
          value={value.preparationNotes || ''}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange('preparationNotes', e.target.value)}
          placeholder="Special preparation requirements or notes"
          rows={4}
        />
      </div>

      <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-md text-sm text-blue-900 dark:text-blue-100">
        <p className="font-medium">Automatic Preparation Subtasks</p>
        <p className="mt-1">
          Five preparation subtasks will be automatically created based on the hearing date: 7, 5,
          4, 3, and 1 days before the hearing.
        </p>
      </div>
    </div>
  );
}
