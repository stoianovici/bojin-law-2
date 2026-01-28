/**
 * Case Context Batch Processor
 * OPS-261: Case Context Batch Processor
 *
 * Pre-compiles comprehensive case context nightly (~2000-4000 tokens per case).
 * Runs at 4 AM daily, before morning briefings (5 AM).
 *
 * Aggregates:
 * - Case metadata and parties (from case-briefing.service)
 * - Document summaries (from document-summary.service)
 * - Email thread summaries (from email-context.service)
 * - Client context (from client-context.service)
 * - Health indicators and upcoming deadlines
 */

import { prisma } from '@legal-platform/database';
import { subDays, addHours, addDays, format, differenceInDays } from 'date-fns';
import { ro } from 'date-fns/locale';
import type {
  BatchProcessor,
  BatchProcessorContext,
  BatchProcessorResult,
} from '../batch-processor.interface';
import { caseBriefingService } from '../../services/case-briefing.service';
import { documentSummaryService } from '../../services/document-summary.service';
import { emailContextService } from '../../services/email-context.service';
import { clientContextService } from '../../services/client-context.service';

// ============================================================================
// Types
// ============================================================================

interface ActiveCase {
  id: string;
  clientId: string;
  title: string;
  status: string;
  firmId: string;
  updatedAt: Date;
}

interface HealthIndicator {
  type: 'STALE' | 'OVERDUE_TASKS' | 'APPROACHING_DEADLINE' | 'UNANSWERED_EMAILS';
  severity: 'high' | 'medium' | 'low';
  message: string;
}

interface UpcomingDeadline {
  taskId: string;
  title: string;
  dueAt: string;
  daysUntil: number;
  priority: string;
}

interface CaseMetrics {
  documentCount: number;
  emailCount: number;
  unreadEmailCount: number;
  pendingTaskCount: number;
  overdueTaskCount: number;
  daysWithoutActivity: number;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Chunk array into smaller batches
 */
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ============================================================================
// Processor
// ============================================================================

export class CaseContextProcessor implements BatchProcessor {
  readonly name = 'Case Context Pre-compilation';
  readonly feature = 'case_context';

  /**
   * Process case context for all active cases in a firm
   */
  async process(ctx: BatchProcessorContext): Promise<BatchProcessorResult> {
    const { firmId, batchJobId, onProgress } = ctx;

    console.log(`[CaseContext] Starting context pre-compilation for firm ${firmId}`);

    // Get active cases
    const activeCases = await this.getActiveCases(firmId);
    console.log(`[CaseContext] Found ${activeCases.length} active cases`);

    let processed = 0;
    let failed = 0;
    let totalTokens = 0;
    let totalCost = 0;
    const errors: string[] = [];

    // Process in batches of 5 with parallel execution within batch
    const batches = chunk(activeCases, 5);

    for (const batch of batches) {
      const results = await Promise.allSettled(
        batch.map((caseItem) => this.processCase(caseItem, firmId, batchJobId))
      );

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const caseItem = batch[i];

        if (result.status === 'fulfilled') {
          processed++;
          totalTokens += result.value.tokens;
          totalCost += result.value.cost;
          console.log(`[CaseContext] Processed case ${caseItem.title}`);
        } else {
          failed++;
          const errorMsg = result.reason?.message || 'Unknown error';
          errors.push(`Case ${caseItem.id}: ${errorMsg}`);
          console.error(`[CaseContext] Failed case ${caseItem.title}:`, errorMsg);
        }
      }

      onProgress?.(processed + failed, activeCases.length);
    }

    console.log(`[CaseContext] Completed: ${processed} processed, ${failed} failed`);

