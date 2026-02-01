/**
 * Prompt Sanitizer Utilities
 *
 * Provides protection against prompt injection attacks by:
 * 1. Wrapping user input in clearly marked tags
 * 2. Escaping potentially problematic characters
 * 3. Truncating excessively long inputs
 *
 * These utilities should be used for ALL user-provided content
 * that gets injected into AI prompts.
 */

// ============================================================================
// Configuration
// ============================================================================

/** Default maximum length for user input fields */
export const DEFAULT_MAX_LENGTH = 10000;

/** Maximum lengths by field type */
export const MAX_LENGTHS = {
  customInstructions: 5000,
  selectedText: 10000,
  cursorContext: 3000,
  caseContext: 15000,
  clientContext: 5000,
  existingContent: 8000,
  prompt: 10000,
} as const;

// ============================================================================
// Core Sanitization Functions
// ============================================================================

/**
 * Escape XML/HTML-like content that could confuse the AI or be interpreted as tags.
 *
 * This escapes:
 * - < and > (could be interpreted as HTML/XML tags)
 * - Sequences that look like prompt injection attempts
 *
 * @param text - The text to sanitize
 * @returns Sanitized text with special characters escaped
 */
export function sanitizeForPrompt(text: string): string {
  if (!text) return '';

  let sanitized = text;

  // Escape XML/HTML angle brackets to prevent tag injection
  // Use Unicode characters that look similar but won't be parsed as tags
  sanitized = sanitized.replace(/</g, '﹤').replace(/>/g, '﹥');

  // Remove or escape potential prompt injection patterns
  // These patterns could trick the AI into changing its behavior
  const injectionPatterns = [
    // System prompt overrides
    /\[SYSTEM\]/gi,
    /\[INST\]/gi,
    /<<SYS>>/gi,
    /<\|im_start\|>/gi,
    /<\|im_end\|>/gi,

    // Common injection attempts
    /ignore previous instructions/gi,
    /ignore all previous/gi,
    /disregard previous/gi,
    /forget your instructions/gi,
    /new instructions:/gi,
    /override:/gi,

    // Jailbreak patterns
    /DAN mode/gi,
    /jailbreak/gi,
    /do anything now/gi,
  ];

  for (const pattern of injectionPatterns) {
    sanitized = sanitized.replace(pattern, '[FILTERED]');
  }

  return sanitized;
}

/**
 * Wrap user input in clearly marked tags to help the AI distinguish
 * user content from system instructions.
 *
 * This provides a clear boundary that makes it harder for injected
 * content to be interpreted as instructions.
 *
 * @param text - The user input to wrap
 * @param options - Configuration options
 * @returns Wrapped and sanitized user input
 */
export function wrapUserInput(
  text: string,
  options: {
    /** Maximum length before truncation (default: DEFAULT_MAX_LENGTH) */
    maxLength?: number;
    /** Label for the input type (e.g., "instrucțiuni", "context") */
    label?: string;
    /** Whether to sanitize the content (default: true) */
    sanitize?: boolean;
    /** Custom tag name (default: "user_input") */
    tagName?: string;
  } = {}
): string {
  const {
    maxLength = DEFAULT_MAX_LENGTH,
    label,
    sanitize = true,
    tagName = 'user_input',
  } = options;

  if (!text) return '';

  // Sanitize if enabled
  let processedText = sanitize ? sanitizeForPrompt(text) : text;

  // Truncate if too long
  if (processedText.length > maxLength) {
    const truncated = processedText.substring(0, maxLength);
    const lastSpaceIndex = truncated.lastIndexOf(' ');
    // Try to truncate at a word boundary
    processedText =
      lastSpaceIndex > maxLength * 0.8 ? truncated.substring(0, lastSpaceIndex) : truncated;
    processedText += '\n[... conținut trunchiat ...]';
  }

  // Build the wrapped output with optional label
  const labelAttr = label ? ` label="${label}"` : '';
  return `<${tagName}${labelAttr}>\n${processedText}\n</${tagName}>`;
}

// ============================================================================
// Specialized Wrappers for Common Use Cases
// ============================================================================

/**
 * Wrap custom instructions from the user.
 */
export function wrapCustomInstructions(text: string): string {
  return wrapUserInput(text, {
    maxLength: MAX_LENGTHS.customInstructions,
    label: 'instrucțiuni utilizator',
    tagName: 'custom_instructions',
  });
}

/**
 * Wrap selected text from the document.
 */
export function wrapSelectedText(text: string): string {
  return wrapUserInput(text, {
    maxLength: MAX_LENGTHS.selectedText,
    label: 'text selectat',
    tagName: 'selected_text',
  });
}

/**
 * Wrap cursor context (surrounding text).
 */
export function wrapCursorContext(text: string): string {
  return wrapUserInput(text, {
    maxLength: MAX_LENGTHS.cursorContext,
    label: 'context cursor',
    tagName: 'cursor_context',
  });
}

/**
 * Wrap case context from the context file.
 * Note: Case context is system-generated but can contain user-provided data.
 */
export function wrapCaseContext(text: string): string {
  return wrapUserInput(text, {
    maxLength: MAX_LENGTHS.caseContext,
    label: 'context dosar',
    tagName: 'case_context',
    // Less aggressive sanitization since this is system-generated
    sanitize: false,
  });
}

/**
 * Wrap existing document content.
 */
export function wrapExistingContent(text: string): string {
  return wrapUserInput(text, {
    maxLength: MAX_LENGTHS.existingContent,
    label: 'conținut existent',
    tagName: 'existing_content',
  });
}

/**
 * Wrap the user's main prompt/instructions.
 */
export function wrapPrompt(text: string): string {
  return wrapUserInput(text, {
    maxLength: MAX_LENGTHS.prompt,
    label: 'cerere utilizator',
    tagName: 'user_prompt',
  });
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Check if text contains potential prompt injection patterns.
 * Returns true if suspicious patterns are found.
 *
 * This is for logging/alerting purposes, not for blocking.
 *
 * @param text - Text to check
 * @returns True if suspicious patterns found
 */
export function containsInjectionPatterns(text: string): boolean {
  if (!text) return false;

  const suspiciousPatterns = [
    /ignore\s+(previous|all|your)\s+(instructions?|prompts?)/i,
    /system\s*prompt/i,
    /\[SYSTEM\]/i,
    /\[INST\]/i,
    /<<SYS>>/i,
    /<\|im_start\|>/i,
    /jailbreak/i,
    /DAN\s*mode/i,
    /override\s*(instructions?|prompts?)/i,
    /new\s*instructions?:/i,
  ];

  return suspiciousPatterns.some((pattern) => pattern.test(text));
}

/**
 * Calculate approximate token count for text.
 * Uses a simple heuristic: ~4 characters per token for Romanian/mixed content.
 *
 * @param text - Text to estimate tokens for
 * @returns Approximate token count
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Romanian text tends to have slightly longer words
  // Using 4 characters per token as a conservative estimate
  return Math.ceil(text.length / 4);
}

// ============================================================================
// Prompt Builder Helper
// ============================================================================

/**
 * Build a prompt section with properly wrapped user inputs.
 * Handles multiple inputs and combines them safely.
 *
 * @param sections - Array of { label, content } to include
 * @returns Combined prompt section string
 */
export function buildPromptSections(
  sections: Array<{ label: string; content: string | undefined | null; maxLength?: number }>
): string {
  return sections
    .filter((s) => s.content && s.content.trim())
    .map((s) =>
      wrapUserInput(s.content!, {
        maxLength: s.maxLength,
        label: s.label,
      })
    )
    .join('\n\n');
}
