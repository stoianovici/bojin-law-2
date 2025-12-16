/**
 * Context Aggregator Service
 * Story 3.3: Intelligent Document Drafting
 *
 * Aggregates case context including case facts, client info, dates, and related documents
 */

import { prisma } from '@legal-platform/database';
import Redis from 'ioredis';
import {
  DocumentContext,
  CaseContext,
  ClientContext,
  TeamMemberContext,
  RelatedDocumentContext,
  FirmContext,
} from '@legal-platform/types';
import logger from '../lib/logger';
import { config } from '../config';

// Cache TTL in seconds (5 minutes as per story requirements)
const CONTEXT_CACHE_TTL = 300;

// Redis client for caching
let redisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(config.redis.url);
  }
  return redisClient;
}

export class ContextAggregatorService {
  /**
   * Aggregate all relevant context for a case
   */
  async aggregateCaseContext(caseId: string, firmId: string): Promise<DocumentContext> {
    const cacheKey = this.buildCacheKey(caseId, firmId);

    // Try to get from cache
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      logger.debug('Context cache hit', { caseId, firmId });
      return cached;
    }

    logger.info('Aggregating case context', { caseId, firmId });
    const startTime = Date.now();

    try {
      // Fetch all data in parallel for efficiency
      const [caseData, teamMembers, relatedDocuments] = await Promise.all([
        this.fetchCaseWithClient(caseId, firmId),
        this.fetchTeamMembers(caseId),
        this.fetchRelatedDocuments(caseId, firmId),
      ]);

      if (!caseData) {
        throw new Error(`Case not found: ${caseId}`);
      }

      const context: DocumentContext = {
        caseId,
        case: this.mapCaseContext(caseData),
        client: this.mapClientContext(caseData.client),
        teamMembers,
        relatedDocuments,
        firmContext: caseData.firm
          ? {
              id: caseData.firm.id,
              name: caseData.firm.name,
            }
          : undefined,
      };

      // Cache the result
      await this.setCache(cacheKey, context);

      const duration = Date.now() - startTime;
      logger.info('Context aggregation completed', {
        caseId,
        firmId,
        durationMs: duration,
        teamMemberCount: teamMembers.length,
        documentCount: relatedDocuments.length,
      });

      return context;
    } catch (error) {
      logger.error('Context aggregation failed', {
        caseId,
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
      where: {
        id: caseId,
        firmId,
      },
      include: {
        client: true,
        firm: true,
      },
    });
  }

  /**
   * Fetch team members assigned to the case
   */
  private async fetchTeamMembers(caseId: string): Promise<TeamMemberContext[]> {
    const caseTeam = await prisma.caseTeam.findMany({
      where: { caseId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return caseTeam.map((member) => ({
      id: member.user.id,
      name: `${member.user.firstName} ${member.user.lastName}`,
      email: member.user.email,
      role: member.role || member.user.role,
    }));
  }

  /**
   * Fetch related documents for the case
   */
  private async fetchRelatedDocuments(
    caseId: string,
    firmId: string
  ): Promise<RelatedDocumentContext[]> {
    const caseDocuments = await prisma.caseDocument.findMany({
      where: {
        caseId,
        firmId,
      },
      include: {
        document: {
          select: {
            id: true,
            fileName: true,
            fileType: true,
            metadata: true,
          },
        },
      },
      orderBy: {
        linkedAt: 'desc',
      },
      take: 10, // Limit to most recent 10 documents
    });

    return caseDocuments.map((cd) => ({
      id: cd.document.id,
      title: cd.document.fileName,
      type: cd.document.fileType,
      summary: (cd.document.metadata as Record<string, unknown>)?.summary as string | undefined,
    }));
  }

  /**
   * Map Prisma case to CaseContext
   */
  private mapCaseContext(caseData: {
    id: string;
    caseNumber: string;
    title: string;
    type: string;
    status: string;
    description: string;
    openedDate: Date;
    closedDate: Date | null;
    value: any;
    metadata: any;
  }): CaseContext {
    return {
      id: caseData.id,
      caseNumber: caseData.caseNumber,
      title: caseData.title,
      type: caseData.type,
      status: caseData.status,
      description: caseData.description,
      openedDate: caseData.openedDate,
      closedDate: caseData.closedDate || undefined,
      value: caseData.value ? Number(caseData.value) : undefined,
      metadata: (caseData.metadata as Record<string, unknown>) || undefined,
    };
  }

  /**
   * Map Prisma client to ClientContext
   */
  private mapClientContext(client: {
    id: string;
    name: string;
    contactInfo: any;
    address: string | null;
  }): ClientContext {
    return {
      id: client.id,
      name: client.name,
      contactInfo: (client.contactInfo as Record<string, unknown>) || {},
      address: client.address || undefined,
    };
  }

  /**
   * Build cache key for context
   */
  private buildCacheKey(caseId: string, firmId: string): string {
    return `context:${firmId}:${caseId}`;
  }

  /**
   * Get context from cache
   */
  private async getFromCache(key: string): Promise<DocumentContext | null> {
    try {
      const redis = getRedisClient();
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached) as DocumentContext;
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
   * Set context in cache
   */
  private async setCache(key: string, context: DocumentContext): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.setex(key, CONTEXT_CACHE_TTL, JSON.stringify(context));
    } catch (error) {
      logger.warn('Cache write failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Invalidate context cache for a case
   */
  async invalidateCache(caseId: string, firmId: string): Promise<void> {
    try {
      const redis = getRedisClient();
      const key = this.buildCacheKey(caseId, firmId);
      await redis.del(key);
      logger.debug('Context cache invalidated', { caseId, firmId });
    } catch (error) {
      logger.warn('Cache invalidation failed', {
        caseId,
        firmId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get a summary of the case context for prompt injection
   */
  async getContextSummary(caseId: string, firmId: string): Promise<string> {
    const context = await this.aggregateCaseContext(caseId, firmId);

    const parts: string[] = [];

    // Case info
    parts.push(`Case: ${context.case.title} (${context.case.caseNumber})`);
    parts.push(`Type: ${context.case.type} | Status: ${context.case.status}`);
    parts.push(`Client: ${context.client.name}`);

    if (context.case.description) {
      parts.push(`Description: ${context.case.description.substring(0, 200)}...`);
    }

    // Key dates
    parts.push(`Opened: ${new Date(context.case.openedDate).toLocaleDateString('ro-RO')}`);
    if (context.case.closedDate) {
      parts.push(`Closed: ${new Date(context.case.closedDate).toLocaleDateString('ro-RO')}`);
    }

    // Team
    if (context.teamMembers.length > 0) {
      const teamList = context.teamMembers.map((m) => `${m.name} (${m.role})`).join(', ');
      parts.push(`Team: ${teamList}`);
    }

    return parts.join('\n');
  }
}

// Singleton instance
export const contextAggregatorService = new ContextAggregatorService();
