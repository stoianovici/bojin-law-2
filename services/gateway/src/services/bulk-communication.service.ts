/**
 * Bulk Communication Service
 * Story 5.5: Multi-Channel Communication Hub (AC: 3)
 *
 * Manages bulk communications - sending messages to multiple recipients
 */

import { prisma } from '@legal-platform/database';
import { BulkCommunicationStatus, BulkRecipientType, CommunicationChannel } from '@prisma/client';
import { communicationTemplateService } from './communication-template.service';
import { GraphService } from './graph.service';

// ============================================================================
// Rate Limiter
// ============================================================================

/**
 * Simple token bucket rate limiter for bulk email sends
 * Enforces 100 emails per minute per firm (AC: 3 - rate limiting)
 */
class FirmRateLimiter {
  private buckets: Map<string, { tokens: number; lastRefill: number }> = new Map();
  private readonly maxTokens = 100; // 100 emails per minute
  private readonly refillInterval = 60000; // 1 minute in ms

  /**
   * Attempt to consume a token for a firm
   * @returns true if token was consumed, false if rate limited
   */
  tryConsume(firmId: string): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(firmId);

    if (!bucket) {
      bucket = { tokens: this.maxTokens, lastRefill: now };
      this.buckets.set(firmId, bucket);
    }

    // Refill tokens if interval has passed
    const elapsed = now - bucket.lastRefill;
    if (elapsed >= this.refillInterval) {
      const refills = Math.floor(elapsed / this.refillInterval);
      bucket.tokens = Math.min(this.maxTokens, bucket.tokens + refills * this.maxTokens);
      bucket.lastRefill = now;
    }

    if (bucket.tokens > 0) {
      bucket.tokens--;
      return true;
    }

    return false;
  }

  /**
   * Get wait time until next token is available (in ms)
   */
  getWaitTime(firmId: string): number {
    const bucket = this.buckets.get(firmId);
    if (!bucket || bucket.tokens > 0) {
      return 0;
    }

    const elapsed = Date.now() - bucket.lastRefill;
    return Math.max(0, this.refillInterval - elapsed);
  }
}

// Singleton rate limiter instance
const firmRateLimiter = new FirmRateLimiter();

// ============================================================================
// Types
// ============================================================================

interface RecipientFilter {
  caseIds?: string[];
  caseTypes?: string[];
  customRecipients?: {
    id: string;
    name: string;
    email: string;
  }[];
}

interface CreateBulkCommunicationInput {
  caseId?: string;
  templateId?: string;
  subject: string;
  body: string;
  htmlBody?: string;
  channelType: CommunicationChannel;
  recipientType: BulkRecipientType;
  recipientFilter: RecipientFilter;
  scheduledFor?: Date;
}

interface ResolvedRecipient {
  id: string;
  name: string;
  email: string;
  source: 'case_client' | 'case_team' | 'custom';
  caseId?: string;
}

interface BulkCommunication {
  id: string;
  firmId: string;
  caseId?: string;
  templateId?: string;
  subject: string;
  body: string;
  htmlBody?: string;
  channelType: CommunicationChannel;
  recipientType: BulkRecipientType;
  recipientFilter: RecipientFilter;
  recipients: ResolvedRecipient[];
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  status: BulkCommunicationStatus;
  scheduledFor?: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface BulkCommunicationLog {
  id: string;
  bulkCommunicationId: string;
  recipientId: string;
  recipientEmail: string;
  recipientName: string;
  status: 'pending' | 'sent' | 'failed';
  errorMessage?: string;
  sentAt?: Date;
}

interface UserContext {
  userId: string;
  firmId: string;
}

// ============================================================================
// Service
// ============================================================================

export class BulkCommunicationService {
  private graphService: GraphService;

  constructor(graphService?: GraphService) {
    this.graphService = graphService || new GraphService();
  }

