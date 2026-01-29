/**
 * Batch Processing Utilities
 * OPS-XXX: Batch Processing Remediation
 *
 * Utility functions for batch processing operations.
 * Includes sanitization, PII redaction, and common helpers.
 */

// ============================================================================
// Prompt Sanitization
// ============================================================================

/**
 * Sanitize user-provided content before including in AI prompts.
 * Prevents prompt injection by escaping special sequences.
 *
 * @param input - Raw input string from user content
 * @returns Sanitized string safe for prompt inclusion
 */
export function sanitizeForPrompt(input: string | null | undefined): string {
  if (!input) return '';

  return (
    input
      // Remove potential prompt injection patterns
      .replace(/\n{3,}/g, '\n\n') // Collapse multiple newlines
      .replace(/---+/g, '-') // Collapse separator-like patterns
      .replace(/```/g, '') // Remove code block markers
      .replace(/\[SYSTEM\]/gi, '[system]') // Prevent fake system messages
      .replace(/\[USER\]/gi, '[user]')
      .replace(/\[ASSISTANT\]/gi, '[assistant]')
      .replace(/<\/?system>/gi, '') // Remove HTML-like system tags
      .replace(/<\/?user>/gi, '')
      .replace(/<\/?assistant>/gi, '')
      .trim()
      .substring(0, 10000) // Hard limit on input length
  );
}

// ============================================================================
// PII Redaction
// ============================================================================

/**
 * Redact potential PII from content for logging.
 * Used to safely log content without exposing sensitive data.
 *
 * @param input - Raw content that may contain PII
 * @returns Content with PII redacted
 */
export function redactPII(input: string): string {
  return (
    input
      // Email addresses
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
      // Phone numbers (Romanian and international formats)
      .replace(/\+?\d{10,}/g, '[PHONE]')
      .replace(/0\d{2}[\s.-]?\d{3}[\s.-]?\d{4}/g, '[PHONE]')
      // Romanian CNP (personal identification number - 13 digits)
      .replace(/\b\d{13}\b/g, '[CNP]')
      // Credit card numbers (basic pattern)
      .replace(/\b\d{4}[\s.-]?\d{4}[\s.-]?\d{4}[\s.-]?\d{4}\b/g, '[CARD]')
      // IBAN (Romanian and international)
      .replace(/\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g, '[IBAN]')
  );
}

// ============================================================================
// Content Truncation
// ============================================================================

/**
 * Truncate content to a maximum length with ellipsis.
 * Useful for logging and display purposes.
 *
 * @param input - Content to truncate
 * @param maxLength - Maximum length (default: 500)
 * @returns Truncated content with ellipsis if needed
 */
export function truncateContent(input: string | null | undefined, maxLength = 500): string {
  if (!input) return '';
  if (input.length <= maxLength) return input;
  return input.substring(0, maxLength - 3) + '...';
}

// ============================================================================
// JSON Extraction
// ============================================================================

/**
 * Extract JSON from AI response content.
 * Handles markdown code blocks and plain JSON.
 *
 * @param content - AI response content
 * @returns Extracted JSON string or null if not found
 */
export function extractJsonFromResponse(content: string): string | null {
  // Try to extract from markdown code block
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Try to find raw JSON object
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  return null;
}

/**
 * Parse JSON safely from AI response content.
 * Returns null if parsing fails instead of throwing.
 *
 * @param content - AI response content
 * @returns Parsed JSON object or null
 */
export function parseJsonFromResponse<T = Record<string, unknown>>(content: string): T | null {
  const jsonStr = extractJsonFromResponse(content);
  if (!jsonStr) return null;

  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    return null;
  }
}

// ============================================================================
// Batch ID Utilities
// ============================================================================

/**
 * Create a customId from entity type and ID.
 *
 * @param entityType - Type of entity (e.g., 'document', 'thread')
 * @param entityId - Entity ID
 * @returns Formatted customId string
 */
export function createCustomId(entityType: string, entityId: string): string {
  // Validate format requirements
  if (!entityType || !entityId) {
    throw new Error('entityType and entityId are required');
  }

  const customId = `${entityType}:${entityId}`;

  // Anthropic requires <= 64 chars
  if (customId.length > 64) {
    throw new Error(`customId exceeds 64 char limit: ${customId}`);
  }

  return customId;
}

/**
 * Parse a customId back into entity type and ID.
 *
 * @param customId - The customId to parse
 * @returns Tuple of [entityType, entityId]
 */
export function parseCustomId(customId: string): [string, string] {
  const colonIndex = customId.indexOf(':');
  if (colonIndex === -1) {
    throw new Error(`Invalid customId format (missing colon): ${customId}`);
  }

  const entityType = customId.substring(0, colonIndex);
  const entityId = customId.substring(colonIndex + 1);

  if (!entityType || !entityId) {
    throw new Error(`Invalid customId format (empty parts): ${customId}`);
  }

  return [entityType, entityId];
}

// ============================================================================
// Error Formatting
// ============================================================================

/**
 * Format error messages for batch job completion.
 * Truncates and adds indicator if more errors exist.
 *
 * @param errors - Array of error messages
 * @param maxErrors - Maximum errors to include (default: 10)
 * @returns Formatted error string
 */
export function formatBatchErrors(errors: string[], maxErrors = 10): string | undefined {
  if (errors.length === 0) return undefined;

  const truncated = errors.slice(0, maxErrors).join('; ');
  const remaining = errors.length - maxErrors;

  if (remaining > 0) {
    return `${truncated} [+${remaining} more errors]`;
  }

  return truncated;
}
