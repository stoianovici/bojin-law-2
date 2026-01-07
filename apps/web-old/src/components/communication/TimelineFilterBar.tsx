/**
 * Timeline Filter Bar Component
 * Story 5.5: Multi-Channel Communication Hub (AC: 1)
 *
 * Provides filtering options for the communication timeline
 */

'use client';

import React, { useState } from 'react';
import {
  useChannelMetadata,
  type CommunicationChannel,
  type CommunicationDirection,
  type TimelineFilter,
} from '@/hooks/useCaseTimeline';
import {
  Filter,
  X,
  Mail,
  FileText,
  MessageCircle,
  Phone,
  Calendar,
  Smartphone,
  Search,
  CalendarDays,
} from 'lucide-react';

interface TimelineFilterBarProps {
  filter: Omit<TimelineFilter, 'caseId'>;
  onChange: (filter: Partial<TimelineFilter>) => void;
  onClear: () => void;
  activeCount: number;
  className?: string;
}

const ALL_CHANNELS: CommunicationChannel[] = [
  'Email',
  'InternalNote',
  'Phone',
  'Meeting',
  'WhatsApp',
  'SMS',
];

const ALL_DIRECTIONS: { value: CommunicationDirection | undefined; label: string }[] = [
  { value: undefined, label: 'Toate' },
  { value: 'Inbound', label: 'Primite' },
  { value: 'Outbound', label: 'Trimise' },
  { value: 'Internal', label: 'Interne' },
];

