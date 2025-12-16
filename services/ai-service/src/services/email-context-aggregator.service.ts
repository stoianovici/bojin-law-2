/**
 * Email Context Aggregator Service
 * Story 5.3: AI-Powered Email Drafting
 *
 * Aggregates email-specific case context for draft generation including:
 * - Case information
 * - Recent documents
 * - Prior communications
 * - Active deadlines
 * - Pending tasks
 * - Extracted commitments
 * - Risk indicators
 */

import { prisma } from '@legal-platform/database';
import Redis from 'ioredis';
import logger from '../lib/logger';
import { config } from '../config';
import type { CaseContext } from './email-drafting.service';
import { threadAnalysis, ThreadSummaryResult } from './thread-analysis.service';

// Cache TTL in seconds (5 minutes for prompt caching compatibility)
const EMAIL_CONTEXT_CACHE_TTL = 300;

// Maximum tokens for context (16K as per story requirements)
const MAX_CONTEXT_TOKENS = 16000;

// Approximate tokens per character (for estimation)
const TOKENS_PER_CHAR = 0.25;

// Redis client for caching
let redisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(config.redis.url);
  }
  return redisClient;
}

export class EmailContextAggregatorService {
  /**
   * Aggregate case context optimized for email drafting
   */
  async aggregateCaseContext(
    caseId: string,
    emailId: string,
    firmId: string
  ): Promise<CaseContext> {
    const cacheKey = this.buildCacheKey(caseId, emailId, firmId);

    // Try to get from cache
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      logger.debug('Email context cache hit', { caseId, emailId, firmId });
      return cached;
    }

    logger.info('Aggregating email case context', { caseId, emailId, firmId });
    const startTime = Date.now();

