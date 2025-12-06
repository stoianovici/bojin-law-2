/**
 * Semantic Diff Service
 * Story 3.5: Semantic Version Control System
 *
 * Computes semantic differences between document versions,
 * focusing on meaningful content changes rather than formatting
 */

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import * as diff from 'diff';
import {
  ChangeType,
  ChangeSignificance,
  DocumentContext,
  DocumentSection,
  SemanticChange,
  SemanticDiffResult,
  ChangeBreakdown,
  ClaudeModel,
  AIOperationType,
} from '@legal-platform/types';
import { providerManager } from './provider-manager.service';
import { tokenTracker } from './token-tracker.service';
import { textExtractionService } from './text-extraction.service';
import { config } from '../config';
import logger from '../lib/logger';

// Initialize clients (will be injected in production)
let prisma: PrismaClient;
let redis: Redis | null = null;

export function initializeSemanticDiffPrisma(client: PrismaClient) {
  prisma = client;
}

export function initializeSemanticDiffRedis(client: Redis) {
  redis = client;
}

// Configuration
const REDIS_CACHE_TTL_SECONDS = 3600; // 1 hour for version content cache
const MAX_SECTIONS_TO_COMPARE = parseInt(process.env.AI_SEMANTIC_DIFF_MAX_SECTIONS || '100', 10);

// Legal terminology patterns for significance detection
const CRITICAL_PATTERNS = {
  ro: [
    /\b(răspundere|daune|penalități|reziliere|încetare)\b/i,
    /\b(garantie|compensație|despăgubire)\b/i,
    /\b(clauza de forță majoră|forță majoră)\b/i,
    /\b(limită de răspundere|excludere răspundere)\b/i,
  ],
  en: [
    /\b(liability|damages|penalties|termination|breach)\b/i,
    /\b(warranty|indemnification|compensation)\b/i,
    /\b(force majeure|act of god)\b/i,
    /\b(limitation of liability|exclusion)\b/i,
  ],
};

const SUBSTANTIVE_PATTERNS = {
  ro: [
    /\b(\d+[.,]?\d*\s*(lei|euro|ron|usd|eur))\b/i,
    /\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\b/,
    /\b(termen|perioadă|durată|scadență)\b/i,
    /\b(părți|contractant|beneficiar|prestator)\b/i,
  ],
  en: [
    /\b(\$?\d+[.,]?\d*\s*(dollars?|euros?|usd|eur|gbp))\b/i,
    /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/,
    /\b(term|period|duration|deadline|expir)\b/i,
    /\b(party|parties|contractor|client|vendor)\b/i,
  ],
};

