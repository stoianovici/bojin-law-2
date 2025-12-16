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
import type { DocumentRetrievalTaskMetadata } from '@legal-platform/types';

export interface DocumentRetrievalTaskFormProps {
  value: DocumentRetrievalTaskMetadata;
  onChange: (value: DocumentRetrievalTaskMetadata) => void;
  errors?: Record<string, string>;
}

const SOURCE_LOCATIONS = ['Court', 'Client', 'Registry', 'Third Party', 'Archives', 'Other'];

const RETRIEVAL_METHODS = ['Physical', 'Electronic', 'Request'] as const;

export function DocumentRetrievalTaskForm({
  value,
  onChange,
  errors,
}: DocumentRetrievalTaskFormProps) {
  const handleChange = (field: keyof DocumentRetrievalTaskMetadata, fieldValue: string) => {
    onChange({
      ...value,
      [field]: fieldValue,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="documentDescription" className="block text-sm font-medium mb-1">
          Document Description <span className="text-red-500">*</span>
        </label>
        <Textarea
          id="documentDescription"
          value={value.documentDescription || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            handleChange('documentDescription', e.target.value)
          }
          placeholder="Describe the document to retrieve"
          rows={3}
          className={errors?.documentDescription ? 'border-red-500' : ''}
        />
        {errors?.documentDescription && (
          <p className="text-sm text-red-500 mt-1">{errors.documentDescription}</p>
        )}
      </div>

      <div>
        <label htmlFor="sourceLocation" className="block text-sm font-medium mb-1">
          Source Location
        </label>
        <Select
          value={value.sourceLocation || ''}
          onValueChange={(val: string) => handleChange('sourceLocation', val)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select source location" />
          </SelectTrigger>
          <SelectContent>
            {SOURCE_LOCATIONS.map((location) => (
              <SelectItem key={location} value={location}>
                {location}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label htmlFor="retrievalMethod" className="block text-sm font-medium mb-1">
          Retrieval Method
        </label>
        <Select
          value={value.retrievalMethod || ''}
          onValueChange={(val: string) =>
            handleChange('retrievalMethod', val as (typeof RETRIEVAL_METHODS)[number])
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select retrieval method" />
          </SelectTrigger>
          <SelectContent>
            {RETRIEVAL_METHODS.map((method) => (
              <SelectItem key={method} value={method}>
                {method}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label htmlFor="trackingNumber" className="block text-sm font-medium mb-1">
          Tracking Number
        </label>
        <Input
          id="trackingNumber"
          value={value.trackingNumber || ''}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            handleChange('trackingNumber', e.target.value)
          }
          placeholder="Tracking or reference number"
        />
      </div>
    </div>
  );
}