    try {
      // Fetch all data in parallel for efficiency
      const [
        caseData,
        recentDocuments,
        priorCommunications,
        activeDeadlines,
        pendingTasks,
        extractedCommitments,
        riskIndicators,
      ] = await Promise.all([
        this.fetchCaseWithClient(caseId, firmId),
        this.fetchRecentDocuments(caseId, firmId),
        this.fetchPriorCommunications(caseId, emailId, firmId),
        this.fetchActiveDeadlines(caseId, firmId),
        this.fetchPendingTasks(caseId, firmId),
        this.fetchExtractedCommitments(caseId, firmId),
        this.fetchRiskIndicators(caseId, firmId),
      ]);

      if (!caseData) {
        throw new Error(`Case not found: ${caseId}`);
      }

      const context: CaseContext = {
        case: {
          id: caseData.id,
          title: caseData.title,
          caseNumber: caseData.caseNumber,
          type: caseData.type,
          status: caseData.status,
          client: {
            id: caseData.client!.id,
            name: caseData.client!.name,
            email: (caseData.client!.contactInfo as { email?: string })?.email,
          },
          opposingParties: caseData
            .actors!.filter((a) => a.role === 'OpposingParty' || a.role === 'OpposingCounsel')
            .map((a) => ({
              id: a.id,
              name: a.name,
              role: a.role,
            })),
        },
        recentDocuments,
        priorCommunications,
        activeDeadlines,
        pendingTasks,
        extractedCommitments,
        riskIndicators,
      };

      // Apply token budget management
      const optimizedContext = this.applyTokenBudget(context);

      // Cache the result
      await this.setCache(cacheKey, optimizedContext);

      const duration = Date.now() - startTime;
      logger.info('Email context aggregation completed', {
        caseId,
        emailId,
        firmId,
        durationMs: duration,
        documentCount: optimizedContext.recentDocuments.length,
        communicationCount: optimizedContext.priorCommunications.length,
        deadlineCount: optimizedContext.activeDeadlines.length,
      });

      return optimizedContext;
    } catch (error) {
      logger.error('Email context aggregation failed', {
        caseId,
        emailId,
        firmId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Fetch case data with client information
   */
  private async fetchCaseWithClient(caseId: string, firmId: string) {
    return prisma.case.findFirst({
      where: { id: caseId, firmId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            contactInfo: true,
          },
        },
        actors: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });
  }

  /**
   * Fetch recent documents (last 10)
   */
  private async fetchRecentDocuments(caseId: string, firmId: string) {
    const documents = await prisma.caseDocument.findMany({
      where: { caseId, firmId },
      include: {
        document: {
          select: {
            id: true,
            fileName: true,
            fileType: true,
            uploadedAt: true,
          },
        },
      },
      orderBy: { linkedAt: 'desc' },
      take: 10,
    });

    return documents.map((d) => ({
      id: d.document.id,
      fileName: d.document.fileName,
      fileType: d.document.fileType,
      uploadedAt: d.document.uploadedAt,
    }));
  }

  /**
   * Fetch prior communications in the thread
   */
  private async fetchPriorCommunications(caseId: string, emailId: string, firmId: string) {
    // Get the conversation ID for the current email
    const currentEmail = await prisma.email.findFirst({
      where: { id: emailId, firmId },
      select: { conversationId: true },
    });

    if (!currentEmail?.conversationId) {
      return [];
    }

    // Get other emails in the same thread
    const emails = await prisma.email.findMany({
      where: {
        caseId,
        firmId,
        conversationId: currentEmail.conversationId,
        id: { not: emailId },
      },
      select: {
        id: true,
        subject: true,
        bodyPreview: true,
        sentDateTime: true,
      },
      orderBy: { sentDateTime: 'desc' },
      take: 10,
    });

    return emails.map((e) => ({
      subject: e.subject,
      date: e.sentDateTime,
      summary: e.bodyPreview,
    }));
  }

  /**
   * Fetch active deadlines for the case
   */
  private async fetchActiveDeadlines(caseId: string, firmId: string) {
    const deadlines = await prisma.extractedDeadline.findMany({
      where: {
        caseId,
        firmId,
        status: 'Pending',
        dueDate: { gte: new Date() },
      },
      select: {
        description: true,
        dueDate: true,
      },
      orderBy: { dueDate: 'asc' },
      take: 5,
    });

    return deadlines.map((d) => ({
      description: d.description,
      dueDate: d.dueDate,
    }));
  }

  /**
   * Fetch pending tasks for the case
   */
  private async fetchPendingTasks(caseId: string, firmId: string) {
    const tasks = await prisma.task.findMany({
      where: {
        caseId,
        firmId,
        status: { in: ['Pending', 'InProgress'] },
      },
      select: {
        title: true,
        priority: true,
        dueDate: true,
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      take: 5,
    });

    return tasks.map((t) => ({
      title: t.title,
      priority: t.priority,
      dueDate: t.dueDate ?? undefined,
    }));
  }

  /**
   * Fetch extracted commitments
   */
  private async fetchExtractedCommitments(caseId: string, firmId: string) {
    const commitments = await prisma.extractedCommitment.findMany({
      where: {
        caseId,
        firmId,
        status: 'Pending',
      },
      select: {
        party: true,
        commitmentText: true,
        dueDate: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return commitments.map((c) => ({
      party: c.party,
      commitmentText: c.commitmentText,
      dueDate: c.dueDate ?? undefined,
    }));
  }

  /**
   * Fetch risk indicators
   */
  private async fetchRiskIndicators(caseId: string, firmId: string) {
    const risks = await prisma.riskIndicator.findMany({
      where: {
        caseId,
        firmId,
        isResolved: false,
      },
      select: {
        type: true,
        severity: true,
        description: true,
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take: 3,
    });

    return risks.map((r) => ({
      type: r.type,
      severity: r.severity,
      description: r.description,
    }));
  }

  /**
   * Apply token budget to prevent context overflow
   * Reserve 4000 tokens for response, allocate rest to context (up to 16K)
   */
  private applyTokenBudget(context: CaseContext): CaseContext {
    let estimatedTokens = this.estimateTokens(context);

    // If within budget, return as-is
    if (estimatedTokens <= MAX_CONTEXT_TOKENS) {
      return context;
    }

    logger.info('Applying token budget optimization', {
      estimatedTokens,
      maxTokens: MAX_CONTEXT_TOKENS,
    });

    // Create a copy to modify
    const optimized = { ...context };

    // Priority for reduction:
    // 1. Reduce prior communications (summarize more)
    // 2. Reduce recent documents
    // 3. Reduce commitments

    // Reduce prior communications first
    if (optimized.priorCommunications.length > 5) {
      optimized.priorCommunications = optimized.priorCommunications.slice(0, 5);
      estimatedTokens = this.estimateTokens(optimized);
    }

    // Reduce recent documents
    if (estimatedTokens > MAX_CONTEXT_TOKENS && optimized.recentDocuments.length > 5) {
      optimized.recentDocuments = optimized.recentDocuments.slice(0, 5);
      estimatedTokens = this.estimateTokens(optimized);
    }

    // Truncate communication summaries
    if (estimatedTokens > MAX_CONTEXT_TOKENS) {
      optimized.priorCommunications = optimized.priorCommunications.map((c) => ({
        ...c,
        summary: c.summary.substring(0, 200) + '...',
      }));
    }

    return optimized;
  }

  /**
   * Estimate token count for context
   */
  private estimateTokens(context: CaseContext): number {
    const json = JSON.stringify(context);
    return Math.ceil(json.length * TOKENS_PER_CHAR);
  }

  /**
   * Build cache key
   */
  private buildCacheKey(caseId: string, emailId: string, firmId: string): string {
    return `email-context:${firmId}:${caseId}:${emailId}`;
  }

  /**
   * Get cached context
   */
  private async getFromCache(key: string): Promise<CaseContext | null> {
    try {
      const cached = await getRedisClient().get(key);
      if (cached) {
        return JSON.parse(cached, (k, v) => {
          // Restore Date objects
          if (k === 'uploadedAt' || k === 'date' || k === 'dueDate') {
            return new Date(v);
          }
          return v;
        });
      }
    } catch (error) {
      logger.warn('Cache read error', { key, error });
    }
    return null;
  }

  /**
   * Set context in cache
   */
  private async setCache(key: string, context: CaseContext): Promise<void> {
    try {
      await getRedisClient().setex(key, EMAIL_CONTEXT_CACHE_TTL, JSON.stringify(context));
    } catch (error) {
      logger.warn('Cache write error', { key, error });
    }
  }

  /**
   * Analyze communication history for a thread
   * Task 7: Communication History Analysis
   * Integrates with thread analysis service from Story 5.2
   */
  async analyzeCommunicationHistory(
    threadId: string,
    firmId: string
  ): Promise<CommunicationHistorySummary> {
    const cacheKey = `comm-history:${firmId}:${threadId}`;

    // Try cache first
    try {
      const cached = await getRedisClient().get(cacheKey);
      if (cached) {
        logger.debug('Communication history cache hit', { threadId });
        return JSON.parse(cached);
      }
    } catch (error) {
      logger.warn('Cache read error for comm history', { threadId, error });
    }

    logger.info('Analyzing communication history', { threadId, firmId });
    const startTime = Date.now();

    try {
      // Fetch emails in the thread
      const emails = await prisma.email.findMany({
        where: {
          conversationId: threadId,
          firmId,
        },
        select: {
          id: true,
          subject: true,
          bodyContent: true,
          from: true,
          toRecipients: true,
          receivedDateTime: true,
          userId: true,
        },
        orderBy: { receivedDateTime: 'asc' },
      });

      if (emails.length === 0) {
        return {
          threadId,
          keyDiscussionPoints: [],
          unansweredQuestions: [],
          positionChanges: [],
          agreements: [],
        };
      }

      // Get case context if available
      const firstEmail = await prisma.email.findFirst({
        where: { conversationId: threadId },
        include: {
          case: {
            select: {
              id: true,
              title: true,
              caseNumber: true,
              client: { select: { name: true } },
            },
          },
        },
      });

      // Use thread analysis service from Story 5.2
      const threadEmails = emails.map((e) => ({
        id: e.id,
        subject: e.subject,
        bodyContent: e.bodyContent,
        from: e.from as { name?: string; address: string },
        toRecipients: e.toRecipients as Array<{ name?: string; address: string }>,
        receivedDateTime: e.receivedDateTime,
        isFromUser: true, // Simplified - would need proper check
      }));

      const caseContext = firstEmail?.case
        ? {
            id: firstEmail.case.id,
            title: firstEmail.case.title,
            caseNumber: firstEmail.case.caseNumber,
            clientName: firstEmail.case.client.name,
          }
        : undefined;

      // Analyze thread
      // Use first email's userId for tracking, threadId as conversationId
      const userId = emails[0].userId;
      const threadAnalysisResult = await threadAnalysis.analyzeThread(
        threadEmails,
        caseContext as any, // CaseContext type may differ between services
        threadId,
        userId,
        firmId
      );

      // Map to communication history format
      const summary: CommunicationHistorySummary = {
        threadId,
        keyDiscussionPoints: threadAnalysisResult.keyArguments.map(
          (a: { argument: string; party: string; date: string }) => ({
            point: a.argument,
            party: a.party,
            date: a.date,
          })
        ),
        unansweredQuestions: this.extractUnansweredQuestions(emails),
        positionChanges: threadAnalysisResult.positionChanges.map(
          (p: {
            date: string;
            previousPosition: string;
            newPosition: string;
            trigger?: string;
          }) => ({
            date: p.date,
            previousPosition: p.previousPosition,
            newPosition: p.newPosition,
            trigger: p.trigger,
          })
        ),
        agreements: this.extractAgreements(threadAnalysisResult),
        opposingCounselPosition: threadAnalysisResult.opposingCounselPosition,
        overallSentiment: threadAnalysisResult.overallSentiment,
        urgencyLevel: threadAnalysisResult.urgencyLevel,
      };

      // Cache the result
      try {
        await getRedisClient().setex(cacheKey, EMAIL_CONTEXT_CACHE_TTL, JSON.stringify(summary));
      } catch (error) {
        logger.warn('Cache write error for comm history', { threadId, error });
      }

      logger.info('Communication history analysis completed', {
        threadId,
        durationMs: Date.now() - startTime,
        emailCount: emails.length,
        discussionPoints: summary.keyDiscussionPoints.length,
      });

      return summary;
    } catch (error) {
      logger.error('Communication history analysis failed', {
        threadId,
        firmId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Extract unanswered questions from emails
   */
  private extractUnansweredQuestions(
    emails: Array<{ id: string; bodyContent: string; receivedDateTime: Date }>
  ): string[] {
    const questions: string[] = [];

    // Simple regex to find questions
    const questionRegex = /[^.!?]*\?/g;

    for (const email of emails) {
      const matches = email.bodyContent.match(questionRegex);
      if (matches) {
        questions.push(...matches.map((q) => q.trim()));
      }
    }

    // Return unique questions (simplified - in production would check if answered)
    return [...new Set(questions)].slice(0, 5);
  }

  /**
   * Extract agreements from thread analysis
   */
  private extractAgreements(analysis: ThreadSummaryResult): string[] {
    // Look for agreement patterns in key arguments
    return analysis.keyArguments
      .filter(
        (a) =>
          a.argument.toLowerCase().includes('agreed') ||
          a.argument.toLowerCase().includes('accept') ||
          a.argument.toLowerCase().includes('de acord')
      )
      .map((a) => a.argument)
      .slice(0, 3);
  }
}

/**
 * Communication history summary for draft generation
 */
export interface CommunicationHistorySummary {
  threadId: string;
  keyDiscussionPoints: Array<{
    point: string;
    party: string;
    date: string;
  }>;
  unansweredQuestions: string[];
  positionChanges: Array<{
    date: string;
    previousPosition: string;
    newPosition: string;
    trigger?: string;
  }>;
  agreements: string[];
  opposingCounselPosition?: string;
  overallSentiment?: 'cooperative' | 'adversarial' | 'neutral';
  urgencyLevel?: 'low' | 'medium' | 'high';
}

// Export singleton instance
export const emailContextAggregatorService = new EmailContextAggregatorService();