export class SemanticDiffService {
  /**
   * Fetch version content from OneDrive or cache
   */
  async fetchVersionContent(versionId: string, documentId: string): Promise<string> {
    // Check Redis cache first
    const cacheKey = `version_content:${versionId}`;
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.info('Version content cache hit', { versionId });
        return cached;
      }
    }

    // Fetch version from database
    const version = await prisma.documentVersion.findUnique({
      where: { id: versionId },
      include: {
        document: true,
      },
    });

    if (!version) {
      throw new Error(`Document version not found: ${versionId}`);
    }

    // For now, we'll retrieve content from R2 storage
    // In production, this would use Microsoft Graph API to fetch version content
    // GET /drives/{driveId}/items/{itemId}/versions/{versionId}/content

    // Placeholder: In a real implementation, we would:
    // 1. Use version.oneDriveVersionId to fetch from OneDrive
    // 2. Parse the DOCX/PDF using text extraction service
    // For development, we'll return a placeholder or use stored content

    let content = '';

    // If we have OneDrive version ID, we would fetch from Graph API
    if (version.oneDriveVersionId) {
      // TODO: Implement Microsoft Graph API call to fetch version content
      // This would be: GET /drives/{driveId}/items/{itemId}/versions/{oneDriveVersionId}/content
      logger.warn('OneDrive version fetch not yet implemented', {
        versionId,
        oneDriveVersionId: version.oneDriveVersionId,
      });
    }

    // For now, use the document's current content from storage
    // In production, each version would have its own stored content
    if (version.document.storagePath) {
      // Placeholder: fetch from R2 and extract text
      content = `[Version ${version.versionNumber} content for document ${documentId}]`;
    }

    // Cache the extracted content
    if (redis && content) {
      await redis.setex(cacheKey, REDIS_CACHE_TTL_SECONDS, content);
    }

    return content;
  }

  /**
   * Normalize document content for semantic comparison
   * Removes formatting-only differences
   */
  normalizeDocument(content: string): string {
    return content
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      // Remove extra line breaks
      .replace(/\n\s*\n/g, '\n')
      // Normalize quotes
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      // Normalize dashes
      .replace(/[–—]/g, '-')
      // Remove page numbers and headers/footers patterns
      .replace(/\b(page|pagina)\s*\d+\s*(of|din)\s*\d+\b/gi, '')
      // Normalize legal citations (Romanian)
      .replace(/\bNr\.\s*/gi, 'Nr. ')
      .replace(/\bArt\.\s*/gi, 'Art. ')
      // Normalize dates
      .replace(/(\d{1,2})\.(\d{1,2})\.(\d{4})/g, '$1-$2-$3')
      // Trim
      .trim();
  }

  /**
   * Parse document into structured sections/paragraphs
   */
  parseIntoSections(content: string): DocumentSection[] {
    const sections: DocumentSection[] = [];
    let currentOffset = 0;

    // Split by paragraphs (double newline or numbered sections)
    const paragraphs = content.split(/\n\s*\n|\n(?=\d+[.)]\s)/);

    paragraphs.forEach((paragraph, index) => {
      const text = paragraph.trim();
      if (text.length > 0) {
        const normalizedText = this.normalizeDocument(text);
        const sectionId = `section-${index}`;

        // Try to extract section path from content (e.g., "Art. 5.2")
        const pathMatch = text.match(/^(Art\.|Articol|Section|§|Cap\.|Capitolul)\s*(\d+(?:\.\d+)*)/i);
        const path = pathMatch ? pathMatch[0] : `§${index + 1}`;

        sections.push({
          id: sectionId,
          path,
          text,
          normalizedText,
          startOffset: currentOffset,
          endOffset: currentOffset + text.length,
        });

        currentOffset += text.length + 2; // +2 for paragraph separator
      }
    });

    return sections.slice(0, MAX_SECTIONS_TO_COMPARE);
  }

  /**
   * Classify the significance of a change
   */
  classifyChangeSignificance(
    beforeText: string,
    afterText: string,
    language: 'ro' | 'en' = 'ro'
  ): ChangeSignificance {
    // Check for formatting-only changes
    const normalizedBefore = this.normalizeDocument(beforeText);
    const normalizedAfter = this.normalizeDocument(afterText);

    if (normalizedBefore === normalizedAfter) {
      return ChangeSignificance.FORMATTING;
    }

    // Check for critical patterns
    const criticalPatterns = CRITICAL_PATTERNS[language];
    for (const pattern of criticalPatterns) {
      const beforeMatch = pattern.test(beforeText);
      const afterMatch = pattern.test(afterText);
      if (beforeMatch !== afterMatch || (beforeMatch && afterMatch)) {
        // Critical term added, removed, or modified
        const beforeMatches = beforeText.match(pattern);
        const afterMatches = afterText.match(pattern);
        if (JSON.stringify(beforeMatches) !== JSON.stringify(afterMatches)) {
          return ChangeSignificance.CRITICAL;
        }
      }
    }

    // Check for substantive patterns
    const substantivePatterns = SUBSTANTIVE_PATTERNS[language];
    for (const pattern of substantivePatterns) {
      const beforeMatch = beforeText.match(pattern);
      const afterMatch = afterText.match(pattern);
      if (JSON.stringify(beforeMatch) !== JSON.stringify(afterMatch)) {
        return ChangeSignificance.SUBSTANTIVE;
      }
    }

    // Calculate text similarity for minor wording detection
    const similarity = this.calculateTextSimilarity(normalizedBefore, normalizedAfter);
    if (similarity > 0.8) {
      return ChangeSignificance.MINOR_WORDING;
    }

    return ChangeSignificance.SUBSTANTIVE;
  }

  /**
   * Calculate text similarity using Levenshtein distance
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const longer = text1.length > text2.length ? text1 : text2;
    const shorter = text1.length > text2.length ? text2 : text1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(s1: string, s2: string): number {
    const m = s1.length;
    const n = s2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
      }
    }

    return dp[m][n];
  }

  /**
   * Use Claude Haiku for quick semantic similarity scoring between sections
   */
  async computeSemanticSimilarity(
    section1: string,
    section2: string,
    context: DocumentContext
  ): Promise<{ similarity: number; changeType: ChangeType }> {
    const prompt = `Compare these two text sections and determine:
1. Semantic similarity (0.0 to 1.0)
2. Change type: "unchanged", "modified", "added", or "removed"

Section 1:
"""
${section1.substring(0, 500)}
"""

Section 2:
"""
${section2.substring(0, 500)}
"""

Respond in JSON format only:
{"similarity": 0.X, "changeType": "..."}`;

    try {
      const startTime = Date.now();
      const response = await providerManager.execute({
        prompt,
        model: ClaudeModel.Haiku,
        maxTokens: 100,
        temperature: 0,
      });

      // Track token usage
      await tokenTracker.recordUsage({
        firmId: context.firmId,
        operationType: AIOperationType.Classification,
        modelUsed: response.model,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        latencyMs: response.latencyMs,
      });

      // Parse response
      const result = JSON.parse(response.content);
      return {
        similarity: result.similarity || 0,
        changeType: this.mapChangeType(result.changeType),
      };
    } catch (error) {
      logger.error('Semantic similarity computation failed', { error });
      // Fallback to basic text comparison
      const similarity = this.calculateTextSimilarity(section1, section2);
      return {
        similarity,
        changeType: similarity > 0.9 ? ChangeType.MODIFIED : ChangeType.MODIFIED,
      };
    }
  }

  /**
   * Map string change type to enum
   */
  private mapChangeType(type: string): ChangeType {
    switch (type?.toLowerCase()) {
      case 'unchanged':
        return ChangeType.MODIFIED; // We only track actual changes
      case 'added':
        return ChangeType.ADDED;
      case 'removed':
        return ChangeType.REMOVED;
      case 'moved':
        return ChangeType.MOVED;
      default:
        return ChangeType.MODIFIED;
    }
  }

  /**
   * Compute semantic diff between two document versions
   */
  async computeSemanticDiff(
    oldContent: string,
    newContent: string,
    context: DocumentContext
  ): Promise<SemanticDiffResult> {
    const startTime = Date.now();
    const changes: SemanticChange[] = [];
    let changeId = 0;

    // Parse both versions into sections
    const oldSections = this.parseIntoSections(oldContent);
    const newSections = this.parseIntoSections(newContent);

    // Use diff library for initial comparison
    const textDiffs = diff.diffWords(
      this.normalizeDocument(oldContent),
      this.normalizeDocument(newContent)
    );

    // Process diff results
    for (const part of textDiffs) {
      if (part.added || part.removed) {
        const beforeText = part.removed ? part.value : '';
        const afterText = part.added ? part.value : '';

        if (beforeText.trim() || afterText.trim()) {
          const significance = this.classifyChangeSignificance(
            beforeText,
            afterText,
            context.language
          );

          // Only include non-formatting changes
          if (significance !== ChangeSignificance.FORMATTING) {
            changes.push({
              id: `change-${changeId++}`,
              changeType: part.added ? ChangeType.ADDED : ChangeType.REMOVED,
              significance,
              beforeText: beforeText.substring(0, 500),
              afterText: afterText.substring(0, 500),
              plainSummary: '', // Will be filled by change summary service
              aiConfidence: 0.85,
            });
          }
        }
      }
    }

    // For modified sections, compare section by section
    const minSections = Math.min(oldSections.length, newSections.length);
    for (let i = 0; i < minSections; i++) {
      const oldSection = oldSections[i];
      const newSection = newSections[i];

      if (oldSection.normalizedText !== newSection.normalizedText) {
        const significance = this.classifyChangeSignificance(
          oldSection.text,
          newSection.text,
          context.language
        );

        if (significance !== ChangeSignificance.FORMATTING) {
          // Check if we already have this change
          const isDuplicate = changes.some(c =>
            c.beforeText.includes(oldSection.text.substring(0, 100)) ||
            c.afterText.includes(newSection.text.substring(0, 100))
          );

          if (!isDuplicate) {
            changes.push({
              id: `change-${changeId++}`,
              changeType: ChangeType.MODIFIED,
              significance,
              beforeText: oldSection.text.substring(0, 500),
              afterText: newSection.text.substring(0, 500),
              sectionPath: oldSection.path,
              plainSummary: '',
              aiConfidence: 0.9,
            });
          }
        }
      }
    }

    // Calculate breakdown
    const breakdown: ChangeBreakdown = {
      formatting: 0,
      minorWording: changes.filter(c => c.significance === ChangeSignificance.MINOR_WORDING).length,
      substantive: changes.filter(c => c.significance === ChangeSignificance.SUBSTANTIVE).length,
      critical: changes.filter(c => c.significance === ChangeSignificance.CRITICAL).length,
    };

    const result: SemanticDiffResult = {
      documentId: context.documentId,
      fromVersionId: '', // Will be set by caller
      toVersionId: '', // Will be set by caller
      changes,
      totalChanges: changes.length,
      changeBreakdown: breakdown,
      computedAt: new Date(),
    };

    logger.info('Semantic diff computed', {
      documentId: context.documentId,
      totalChanges: changes.length,
      breakdown,
      durationMs: Date.now() - startTime,
    });

    return result;
  }

  /**
   * Compare two document versions end-to-end
   */
  async compareVersions(
    documentId: string,
    fromVersionId: string,
    toVersionId: string,
    context: DocumentContext
  ): Promise<SemanticDiffResult> {
    // Fetch content for both versions
    const [oldContent, newContent] = await Promise.all([
      this.fetchVersionContent(fromVersionId, documentId),
      this.fetchVersionContent(toVersionId, documentId),
    ]);

    // Compute semantic diff
    const diffResult = await this.computeSemanticDiff(oldContent, newContent, context);

    // Set version IDs
    diffResult.fromVersionId = fromVersionId;
    diffResult.toVersionId = toVersionId;

    return diffResult;
  }
}

// Singleton instance
export const semanticDiffService = new SemanticDiffService();