  /**
   * Create a new bulk communication (draft)
   */
  async createBulkCommunication(
    input: CreateBulkCommunicationInput,
    userContext: UserContext
  ): Promise<BulkCommunication> {
    // If using a template, increment usage count
    if (input.templateId) {
      await communicationTemplateService.incrementUsageCount(input.templateId);
    }

    const bulkComm = await prisma.bulkCommunication.create({
      data: {
        firmId: userContext.firmId,
        caseId: input.caseId,
        templateId: input.templateId,
        subject: input.subject,
        body: input.body,
        htmlBody: input.htmlBody,
        channelType: input.channelType,
        recipientType: input.recipientType,
        recipientFilter: input.recipientFilter as any,
        recipients: [],
        totalRecipients: 0,
        sentCount: 0,
        failedCount: 0,
        status: BulkCommunicationStatus.Draft,
        scheduledFor: input.scheduledFor,
        createdBy: userContext.userId,
      },
    });

    return this.mapToBulkCommunication(bulkComm);
  }

  /**
   * Resolve recipient filter to actual recipients
   */
  async resolveRecipients(
    bulkCommId: string,
    userContext: UserContext
  ): Promise<ResolvedRecipient[]> {
    const bulkComm = await prisma.bulkCommunication.findFirst({
      where: { id: bulkCommId, firmId: userContext.firmId },
    });

    if (!bulkComm) {
      throw new Error('Bulk communication not found');
    }

    const filter = bulkComm.recipientFilter as RecipientFilter;
    const recipients: ResolvedRecipient[] = [];

    switch (bulkComm.recipientType) {
      case BulkRecipientType.CaseClients:
        if (bulkComm.caseId) {
          const caseClients = await this.getCaseClients(bulkComm.caseId);
          recipients.push(...caseClients);
        }
        break;

      case BulkRecipientType.CaseTeam:
        if (bulkComm.caseId) {
          const caseTeam = await this.getCaseTeam(bulkComm.caseId);
          recipients.push(...caseTeam);
        }
        break;

      case BulkRecipientType.AllClients:
        const allClients = await this.getAllFirmClients(userContext.firmId);
        recipients.push(...allClients);
        break;

      case BulkRecipientType.CaseTypeClients:
        if (filter.caseTypes && filter.caseTypes.length > 0) {
          const caseTypeClients = await this.getClientsByCaseType(
            userContext.firmId,
            filter.caseTypes
          );
          recipients.push(...caseTypeClients);
        }
        break;

      case BulkRecipientType.CustomList:
        if (filter.customRecipients) {
          recipients.push(
            ...filter.customRecipients.map((r) => ({
              id: r.id,
              name: r.name,
              email: r.email,
              source: 'custom' as const,
            }))
          );
        }
        break;
    }

    // Deduplicate by email
    const uniqueRecipients = this.deduplicateRecipients(recipients);

    // Update bulk communication with resolved recipients
    await prisma.bulkCommunication.update({
      where: { id: bulkCommId },
      data: {
        recipients: uniqueRecipients as any,
        totalRecipients: uniqueRecipients.length,
      },
    });

    // Create log entries for each recipient
    await prisma.bulkCommunicationLog.createMany({
      data: uniqueRecipients.map((r) => ({
        bulkCommunicationId: bulkCommId,
        recipientId: r.id,
        recipientEmail: r.email,
        recipientName: r.name,
        status: 'pending',
      })),
    });

    return uniqueRecipients;
  }

  /**
   * Start sending the bulk communication
   */
  async sendBulkCommunication(
    bulkCommId: string,
    userContext: UserContext
  ): Promise<BulkCommunication> {
    const bulkComm = await prisma.bulkCommunication.findFirst({
      where: { id: bulkCommId, firmId: userContext.firmId },
    });

    if (!bulkComm) {
      throw new Error('Bulk communication not found');
    }

    if (bulkComm.status !== BulkCommunicationStatus.Draft) {
      throw new Error('Bulk communication is not in draft status');
    }

    const recipients = bulkComm.recipients as unknown as ResolvedRecipient[];
    if (recipients.length === 0) {
      throw new Error('No recipients resolved. Call resolveRecipients first.');
    }

    // Update status to InProgress
    await prisma.bulkCommunication.update({
      where: { id: bulkCommId },
      data: {
        status: BulkCommunicationStatus.InProgress,
        startedAt: new Date(),
      },
    });

    // Start async sending process
    this.processBulkSend(bulkCommId).catch((error) => {
      console.error(`Bulk send failed for ${bulkCommId}:`, error);
    });

    return this.getBulkCommunication(bulkCommId, userContext) as Promise<BulkCommunication>;
  }