export function TimelineFilterBar({
  filter,
  onChange,
  onClear,
  activeCount,
  className = '',
}: TimelineFilterBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { getChannelLabel, isChannelDisabled } = useChannelMetadata();

  const selectedChannels = filter.channelTypes || [];

  const toggleChannel = (channel: CommunicationChannel) => {
    if (isChannelDisabled(channel)) return;

    const current = filter.channelTypes || [];
    const isSelected = current.includes(channel);

    if (isSelected) {
      onChange({
        channelTypes: current.filter((c) => c !== channel),
      });
    } else {
      onChange({
        channelTypes: [...current, channel],
      });
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ searchTerm: e.target.value || undefined });
  };

  const handleDirectionChange = (direction: CommunicationDirection | undefined) => {
    onChange({ direction });
  };

  const handleDateFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value ? new Date(e.target.value) : undefined;
    onChange({ dateFrom: date });
  };

  const handleDateToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value ? new Date(e.target.value) : undefined;
    onChange({ dateTo: date });
  };

  const handlePrivacyToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ includePrivate: e.target.checked });
  };

  return (
    <div
      className={`rounded-lg border border-linear-border-subtle bg-linear-bg-tertiary ${className}`}
    >
      {/* Collapsed View */}
      <div className="flex items-center gap-3 p-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 rounded-lg border border-linear-border bg-linear-bg-secondary px-3 py-1.5 text-sm font-medium text-linear-text-secondary hover:bg-linear-bg-tertiary"
          aria-expanded={isExpanded}
          aria-controls="filter-panel"
        >
          <Filter className="h-4 w-4" />
          Filtre
          {activeCount > 0 && (
            <span className="ml-1 rounded-full bg-linear-accent/15 px-2 py-0.5 text-xs text-linear-accent">
              {activeCount}
            </span>
          )}
        </button>

        {/* Quick search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-linear-text-muted" />
          <input
            type="text"
            placeholder="Caută comunicări..."
            value={filter.searchTerm || ''}
            onChange={handleSearchChange}
            className="w-full rounded-lg border border-linear-border bg-linear-bg-secondary py-1.5 pl-9 pr-3 text-sm placeholder:text-linear-text-muted focus:border-linear-accent focus:outline-none focus:ring-1 focus:ring-linear-accent"
            aria-label="Caută comunicări"
          />
        </div>

        {/* Quick channel filters */}
        <div
          className="hidden items-center gap-1 md:flex"
          role="group"
          aria-label="Channel filters"
        >
          {ALL_CHANNELS.slice(0, 4).map((channel) => {
            const isSelected = selectedChannels.includes(channel);
            const disabled = isChannelDisabled(channel);

            return (
              <button
                key={channel}
                onClick={() => toggleChannel(channel)}
                disabled={disabled}
                className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition-colors ${
                  isSelected
                    ? 'border-linear-accent bg-linear-accent/10 text-linear-accent'
                    : 'border-linear-border bg-linear-bg-secondary text-linear-text-tertiary hover:bg-linear-bg-tertiary'
                } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                title={disabled ? 'În curând' : getChannelLabel(channel)}
                aria-pressed={isSelected}
              >
                {getChannelIcon(channel)}
                <span className="hidden lg:inline">{getChannelLabel(channel)}</span>
              </button>
            );
          })}
        </div>

        {/* Clear button */}
        {activeCount > 0 && (
          <button
            onClick={onClear}
            className="flex items-center gap-1 text-sm text-linear-text-tertiary hover:text-linear-text-secondary"
          >
            <X className="h-4 w-4" />
            Șterge
          </button>
        )}
      </div>

      {/* Expanded Filter Panel */}
      {isExpanded && (
        <div
          id="filter-panel"
          className="border-t border-linear-border-subtle p-4"
          role="region"
          aria-label="Filter options"
        >
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Channel Types */}
            <fieldset>
              <legend className="mb-2 text-xs font-medium uppercase text-linear-text-tertiary">
                Canale
              </legend>
              <div className="flex flex-wrap gap-2">
                {ALL_CHANNELS.map((channel) => {
                  const isSelected = selectedChannels.includes(channel);
                  const disabled = isChannelDisabled(channel);

                  return (
                    <label
                      key={channel}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                        isSelected
                          ? 'border-linear-accent bg-linear-accent/10 text-linear-accent'
                          : 'border-linear-border bg-linear-bg-secondary text-linear-text-tertiary'
                      } ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-linear-bg-tertiary'}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleChannel(channel)}
                        disabled={disabled}
                        className="sr-only"
                      />
                      {getChannelIcon(channel)}
                      {getChannelLabel(channel)}
                      {disabled && (
                        <span className="rounded bg-linear-bg-hover px-1 text-[10px] text-linear-text-muted">
                          În curând
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {/* Direction */}
            <fieldset>
              <legend className="mb-2 text-xs font-medium uppercase text-linear-text-tertiary">
                Direcție
              </legend>
              <div className="flex gap-2">
                {ALL_DIRECTIONS.map(({ value, label }) => (
                  <label
                    key={label}
                    className={`flex cursor-pointer items-center rounded-lg border px-3 py-1.5 text-sm ${
                      filter.direction === value
                        ? 'border-linear-accent bg-linear-accent/10 text-linear-accent'
                        : 'border-linear-border bg-linear-bg-secondary text-linear-text-tertiary hover:bg-linear-bg-tertiary'
                    }`}
                  >
                    <input
                      type="radio"
                      name="direction"
                      checked={filter.direction === value}
                      onChange={() => handleDirectionChange(value)}
                      className="sr-only"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Date Range */}
            <fieldset>
              <legend className="mb-2 text-xs font-medium uppercase text-linear-text-tertiary">
                Interval Date
              </legend>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <CalendarDays className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-linear-text-muted" />
                  <input
                    type="date"
                    value={filter.dateFrom?.toISOString().split('T')[0] || ''}
                    onChange={handleDateFromChange}
                    className="w-full rounded-lg border border-linear-border bg-linear-bg-secondary py-1.5 pl-8 pr-2 text-sm focus:border-linear-accent focus:outline-none focus:ring-1 focus:ring-linear-accent"
                    aria-label="De la data"
                  />
                </div>
                <span className="text-linear-text-muted">până la</span>
                <div className="relative flex-1">
                  <CalendarDays className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-linear-text-muted" />
                  <input
                    type="date"
                    value={filter.dateTo?.toISOString().split('T')[0] || ''}
                    onChange={handleDateToChange}
                    className="w-full rounded-lg border border-linear-border bg-linear-bg-secondary py-1.5 pl-8 pr-2 text-sm focus:border-linear-accent focus:outline-none focus:ring-1 focus:ring-linear-accent"
                    aria-label="Până la data"
                  />
                </div>
              </div>
            </fieldset>

            {/* Privacy Toggle */}
            <fieldset>
              <legend className="mb-2 text-xs font-medium uppercase text-linear-text-tertiary">
                Confidențialitate
              </legend>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={filter.includePrivate || false}
                  onChange={handlePrivacyToggle}
                  className="h-4 w-4 rounded border-linear-border text-linear-accent focus:ring-linear-accent"
                />
                <span className="text-sm text-linear-text-secondary">
                  Afișează comunicările private
                </span>
              </label>
            </fieldset>
          </div>
        </div>
      )}

      {/* Screen reader announcement for filter state */}
      <div className="sr-only" role="status" aria-live="polite">
        {activeCount > 0 ? `${activeCount} filtre active` : 'Niciun filtru activ'}
      </div>
    </div>
  );
}

// Helper function for channel icons
function getChannelIcon(channel: CommunicationChannel): React.ReactNode {
  const iconProps = { className: 'h-4 w-4' };

  switch (channel) {
    case 'Email':
      return <Mail {...iconProps} />;
    case 'InternalNote':
      return <FileText {...iconProps} />;
    case 'WhatsApp':
      return <MessageCircle {...iconProps} />;
    case 'Phone':
      return <Phone {...iconProps} />;
    case 'Meeting':
      return <Calendar {...iconProps} />;
    case 'SMS':
      return <Smartphone {...iconProps} />;
    default:
      return <Mail {...iconProps} />;
  }
}

export default TimelineFilterBar;
