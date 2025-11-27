/**
 * Simple in-memory rate limiter for PST uploads
 * Per story requirement: 1 upload per user per hour
 *
 * Note: In production with multiple instances, use Redis for distributed rate limiting
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (per-process)
const uploadLimits = new Map<string, RateLimitEntry>();

// Rate limit config: 1 upload per user per hour
const UPLOAD_LIMIT = 1;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Check if user is rate limited for PST uploads
 * @param userId - The user's unique identifier
 * @returns Object with allowed status and reset time if limited
 */
export function checkUploadRateLimit(userId: string): {
  allowed: boolean;
  remaining: number;
  resetAt: Date | null;
  retryAfterSeconds: number | null;
} {
  const now = Date.now();
  const entry = uploadLimits.get(userId);

  // Clean up expired entry
  if (entry && entry.resetAt <= now) {
    uploadLimits.delete(userId);
  }

  const currentEntry = uploadLimits.get(userId);

  if (!currentEntry) {
    return {
      allowed: true,
      remaining: UPLOAD_LIMIT,
      resetAt: null,
      retryAfterSeconds: null,
    };
  }

  const remaining = Math.max(0, UPLOAD_LIMIT - currentEntry.count);
  const retryAfterSeconds = Math.ceil((currentEntry.resetAt - now) / 1000);

  return {
    allowed: remaining > 0,
    remaining,
    resetAt: new Date(currentEntry.resetAt),
    retryAfterSeconds: remaining === 0 ? retryAfterSeconds : null,
  };
}

/**
 * Record an upload attempt for rate limiting
 * @param userId - The user's unique identifier
 */
export function recordUploadAttempt(userId: string): void {
  const now = Date.now();
  const entry = uploadLimits.get(userId);

  // Clean up expired entry
  if (entry && entry.resetAt <= now) {
    uploadLimits.delete(userId);
  }

  const currentEntry = uploadLimits.get(userId);

  if (currentEntry) {
    currentEntry.count++;
  } else {
    uploadLimits.set(userId, {
      count: 1,
      resetAt: now + WINDOW_MS,
    });
  }
}

/**
 * Clear rate limit for a user (for testing or admin override)
 * @param userId - The user's unique identifier
 */
export function clearRateLimit(userId: string): void {
  uploadLimits.delete(userId);
}

/**
 * Get rate limit status headers for response
 */
export function getRateLimitHeaders(userId: string): Record<string, string> {
  const status = checkUploadRateLimit(userId);
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': UPLOAD_LIMIT.toString(),
    'X-RateLimit-Remaining': status.remaining.toString(),
  };

  if (status.resetAt) {
    headers['X-RateLimit-Reset'] = Math.floor(status.resetAt.getTime() / 1000).toString();
  }

  if (status.retryAfterSeconds !== null) {
    headers['Retry-After'] = status.retryAfterSeconds.toString();
  }

  return headers;
}