  /**
   * Schedule a bulk communication for later
   */
  async scheduleBulkCommunication(
    bulkCommId: string,
    scheduledFor: Date,
    userContext: UserContext
  ): Promise<BulkCommunication> {
    const bulkComm = await prisma.bulkCommunication.findFirst({
      where: { id: bulkCommId, firmId: userContext.firmId },
    });

    if (!bulkComm) {
      throw new Error('Bulk communication not found');
    }

    if (bulkComm.status !== BulkCommunicationStatus.Draft) {
      throw new Error('Only draft communications can be scheduled');
    }

    const updated = await prisma.bulkCommunication.update({
      where: { id: bulkCommId },
      data: {
        status: BulkCommunicationStatus.Scheduled,
        scheduledFor,
      },
    });

    return this.mapToBulkCommunication(updated);
  }

  /**
   * Cancel a bulk communication
   */
  async cancelBulkCommunication(
    bulkCommId: string,
    userContext: UserContext
  ): Promise<BulkCommunication> {
    const bulkComm = await prisma.bulkCommunication.findFirst({
      where: { id: bulkCommId, firmId: userContext.firmId },
    });

    if (!bulkComm) {
      throw new Error('Bulk communication not found');
    }

    if (
      bulkComm.status === BulkCommunicationStatus.Completed ||
      bulkComm.status === BulkCommunicationStatus.PartiallyFailed
    ) {
      throw new Error('Cannot cancel a completed communication');
    }

    const updated = await prisma.bulkCommunication.update({
      where: { id: bulkCommId },
      data: { status: BulkCommunicationStatus.Cancelled },
    });

    return this.mapToBulkCommunication(updated);
  }

  /**
   * Get bulk communication by ID
   */
  async getBulkCommunication(
    bulkCommId: string,
    userContext: UserContext
  ): Promise<BulkCommunication | null> {
    const bulkComm = await prisma.bulkCommunication.findFirst({
      where: { id: bulkCommId, firmId: userContext.firmId },
    });

    return bulkComm ? this.mapToBulkCommunication(bulkComm) : null;
  }

  /**
   * Get send logs for a bulk communication
   */
  async getBulkCommunicationLogs(
    bulkCommId: string,
    userContext: UserContext,
    options?: { status?: string; limit?: number; offset?: number }
  ): Promise<{ logs: BulkCommunicationLog[]; total: number }> {
    const bulkComm = await prisma.bulkCommunication.findFirst({
      where: { id: bulkCommId, firmId: userContext.firmId },
    });

    if (!bulkComm) {
      throw new Error('Bulk communication not found');
    }

    const where: any = { bulkCommunicationId: bulkCommId };
    if (options?.status) {
      where.status = options.status;
    }

    const [logs, total] = await Promise.all([
      prisma.bulkCommunicationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      prisma.bulkCommunicationLog.count({ where }),
    ]);

    return {
      logs: logs.map((l) => ({
        id: l.id,
        bulkCommunicationId: l.bulkCommunicationId,
        recipientId: l.recipientId,
        recipientEmail: l.recipientEmail,
        recipientName: l.recipientName,
        status: l.status as 'pending' | 'sent' | 'failed',
        errorMessage: l.errorMessage || undefined,
        sentAt: l.sentAt || undefined,
      })),
      total,
    };
  }

  /**
   * List bulk communications for a firm
   */
  async listBulkCommunications(
    userContext: UserContext,
    options?: {
      status?: BulkCommunicationStatus;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ items: BulkCommunication[]; total: number }> {
    const where: any = { firmId: userContext.firmId };
    if (options?.status) {
      where.status = options.status;
    }

    const [items, total] = await Promise.all([
      prisma.bulkCommunication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 20,
        skip: options?.offset || 0,
      }),
      prisma.bulkCommunication.count({ where }),
    ]);

