/**
 * Document Filter Configuration
 * OPS-113: Rule-Based Document Filtering
 *
 * Filters junk email attachments (calendar invites, tiny images, email signatures)
 * during import to reduce document clutter. Estimated 40-60% noise reduction.
 */

import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

/**
 * Filter actions determine what happens to matched attachments
 * - dismiss: Skip download entirely, create minimal tracking record
 * - quarantine: Store in R2 but don't link to case (future)
 * - flag: Import normally but mark for review (future)
 */
export type FilterAction = 'dismiss' | 'quarantine' | 'flag';

/**
 * Filter status stored in EmailAttachment records
 */
export type FilterStatus = 'imported' | 'dismissed' | 'quarantined' | 'flagged';

/**
 * Condition types for filter rules
 */
export type FilterConditionType =
  | 'extension' // Match file extension (.ics, .vcf)
  | 'contentType' // Match MIME type (text/calendar, image/*)
  | 'sizeRange' // Match file size range
  | 'namePattern' // Match filename regex pattern
  | 'inline'; // Match isInline flag from Graph API

/**
 * A single filter condition. Rules can have multiple conditions (AND logic)
 */
export interface FilterCondition {
  type: FilterConditionType;
  /** Value depends on type:
   * - extension: string[] of extensions without dots (e.g., ['ics', 'vcf'])
   * - contentType: string[] of MIME types (e.g., ['text/calendar', 'image/*'])
   * - sizeRange: { min?: number; max?: number } in bytes
   * - namePattern: string regex pattern (e.g., '^image\\d+\\.png$')
   * - inline: boolean (true = must be inline, false = must not be inline)
   */
  value: string[] | { min?: number; max?: number } | string | boolean;
}

/**
 * A filter rule with conditions and action
 */
export interface FilterRule {
  id: string;
  name: string;
  description: string;
  action: FilterAction;
  enabled: boolean;
  /** All conditions must match (AND logic) */
  conditions: FilterCondition[];
  /** Priority: lower runs first. Default rules use 100-900. */
  priority: number;
}

/**
 * Result of evaluating an attachment against filter rules
 */
export interface FilterResult {
  /** Whether any rule matched */
  matched: boolean;
  /** The action to take */
  action: FilterAction | 'import';
  /** Rule that matched (if any) */
  matchedRule?: FilterRule;
  /** Human-readable reason */
  reason: string;
}

/**
 * Attachment metadata for filter evaluation
 * Matches Graph API attachment properties
 */
export interface AttachmentMetadata {
  name: string;
  contentType: string;
  size: number;
  isInline?: boolean;
}

/**
 * Batch analysis result for validating rules against existing data
 */
export interface BatchAnalysisResult {
  total: number;
  wouldDismiss: number;
  wouldImport: number;
  byRule: Record<string, { count: number; examples: string[] }>;
}

// ============================================================================
// Default Filter Rules
// ============================================================================

