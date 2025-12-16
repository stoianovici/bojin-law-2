/**
 * Privacy Selector Component
 * Story 5.5: Multi-Channel Communication Hub (AC: 6)
 *
 * Dropdown for selecting communication privacy level with viewer selection
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  usePrivacyLevels,
  useTeamMembers,
  useUpdatePrivacy,
  type PrivacyLevel,
  type TeamMember,
} from '@/hooks/useCommunicationPrivacy';
import {
  Lock,
  Unlock,
  Users,
  Briefcase,
  Crown,
  ChevronDown,
  Check,
  AlertTriangle,
  Loader2,
  X,
  Info,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface PrivacySelectorProps {
  communicationId?: string;
  caseId: string;
  currentLevel: PrivacyLevel;
  currentViewers?: string[];
  userRole: string;
  onChange?: (level: PrivacyLevel, viewers?: string[]) => void;
  onSave?: () => void;
  compact?: boolean;
  disabled?: boolean;
  className?: string;
}

// ============================================================================
// Helper Components
// ============================================================================

const PrivacyIcon = ({ level, className = '' }: { level: PrivacyLevel; className?: string }) => {
  switch (level) {
    case 'Normal':
      return <Users className={className} />;
    case 'Confidential':
      return <Lock className={className} />;
    case 'AttorneyOnly':
      return <Briefcase className={className} />;
    case 'PartnerOnly':
      return <Crown className={className} />;
    default:
      return <Unlock className={className} />;
  }
};

// ============================================================================
// Component
// ============================================================================

export function PrivacySelector({
  communicationId,
  caseId,
  currentLevel,
  currentViewers = [],
  userRole,
  onChange,
  onSave,
  compact = false,
  disabled = false,
  className = '',
}: PrivacySelectorProps) {
  // State
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<PrivacyLevel>(currentLevel);
  const [selectedViewers, setSelectedViewers] = useState<string[]>(currentViewers);
  const [showWarning, setShowWarning] = useState(false);

  // Hooks
  const {
    getLevelLabel,
    getLevelDescription,
    getLevelColor,
    requiresViewerSelection,
    getAvailableLevels,
  } = usePrivacyLevels();
  const { teamMembers, getEligibleViewers } = useTeamMembers(caseId);
  const { updatePrivacy, loading, error } = useUpdatePrivacy();

  const availableLevels = getAvailableLevels(userRole);
  const needsViewers = requiresViewerSelection(selectedLevel);
  const eligibleViewers = getEligibleViewers(selectedLevel);

  // Reset state when props change
  useEffect(() => {
    setSelectedLevel(currentLevel);
    setSelectedViewers(currentViewers);
  }, [currentLevel, currentViewers]);

  // Handle level selection
  const handleLevelSelect = useCallback(
    (level: PrivacyLevel) => {
      // Show warning when restricting access
      if (currentLevel === 'Normal' && level !== 'Normal') {
        setShowWarning(true);
      }

      setSelectedLevel(level);

      // Clear viewers if not needed
      if (!requiresViewerSelection(level)) {
        setSelectedViewers([]);
      }

      // Notify parent if no viewer selection needed
      if (!requiresViewerSelection(level)) {
        onChange?.(level, []);
      }
    },
    [currentLevel, requiresViewerSelection, onChange]
  );

  // Handle viewer toggle
  const handleViewerToggle = useCallback((viewerId: string) => {
    setSelectedViewers((prev) =>
      prev.includes(viewerId) ? prev.filter((id) => id !== viewerId) : [...prev, viewerId]
    );
  }, []);

  // Handle save
  const handleSave = useCallback(async () => {
    if (communicationId) {
      try {
        await updatePrivacy({
          communicationId,
          privacyLevel: selectedLevel,
          allowedViewers: needsViewers ? selectedViewers : undefined,
        });
        onSave?.();
      } catch (err) {
        // Error handled by hook
      }
    } else {
      onChange?.(selectedLevel, needsViewers ? selectedViewers : undefined);
    }
    setIsOpen(false);
    setShowWarning(false);
  }, [
    communicationId,
    selectedLevel,
    selectedViewers,
    needsViewers,
    updatePrivacy,
    onChange,
    onSave,
  ]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    setSelectedLevel(currentLevel);
    setSelectedViewers(currentViewers);
    setIsOpen(false);
    setShowWarning(false);
  }, [currentLevel, currentViewers]);

  return (
    <div className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
          isOpen
            ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
            : 'border-gray-300 hover:border-gray-400'
        } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <PrivacyIcon level={currentLevel} className="h-4 w-4" />
        {!compact && <span className="text-gray-700">{getLevelLabel(currentLevel)}</span>}
        <ChevronDown
          className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={handleCancel} aria-hidden="true" />

          {/* Panel */}
          <div
            className="absolute left-0 top-full z-20 mt-1 w-80 rounded-lg border border-gray-200 bg-white shadow-lg"
            role="listbox"
          >
            {/* Warning */}
            {showWarning && (
              <div className="border-b border-yellow-200 bg-yellow-50 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-600" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">Restricting Access</p>
                    <p className="text-xs text-yellow-700">
                      This will limit who can view this communication.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Privacy Levels */}
            <div className="p-2">
              <div className="mb-1 px-2 text-xs font-medium uppercase text-gray-500">
                Privacy Level
              </div>
              {availableLevels.map((level) => (
                <button
                  key={level.level}
                  type="button"
                  onClick={() => handleLevelSelect(level.level)}
                  className={`flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                    selectedLevel === level.level ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'
                  }`}
                  role="option"
                  aria-selected={selectedLevel === level.level}
                >
                  <span className="mt-0.5 text-lg">{level.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{level.label}</span>
                      {selectedLevel === level.level && <Check className="h-4 w-4 text-blue-600" />}
                    </div>
                    <p className="text-xs text-gray-500">{level.description}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Viewer Selection (for Confidential) */}
            {needsViewers && (
              <div className="border-t border-gray-200 p-2">
                <div className="mb-2 flex items-center gap-2 px-2">
                  <Users className="h-4 w-4 text-gray-500" />
                  <span className="text-xs font-medium uppercase text-gray-500">
                    Allowed Viewers
                  </span>
                </div>

                {eligibleViewers.length === 0 ? (
                  <p className="px-2 text-sm text-gray-500">No eligible viewers</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto">
                    {eligibleViewers.map((member) => (
                      <label
                        key={member.id}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedViewers.includes(member.id)}
                          onChange={() => handleViewerToggle(member.id)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-sm font-medium text-gray-900">
                            {member.firstName} {member.lastName}
                          </div>
                          <div className="truncate text-xs text-gray-500">{member.role}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {selectedViewers.length === 0 && (
                  <p className="mt-2 flex items-center gap-1 px-2 text-xs text-yellow-600">
                    <Info className="h-3 w-3" />
                    Select at least one viewer
                  </p>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="border-t border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {error.message}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 border-t border-gray-200 p-2">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={loading || (needsViewers && selectedViewers.length === 0)}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading && <Loader2 className="h-3 w-3 animate-spin" />}
                Apply
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default PrivacySelector;
