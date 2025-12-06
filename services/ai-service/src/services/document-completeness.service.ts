/**
 * Document Completeness Service
 * Story 5.4: Proactive AI Suggestions System
 *
 * Checks documents for completeness based on document type,
 * identifying missing required and recommended elements.
 */

import { prisma } from '@legal-platform/database';
import Redis from 'ioredis';
import { ClaudeModel } from '@legal-platform/types';
import logger from '../lib/logger';
import { config } from '../config';
import { providerManager, ProviderRequest } from './provider-manager.service';

// Cache TTL: 1 hour
const COMPLETENESS_CACHE_TTL = 3600;

// Maximum content length for AI analysis
const MAX_CONTENT_LENGTH = 15000;

// Redis client for caching
let redisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(config.redis.url);
  }
  return redisClient;
}

// Types for completeness checking
export interface MissingItem {
  item: string;
  severity: 'required' | 'recommended' | 'optional';
  section?: string;
  suggestion: string;
}

export interface CompletenessCheckResult {
  documentId: string;
  documentType: string;
  completenessScore: number; // 0.0 - 1.0
  missingItems: MissingItem[];
  suggestions: string[];
}

// Document completeness rules for Romanian legal documents
export const DOCUMENT_COMPLETENESS_RULES: Record<string, {
  required: string[];
  recommended: string[];
  signatureBlocks: number;
}> = {
  Contract: {
    required: ['parties', 'object', 'price', 'signatures', 'date'],
    recommended: ['witnesses', 'notarization'],
    signatureBlocks: 2,
  },
  Motion: {
    required: ['caption', 'court', 'caseNumber', 'prayer', 'signature', 'certificateOfService'],
    recommended: ['exhibits', 'memorandum'],
    signatureBlocks: 1,
  },
  Pleading: {
    required: ['caption', 'allegations', 'relief', 'signature'],
    recommended: ['exhibits'],
    signatureBlocks: 1,
  },
  Letter: {
    required: ['date', 'recipient', 'salutation', 'body', 'closing', 'signature'],
    recommended: ['reference'],
    signatureBlocks: 1,
  },
};

// Document type mapping from system types to completeness rule keys
const DOCUMENT_TYPE_MAPPING: Record<string, string> = {
  // Contract types
  Contract: 'Contract',
  contract: 'Contract',
  VanzareCumparare: 'Contract',
  'contract-vanzare-cumparare': 'Contract',
  ServiceAgreement: 'Contract',
  Lease: 'Contract',
  NDA: 'Contract',
  pdf: 'Contract', // Default for PDFs
  docx: 'Contract', // Default for Word docs

  // Motion types
  Motion: 'Motion',
  motion: 'Motion',
  CourtMotion: 'Motion',

  // Pleading types
  Pleading: 'Pleading',
  pleading: 'Pleading',
  Complaint: 'Pleading',
  Answer: 'Pleading',
  Intampinare: 'Pleading',

  // Letter types
  Letter: 'Letter',
  letter: 'Letter',
  ClientLetter: 'Letter',
  OpposingCounselLetter: 'Letter',

  // Default
  Other: 'Contract', // Use Contract as fallback (most comprehensive)
};

