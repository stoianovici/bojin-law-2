/**
 * Privacy Badge Component
 * Story 5.5: Multi-Channel Communication Hub (AC: 6)
 *
 * Visual indicator for communication privacy level with tooltip
 */

'use client';

import React, { useState } from 'react';
import {
  usePrivacyLevels,
  type PrivacyLevel,
} from '@/hooks/useCommunicationPrivacy';
import {
  Lock,
  Unlock,
  Users,
  Briefcase,
  Crown,
  Info,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface PrivacyBadgeProps {
  level: PrivacyLevel;
  allowedViewers?: { id: string; name: string }[];
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onClick?: () => void;
  className?: string;
}

// ============================================================================
// Helper Components
// ============================================================================

const PrivacyIcon = ({
  level,
  className = '',
}: {
  level: PrivacyLevel;
  className?: string;
}) => {
  const iconProps = { className };

  switch (level) {
    case 'Normal':
      return null; // No icon for normal
    case 'Confidential':
      return <Lock {...iconProps} />;
    case 'AttorneyOnly':
      return <Briefcase {...iconProps} />;
    case 'PartnerOnly':
      return <Crown {...iconProps} />;
    default:
      return <Unlock {...iconProps} />;
  }
};

// ============================================================================
// Component
// ============================================================================

export function PrivacyBadge({
  level,
  allowedViewers = [],
  showLabel = false,
  size = 'md',
  interactive = true,
  onClick,
  className = '',
}: PrivacyBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const { getLevelLabel, getLevelDescription, getLevelColor } = usePrivacyLevels();

  // Don't show badge for normal privacy
  if (level === 'Normal') {
    return null;
  }

  // Size classes
  const sizeClasses = {
    sm: {
      badge: 'h-5 px-1.5 text-xs gap-1',
      icon: 'h-3 w-3',
    },
    md: {
      badge: 'h-6 px-2 text-xs gap-1.5',
      icon: 'h-3.5 w-3.5',
    },
    lg: {
      badge: 'h-7 px-2.5 text-sm gap-2',
      icon: 'h-4 w-4',
    },
  };

  const currentSize = sizeClasses[size];
  const colorClasses = getLevelColor(level);

  // Determine ARIA label
  const ariaLabel = `Privacy: ${getLevelLabel(level)}${
    allowedViewers.length > 0
      ? `. Visible to ${allowedViewers.map((v) => v.name).join(', ')}`
      : ''
  }`;

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Badge */}
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => interactive && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => interactive && setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        className={`inline-flex items-center rounded-full font-medium ${currentSize.badge} ${colorClasses} ${
          interactive ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
        }`}
        aria-label={ariaLabel}
        disabled={!interactive && !onClick}
      >
        <PrivacyIcon level={level} className={currentSize.icon} />
        {showLabel && <span>{getLevelLabel(level)}</span>}
      </button>

      {/* Tooltip */}
      {showTooltip && interactive && (
        <div
          className="absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-3 shadow-lg"
          role="tooltip"
        >
          {/* Arrow */}
          <div className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-gray-200 bg-white" />

          {/* Content */}
          <div className="relative">
            {/* Header */}
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${colorClasses}`}
              >
                <PrivacyIcon level={level} className="h-3.5 w-3.5" />
              </span>
              <span className="font-medium text-gray-900">
                {getLevelLabel(level)}
              </span>
            </div>

            {/* Description */}
            <p className="text-xs text-gray-500">{getLevelDescription(level)}</p>

            {/* Allowed Viewers (for Confidential) */}
            {level === 'Confidential' && allowedViewers.length > 0 && (
              <div className="mt-2 border-t border-gray-100 pt-2">
                <div className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-500">
                  <Users className="h-3 w-3" />
                  Allowed Viewers
                </div>
                <div className="flex flex-wrap gap-1">
                  {allowedViewers.slice(0, 5).map((viewer) => (
                    <span
                      key={viewer.id}
                      className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700"
                    >
                      {viewer.name}
                    </span>
                  ))}
                  {allowedViewers.length > 5 && (
                    <span className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                      +{allowedViewers.length - 5} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Info for restricted levels */}
            {(level === 'AttorneyOnly' || level === 'PartnerOnly') && (
              <div className="mt-2 flex items-start gap-1 text-xs text-gray-400">
                <Info className="mt-0.5 h-3 w-3 flex-shrink-0" />
                <span>
                  {level === 'AttorneyOnly'
                    ? 'Only Partners and Associates can view this'
                    : 'Only Partners can view this'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Inline privacy indicator for lists/tables
 */
export function PrivacyIndicator({
  level,
  className = '',
}: {
  level: PrivacyLevel;
  className?: string;
}) {
  const { getLevelColor } = usePrivacyLevels();

  // Don't show indicator for normal privacy
  if (level === 'Normal') {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center ${className}`}
      title={`${level} privacy`}
    >
      <PrivacyIcon level={level} className={`h-3.5 w-3.5 ${getLevelColor(level).split(' ')[1]}`} />
    </span>
  );
}

export default PrivacyBadge;