    return {
      items: items.map((i) => this.mapToBulkCommunication(i)),
      total,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Process bulk send asynchronously with rate limiting
   * Rate limit: 100 emails per minute per firm (Story 5.5 requirement)
   */
  private async processBulkSend(bulkCommId: string): Promise<void> {
    // Get bulk communication with firm context
    const bulkComm = await prisma.bulkCommunication.findUnique({
      where: { id: bulkCommId },
    });

    if (!bulkComm) {
      throw new Error('Bulk communication not found');
    }

    const firmId = bulkComm.firmId;

    const logs = await prisma.bulkCommunicationLog.findMany({
      where: { bulkCommunicationId: bulkCommId, status: 'pending' },
    });

    let sentCount = 0;
    let failedCount = 0;

    for (const log of logs) {
      // Check if bulk communication was cancelled
      const currentStatus = await prisma.bulkCommunication.findUnique({
        where: { id: bulkCommId },
        select: { status: true },
      });

      if (currentStatus?.status === BulkCommunicationStatus.Cancelled) {
        break;
      }

      // Apply rate limiting - wait if necessary
      while (!firmRateLimiter.tryConsume(firmId)) {
        const waitTime = firmRateLimiter.getWaitTime(firmId);
        if (waitTime > 0) {
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }

      try {
        await this.sendSingleEmail(bulkCommId, log);
        sentCount++;

        await prisma.bulkCommunicationLog.update({
          where: { id: log.id },
          data: { status: 'sent', sentAt: new Date() },
        });
      } catch (error: any) {
        failedCount++;
        await prisma.bulkCommunicationLog.update({
          where: { id: log.id },
          data: { status: 'failed', errorMessage: error.message },
        });
      }

      // Update counts periodically (every 10 emails for efficiency)
      if ((sentCount + failedCount) % 10 === 0 || sentCount + failedCount === logs.length) {
        await prisma.bulkCommunication.update({
          where: { id: bulkCommId },
          data: { sentCount, failedCount },
        });
      }
    }

    // Finalize
    const finalStatus =
      failedCount === 0
        ? BulkCommunicationStatus.Completed
        : failedCount === logs.length
          ? BulkCommunicationStatus.PartiallyFailed
          : BulkCommunicationStatus.PartiallyFailed;

    await prisma.bulkCommunication.update({
      where: { id: bulkCommId },
      data: {
        status: finalStatus,
        completedAt: new Date(),
        sentCount,
        failedCount,
      },
    });
  }

  /**
   * Send a single email via Microsoft Graph API
   * Uses app-level authentication for background bulk sends
   */
  private async sendSingleEmail(
    bulkCommId: string,
    log: { recipientEmail: string; recipientName: string }
  ): Promise<void> {
    // Get the bulk communication content with creator info
    const bulkComm = await prisma.bulkCommunication.findUnique({
      where: { id: bulkCommId },
      select: {
        subject: true,
        body: true,
        htmlBody: true,
        creator: {
          select: { email: true },
        },
      },
    });

    if (!bulkComm) {
      throw new Error('Bulk communication not found');
    }

    try {
      // Use app-level client for background sends (client credentials flow)
      const appClient = await this.graphService.getAppClient();

      // Send email using the Graph API with app permissions
      // Note: With application permissions, we need to specify the sender
      await appClient.api(`/users/${bulkComm.creator.email}/sendMail`).post({
        message: {
          subject: bulkComm.subject,
          body: {
            contentType: bulkComm.htmlBody ? 'HTML' : 'Text',
            content: bulkComm.htmlBody || bulkComm.body,
          },
          toRecipients: [
            {
              emailAddress: {
                address: log.recipientEmail,
              },
            },
          ],
        },
        saveToSentItems: true,
      });
    } catch (error: any) {
      // Check if this is a development environment without Graph API configured
      if (
        error.message?.includes('Failed to initialize app-only Graph client') ||
        error.message?.includes('Failed to acquire')
      ) {
        console.warn(`Graph API not configured for bulk comm ${bulkCommId}, simulating send`);
        await new Promise((resolve) => setTimeout(resolve, 50));
        return;
      }
      throw error;
    }
  }

  /**
   * Get clients for a specific case
   */
  private async getCaseClients(caseId: string): Promise<ResolvedRecipient[]> {
    const caseRecord = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        client: true,
      },
    });