export class DocumentCompletenessService {
  /**
   * Check document completeness by analyzing the provided content
   */
  async checkDocumentCompleteness(
    documentId: string,
    firmId: string,
    documentContent: string,
    documentType: string,
    documentTitle?: string,
    forceRefresh: boolean = false
  ): Promise<CompletenessCheckResult> {
    const cacheKey = `doc_completeness:${documentId}`;

    // Try cache first unless force refresh
    if (!forceRefresh) {
      const cached = await this.getFromCache(cacheKey);
      if (cached) {
        logger.debug('Document completeness cache hit', { documentId });
        return cached;
      }
    }

    logger.info('Checking document completeness', { documentId, firmId, documentType });
    const startTime = Date.now();

    if (!documentContent || documentContent.length < 50) {
      logger.warn('Document has insufficient content for completeness check', {
        documentId,
        contentLength: documentContent?.length || 0,
      });

      return {
        documentId,
        documentType: documentType || 'Unknown',
        completenessScore: 0,
        missingItems: [{
          item: 'Document content',
          severity: 'required',
          suggestion: 'The document appears to be empty or has very little content. Please add content to the document.',
        }],
        suggestions: ['Add content to the document before checking completeness'],
      };
    }

    // Normalize document type for rules lookup
    const normalizedType = this.normalizeDocumentType(documentType);
    const rules = DOCUMENT_COMPLETENESS_RULES[normalizedType] || DOCUMENT_COMPLETENESS_RULES['Contract'];

    // Perform AI-based completeness check
    const result = await this.performAICompletenessCheck(
      documentId,
      normalizedType,
      documentContent,
      rules,
      documentTitle || 'Untitled'
    );

    // Store check in database
    await this.storeCompletenessCheck(documentId, firmId, result);

    // Cache the result
    await this.setCache(cacheKey, result);

    const duration = Date.now() - startTime;
    logger.info('Document completeness check completed', {
      documentId,
      documentType: normalizedType,
      completenessScore: result.completenessScore,
      missingItemCount: result.missingItems.length,
      durationMs: duration,
    });

    return result;
  }

  /**
   * Perform AI-based completeness analysis
   */
  private async performAICompletenessCheck(
    documentId: string,
    documentType: string,
    content: string,
    rules: { required: string[]; recommended: string[]; signatureBlocks: number },
    documentTitle: string
  ): Promise<CompletenessCheckResult> {
    // Truncate content if needed
    let truncatedContent = content;
    if (content.length > MAX_CONTENT_LENGTH) {
      const halfLength = Math.floor(MAX_CONTENT_LENGTH / 2);
      truncatedContent =
        content.substring(0, halfLength) +
        '\n\n[...content truncated for analysis...]\n\n' +
        content.substring(content.length - halfLength);
    }

    const prompt = this.buildCompletenessPrompt(
      documentType,
      truncatedContent,
      rules,
      documentTitle
    );

    try {
      const request: ProviderRequest = {
        systemPrompt: 'You are a legal document completeness analyzer for a Romanian law firm. Analyze documents for missing or incomplete elements. Always respond with valid JSON.',
        prompt,
        model: ClaudeModel.Haiku, // Use Haiku for fast analysis
        maxTokens: 1500,
        temperature: 0.1, // Low temperature for consistent analysis
      };

      const response = await providerManager.execute(request);
      return this.parseCompletenessResponse(documentId, documentType, response.content, rules);
    } catch (error) {
      logger.error('AI completeness check failed, falling back to rule-based', {
        documentId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Fall back to rule-based check
      return this.performRuleBasedCheck(documentId, documentType, content, rules);
    }
  }

  /**
   * Build the AI prompt for completeness analysis
   */
  private buildCompletenessPrompt(
    documentType: string,
    content: string,
    rules: { required: string[]; recommended: string[]; signatureBlocks: number },
    documentTitle: string
  ): string {
    return `
Analyze the following ${documentType} document for completeness.

DOCUMENT TITLE: ${documentTitle}

REQUIRED ELEMENTS for ${documentType}:
${rules.required.map(r => `- ${r}`).join('\n')}

RECOMMENDED ELEMENTS:
${rules.recommended.map(r => `- ${r}`).join('\n')}

SIGNATURE BLOCKS EXPECTED: ${rules.signatureBlocks}

DOCUMENT CONTENT:
${content}

Analyze the document and identify:
1. Which required elements are missing or incomplete
2. Which recommended elements are missing
3. Whether the expected number of signature blocks are present
4. Overall completeness score (0.0 to 1.0)

Return your analysis as JSON:
{
  "completenessScore": number (0.0-1.0),
  "missingItems": [
    {
      "item": "string - name of missing item",
      "severity": "required" | "recommended" | "optional",
      "section": "string - where it should appear (optional)",
      "suggestion": "string - how to fix"
    }
  ],
  "suggestions": ["string - general improvement suggestions"],
  "foundElements": ["string - list of elements that were found"]
}

Consider Romanian legal document conventions. Be thorough but practical.
Respond ONLY with the JSON, no additional text.
`.trim();
  }

  /**
   * Parse AI response into completeness result
   */
  private parseCompletenessResponse(
    documentId: string,
    documentType: string,
    response: string,
    _rules: { required: string[]; recommended: string[]; signatureBlocks: number }
  ): CompletenessCheckResult {
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = response.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      }

      const parsed = JSON.parse(jsonStr);

      // Validate and normalize the response
      const completenessScore = Math.max(0, Math.min(1, Number(parsed.completenessScore) || 0));

      const missingItems: MissingItem[] = Array.isArray(parsed.missingItems)
        ? parsed.missingItems.map((item: Record<string, unknown>) => ({
            item: String(item.item || ''),
            severity: (['required', 'recommended', 'optional'].includes(String(item.severity))
              ? item.severity
              : 'recommended') as 'required' | 'recommended' | 'optional',
            section: item.section ? String(item.section) : undefined,
            suggestion: String(item.suggestion || ''),
          }))
        : [];

      const suggestions = Array.isArray(parsed.suggestions)
        ? parsed.suggestions.map((s: unknown) => String(s))
        : [];

      return {
        documentId,
        documentType,
        completenessScore,
        missingItems,
        suggestions,
      };
    } catch (error) {
      logger.error('Failed to parse AI completeness response', {
        documentId,
        error: error instanceof Error ? error.message : String(error),
        response: response.substring(0, 500),
      });

      // Return a default result indicating parse failure
      return {
        documentId,
        documentType,
        completenessScore: 0.5, // Unknown, assume partial
        missingItems: [{
          item: 'Analysis incomplete',
          severity: 'recommended',
          suggestion: 'Could not fully analyze document. Please review manually.',
        }],
        suggestions: ['Manual review recommended'],
      };
    }
  }

