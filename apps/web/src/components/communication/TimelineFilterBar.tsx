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
    <div className={`rounded-lg border border-gray-200 bg-gray-50 ${className}`}>
      {/* Collapsed View */}
      <div className="flex items-center gap-3 p-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          aria-expanded={isExpanded}
          aria-controls="filter-panel"
        >
          <Filter className="h-4 w-4" />
          Filtre
          {activeCount > 0 && (
            <span className="ml-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
              {activeCount}
            </span>
          )}
        </button>

        {/* Quick search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Caută comunicări..."
            value={filter.searchTerm || ''}
            onChange={handleSearchChange}
            className="w-full rounded-lg border border-gray-300 bg-white py-1.5 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
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
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
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
          className="border-t border-gray-200 p-4"
          role="region"
          aria-label="Filter options"
        >
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Channel Types */}
            <fieldset>
              <legend className="mb-2 text-xs font-medium uppercase text-gray-500">Canale</legend>
              <div className="flex flex-wrap gap-2">
                {ALL_CHANNELS.map((channel) => {
                  const isSelected = selectedChannels.includes(channel);
                  const disabled = isChannelDisabled(channel);

                  return (
                    <label
                      key={channel}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 bg-white text-gray-600'
                      } ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-gray-50'}`}
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
                        <span className="rounded bg-gray-200 px-1 text-[10px] text-gray-500">
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
              <legend className="mb-2 text-xs font-medium uppercase text-gray-500">Direcție</legend>
              <div className="flex gap-2">
                {ALL_DIRECTIONS.map(({ value, label }) => (
                  <label
                    key={label}
                    className={`flex cursor-pointer items-center rounded-lg border px-3 py-1.5 text-sm ${
                      filter.direction === value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
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
              <legend className="mb-2 text-xs font-medium uppercase text-gray-500">
                Interval Date
              </legend>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <CalendarDays className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="date"
                    value={filter.dateFrom?.toISOString().split('T')[0] || ''}
                    onChange={handleDateFromChange}
                    className="w-full rounded-lg border border-gray-300 py-1.5 pl-8 pr-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    aria-label="De la data"
                  />
                </div>
                <span className="text-gray-400">până la</span>
                <div className="relative flex-1">
                  <CalendarDays className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="date"
                    value={filter.dateTo?.toISOString().split('T')[0] || ''}
                    onChange={handleDateToChange}
                    className="w-full rounded-lg border border-gray-300 py-1.5 pl-8 pr-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    aria-label="Până la data"
                  />
                </div>
              </div>
            </fieldset>

            {/* Privacy Toggle */}
            <fieldset>
              <legend className="mb-2 text-xs font-medium uppercase text-gray-500">
                Confidențialitate
              </legend>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={filter.includePrivate || false}
                  onChange={handlePrivacyToggle}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Afișează comunicările private</span>
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
