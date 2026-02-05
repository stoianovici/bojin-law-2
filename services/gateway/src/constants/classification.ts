/**
 * Email Classification Constants
 *
 * Centralized confidence scores and thresholds for email classification.
 * Used across email-classifier.ts, ai-email-classifier.service.ts,
 * and ai-email-case-router.service.ts.
 */

/**
 * Classification confidence scores
 * Higher = more certain about the classification
 */
export const CLASSIFICATION_CONFIDENCE = {
  // Absolute certainty (deterministic matches)
  REFERENCE_MATCH: 1.0,
  THREAD_CONTINUITY: 1.0,
  COURT_SOURCE: 1.0,
  FILTER_LIST: 1.0,

  // High certainty (strong signals)
  ACTOR_EMAIL_EXACT: 0.95,
  SUBJECT_PATTERN: 0.95,
  CLIENT_CONTACT: 0.9,
  CONTACT_SINGLE_CASE: 0.9,

  // Medium certainty (weaker signals)
  ACTOR_DOMAIN: 0.85,
  KEYWORD_UNIQUE: 0.85,
  COMPANY_DOMAIN: 0.8,

  // AI thresholds
  AI_HIGH: 0.8, // >= 0.8 → Classified
  AI_MEDIUM: 0.5, // >= 0.5 → ClientInbox

  // Low certainty
  CONTACT_MULTI_CASE: 0.5,
  FALLBACK: 0.5,

  // No match
  NONE: 0.0,
} as const;

/**
 * AI Router thresholds for multi-case linking
 */
export const AI_ROUTER_THRESHOLDS = {
  PRIMARY: 0.7, // >= 0.7 → isPrimary: true
  LINK: 0.5, // 0.5-0.69 → isPrimary: false
  // < 0.5 → don't link
} as const;

/**
 * AI Model configurations
 */
export const AI_MODELS = {
  HAIKU: 'claude-3-5-haiku-20241022',
} as const;

/**
 * Batch sizes for AI operations
 */
export const BATCH_SIZES = {
  EMAIL_ROUTING: 15, // Emails per AI call for routing
  CASE_CONTEXT: 20, // Max cases to include in AI context
  PRE_FILTER: 30, // Max cases for smart pre-filtering
} as const;