  /**
   * Rule-based fallback for completeness check
   */
  private performRuleBasedCheck(
    documentId: string,
    documentType: string,
    content: string,
    rules: { required: string[]; recommended: string[]; signatureBlocks: number }
  ): CompletenessCheckResult {
    const contentLower = content.toLowerCase();
    const missingItems: MissingItem[] = [];
    let foundCount = 0;
    const totalRequired = rules.required.length;

    // Check required elements
    for (const required of rules.required) {
      const patterns = this.getElementPatterns(required);
      const found = patterns.some(pattern => contentLower.includes(pattern.toLowerCase()));

      if (found) {
        foundCount++;
      } else {
        missingItems.push({
          item: required,
          severity: 'required',
          suggestion: this.getElementSuggestion(required),
        });
      }
    }

    // Check recommended elements
    for (const recommended of rules.recommended) {
      const patterns = this.getElementPatterns(recommended);
      const found = patterns.some(pattern => contentLower.includes(pattern.toLowerCase()));

      if (!found) {
        missingItems.push({
          item: recommended,
          severity: 'recommended',
          suggestion: this.getElementSuggestion(recommended),
        });
      }
    }

    // Check signature blocks
    const signaturePatterns = ['semnătură', 'signature', '___________', 'signed:', 'semnat:'];
    const signatureCount = signaturePatterns.reduce((count, pattern) => {
      return count + (contentLower.split(pattern.toLowerCase()).length - 1);
    }, 0);

    if (signatureCount < rules.signatureBlocks) {
      missingItems.push({
        item: `Signature blocks (expected ${rules.signatureBlocks}, found ${signatureCount})`,
        severity: 'required',
        suggestion: `Add ${rules.signatureBlocks - signatureCount} more signature block(s)`,
      });
    }

    // Calculate completeness score
    const completenessScore = totalRequired > 0 ? foundCount / totalRequired : 0;

    const suggestions: string[] = [];
    if (missingItems.filter(m => m.severity === 'required').length > 0) {
      suggestions.push('Review and add all required elements before finalizing');
    }
    if (missingItems.filter(m => m.severity === 'recommended').length > 0) {
      suggestions.push('Consider adding recommended elements for a more complete document');
    }

    return {
      documentId,
      documentType,
      completenessScore,
      missingItems,
      suggestions,
    };
  }

