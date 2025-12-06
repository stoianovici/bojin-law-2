/**
 * User Adoption Leaderboard Component
 * Story 5.7: Platform Intelligence Dashboard - Task 16
 *
 * Displays user AI adoption rankings with scores, feature usage,
 * and training recommendations.
 * AC: 5 - AI utilization by user and feature
 */

'use client';

import React, { useMemo, useState } from 'react';
import type { AIUtilizationByUser } from '@legal-platform/types';

// ============================================================================
// Types
// ============================================================================

interface UserAdoptionLeaderboardProps {
  users: AIUtilizationByUser[];
  loading?: boolean;
  /** Callback when clicking on a user for details */
  onUserClick?: (userId: string) => void;
  /** Maximum users to display (default: 10) */
  maxUsers?: number;
  /** Show underutilized users section */
  showUnderutilized?: boolean;
}

type SortField = 'adoptionScore' | 'totalRequests' | 'featuresUsed' | 'userName';
type SortDirection = 'asc' | 'desc';

// ============================================================================
// Constants
// ============================================================================

const ADOPTION_THRESHOLDS = {
  excellent: 80, // >= 80%
  good: 60, // >= 60%
  moderate: 40, // >= 40%
  low: 20, // >= 20%
  // < 20% = very low
};

// ============================================================================
// Helper Functions
// ============================================================================

function getAdoptionLevel(
  score: number
): { label: string; color: string; bg: string; icon: string } {
  if (score >= ADOPTION_THRESHOLDS.excellent) {
    return {
      label: 'Excelent',
      color: 'text-emerald-700',
      bg: 'bg-emerald-100',
      icon: '🏆',
    };
  }
  if (score >= ADOPTION_THRESHOLDS.good) {
    return {
      label: 'Bun',
      color: 'text-blue-700',
      bg: 'bg-blue-100',
      icon: '⭐',
    };
  }
  if (score >= ADOPTION_THRESHOLDS.moderate) {
    return {
      label: 'Moderat',
      color: 'text-amber-700',
      bg: 'bg-amber-100',
      icon: '📈',
    };
  }
  if (score >= ADOPTION_THRESHOLDS.low) {
    return {
      label: 'Scăzut',
      color: 'text-orange-700',
      bg: 'bg-orange-100',
      icon: '📊',
    };
  }
  return {
    label: 'Foarte scăzut',
    color: 'text-red-700',
    bg: 'bg-red-100',
    icon: '⚠️',
  };
}

function getRankBadge(rank: number): { bg: string; text: string } {
  switch (rank) {
    case 1:
      return { bg: 'bg-yellow-400', text: 'text-yellow-900' }; // Gold
    case 2:
      return { bg: 'bg-gray-300', text: 'text-gray-700' }; // Silver
    case 3:
      return { bg: 'bg-amber-600', text: 'text-amber-100' }; // Bronze
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-600' };
  }
}

function formatNumber(num: number): string {
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

// ============================================================================
// Sub-Components
// ============================================================================

function LoadingSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
      <div className="h-5 bg-gray-200 rounded w-48 mb-6" />
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded" />
        ))}
      </div>
    </div>
  );
}

interface SortHeaderProps {
  field: SortField;
  label: string;
  currentSort: SortField;
  direction: SortDirection;
  onSort: (field: SortField) => void;
}