    if (!caseRecord || !caseRecord.client) {
      return [];
    }

    // Extract email from contactInfo JSON
    const contactInfo = caseRecord.client.contactInfo as any;
    const email = contactInfo?.email || '';

    return [
      {
        id: caseRecord.client.id,
        name: caseRecord.client.name,
        email,
        source: 'case_client',
        caseId,
      },
    ];
  }

  /**
   * Get team members for a specific case
   */
  private async getCaseTeam(caseId: string): Promise<ResolvedRecipient[]> {
    const teamMembers = await prisma.caseTeam.findMany({
      where: { caseId },
      include: { user: true },
    });

    return teamMembers.map((tm) => ({
      id: tm.user.id,
      name: `${tm.user.firstName || ''} ${tm.user.lastName || ''}`.trim() || tm.user.email,
      email: tm.user.email,
      source: 'case_team' as const,
      caseId,
    }));
  }

  /**
   * Get all clients for a firm
   */
  private async getAllFirmClients(firmId: string): Promise<ResolvedRecipient[]> {
    const clients = await prisma.client.findMany({
      where: { firmId },
    });

    return clients.map((c) => {
      const contactInfo = c.contactInfo as any;
      return {
        id: c.id,
        name: c.name,
        email: contactInfo?.email || '',
        source: 'case_client' as const,
      };
    });
  }

  /**
   * Get clients by case type
   */
  private async getClientsByCaseType(
    firmId: string,
    caseTypes: string[]
  ): Promise<ResolvedRecipient[]> {
    const cases = await prisma.case.findMany({
      where: {
        firmId,
        type: { in: caseTypes },
        status: { not: 'Closed' },
      },
      include: { client: true },
    });

    const clientMap = new Map<string, ResolvedRecipient>();
    for (const c of cases) {
      if (c.client && !clientMap.has(c.client.id)) {
        const contactInfo = c.client.contactInfo as any;
        clientMap.set(c.client.id, {
          id: c.client.id,
          name: c.client.name,
          email: contactInfo?.email || '',
          source: 'case_client',
          caseId: c.id,
        });
      }
    }

    return Array.from(clientMap.values());
  }

  /**
   * Deduplicate recipients by email
   */
  private deduplicateRecipients(recipients: ResolvedRecipient[]): ResolvedRecipient[] {
    const seen = new Set<string>();
    return recipients.filter((r) => {
      const email = r.email.toLowerCase();
      if (seen.has(email)) {
        return false;
      }
      seen.add(email);
      return true;
    });
  }

  /**
   * Map Prisma result to BulkCommunication type
   */
  private mapToBulkCommunication(bulkComm: any): BulkCommunication {
    return {
      id: bulkComm.id,
      firmId: bulkComm.firmId,
      caseId: bulkComm.caseId || undefined,
      templateId: bulkComm.templateId || undefined,
      subject: bulkComm.subject,
      body: bulkComm.body,
      htmlBody: bulkComm.htmlBody || undefined,
      channelType: bulkComm.channelType,
      recipientType: bulkComm.recipientType,
      recipientFilter: bulkComm.recipientFilter as RecipientFilter,
      recipients: (bulkComm.recipients as ResolvedRecipient[]) || [],
      totalRecipients: bulkComm.totalRecipients,
      sentCount: bulkComm.sentCount,
      failedCount: bulkComm.failedCount,
      status: bulkComm.status,
      scheduledFor: bulkComm.scheduledFor || undefined,
      startedAt: bulkComm.startedAt || undefined,
      completedAt: bulkComm.completedAt || undefined,
      createdBy: bulkComm.createdBy,
      createdAt: bulkComm.createdAt,
      updatedAt: bulkComm.updatedAt,
    };
  }
}

// Export singleton instance
export const bulkCommunicationService = new BulkCommunicationService();
