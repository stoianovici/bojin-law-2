'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DocumentCreationTaskMetadata } from '@legal-platform/types';

export interface DocumentCreationTaskFormProps {
  value: DocumentCreationTaskMetadata;
  onChange: (value: DocumentCreationTaskMetadata) => void;
  errors?: Record<string, string>;
}

const DOCUMENT_TYPES = [
  'Contract',
  'Motion',
  'Letter',
  'Memorandum',
  'Brief',
  'Pleading',
  'Agreement',
  'Notice',
  'Other',
];

const DRAFT_STATUSES = ['NotStarted', 'InProgress', 'Review', 'Complete'] as const;

export function DocumentCreationTaskForm({
  value,
  onChange,
  errors,
}: DocumentCreationTaskFormProps) {
  const handleChange = (field: keyof DocumentCreationTaskMetadata, fieldValue: string) => {
    onChange({
      ...value,
      [field]: fieldValue,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="documentType" className="block text-sm font-medium mb-1">
          Document Type <span className="text-red-500">*</span>
        </label>
        <Select
          value={value.documentType || ''}
          onValueChange={(val: string) => handleChange('documentType', val)}
        >
          <SelectTrigger className={errors?.documentType ? 'border-red-500' : ''}>
            <SelectValue placeholder="Select document type" />
          </SelectTrigger>
          <SelectContent>
            {DOCUMENT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors?.documentType && <p className="text-sm text-red-500 mt-1">{errors.documentType}</p>}
      </div>

      <div>
        <label htmlFor="templateId" className="block text-sm font-medium mb-1">
          Template ID
        </label>
        <Input
          id="templateId"
          value={value.templateId || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            handleChange('templateId', e.target.value)
          }
          placeholder="Optional template ID"
        />
      </div>

      <div>
        <label htmlFor="draftStatus" className="block text-sm font-medium mb-1">
          Draft Status
        </label>
        <Select
          value={value.draftStatus || 'NotStarted'}
          onValueChange={(val: string) =>
            handleChange('draftStatus', val as (typeof DRAFT_STATUSES)[number])
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select draft status" />
          </SelectTrigger>
          <SelectContent>
            {DRAFT_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label htmlFor="outputDocumentId" className="block text-sm font-medium mb-1">
          Output Document ID
        </label>
        <Input
          id="outputDocumentId"
          value={value.outputDocumentId || ''}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            handleChange('outputDocumentId', e.target.value)
          }
          placeholder="ID of created document (if applicable)"
        />
      </div>
    </div>
  );
}
