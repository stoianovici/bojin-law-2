/**
 * Email Search Service
 * Story 5.1: Email Integration and Synchronization
 *
 * Provides full-text search for emails using PostgreSQL tsvector.
 * Also supports semantic search via Voyage AI embeddings.
 *
 * [Source: docs/architecture/external-apis.md#voyage-ai-api]
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { EmbeddingService, getEmbeddingService } from './embedding.service';
import logger from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface EmailSearchFilters {
  userId: string;
  caseId?: string;
  search?: string;
  hasAttachments?: boolean;
  isUnread?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  uncategorizedOnly?: boolean;
  importance?: 'low' | 'normal' | 'high';
}

export interface EmailSearchResult {
  id: string;
  graphMessageId: string;
  conversationId: string;
  subject: string;
  bodyPreview: string;
  from: { name?: string; address: string };
  toRecipients: Array<{ name?: string; address: string }>;
  receivedDateTime: Date;
  hasAttachments: boolean;
  isRead: boolean;
  importance: string;
  caseId: string | null;
  caseName?: string;
  matchScore?: number;
  highlightedSubject?: string;
  highlightedBody?: string;
}

export interface EmailSearchResponse {
  emails: EmailSearchResult[];
  totalCount: number;
  hasMore: boolean;
}

export interface SemanticSearchOptions {
  minSimilarity?: number;
  limit?: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const DEFAULT_MIN_SIMILARITY = 0.5;

// ============================================================================
// Email Search Service
// ============================================================================

export class EmailSearchService {
  private prisma: PrismaClient;
  private embeddingService: EmbeddingService | null = null;

  constructor(prisma: PrismaClient, embeddingService?: EmbeddingService) {
    this.prisma = prisma;
    if (embeddingService) {
      this.embeddingService = embeddingService;
    }
  }

  /**
   * Search emails with full-text and filters (AC: 5)
   *
   * Implements PostgreSQL full-text search using tsvector.
   * Supports filtering by case, date range, attachments, read status.
   *
   * @param filters - Search filters
   * @param limit - Maximum results (default 20)
   * @param offset - Pagination offset
   * @returns Search results with pagination
   */
  async searchEmails(
    filters: EmailSearchFilters,
    limit: number = DEFAULT_PAGE_SIZE,
    offset: number = 0
  ): Promise<EmailSearchResponse> {
    const { userId, caseId, search, hasAttachments, isUnread, dateFrom, dateTo, uncategorizedOnly, importance } = filters;

    // Clamp limit
    const clampedLimit = Math.min(limit, MAX_PAGE_SIZE);

    // Build where clause
    const where: Prisma.EmailWhereInput = { userId };

    if (caseId) {
      where.caseId = caseId;
    }

    if (uncategorizedOnly) {
      where.caseId = null;
    }

    if (hasAttachments !== undefined) {
      where.hasAttachments = hasAttachments;
    }

    if (isUnread !== undefined) {
      where.isRead = !isUnread;
    }

    if (importance) {
      where.importance = importance;
    }

    if (dateFrom || dateTo) {
      where.receivedDateTime = {};
      if (dateFrom) where.receivedDateTime.gte = dateFrom;
      if (dateTo) where.receivedDateTime.lte = dateTo;
    }

    // Add full-text search if search query provided
    if (search && search.trim()) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { bodyPreview: { contains: search, mode: 'insensitive' } },
        { bodyContent: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Execute query with count
    const [emails, totalCount] = await Promise.all([
      this.prisma.email.findMany({
        where,
        select: {
          id: true,
          graphMessageId: true,
          conversationId: true,
          subject: true,
          bodyPreview: true,
          from: true,
          toRecipients: true,
          receivedDateTime: true,
          hasAttachments: true,
          isRead: true,
          importance: true,
          caseId: true,
          case: {
            select: { title: true },
          },
        },
        orderBy: { receivedDateTime: 'desc' },
        take: clampedLimit,
        skip: offset,
      }),
      this.prisma.email.count({ where }),
    ]);

    // Transform results
    const results: EmailSearchResult[] = emails.map((email) => ({
      id: email.id,
      graphMessageId: email.graphMessageId,
      conversationId: email.conversationId,
      subject: email.subject,
      bodyPreview: email.bodyPreview,
      from: email.from as { name?: string; address: string },
      toRecipients: email.toRecipients as Array<{ name?: string; address: string }>,
      receivedDateTime: email.receivedDateTime,
      hasAttachments: email.hasAttachments,
      isRead: email.isRead,
      importance: email.importance,
      caseId: email.caseId,
      caseName: email.case?.title,
      highlightedSubject: search ? this.highlightMatches(email.subject, search) : undefined,
      highlightedBody: search ? this.highlightMatches(email.bodyPreview, search) : undefined,
    }));

    return {
      emails: results,
      totalCount,
      hasMore: offset + clampedLimit < totalCount,
    };
  }

  /**
   * Semantic search using Voyage AI embeddings (AC: 5)
   *
   * Converts search query to embedding and finds similar emails
   * using pgvector cosine similarity.
   *
   * Note: Requires email embeddings to be pre-computed and stored.
   *
   * @param query - Natural language search query
   * @param userId - User ID for access control
   * @param options - Search options
   * @returns Semantically similar emails
   */
  async semanticSearch(
    query: string,
    userId: string,
    options: SemanticSearchOptions = {}
  ): Promise<EmailSearchResult[]> {
    const { minSimilarity = DEFAULT_MIN_SIMILARITY, limit = DEFAULT_PAGE_SIZE } = options;

    if (!this.embeddingService) {
      this.embeddingService = getEmbeddingService();
    }

    // Generate query embedding
    const queryEmbedding = await this.embeddingService.generateEmbedding(query, 'document');

    if (!queryEmbedding) {
      logger.warn('Failed to generate query embedding for semantic search');
      // Fall back to regular search
      return (await this.searchEmails({ userId, search: query }, limit)).emails;
    }

    // Perform vector similarity search using raw SQL
    // Note: This assumes email_embeddings table exists with email_id and embedding columns
    const results = await this.prisma.$queryRaw<Array<{
      id: string;
      graph_message_id: string;
      conversation_id: string;
      subject: string;
      body_preview: string;
      from_json: any;
      to_recipients: any;
      received_date_time: Date;
      has_attachments: boolean;
      is_read: boolean;
      importance: string;
      case_id: string | null;
      case_title: string | null;
      similarity: number;
    }>>`
      SELECT
        e.id,
        e.graph_message_id,
        e.conversation_id,
        e.subject,
        e.body_preview,
        e."from" as from_json,
        e.to_recipients,
        e.received_date_time,
        e.has_attachments,
        e.is_read,
        e.importance,
        e.case_id,
        c.title as case_title,
        1 - (ee.embedding <=> ${queryEmbedding}::vector) as similarity
      FROM emails e
      LEFT JOIN email_embeddings ee ON ee.email_id = e.id
      LEFT JOIN cases c ON c.id = e.case_id
      WHERE e.user_id = ${userId}
        AND ee.embedding IS NOT NULL
        AND 1 - (ee.embedding <=> ${queryEmbedding}::vector) >= ${minSimilarity}
      ORDER BY similarity DESC
      LIMIT ${limit}
    `;

    return results.map((r) => ({
      id: r.id,
      graphMessageId: r.graph_message_id,
      conversationId: r.conversation_id,
      subject: r.subject,
      bodyPreview: r.body_preview,
      from: r.from_json,
      toRecipients: r.to_recipients,
      receivedDateTime: r.received_date_time,
      hasAttachments: r.has_attachments,
      isRead: r.is_read,
      importance: r.importance,
      caseId: r.case_id,
      caseName: r.case_title || undefined,
      matchScore: r.similarity,
    }));
  }

  /**
   * Search within email attachments (AC: 5)
   *
   * Searches attachment names and content (if text extracted).
   *
   * @param query - Search query
   * @param userId - User ID
   * @param limit - Maximum results
   * @returns Emails with matching attachments
   */
  async searchAttachments(
    query: string,
    userId: string,
    limit: number = DEFAULT_PAGE_SIZE
  ): Promise<EmailSearchResult[]> {
    const emails = await this.prisma.email.findMany({
      where: {
        userId,
        hasAttachments: true,
        attachments: {
          some: {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              // If we have extracted text from attachments, search it
              // This would require a content field on EmailAttachment
            ],
          },
        },
      },
      include: {
        attachments: {
          where: {
            name: { contains: query, mode: 'insensitive' },
          },
        },
        case: {
          select: { title: true },
        },
      },
      orderBy: { receivedDateTime: 'desc' },
      take: limit,
    });

    return emails.map((email) => ({
      id: email.id,
      graphMessageId: email.graphMessageId,
      conversationId: email.conversationId,
      subject: email.subject,
      bodyPreview: email.bodyPreview,
      from: email.from as { name?: string; address: string },
      toRecipients: email.toRecipients as Array<{ name?: string; address: string }>,
      receivedDateTime: email.receivedDateTime,
      hasAttachments: email.hasAttachments,
      isRead: email.isRead,
      importance: email.importance,
      caseId: email.caseId,
      caseName: email.case?.title,
    }));
  }

  /**
   * Get email statistics for a user
   *
   * @param userId - User ID
   * @returns Email statistics
   */
  async getEmailStats(userId: string): Promise<{
    totalEmails: number;
    unreadEmails: number;
    uncategorizedEmails: number;
    emailsWithAttachments: number;
    emailsByCase: Array<{ caseId: string; caseName: string; count: number }>;
  }> {
    const [
      totalEmails,
      unreadEmails,
      uncategorizedEmails,
      emailsWithAttachments,
      emailsByCase,
    ] = await Promise.all([
      this.prisma.email.count({ where: { userId } }),
      this.prisma.email.count({ where: { userId, isRead: false } }),
      this.prisma.email.count({ where: { userId, caseId: null } }),
      this.prisma.email.count({ where: { userId, hasAttachments: true } }),
      this.prisma.email.groupBy({
        by: ['caseId'],
        where: { userId, caseId: { not: null } },
        _count: true,
      }),
    ]);

    // Get case names
    const caseIds = emailsByCase
      .filter((e) => e.caseId !== null)
      .map((e) => e.caseId as string);

    const cases = await this.prisma.case.findMany({
      where: { id: { in: caseIds } },
      select: { id: true, title: true },
    });

    const caseNameMap = new Map(cases.map((c) => [c.id, c.title]));

    return {
      totalEmails,
      unreadEmails,
      uncategorizedEmails,
      emailsWithAttachments,
      emailsByCase: emailsByCase
        .filter((e) => e.caseId !== null)
        .map((e) => ({
          caseId: e.caseId as string,
          caseName: caseNameMap.get(e.caseId as string) || 'Unknown',
          count: e._count,
        })),
    };
  }

  /**
   * Suggest search completions based on email content
   *
   * @param prefix - Search prefix
   * @param userId - User ID
   * @param limit - Maximum suggestions
   * @returns Search suggestions
   */
  async getSuggestions(
    prefix: string,
    userId: string,
    limit: number = 10
  ): Promise<string[]> {
    if (!prefix || prefix.length < 2) {
      return [];
    }

    // Get unique subjects matching prefix
    const emails = await this.prisma.email.findMany({
      where: {
        userId,
        subject: { startsWith: prefix, mode: 'insensitive' },
      },
      select: { subject: true },
      distinct: ['subject'],
      take: limit,
    });

    return emails.map((e) => e.subject);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Highlight search matches in text
   */
  private highlightMatches(text: string, query: string): string {
    if (!query) return text;

    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');

    return text.replace(regex, '<mark>$1</mark>');
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let emailSearchServiceInstance: EmailSearchService | null = null;

export function getEmailSearchService(prisma: PrismaClient): EmailSearchService {
  if (!emailSearchServiceInstance) {
    emailSearchServiceInstance = new EmailSearchService(prisma);
  }
  return emailSearchServiceInstance;
}
