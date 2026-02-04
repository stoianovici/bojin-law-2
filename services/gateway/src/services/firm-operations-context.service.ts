/**
 * Firm Operations Context Service
 *
 * Provides context building for the Firm Operations agent.
 * Determines user role, builds tool context, and manages permissions.
 * Includes Redis caching for performance (5-minute TTL).
 */

import { prisma, redis } from '@legal-platform/database';
import { FirmOperationsToolContext } from './firm-operations.types';
import { randomUUID } from 'crypto';
import logger from '../utils/logger';

// ============================================================================
// Cache Configuration
// ============================================================================

const CACHE_PREFIX = 'firm-ops:context:';
const CACHE_TTL_SECONDS = 5 * 60; // 5 minutes

// ============================================================================
// Partner Role Detection
// ============================================================================

/**
 * Check if a user is a partner in their firm.
 * Partners see all firm data; others see only assigned data.
 */
export async function isUserPartner(userId: string, firmId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, firmId: true },
  });

  if (!user || user.firmId !== firmId) {
    return false;
  }

  // Partner roles that get full visibility (case-insensitive)
  const partnerRoles = ['partner', 'senior partner', 'managing partner', 'admin'];
  return partnerRoles.includes(user.role.toLowerCase());
}

/**
 * Get user's role string for display purposes.
 */
export async function getUserRole(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  return user?.role || 'User';
}

// ============================================================================
// Context Builder
// ============================================================================

/**
 * Build the tool context for a firm operations agent run.
 * This context is passed to all tool handlers for authorization.
 */
export async function buildFirmOperationsContext(
  userId: string,
  firmId: string
): Promise<FirmOperationsToolContext> {
  const [isPartner, userRole] = await Promise.all([
    isUserPartner(userId, firmId),
    getUserRole(userId),
  ]);

  const correlationId = randomUUID();

  logger.debug('Built firm operations context', {
    userId,
    firmId,
    isPartner,
    userRole,
    correlationId,
  });

  return {
    firmId,
    userId,
    userRole,
    isPartner,
    correlationId,
  };
}

// ============================================================================
// User Greeting
// ============================================================================

/**
 * Get a personalized greeting for the user based on time of day.
 */
export function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();

  if (hour < 12) {
    return 'Bună dimineața';
  } else if (hour < 18) {
    return 'Bună ziua';
  } else {
    return 'Bună seara';
  }
}

/**
 * Get user's first name for personalization.
 */
export async function getUserFirstName(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true },
  });

  return user?.firstName || 'User';
}

// ============================================================================
// Briefing Eligibility
// ============================================================================

/**
 * Check if user is eligible for firm briefing.
 * Currently restricted to partners for firm-wide strategic briefings.
 * Non-partners see role-filtered data in the tools but may not need
 * the full briefing experience.
 */
export async function isBriefingEligible(
  userId: string,
  firmId: string
): Promise<{ eligible: boolean; reason?: string }> {
  // Check if user is a partner
  const isPartner = await isUserPartner(userId, firmId);

  if (!isPartner) {
    return {
      eligible: false,
      reason: 'Briefingul firmei este disponibil doar pentru parteneri.',
    };
  }

  return { eligible: true };
}

/**
 * Check if a briefing already exists for today for this user.
 */
export async function hasExistingBriefing(
  userId: string
): Promise<{ exists: boolean; briefingId?: string }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existing = await prisma.firmBriefing.findFirst({
    where: {
      userId,
      briefingDate: today,
    },
    select: { id: true },
  });

  return {
    exists: !!existing,
    briefingId: existing?.id,
  };
}

/**
 * Get existing briefing for today if available.
 */
export async function getTodaysBriefing(userId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  logger.debug('[getTodaysBriefing] Looking for briefing', {
    userId,
    queryDate: today.toISOString(),
    localDate: today.toLocaleDateString(),
  });

  const result = await prisma.firmBriefing.findUnique({
    where: {
      userId_briefingDate: {
        userId,
        briefingDate: today,
      },
    },
  });

  logger.debug('[getTodaysBriefing] Result', {
    userId,
    found: !!result,
    briefingId: result?.id,
    briefingDate: result?.briefingDate?.toISOString(),
  });

  return result;
}

// ============================================================================
// Cache Invalidation (for external use)
// ============================================================================

/**
 * Invalidate cached context for a user.
 * Call this when user role changes or firm data is updated.
 * Note: Context caching was removed for simplicity, but this function is
 * kept for potential future use and existing callers.
 */
export async function invalidateContextCache(userId: string): Promise<void> {
  const key = `${CACHE_PREFIX}${userId}`;
  try {
    await redis.del(key);
    logger.debug('Invalidated firm operations context cache', { userId });
  } catch (error) {
    logger.warn('Failed to invalidate context cache', { userId, error });
  }
}

/**
 * Invalidate all cached contexts for a firm.
 * Call this when significant firm-wide data changes.
 */
export async function invalidateFirmContextCache(firmId: string): Promise<void> {
  try {
    // Get all user IDs for this firm
    const users = await prisma.user.findMany({
      where: { firmId },
      select: { id: true },
    });

    // Delete cache for each user
    const keys = users.map((u) => `${CACHE_PREFIX}${u.id}`);
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.info('Invalidated firm context cache', { firmId, userCount: keys.length });
    }
  } catch (error) {
    logger.warn('Failed to invalidate firm context cache', { firmId, error });
  }
}
