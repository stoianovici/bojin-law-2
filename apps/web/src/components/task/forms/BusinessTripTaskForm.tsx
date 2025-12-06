'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { BusinessTripTaskMetadata } from '@legal-platform/types';

export interface BusinessTripTaskFormProps {
  value: BusinessTripTaskMetadata;
  onChange: (value: BusinessTripTaskMetadata) => void;
  errors?: Record<string, string>;
}

export function BusinessTripTaskForm({ value, onChange, errors }: BusinessTripTaskFormProps) {
  const handleChange = (field: keyof BusinessTripTaskMetadata, fieldValue: string | boolean) => {
    onChange({
      ...value,
      [field]: fieldValue,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="destination" className="block text-sm font-medium mb-1">
          Destination <span className="text-red-500">*</span>
        </label>
        <Input
          id="destination"
          value={value.destination || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('destination', e.target.value)}
          placeholder="e.g., New York, NY"
          className={errors?.destination ? 'border-red-500' : ''}
        />
        {errors?.destination && <p className="text-sm text-red-500 mt-1">{errors.destination}</p>}
      </div>

      <div>
        <label htmlFor="purpose" className="block text-sm font-medium mb-1">
          Trip Purpose <span className="text-red-500">*</span>
        </label>
        <Textarea
          id="purpose"
          value={value.purpose || ''}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange('purpose', e.target.value)}
          placeholder="Business reason for the trip"
          rows={3}
          className={errors?.purpose ? 'border-red-500' : ''}
        />
        {errors?.purpose && <p className="text-sm text-red-500 mt-1">{errors.purpose}</p>}
      </div>

      <div>
        <label htmlFor="travelDetails" className="block text-sm font-medium mb-1">
          Travel Details
        </label>
        <Textarea
          id="travelDetails"
          value={value.travelDetails || ''}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange('travelDetails', e.target.value)}
          placeholder="Flight/train details, departure/arrival times"
          rows={3}
        />
      </div>

      <div>
        <label htmlFor="accommodationDetails" className="block text-sm font-medium mb-1">
          Accommodation Details
        </label>
        <Textarea
          id="accommodationDetails"
          value={value.accommodationDetails || ''}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange('accommodationDetails', e.target.value)}
          placeholder="Hotel name, address, confirmation number"
          rows={2}
        />
      </div>

      <div className="flex items-start space-x-2">
        <input
          type="checkbox"
          id="delegationRequired"
          checked={value.delegationRequired || false}
          onChange={(e) => handleChange('delegationRequired', e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300"
        />
        <div className="flex-1">
          <label htmlFor="delegationRequired" className="block text-sm font-medium cursor-pointer">
            Delegation Required
          </label>
          <p className="text-sm text-gray-500">
            Automatically create delegation workflow to reassign tasks during this trip
          </p>
        </div>
      </div>

      {value.delegationRequired && (
        <div className="bg-amber-50 dark:bg-amber-950 p-3 rounded-md text-sm text-amber-900 dark:text-amber-100">
          <p className="font-medium">Delegation Workflow</p>
          <p className="mt-1">
            After creating this task, you'll be prompted to select which tasks to delegate and to
            whom during your trip dates.
          </p>
        </div>
      )}
    </div>
  );
}
