'use client';

/**
 * Firm Briefing Hook for Mobile
 *
 * Provides access to the firm briefing with editorial slots (lead/secondary/tertiary).
 * Adapted from web hook to use Apollo's useQuery directly (mobile pattern).
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { GET_FIRM_BRIEFING } from '@/graphql/queries';
import { GENERATE_FIRM_BRIEFING, MARK_FIRM_BRIEFING_VIEWED } from '@/graphql/mutations';

// ============================================
// Types
// ============================================

export type EditionMood = 'URGENT' | 'FOCUSED' | 'CELEBRATORY' | 'STEADY' | 'CAUTIOUS';
export type StoryUrgency = 'HIGH' | 'MEDIUM' | 'LOW';
export type StoryCategory = 'CLIENT' | 'TEAM' | 'DEADLINE' | 'EMAIL' | 'CASE';
export type StoryEntityType = 'CLIENT' | 'USER' | 'CASE' | 'EMAIL_THREAD';
export type StoryDetailStatus = 'ON_TRACK' | 'AT_RISK' | 'OVERDUE';

export interface StoryDetail {
  id: string;
  title: string;
  subtitle: string;
  dueDate?: string;
  dueDateLabel?: string;
  status?: StoryDetailStatus;
  href?: string;
}

export interface StoryItem {
  id: string;
  headline: string;
  summary: string;
  details: StoryDetail[];
  category: StoryCategory;
  urgency?: StoryUrgency;
  href?: string;
  entityType?: StoryEntityType;
  entityId?: string;
  canAskFollowUp: boolean;
}

export interface BriefingSection {
  title: string;
  items: StoryItem[];
}

export interface BriefingEdition {
  date: string;
  mood: EditionMood;
  editorNote?: string;
}

export interface FirmBriefingQuickStats {
  activeCases: number;
  urgentTasks: number;
  teamUtilization: number;
  unreadEmails: number;
  overdueItems: number;
  upcomingDeadlines: number;
}

export interface BriefingRateLimitInfo {
  limited: boolean;
  message?: string;
  retryAfterMinutes?: number;
}

export interface FirmBriefing {
  id: string;
  schemaVersion: number;
  edition: BriefingEdition;
  lead: StoryItem[];
  secondary: BriefingSection;
  tertiary: BriefingSection;
  quickStats: FirmBriefingQuickStats;
  totalTokens: number;
  totalCostEur: number | null;
  isStale: boolean;
  isViewed: boolean;
  generatedAt: string;
  rateLimitInfo?: BriefingRateLimitInfo | null;
}

interface FirmBriefingData {
  firmBriefing: FirmBriefing | null;
}

interface GenerateFirmBriefingData {
  generateFirmBriefing: FirmBriefing;
}

// ============================================
// Hook
// ============================================

export function useFirmBriefing() {
  const [rateLimitInfo, setRateLimitInfo] = useState<BriefingRateLimitInfo | null>(null);

  // Fetch current briefing
  const { data, loading, error, refetch } = useQuery<FirmBriefingData>(GET_FIRM_BRIEFING, {
    fetchPolicy: 'cache-and-network',
  });

  // Generate briefing mutation
  const [generateMutation, { loading: generating }] =
    useMutation<GenerateFirmBriefingData>(GENERATE_FIRM_BRIEFING);

  // Mark viewed mutation
  const [markViewedMutation] = useMutation(MARK_FIRM_BRIEFING_VIEWED);

  // Generate briefing action
  const generateBriefing = useCallback(
    async (force = false) => {
      setRateLimitInfo(null);
      try {
        const result = await generateMutation({
          variables: { force },
        });

        const briefing = result.data?.generateFirmBriefing;

        // Check if rate limited
        if (briefing?.rateLimitInfo?.limited) {
          setRateLimitInfo(briefing.rateLimitInfo);
        }

        await refetch();
        return briefing;
      } catch (err) {
        console.error('Failed to generate briefing:', err);
        throw err;
      }
    },
    [generateMutation, refetch]
  );

  // Mark as viewed
  const markViewed = useCallback(
    async (briefingId: string) => {
      try {
        await markViewedMutation({
          variables: { briefingId },
        });
      } catch (err) {
        console.error('Failed to mark briefing as viewed:', err);
      }
    },
    [markViewedMutation]
  );

  // Clear rate limit info (for dismissing the message)
  const clearRateLimitInfo = useCallback(() => {
    setRateLimitInfo(null);
  }, []);

  return {
    // Data
    briefing: data?.firmBriefing ?? null,

    // Rate limit info (set after generate attempt)
    rateLimitInfo,

    // Loading states
    loading,
    generating,

    // Error
    error,

    // Actions
    generateBriefing,
    markViewed,
    clearRateLimitInfo,
    refetch,
  };
}