export const DEFAULT_FILTER_RULES: FilterRule[] = [
  {
    id: 'calendar-invites',
    name: 'Calendar Invites',
    description: 'Calendar and contact files (.ics, .vcf, text/calendar)',
    action: 'dismiss',
    enabled: true,
    priority: 100,
    conditions: [
      {
        type: 'extension',
        value: ['ics', 'vcf', 'vcs'],
      },
    ],
  },
  {
    id: 'calendar-content-type',
    name: 'Calendar Content Type',
    description: 'Calendar content type regardless of extension',
    action: 'dismiss',
    enabled: true,
    priority: 101,
    conditions: [
      {
        type: 'contentType',
        value: ['text/calendar', 'text/x-vcalendar'],
      },
    ],
  },
  {
    id: 'tiny-images',
    name: 'Tiny Images (< 5KB)',
    description: 'Tracking pixels and spacer images under 5KB',
    action: 'dismiss',
    enabled: true,
    priority: 200,
    conditions: [
      {
        type: 'contentType',
        value: ['image/*'],
      },
      {
        type: 'sizeRange',
        value: { max: 5 * 1024 }, // 5KB
      },
    ],
  },
  {
    id: 'inline-small-images',
    name: 'Small Inline Images (< 20KB)',
    description: 'Email body decorations and inline images under 20KB',
    action: 'dismiss',
    enabled: true,
    priority: 300,
    conditions: [
      {
        type: 'contentType',
        value: ['image/*'],
      },
      {
        type: 'inline',
        value: true,
      },
      {
        type: 'sizeRange',
        value: { max: 20 * 1024 }, // 20KB
      },
    ],
  },
  {
    id: 'email-cruft-images',
    name: 'Email Cruft Images',
    description: 'Auto-generated image names like image001.png, img001.jpg',
    action: 'dismiss',
    enabled: true,
    priority: 400,
    conditions: [
      {
        type: 'contentType',
        value: ['image/*'],
      },
      {
        type: 'namePattern',
        // Matches: image001.png, image002.jpg, img1.gif, etc.
        value: '^(image|img)\\d+\\.(png|jpg|jpeg|gif|bmp)$',
      },
    ],
  },
  {
    id: 'signature-files',
    name: 'Signature/Logo Files',
    description: 'Common email signature images (signature.*, logo.*, banner.*)',
    action: 'dismiss',
    enabled: true,
    priority: 500,
    conditions: [
      {
        type: 'contentType',
        value: ['image/*'],
      },
      {
        type: 'namePattern',
        // Matches: signature.png, logo.jpg, banner.gif, signature_john.png, etc.
        value: '^(signature|logo|banner|signatură)[_\\-]?.*\\.(png|jpg|jpeg|gif|bmp)$',
      },
    ],
  },
  {
    id: 'animated-gifs',
    name: 'Small Animated GIFs (< 50KB)',
    description: 'Small GIF images, typically animated signatures or emojis',
    action: 'dismiss',
    enabled: true,
    priority: 600,
    conditions: [
      {
        type: 'extension',
        value: ['gif'],
      },
      {
        type: 'sizeRange',
        value: { max: 50 * 1024 }, // 50KB
      },
    ],
  },
  {
    id: 'winmail-dat',
    name: 'Outlook Wrapper Files',
    description: 'Outlook TNEF wrapper files (winmail.dat, ATT*.dat)',
    action: 'dismiss',
    enabled: true,
    priority: 700,
    conditions: [
      {
        type: 'namePattern',
        value: '^(winmail\\.dat|ATT\\d+\\.dat)$',
      },
    ],
  },
];

// ============================================================================
// Document Filter Service
// ============================================================================

export class DocumentFilterService {
  private rules: FilterRule[];

  constructor(rules?: FilterRule[]) {
    this.rules = rules || DEFAULT_FILTER_RULES;
    // Sort by priority
    this.rules.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Evaluate an attachment against all filter rules
   *
   * @param attachment - Attachment metadata from Graph API
   * @returns Filter result with action and reason
   */
  evaluate(attachment: AttachmentMetadata): FilterResult {
    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      if (this.matchesRule(attachment, rule)) {
        logger.debug('Attachment matched filter rule', {
          attachmentName: attachment.name,
          ruleId: rule.id,
          ruleName: rule.name,
          action: rule.action,
        });

        return {
          matched: true,
          action: rule.action,
          matchedRule: rule,
          reason: `${rule.name}: ${rule.description}`,
        };
      }
    }

    return {
      matched: false,
      action: 'import',
      reason: 'Nu a corespuns niciunei reguli de filtrare',
    };
  }

  /**
   * Check if attachment matches all conditions in a rule (AND logic)
   */
  private matchesRule(attachment: AttachmentMetadata, rule: FilterRule): boolean {
    return rule.conditions.every((condition) => this.matchesCondition(attachment, condition));
  }

