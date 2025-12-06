'use client';

/**
 * Assignment Suggestion Panel Component
 * Story 4.5: Team Workload Management
 *
 * AC: 3 - AI suggests optimal task assignments based on skills and capacity
 */

import { useState } from 'react';
import {
  Users,
  Star,
  Clock,
  Briefcase,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type {
  AssignmentSuggestionResponse,
  AssignmentSuggestion,
} from '@legal-platform/types';

interface AssignmentSuggestionPanelProps {
  suggestions: AssignmentSuggestionResponse | null;
  onAssign: (userId: string) => void;
  isLoading?: boolean;
  selectedUserId?: string;
}

function ScoreBar({ score, label }: { score: number; label: string }) {
  const getColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-blue-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-16">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${getColor(score)} transition-all`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs font-medium w-8 text-right">{score}%</span>
    </div>
  );
}

function SuggestionCard({
  suggestion,
  isRecommended,
  isSelected,
  onAssign,
}: {
  suggestion: AssignmentSuggestion;
  isRecommended: boolean;
  isSelected: boolean;
  onAssign: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50'
          : isRecommended
            ? 'border-green-300 bg-green-50'
            : 'border-gray-200'
      }`}
    >
      <div className="p-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium">
              {suggestion.user.firstName[0]}
              {suggestion.user.lastName[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">
                  {suggestion.user.firstName} {suggestion.user.lastName}
                </span>
                {isRecommended && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                    <Star className="h-3 w-3" />
                    Recommended
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500">{suggestion.user.role}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-gray-900">{suggestion.matchScore}%</div>
            <div className="text-xs text-gray-500">match</div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <Briefcase className="h-4 w-4" />
            <span>{suggestion.currentWorkload.toFixed(1)}h current</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <Clock className="h-4 w-4" />
            <span>{suggestion.availableCapacity.toFixed(1)}h available</span>
          </div>
        </div>

        {/* Expandable Details */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 w-full flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-gray-700"
        >
          {expanded ? 'Hide details' : 'Show details'}
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {expanded && (
          <div className="mt-3 pt-3 border-t space-y-2">
            <ScoreBar score={suggestion.skillMatch} label="Skill" />
            <ScoreBar score={suggestion.capacityMatch} label="Capacity" />

            <div className="mt-2 p-2 bg-gray-100 rounded text-xs text-gray-600">
              <span className="font-medium">Reasoning:</span> {suggestion.reasoning}
            </div>

            {suggestion.caveats && suggestion.caveats.length > 0 && (
              <div className="mt-2 space-y-1">
                {suggestion.caveats.map((caveat: string, index: number) => (
                  <div
                    key={index}
                    className="flex items-start gap-1.5 text-xs text-amber-700"
                  >
                    <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>{caveat}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Assign Button */}
      <button
        onClick={onAssign}
        disabled={isSelected}
        className={`w-full py-2 text-sm font-medium transition-colors ${
          isSelected
            ? 'bg-blue-600 text-white cursor-default'
            : 'bg-gray-100 text-gray-700 hover:bg-blue-600 hover:text-white'
        }`}
      >
        {isSelected ? (
          <span className="flex items-center justify-center gap-1">
            <CheckCircle className="h-4 w-4" />
            Selected
          </span>
        ) : (
          'Assign'
        )}
      </button>
    </div>
  );
}

export function AssignmentSuggestionPanel({
  suggestions,
  onAssign,
  isLoading = false,
  selectedUserId,
}: AssignmentSuggestionPanelProps) {
  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
        <p className="text-sm text-gray-500">Finding best assignees...</p>
      </div>
    );
  }

  if (!suggestions) {
    return (
      <div className="p-6 text-center text-gray-500">
        <Users className="h-8 w-8 mx-auto mb-2 text-gray-400" />
        <p className="text-sm">Enter task details to see assignment suggestions</p>
      </div>
    );
  }

  if (suggestions.noSuitableCandidates) {
    return (
      <div className="p-6 text-center">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
        <p className="text-sm font-medium text-gray-900">No Suitable Candidates</p>
        <p className="text-xs text-gray-500 mt-1">
          No team members match the required skills or have available capacity
        </p>
      </div>
    );
  }

  if (suggestions.allOverloaded) {
    return (
      <div className="p-6 text-center">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-red-500" />
        <p className="text-sm font-medium text-gray-900">Team Overloaded</p>
        <p className="text-xs text-gray-500 mt-1">
          All team members are currently at or over capacity
        </p>
        {suggestions.suggestions.length > 0 && (
          <div className="mt-4 space-y-3">
            {suggestions.suggestions.map((suggestion: AssignmentSuggestion) => (
              <SuggestionCard
                key={suggestion.userId}
                suggestion={suggestion}
                isRecommended={suggestion.userId === suggestions.recommendedAssignee}
                isSelected={suggestion.userId === selectedUserId}
                onAssign={() => onAssign(suggestion.userId)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Users className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">
          Suggested Assignees ({suggestions.suggestions.length})
        </span>
      </div>

      <div className="space-y-3">
        {suggestions.suggestions.map((suggestion: AssignmentSuggestion) => (
          <SuggestionCard
            key={suggestion.userId}
            suggestion={suggestion}
            isRecommended={suggestion.userId === suggestions.recommendedAssignee}
            isSelected={suggestion.userId === selectedUserId}
            onAssign={() => onAssign(suggestion.userId)}
          />
        ))}
      </div>
    </div>
  );
}