  /**
   * Get search patterns for document elements
   */
  private getElementPatterns(element: string): string[] {
    const patterns: Record<string, string[]> = {
      parties: ['părți', 'parties', 'între', 'between', 'vânzător', 'seller', 'cumpărător', 'buyer'],
      object: ['obiect', 'object', 'obiectul contractului', 'subject matter'],
      price: ['preț', 'price', 'valoare', 'value', 'contravaloare', 'consideration', 'lei', 'ron', 'eur'],
      signatures: ['semnătură', 'signature', 'signed', 'semnat'],
      date: ['data', 'date', 'încheiat la', 'executed on'],
      witnesses: ['martor', 'witness', 'în prezența'],
      notarization: ['notar', 'notary', 'autentificat', 'authenticated'],
      caption: ['caption', 'antet', 'court', 'instanța', 'tribunal'],
      court: ['court', 'instanță', 'judecătorie', 'tribunal'],
      caseNumber: ['dosar', 'case number', 'nr.', 'file no'],
      prayer: ['prayer', 'request', 'solicit', 'cerere', 'relief'],
      signature: ['semnătură', 'signature', 'signed', 'semnat'],
      certificateOfService: ['certificate of service', 'certificat', 'comunicare'],
      exhibits: ['anexă', 'exhibit', 'attachment', 'anexe'],
      memorandum: ['memorandum', 'memoriu', 'brief'],
      allegations: ['alegații', 'allegations', 'în fapt', 'facts'],
      relief: ['relief', 'cerere', 'solicit'],
      recipient: ['destinatar', 'recipient', 'către', 'to:'],
      salutation: ['stimate', 'dear', 'domnule', 'doamnă'],
      body: ['body'], // Generic - hard to detect
      closing: ['cu stimă', 'sincerely', 'respectuos', 'regards'],
      reference: ['referință', 'reference', 're:', 'ref:'],
    };

    return patterns[element] || [element];
  }

  /**
   * Get suggestion for missing element
   */
  private getElementSuggestion(element: string): string {
    const suggestions: Record<string, string> = {
      parties: 'Add clear identification of all parties to the agreement',
      object: 'Specify the subject matter or object of the agreement',
      price: 'Include the price, payment terms, and currency',
      signatures: 'Add signature lines for all parties',
      date: 'Include the execution date of the document',
      witnesses: 'Consider adding witness signatures for additional validity',
      notarization: 'Consider notarizing the document for legal weight',
      caption: 'Add the proper court caption with case information',
      court: 'Specify the court name and jurisdiction',
      caseNumber: 'Include the case or file number',
      prayer: 'Add a clear prayer for relief or request section',
      certificateOfService: 'Include a certificate of service',
      exhibits: 'Attach any referenced exhibits or annexes',
      memorandum: 'Consider adding a supporting memorandum',
      allegations: 'Add clear factual allegations',
      relief: 'Specify the relief being requested',
      recipient: 'Add recipient name and address',
      salutation: 'Include a proper salutation',
      closing: 'Add a professional closing',
      reference: 'Include a reference line for easy identification',
    };

    return suggestions[element] || `Add the missing ${element} section`;
  }

  /**
   * Normalize document type to match completeness rules
   */
  private normalizeDocumentType(type: string | null): string {
    if (type && DOCUMENT_TYPE_MAPPING[type]) {
      return DOCUMENT_TYPE_MAPPING[type];
    }
    return 'Contract'; // Default fallback
  }

