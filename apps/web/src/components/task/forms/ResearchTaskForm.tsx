'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { ResearchTaskMetadata } from '@legal-platform/types';

export interface ResearchTaskFormProps {
  value: ResearchTaskMetadata;
  onChange: (value: ResearchTaskMetadata) => void;
  errors?: Record<string, string>;
}

export function ResearchTaskForm({ value, onChange, errors }: ResearchTaskFormProps) {
  const handleChange = (field: keyof ResearchTaskMetadata, fieldValue: string) => {
    onChange({
      ...value,
      [field]: fieldValue,
    });
  };

  const handleSourcesChange = (sources: string) => {
    onChange({
      ...value,
      sources: sources.split('\n').filter((s) => s.trim()),
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="researchTopic" className="block text-sm font-medium mb-1">
          Research Topic <span className="text-red-500">*</span>
        </label>
        <Input
          id="researchTopic"
          value={value.researchTopic || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('researchTopic', e.target.value)}
          placeholder="e.g., Precedents on contract enforcement"
          className={errors?.researchTopic ? 'border-red-500' : ''}
        />
        {errors?.researchTopic && (
          <p className="text-sm text-red-500 mt-1">{errors.researchTopic}</p>
        )}
      </div>

      <div>
        <label htmlFor="jurisdiction" className="block text-sm font-medium mb-1">
          Jurisdiction
        </label>
        <Input
          id="jurisdiction"
          value={value.jurisdiction || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('jurisdiction', e.target.value)}
          placeholder="e.g., Federal, State, County"
        />
      </div>

      <div>
        <label htmlFor="sources" className="block text-sm font-medium mb-1">
          Sources (one per line)
        </label>
        <Textarea
          id="sources"
          value={value.sources?.join('\n') || ''}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleSourcesChange(e.target.value)}
          placeholder="Enter URLs or document references, one per line"
          rows={4}
        />
      </div>

      <div>
        <label htmlFor="findings" className="block text-sm font-medium mb-1">
          Findings
        </label>
        <Textarea
          id="findings"
          value={value.findings || ''}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange('findings', e.target.value)}
          placeholder="Key findings from research (optional)"
          rows={4}
        />
      </div>
    </div>
  );
}