    return {
      itemsProcessed: processed,
      itemsFailed: failed,
      totalTokens,
      totalCost,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Get active cases for processing
   * Active = not closed AND (updated in last 60 days OR has pending tasks)
   */
  private async getActiveCases(firmId: string): Promise<ActiveCase[]> {
    const sixtyDaysAgo = subDays(new Date(), 60);

    return prisma.case.findMany({
      where: {
        firmId,
        status: { not: 'Closed' },
        OR: [
          { updatedAt: { gte: sixtyDaysAgo } },
          { tasks: { some: { status: { not: 'Completed' } } } },
        ],
      },
      select: {
        id: true,
        clientId: true,
        title: true,
        status: true,
        firmId: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Process a single case - gather all context and save
   */
  private async processCase(
    caseItem: ActiveCase,
    firmId: string,
    _batchJobId: string
  ): Promise<{ tokens: number; cost: number }> {
    const now = new Date();

    // Gather all context in parallel
    const [briefingData, documents, emails, client, metrics, deadlines] = await Promise.all([
      // Basic case briefing data
      caseBriefingService.getBriefing(caseItem.id),
      // Document summaries (OPS-258)
      documentSummaryService.getForCase(caseItem.id, firmId).catch(() => []),
      // Email context (OPS-259)
      emailContextService.getForCase(caseItem.id, firmId).catch(() => ({
        threads: [],
        pendingActionItems: [],
        unreadCount: 0,
        urgentCount: 0,
      })),
      // Client context (OPS-260)
      caseItem.clientId
        ? clientContextService.getForClient(caseItem.clientId, firmId).catch(() => null)
        : Promise.resolve(null),
      // Case metrics for health indicators
      this.getCaseMetrics(caseItem.id, firmId),
      // Upcoming deadlines
      this.getUpcomingDeadlines(caseItem.id, firmId),
    ]);

    // Calculate health indicators
    const healthIndicators = this.calculateHealthIndicators(caseItem, metrics, deadlines);

    // Generate formatted briefing text
    const briefingText = this.formatBriefingText({
      caseTitle: caseItem.title,
      caseStatus: caseItem.status,
      briefingData,
      documents,
      emails,
      client,
      deadlines,
      healthIndicators,
    });

    // Get contacts from case actors for contact_context
    const contacts = await this.getCaseContacts(caseItem.id);

    // Map document summaries to expected type format (title/type instead of fileName/fileType)
    const mappedDocuments = documents.map((doc) => ({
      id: doc.id,
      title: doc.fileName, // Map fileName to title
      type: doc.fileType, // Map fileType to type
      summary: doc.summary,
      updatedAt: doc.updatedAt.toISOString(),
    }));

    // Upsert to CaseBriefing table
    await prisma.caseBriefing.upsert({
      where: { caseId: caseItem.id },
      create: {
        caseId: caseItem.id,
        firmId,
        briefingText,
        briefingData: JSON.parse(JSON.stringify(briefingData)),
        documentSummaries: JSON.parse(JSON.stringify(mappedDocuments)),
        emailThreadSummaries: JSON.parse(JSON.stringify(emails)),
        clientContext: client ? JSON.parse(JSON.stringify(client)) : null,
        contactContext: JSON.parse(JSON.stringify(contacts)),
        upcomingDeadlines: JSON.parse(JSON.stringify(deadlines)),
        caseHealthIndicators: JSON.parse(JSON.stringify(healthIndicators)),
        contextVersion: 1,
        lastComputedAt: now,
        validUntil: addHours(now, 24),
      },
      update: {
        briefingText,
        briefingData: JSON.parse(JSON.stringify(briefingData)),
        documentSummaries: JSON.parse(JSON.stringify(mappedDocuments)),
        emailThreadSummaries: JSON.parse(JSON.stringify(emails)),
        clientContext: client ? JSON.parse(JSON.stringify(client)) : null,
        contactContext: JSON.parse(JSON.stringify(contacts)),
        upcomingDeadlines: JSON.parse(JSON.stringify(deadlines)),
        caseHealthIndicators: JSON.parse(JSON.stringify(healthIndicators)),
        lastComputedAt: now,
        validUntil: addHours(now, 24),
      },
    });

    // No AI calls in this processor - just aggregation
    return { tokens: 0, cost: 0 };
  }

  /**
   * Get case metrics for health indicator calculation
   */
  private async getCaseMetrics(caseId: string, firmId: string): Promise<CaseMetrics> {
    const now = new Date();

    const [documentCount, emailStats, taskStats, lastActivity] = await Promise.all([
      // Document count
      prisma.caseDocument.count({ where: { caseId, firmId } }),
      // Email counts
      prisma.email
        .aggregate({
          where: { caseLinks: { some: { caseId } } },
          _count: true,
        })
        .then(async (total) => {
          const unread = await prisma.email.count({
            where: { caseLinks: { some: { caseId } }, isRead: false },
          });
          return { total: total._count, unread };
        }),
      // Task counts
      prisma.task
        .findMany({
          where: { caseId, status: { not: 'Completed' } },
          select: { dueDate: true },
        })
        .then((tasks) => {
          const pending = tasks.length;
          const overdue = tasks.filter((t) => t.dueDate && t.dueDate < now).length;
          return { pending, overdue };
        }),
      // Last activity
      prisma.caseActivityEntry.findFirst({
        where: { caseId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    const daysWithoutActivity = lastActivity ? differenceInDays(now, lastActivity.createdAt) : 999;

    return {
      documentCount,
      emailCount: emailStats.total,
      unreadEmailCount: emailStats.unread,
      pendingTaskCount: taskStats.pending,
      overdueTaskCount: taskStats.overdue,
      daysWithoutActivity,
    };
  }

  /**
   * Get upcoming deadlines (next 10)
   */
  private async getUpcomingDeadlines(caseId: string, _firmId: string): Promise<UpcomingDeadline[]> {
    const now = new Date();
    const thirtyDaysFromNow = addDays(now, 30);

    const tasks = await prisma.task.findMany({
      where: {
        caseId,
        status: { not: 'Completed' },
        dueDate: { gte: now, lte: thirtyDaysFromNow },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        priority: true,
      },
      orderBy: { dueDate: 'asc' },
      take: 10,
    });

    return tasks
      .filter((t) => t.dueDate)
      .map((t) => ({
        taskId: t.id,
        title: t.title,
        dueAt: t.dueDate!.toISOString(),
        daysUntil: differenceInDays(t.dueDate!, now),
        priority: t.priority,
      }));
  }

  /**
   * Get case contacts (actors) for context
   */
  private async getCaseContacts(
    caseId: string
  ): Promise<Array<{ name: string; role: string; email?: string }>> {
    const actors = await prisma.caseActor.findMany({
      where: { caseId },
      select: {
        name: true,
        role: true,
        email: true,
      },
      take: 10,
    });

    return actors.map((a) => ({
      name: a.name || 'Necunoscut',
      role: this.translateRole(a.role),
      email: a.email || undefined,
    }));
  }

  /**
   * Calculate health indicators based on case metrics
   */
  private calculateHealthIndicators(
    caseItem: ActiveCase,
    metrics: CaseMetrics,
    deadlines: UpcomingDeadline[]
  ): HealthIndicator[] {
    const indicators: HealthIndicator[] = [];

    // Staleness warning (no activity in 14+ days)
    if (metrics.daysWithoutActivity > 14) {
      indicators.push({
        type: 'STALE',
        severity: metrics.daysWithoutActivity > 30 ? 'high' : 'medium',
        message: `Fără activitate de ${metrics.daysWithoutActivity} zile`,
      });
    }

    // Overdue tasks
    if (metrics.overdueTaskCount > 0) {
      indicators.push({
        type: 'OVERDUE_TASKS',
        severity: 'high',
        message: `${metrics.overdueTaskCount} ${metrics.overdueTaskCount === 1 ? 'sarcină restantă' : 'sarcini restante'}`,
      });
    }

    // Approaching deadline (within 3 days)
    const urgentDeadlines = deadlines.filter((d) => d.daysUntil <= 3);
    if (urgentDeadlines.length > 0) {
      const nearest = urgentDeadlines[0];
      indicators.push({
        type: 'APPROACHING_DEADLINE',
        severity: nearest.daysUntil <= 1 ? 'high' : 'medium',
        message:
          nearest.daysUntil === 0
            ? `Termen astăzi: ${nearest.title}`
            : nearest.daysUntil === 1
              ? `Termen mâine: ${nearest.title}`
              : `Termen în ${nearest.daysUntil} zile: ${nearest.title}`,
      });
    }

    // Unanswered emails (5+ unread)
    if (metrics.unreadEmailCount >= 5) {
      indicators.push({
        type: 'UNANSWERED_EMAILS',
        severity: metrics.unreadEmailCount >= 10 ? 'high' : 'medium',
        message: `${metrics.unreadEmailCount} emailuri necitite`,
      });
    }

    return indicators;
  }

  /**
   * Format comprehensive briefing text (~2000-4000 tokens)
   */
  private formatBriefingText(data: {
    caseTitle: string;
    caseStatus: string;
    briefingData: Awaited<ReturnType<typeof caseBriefingService.getBriefing>>;
    documents: Awaited<ReturnType<typeof documentSummaryService.getForCase>>;
    emails: Awaited<ReturnType<typeof emailContextService.getForCase>>;
    client: Awaited<ReturnType<typeof clientContextService.getForClient>> | null;
    deadlines: UpcomingDeadline[];
    healthIndicators: HealthIndicator[];
  }): string {
    const lines: string[] = [];

    // ========== Case Header ==========
    lines.push(`# Dosar: ${data.caseTitle}`);
    lines.push(`Status: ${this.translateStatus(data.caseStatus)}`);

    if (data.briefingData.caseNumber) {
      lines.push(`Număr: ${data.briefingData.caseNumber}`);
    }
    if (data.briefingData.court) {
      lines.push(`Instanță: ${data.briefingData.court}`);
    }
    lines.push('');

    // ========== Health Alerts ==========
    if (data.healthIndicators.length > 0) {
      lines.push('## ⚠️ Alerte');
      for (const indicator of data.healthIndicators) {
        const icon = indicator.severity === 'high' ? '🔴' : '🟡';
        lines.push(`${icon} ${indicator.message}`);
      }
      lines.push('');
    }

    // ========== Parties ==========
    if (data.briefingData.parties.length > 0) {
      lines.push('## Părți');
      for (const party of data.briefingData.parties) {
        const clientMark = party.isClient ? ' **(client)**' : '';
        lines.push(`- ${party.role}: ${party.name}${clientMark}`);
      }
      lines.push('');
    }

    // ========== Deadlines ==========
    if (data.deadlines.length > 0) {
      lines.push('## Termene apropiate');
      for (const deadline of data.deadlines.slice(0, 5)) {
        try {
          const dateStr = format(new Date(deadline.dueAt), 'd MMMM yyyy', { locale: ro });
          const urgency = deadline.daysUntil <= 3 ? '⚡' : '';
          lines.push(`- ${urgency}${dateStr}: ${deadline.title}`);
        } catch {
          lines.push(`- ${deadline.title}`);
        }
      }
      lines.push('');
    }

    // ========== Documents ==========
    if (data.documents.length > 0) {
      lines.push(`## Documente cheie (${data.documents.length})`);
      for (const doc of data.documents.slice(0, 8)) {
        const priority = doc.score >= 60 ? '★' : doc.score >= 40 ? '◆' : '◇';
        lines.push(`${priority} **${doc.fileName}**: ${doc.summary}`);
      }
      lines.push('');
    }

    // ========== Emails ==========
    if (data.emails.threads.length > 0) {
      lines.push(`## Corespondență recentă (${data.emails.threads.length} fire)`);
      if (data.emails.unreadCount > 0) {
        lines.push(`*${data.emails.unreadCount} necitite*`);
      }
      for (const thread of data.emails.threads.slice(0, 5)) {
        const urgentFlag = thread.isUrgent ? '⚠️ ' : '';
        const unreadFlag = thread.isUnread ? '● ' : '';
        lines.push(`- ${unreadFlag}${urgentFlag}**${thread.subject}**`);
        if (thread.summary) {
          lines.push(`  ${thread.summary}`);
        }
      }
      if (data.emails.pendingActionItems.length > 0) {
        lines.push('');
        lines.push('**Acțiuni din emailuri:**');
        for (const item of data.emails.pendingActionItems.slice(0, 3)) {
          lines.push(`- ${item}`);
        }
      }
      lines.push('');
    }

    // ========== Client Context ==========
    if (data.client) {
      lines.push('## Context client');
      lines.push(`Client: **${data.client.name}**`);
      lines.push(
        `Dosare: ${data.client.activeCaseCount} active, ${data.client.closedCaseCount} închise`
      );
      if (data.client.casesByType.length > 0) {
        const typesSummary = data.client.casesByType
          .slice(0, 3)
          .map((t) => `${t.type} (${t.count})`)
          .join(', ');
        lines.push(`Tipuri: ${typesSummary}`);
      }
      if (data.client.primaryContacts.length > 0) {
        lines.push('Contacte principale:');
        for (const contact of data.client.primaryContacts.slice(0, 2)) {
          lines.push(`- ${contact.name} (${contact.role})`);
        }
      }
      lines.push('');
    }

    // ========== Summary Stats ==========
    lines.push('## Conținut');
    lines.push(`- Documente: ${data.briefingData.documentCount}`);
    const unreadSuffix =
      data.briefingData.unreadEmailCount > 0
        ? ` (${data.briefingData.unreadEmailCount} necitite)`
        : '';
    lines.push(`- Emailuri: ${data.briefingData.emailCount}${unreadSuffix}`);
    lines.push(`- Sarcini active: ${data.briefingData.pendingTaskCount}`);

    return lines.join('\n');
  }

  /**
   * Translate case status to Romanian
   */
  private translateStatus(status: string): string {
    const translations: Record<string, string> = {
      Active: 'Activ',
      Pending: 'În așteptare',
      Closed: 'Închis',
      OnHold: 'Suspendat',
      Suspended: 'Suspendat',
      Archived: 'Arhivat',
      PendingApproval: 'În aprobare',
    };
    return translations[status] || status;
  }

  /**
   * Translate actor role to Romanian
   */
  private translateRole(role: string): string {
    const translations: Record<string, string> = {
      Client: 'Client',
      OpposingParty: 'Parte adversă',
      OpposingCounsel: 'Avocat adversar',
      Witness: 'Martor',
      Expert: 'Expert',
      Other: 'Altul',
      LegalRepresentative: 'Reprezentant legal',
      Court: 'Instanță',
      Intervenient: 'Intervenient',
      Mandatar: 'Mandatar',
      Executor: 'Executor',
      Notar: 'Notar',
      Mediator: 'Mediator',
      Administrator: 'Administrator',
      Lichidator: 'Lichidator',
    };
    return translations[role] || role;
  }
}

// Export singleton instance
export const caseContextProcessor = new CaseContextProcessor();