  /**
   * Store completeness check result in database
   */
  private async storeCompletenessCheck(
    documentId: string,
    firmId: string,
    result: CompletenessCheckResult
  ): Promise<void> {
    try {
      await prisma.documentCompletenessCheck.create({
        data: {
          firmId,
          documentId,
          documentType: result.documentType,
          completeness: result.completenessScore,
          missingItems: JSON.parse(JSON.stringify(result.missingItems)),
          checkType: 'comprehensive', // Full check
        },
      });
    } catch (error) {
      logger.error('Failed to store completeness check', {
        documentId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - this is not critical for the main flow
    }
  }

  /**
   * Get recent completeness checks for a document
   */
  async getRecentChecks(
    documentId: string,
    limit: number = 5
  ): Promise<CompletenessCheckResult[]> {
    const checks = await prisma.documentCompletenessCheck.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return checks.map(check => ({
      documentId: check.documentId,
      documentType: check.documentType,
      completenessScore: check.completeness,
      missingItems: (check.missingItems as unknown) as MissingItem[],
      suggestions: [], // Schema doesn't store suggestions, generate default
    }));
  }

  /**
   * Get documents with low completeness scores
   */
  async getIncompleteDocuments(
    firmId: string,
    threshold: number = 0.7,
    limit: number = 20
  ): Promise<Array<{
    documentId: string;
    documentType: string;
    completenessScore: number;
    checkedAt: Date;
  }>> {
    const checks = await prisma.documentCompletenessCheck.findMany({
      where: {
        firmId,
        completeness: { lt: threshold },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        documentId: true,
        documentType: true,
        completeness: true,
        createdAt: true,
      },
    });

    return checks.map(check => ({
      documentId: check.documentId,
      documentType: check.documentType,
      completenessScore: check.completeness,
      checkedAt: check.createdAt,
    }));
  }

  /**
   * Batch check multiple documents
   */
  async batchCheckCompleteness(
    documents: Array<{
      documentId: string;
      firmId: string;
      content: string;
      type: string;
      title?: string;
    }>
  ): Promise<CompletenessCheckResult[]> {
    const results: CompletenessCheckResult[] = [];

    // Process in batches of 5 to avoid overwhelming the AI service
    const batchSize = 5;
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(doc =>
          this.checkDocumentCompleteness(
            doc.documentId,
            doc.firmId,
            doc.content,
            doc.type,
            doc.title
          ).catch(error => {
            logger.error('Batch completeness check failed for document', {
              documentId: doc.documentId,
              error: error instanceof Error ? error.message : String(error),
            });
            return null;
          })
        )
      );

      results.push(...batchResults.filter((r): r is CompletenessCheckResult => r !== null));
    }

    return results;
  }

  /**
   * Mark a completeness issue as resolved
   */
  async markResolved(
    checkId: string,
    resolvedBy: string
  ): Promise<void> {
    await prisma.documentCompletenessCheck.update({
      where: { id: checkId },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        resolvedBy,
      },
    });

    logger.info('Completeness check marked as resolved', { checkId, resolvedBy });
  }

  /**
   * Get unresolved completeness issues for a firm
   */
  async getUnresolvedIssues(
    firmId: string,
    limit: number = 50
  ): Promise<Array<{
    id: string;
    documentId: string;
    documentType: string;
    completenessScore: number;
    missingItems: MissingItem[];
    createdAt: Date;
  }>> {
    const checks = await prisma.documentCompletenessCheck.findMany({
      where: {
        firmId,
        isResolved: false,
        completeness: { lt: 0.9 }, // Only show if significantly incomplete
      },
      orderBy: [
        { completeness: 'asc' }, // Most incomplete first
        { createdAt: 'desc' },
      ],
      take: limit,
    });

    return checks.map(check => ({
      id: check.id,
      documentId: check.documentId,
      documentType: check.documentType,
      completenessScore: check.completeness,
      missingItems: (check.missingItems as unknown) as MissingItem[],
      createdAt: check.createdAt,
    }));
  }

  /**
   * Get from cache
   */
  private async getFromCache(key: string): Promise<CompletenessCheckResult | null> {
    try {
      const redis = getRedisClient();
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached) as CompletenessCheckResult;
      }
      return null;
    } catch (error) {
      logger.warn('Cache read failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Set cache
   */
  private async setCache(key: string, result: CompletenessCheckResult): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.setex(key, COMPLETENESS_CACHE_TTL, JSON.stringify(result));
    } catch (error) {
      logger.warn('Cache write failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Invalidate cache for a document
   */
  async invalidateCache(documentId: string): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.del(`doc_completeness:${documentId}`);
      logger.debug('Completeness cache invalidated', { documentId });
    } catch (error) {
      logger.warn('Cache invalidation failed', {
        documentId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// Singleton instance
export const documentCompletenessService = new DocumentCompletenessService();