  /**
   * Check if attachment matches a single condition
   */
  private matchesCondition(attachment: AttachmentMetadata, condition: FilterCondition): boolean {
    switch (condition.type) {
      case 'extension':
        return this.matchesExtension(attachment.name, condition.value as string[]);

      case 'contentType':
        return this.matchesContentType(attachment.contentType, condition.value as string[]);

      case 'sizeRange':
        return this.matchesSizeRange(
          attachment.size,
          condition.value as { min?: number; max?: number }
        );

      case 'namePattern':
        return this.matchesNamePattern(attachment.name, condition.value as string);

      case 'inline':
        return attachment.isInline === (condition.value as boolean);

      default:
        return false;
    }
  }

  /**
   * Check if filename has one of the specified extensions
   */
  private matchesExtension(filename: string, extensions: string[]): boolean {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ext ? extensions.includes(ext) : false;
  }

  /**
   * Check if content type matches any pattern (supports wildcards like image/*)
   */
  private matchesContentType(contentType: string, patterns: string[]): boolean {
    const normalizedType = contentType.toLowerCase();

    return patterns.some((pattern) => {
      if (pattern.endsWith('/*')) {
        // Wildcard pattern (e.g., "image/*")
        const prefix = pattern.slice(0, -1); // "image/"
        return normalizedType.startsWith(prefix);
      }
      return normalizedType === pattern.toLowerCase();
    });
  }

  /**
   * Check if size is within the specified range
   */
  private matchesSizeRange(size: number, range: { min?: number; max?: number }): boolean {
    if (range.min !== undefined && size < range.min) {
      return false;
    }
    if (range.max !== undefined && size > range.max) {
      return false;
    }
    return true;
  }

  /**
   * Check if filename matches regex pattern (case-insensitive)
   */
  private matchesNamePattern(filename: string, pattern: string): boolean {
    try {
      const regex = new RegExp(pattern, 'i');
      return regex.test(filename);
    } catch {
      logger.warn('Invalid regex pattern in filter rule', { pattern });
      return false;
    }
  }

  /**
   * Get all enabled rules
   */
  getEnabledRules(): FilterRule[] {
    return this.rules.filter((r) => r.enabled);
  }

  /**
   * Enable or disable a rule by ID
   */
  setRuleEnabled(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (rule) {
      rule.enabled = enabled;
      return true;
    }
    return false;
  }

  /**
   * Analyze existing attachments to validate filter rules
   * Useful for testing rules against production data before deployment
   *
   * @param prisma - Prisma client
   * @param limit - Maximum attachments to analyze
   * @returns Analysis results showing what would be filtered
   */
  async analyzeBatch(prisma: PrismaClient, limit: number = 1000): Promise<BatchAnalysisResult> {
    const attachments = await prisma.emailAttachment.findMany({
      take: limit,
      select: {
        id: true,
        name: true,
        contentType: true,
        size: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const result: BatchAnalysisResult = {
      total: attachments.length,
      wouldDismiss: 0,
      wouldImport: 0,
      byRule: {},
    };

    for (const attachment of attachments) {
      // Note: We don't have isInline data in DB, so set undefined
      const filterResult = this.evaluate({
        name: attachment.name,
        contentType: attachment.contentType,
        size: attachment.size,
        isInline: undefined,
      });

      if (filterResult.action === 'dismiss') {
        result.wouldDismiss++;

        const ruleId = filterResult.matchedRule?.id || 'unknown';
        if (!result.byRule[ruleId]) {
          result.byRule[ruleId] = {
            count: 0,
            examples: [],
          };
        }
        result.byRule[ruleId].count++;
        if (result.byRule[ruleId].examples.length < 5) {
          result.byRule[ruleId].examples.push(attachment.name);
        }
      } else {
        result.wouldImport++;
      }
    }

    logger.info('Batch analysis complete', {
      total: result.total,
      wouldDismiss: result.wouldDismiss,
      wouldImport: result.wouldImport,
      dismissPercentage: ((result.wouldDismiss / result.total) * 100).toFixed(1),
    });

    return result;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const documentFilterService = new DocumentFilterService();
