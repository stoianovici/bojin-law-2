'use client';

/**
 * Firm Briefing Hook V2
 *
 * Provides access to the firm briefing for partners.
 * V2: Editor-in-Chief model with editorial slots (lead/secondary/tertiary).
 */

import { useState, useCallback } from 'react';
import { useQuery } from './useGraphQL';
import { apolloClient } from '@/lib/apollo-client';
import { GET_FIRM_BRIEFING, GET_FIRM_BRIEFING_ELIGIBILITY } from '@/graphql/queries';
import {
  GENERATE_FIRM_BRIEFING,
  MARK_FIRM_BRIEFING_VIEWED,
  ASK_BRIEFING_FOLLOWUP,
} from '@/graphql/mutations';

// ============================================================================
// V2 Types (Editor-in-Chief Model)
// ============================================================================

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
}

export interface BriefingFollowUpResponse {
  answer: string;
  suggestedActions: Array<{ label: string; href: string }>;
}

export interface BriefingRateLimitInfo {
  limited: boolean;
  message?: string;
  retryAfterMinutes?: number;
}

export interface FirmBriefingWithRateLimit extends FirmBriefing {
  rateLimitInfo?: BriefingRateLimitInfo | null;
}

// ============================================================================
// Legacy Types (Deprecated - for backwards compatibility)
// ============================================================================

/** @deprecated Use StoryUrgency instead */
export type BriefingSeverity = 'CRITICAL' | 'WARNING' | 'INFO';
/** @deprecated Use StoryCategory instead */
export type BriefingCategory = 'CLIENT' | 'TEAM' | 'DEADLINE' | 'EMAIL' | 'CASE';
/** @deprecated Use StoryEntityType instead */
export type BriefingEntityType = 'CLIENT' | 'USER' | 'CASE' | 'EMAIL_THREAD';
/** @deprecated Use StoryDetailStatus instead */
export type BriefingDetailStatus = 'ON_TRACK' | 'AT_RISK' | 'OVERDUE';

/** @deprecated Use StoryDetail instead */
export interface FirmBriefingDetail {
  id: string;
  title: string;
  subtitle: string;
  dueDate?: string;
  dueDateLabel?: string;
  status?: BriefingDetailStatus;
  href?: string;
}

/** @deprecated Use StoryItem instead */
export interface FirmBriefingItem {
  id: string;
  severity: BriefingSeverity;
  category: BriefingCategory;
  icon: string;
  headline: string;
  summary: string;
  details: FirmBriefingDetail[];
  entityType?: BriefingEntityType;
  entityId?: string;
  canAskFollowUp: boolean;
}

// ============================================================================
// Hook
// ============================================================================

interface UseFirmBriefingOptions {
  skip?: boolean;
}

export function useFirmBriefing(options: UseFirmBriefingOptions = {}) {
  const [generating, setGenerating] = useState(false);
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState<BriefingRateLimitInfo | null>(null);

  // Fetch current briefing
  const {
    data: briefingData,
    loading: briefingLoading,
    error: briefingError,
    refetch: refetchBriefing,
  } = useQuery<{ firmBriefing: FirmBriefingWithRateLimit | null }>(GET_FIRM_BRIEFING, {
    skip: options.skip,
  });

  // Fetch eligibility
  const { data: eligibilityData, loading: eligibilityLoading } = useQuery<{
    firmBriefingEligibility: { eligible: boolean; reason?: string };
  }>(GET_FIRM_BRIEFING_ELIGIBILITY, { skip: options.skip });

  // Generate briefing
  const generateBriefing = useCallback(
    async (force = false) => {
      setGenerating(true);
      setRateLimitInfo(null); // Clear previous rate limit info
      try {
        const result = await apolloClient.mutate<{
          generateFirmBriefing: FirmBriefingWithRateLimit;
        }>({
          mutation: GENERATE_FIRM_BRIEFING,
          variables: { force },
        });

        const briefing = result.data?.generateFirmBriefing;

        // Check if rate limited
        if (briefing?.rateLimitInfo?.limited) {
          setRateLimitInfo(briefing.rateLimitInfo);
        }

        await refetchBriefing();
        return briefing;
      } finally {
        setGenerating(false);
      }
    },
    [refetchBriefing]
  );

  // Clear rate limit info (useful for dismissing the message)
  const clearRateLimitInfo = useCallback(() => {
    setRateLimitInfo(null);
  }, []);

  // Mark as viewed
  const markViewed = useCallback(async (briefingId: string) => {
    await apolloClient.mutate({
      mutation: MARK_FIRM_BRIEFING_VIEWED,
      variables: { briefingId },
    });
  }, []);

  // Ask follow-up question
  const askFollowUp = useCallback(
    async (
      briefingItemId: string,
      question: string,
      entityType: StoryEntityType,
      entityId: string
    ): Promise<BriefingFollowUpResponse> => {
      setFollowUpLoading(true);
      try {
        const result = await apolloClient.mutate<{ askBriefingFollowUp: BriefingFollowUpResponse }>(
          {
            mutation: ASK_BRIEFING_FOLLOWUP,
            variables: {
              input: { briefingItemId, question, entityType, entityId },
            },
          }
        );
        return result.data?.askBriefingFollowUp as BriefingFollowUpResponse;
      } finally {
        setFollowUpLoading(false);
      }
    },
    []
  );

  return {
    // Data
    briefing: briefingData?.firmBriefing ?? null,
    eligible: eligibilityData?.firmBriefingEligibility?.eligible ?? false,
    eligibilityReason: eligibilityData?.firmBriefingEligibility?.reason,

    // Rate limit info (set after generate attempt)
    rateLimitInfo,

    // Loading states
    loading: briefingLoading || eligibilityLoading,
    generating,
    followUpLoading,

    // Error
    error: briefingError,

    // Actions
    generateBriefing,
    markViewed,
    askFollowUp,
    clearRateLimitInfo,
    refetch: refetchBriefing,
  };
}