function SortHeader({
  field,
  label,
  currentSort,
  direction,
  onSort,
}: SortHeaderProps) {
  const isActive = currentSort === field;
  return (
    <button
      onClick={() => onSort(field)}
      className={`flex items-center gap-1 text-xs font-medium uppercase tracking-wider ${
        isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {label}
      {isActive && (
        <span className="text-blue-600">
          {direction === 'asc' ? '↑' : '↓'}
        </span>
      )}
    </button>
  );
}

interface UserRowProps {
  user: AIUtilizationByUser;
  rank: number;
  featuresUsedCount: number;
  totalFeatures: number;
  onClick?: () => void;
}

function UserRow({
  user,
  rank,
  featuresUsedCount,
  totalFeatures,
  onClick,
}: UserRowProps) {
  const adoptionLevel = getAdoptionLevel(user.adoptionScore);
  const rankBadge = getRankBadge(rank);
  const isTopThree = rank <= 3;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 p-3 rounded-lg transition-colors text-left ${
        onClick ? 'hover:bg-gray-50 cursor-pointer' : ''
      } ${isTopThree ? 'bg-gray-50' : ''}`}
    >
      {/* Rank */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${rankBadge.bg} ${rankBadge.text}`}
      >
        {rank}
      </div>

      {/* User Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 truncate">
            {user.userName}
          </span>
          {isTopThree && <span>{adoptionLevel.icon}</span>}
        </div>
        <div className="text-xs text-gray-500">
          {formatNumber(user.totalRequests)} cereri •{' '}
          {featuresUsedCount}/{totalFeatures} funcții
        </div>
      </div>

      {/* Adoption Score */}
      <div className="text-right">
        <div className="text-lg font-bold text-gray-900">
          {user.adoptionScore}%
        </div>
        <span
          className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${adoptionLevel.bg} ${adoptionLevel.color}`}
        >
          {adoptionLevel.label}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-24 hidden md:block">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${user.adoptionScore}%`,
              backgroundColor:
                user.adoptionScore >= ADOPTION_THRESHOLDS.excellent
                  ? '#10B981'
                  : user.adoptionScore >= ADOPTION_THRESHOLDS.good
                  ? '#3B82F6'
                  : user.adoptionScore >= ADOPTION_THRESHOLDS.moderate
                  ? '#F59E0B'
                  : '#EF4444',
            }}
          />
        </div>
      </div>

      {/* Arrow */}
      {onClick && (
        <svg
          className="w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      )}
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function UserAdoptionLeaderboard({
  users,
  loading = false,
  onUserClick,
  maxUsers = 10,
  showUnderutilized = true,
}: UserAdoptionLeaderboardProps) {
  const [sortField, setSortField] = useState<SortField>('adoptionScore');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Calculate features used count for each user
  const usersWithFeatureCount = useMemo(() => {
    return users.map((user) => ({
      ...user,
      featuresUsedCount: user.byFeature?.filter((f) => f.requestCount > 0).length || 0,
    }));
  }, [users]);

  // Sort users
  const sortedUsers = useMemo(() => {
    return [...usersWithFeatureCount].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'adoptionScore':
          comparison = a.adoptionScore - b.adoptionScore;
          break;
        case 'totalRequests':
          comparison = a.totalRequests - b.totalRequests;
          break;
        case 'featuresUsed':
          comparison = a.featuresUsedCount - b.featuresUsedCount;
          break;
        case 'userName':
          comparison = a.userName.localeCompare(b.userName);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [usersWithFeatureCount, sortField, sortDirection]);

  // Separate top performers and underutilized
  const topPerformers = sortedUsers.slice(0, maxUsers);
  const underutilizedUsers = useMemo(() => {
    return usersWithFeatureCount
      .filter((u) => u.adoptionScore < ADOPTION_THRESHOLDS.moderate)
      .sort((a, b) => a.adoptionScore - b.adoptionScore);
  }, [usersWithFeatureCount]);

  // Total features available
  const totalFeatures = useMemo(() => {
    const maxFeatures = Math.max(
      ...usersWithFeatureCount.map((u) => u.byFeature?.length || 0),
      9 // Default to 9 AI features
    );
    return maxFeatures;
  }, [usersWithFeatureCount]);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (users.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500">
        Nu există date de utilizatori disponibile
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Clasament adopție AI
        </h3>
        <div className="text-sm text-gray-500">
          {users.length} utilizatori
        </div>
      </div>

      {/* Sort Controls */}
      <div className="flex gap-4 mb-4 pb-4 border-b border-gray-200">
        <span className="text-xs text-gray-400">Sortare:</span>
        <SortHeader
          field="adoptionScore"
          label="Scor"
          currentSort={sortField}
          direction={sortDirection}
          onSort={handleSort}
        />
        <SortHeader
          field="totalRequests"
          label="Cereri"
          currentSort={sortField}
          direction={sortDirection}
          onSort={handleSort}
        />
        <SortHeader
          field="featuresUsed"
          label="Funcții"
          currentSort={sortField}
          direction={sortDirection}
          onSort={handleSort}
        />
        <SortHeader
          field="userName"
          label="Nume"
          currentSort={sortField}
          direction={sortDirection}
          onSort={handleSort}
        />
      </div>

      {/* Leaderboard */}
      <div className="space-y-2">
        {topPerformers.map((user, index) => (
          <UserRow
            key={user.userId}
            user={user}
            rank={index + 1}
            featuresUsedCount={user.featuresUsedCount}
            totalFeatures={totalFeatures}
            onClick={onUserClick ? () => onUserClick(user.userId) : undefined}
          />
        ))}
      </div>

      {/* Underutilized Section */}
      {showUnderutilized && underutilizedUsers.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-medium text-amber-700">
              ⚠️ Necesită training ({underutilizedUsers.length})
            </span>
          </div>
          <div className="space-y-2">
            {underutilizedUsers.slice(0, 3).map((user) => (
              <button
                key={user.userId}
                onClick={() => onUserClick?.(user.userId)}
                className="w-full flex items-center justify-between p-2 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {user.userName}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatNumber(user.totalRequests)} cereri
                  </span>
                </div>
                <span className="text-sm font-bold text-amber-700">
                  {user.adoptionScore}%
                </span>
              </button>
            ))}
            {underutilizedUsers.length > 3 && (
              <div className="text-xs text-gray-500 text-center">
                +{underutilizedUsers.length - 3} alți utilizatori
              </div>
            )}
          </div>
        </div>
      )}

      {/* Accessibility: Data Table */}
      <div className="sr-only">
        <table>
          <caption>Clasament adopție AI utilizatori</caption>
          <thead>
            <tr>
              <th>Rang</th>
              <th>Nume</th>
              <th>Scor adopție</th>
              <th>Total cereri</th>
              <th>Funcții folosite</th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.map((user, index) => (
              <tr key={user.userId}>
                <td>{index + 1}</td>
                <td>{user.userName}</td>
                <td>{user.adoptionScore}%</td>
                <td>{user.totalRequests}</td>
                <td>{user.featuresUsedCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default UserAdoptionLeaderboard;
