/**
 * Flipboard Agent Tool Handlers
 *
 * Implements the tools for the user-scoped Flipboard agent.
 * Partners see all firm cases; others see only their assigned cases.
 */

import { prisma, Prisma } from '@legal-platform/database';
import { ToolHandler } from './ai-client.service';
import {
  FlipboardAgentContext,
  PendingActionsOutput,
  PendingActionItem,
  CaseAlertsOutput,
  CaseAlertItem,
  CaseNewsOutput,
  CaseNewsItem,
  FlipboardAgentOutput,
  FlipboardItem,
  FLIPBOARD_CONSTRAINTS,
} from './flipboard-agent.types';
import logger from '../utils/logger';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_LIMIT = 20;
const DEFAULT_HOURS_BACK = 168; // 7 days - extended for better coverage

// ============================================================================
// Helper Functions
// ============================================================================

function formatDate(date: Date | null | undefined): string {
  if (!date) return 'N/A';
  return date.toLocaleDateString('ro-RO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateTime(date: Date | null | undefined): string {
  if (!date) return 'N/A';
  return date.toLocaleString('ro-RO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function daysBetween(date1: Date, date2: Date): number {
  const diffTime = date2.getTime() - date1.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function hoursBetween(date1: Date, date2: Date): number {
  const diffTime = date2.getTime() - date1.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60));
}

/**
 * Get the case IDs visible to the user.
 * Partners see all firm cases; others see only assigned cases.
 */
async function getUserCaseIds(
  userId: string,
  firmId: string,
  isPartner: boolean
): Promise<string[]> {
  if (isPartner) {
    // Partners see all active firm cases
    const cases = await prisma.case.findMany({
      where: {
        firmId,
        status: 'Active',
      },
      select: { id: true },
    });
    logger.debug('Flipboard: Partner case lookup', {
      userId,
      isPartner: true,
      caseCount: cases.length,
    });
    return cases.map((c) => c.id);
  }

  // Non-partners see only cases they're assigned to
  const assignments = await prisma.caseTeam.findMany({
    where: {
      userId,
      case: { firmId, status: 'Active' },
    },
    select: { caseId: true },
  });
  logger.debug('Flipboard: Non-partner case lookup', {
    userId,
    isPartner: false,
    caseCount: assignments.length,
  });
  return assignments.map((a) => a.caseId);
}

/**
 * Format error result for the agent.
 */
function errorResult(code: string, message: string): string {
  return `[TOOL_ERROR]
code: ${code}
message: ${message}
[/TOOL_ERROR]`;
}

// ============================================================================
// Tool 1: Read My Pending Actions
// ============================================================================

export async function handleReadMyPendingActions(
  input: Record<string, unknown>,
  ctx: FlipboardAgentContext
): Promise<string> {
  const limit = Math.min((input.limit as number) ?? DEFAULT_LIMIT, 30);
  const includeOverdue = (input.includeOverdue as boolean) ?? true;
  const pendingResponseHours =
    (input.pendingResponseHours as number) ?? FLIPBOARD_CONSTRAINTS.PENDING_RESPONSE_HOURS;

  logger.debug('Flipboard tool: read_my_pending_actions', {
    correlationId: ctx.correlationId,
    userId: ctx.userId,
    limit,
  });

  try {
    const caseIds = await getUserCaseIds(ctx.userId, ctx.firmId, ctx.isPartner);
    if (caseIds.length === 0) {
      return formatPendingActionsOutput({ totalCount: 0, items: [] });
    }

    const now = new Date();
    const pendingThreshold = new Date(now.getTime() - pendingResponseHours * 60 * 60 * 1000);
    const items: PendingActionItem[] = [];

    // 1. Emails awaiting reply (sent emails with no response in same thread)
    // Find outbound emails (folderType = 'sent' or 'Sent') that are old enough
    const pendingEmails = await prisma.email.findMany({
      where: {
        caseLinks: { some: { caseId: { in: caseIds } } },
        userId: ctx.userId,
        folderType: { in: ['sent', 'Sent', 'sentitems', 'SentItems'] },
        sentDateTime: { lte: pendingThreshold },
      },
      include: {
        caseLinks: {
          include: {
            case: { select: { id: true, caseNumber: true, title: true } },
          },
          take: 1,
        },
      },
      orderBy: { sentDateTime: 'asc' },
      take: limit,
    });

    // Filter to only emails without a newer inbound reply in same conversation
    for (const email of pendingEmails) {
      const caseLink = email.caseLinks[0];
      if (!caseLink) continue;

      // Check if there's a newer inbound email in the same conversation
      const hasReply = await prisma.email.findFirst({
        where: {
          conversationId: email.conversationId,
          folderType: { in: ['inbox', 'Inbox'] },
          receivedDateTime: { gt: email.sentDateTime },
        },
      });

      if (hasReply) continue; // Skip if already replied

      const hoursSinceSent = hoursBetween(email.sentDateTime, now);
      items.push({
        id: `pending-reply-${email.id}`,
        type: 'reply',
        description: `Emailul "${email.subject || 'Fără subiect'}" așteaptă răspuns de ${hoursSinceSent} ore`,
        caseId: caseLink.case.id,
        caseNumber: caseLink.case.caseNumber || '',
        caseTitle: caseLink.case.title,
        entityType: 'email_thread',
        entityId: email.conversationId || email.id,
        hoursOverdue: hoursSinceSent - pendingResponseHours,
        priority: hoursSinceSent > pendingResponseHours * 2 ? 'high' : 'medium',
      });
    }

    // 2. Tasks overdue, due today, or upcoming (next 7 days)
    if (includeOverdue) {
      const upcomingDays = FLIPBOARD_CONSTRAINTS.UPCOMING_TASK_DAYS || 7;
      const upcomingDate = new Date();
      upcomingDate.setDate(upcomingDate.getDate() + upcomingDays);
      upcomingDate.setHours(23, 59, 59, 999);

      // Build task filter - partners see all firm tasks, others see only their assigned tasks
      const taskWhere: Prisma.TaskWhereInput = {
        caseId: { in: caseIds },
        status: { not: 'Completed' },
        dueDate: { lte: upcomingDate },
      };

      // Non-partners only see tasks assigned to them
      if (!ctx.isPartner) {
        taskWhere.assignedTo = ctx.userId;
      }

      const tasks = await prisma.task.findMany({
        where: taskWhere,
        include: {
          case: { select: { id: true, caseNumber: true, title: true } },
          assignee: { select: { firstName: true, lastName: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: limit,
      });

      for (const task of tasks) {
        if (!task.case) continue;

        const isOverdue = task.dueDate && task.dueDate < now;
        const daysOverdue = task.dueDate ? daysBetween(task.dueDate, now) : 0;
        const daysUntil = task.dueDate ? daysBetween(now, task.dueDate) : 0;

        let description = task.title;
        if (isOverdue) {
          description += ` (întârziat ${daysOverdue} zile)`;
        } else if (daysUntil === 0) {
          description += ' (scadent azi)';
        } else {
          description += ` (în ${daysUntil} zile)`;
        }

        // For partners viewing others' tasks, add assignee info
        if (ctx.isPartner && task.assignedTo !== ctx.userId && task.assignee) {
          description += ` - ${task.assignee.firstName} ${task.assignee.lastName}`;
        }

        items.push({
          id: `task-${task.id}`,
          type: 'complete',
          description,
          caseId: task.case.id,
          caseNumber: task.case.caseNumber || '',
          caseTitle: task.case.title,
          entityType: 'task',
          entityId: task.id,
          dueDate: task.dueDate?.toISOString(),
          hoursOverdue: isOverdue ? daysOverdue * 24 : 0,
          priority: isOverdue ? 'high' : daysUntil <= 1 ? 'medium' : 'low',
        });
      }
    }

    // 3. Documents pending review - DocumentReview model doesn't exist
    // Skip this section for now - could be implemented with Document.status check if needed

    // 4. Extracted questions pending answer
    const pendingQuestions = await prisma.extractedQuestion.findMany({
      where: {
        caseId: { in: caseIds },
        status: 'Pending',
        isAnswered: false,
      },
      include: {
        case: { select: { id: true, caseNumber: true, title: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    for (const question of pendingQuestions) {
      items.push({
        id: `question-${question.id}`,
        type: 'other',
        description: `Întrebare fără răspuns: ${question.questionText.slice(0, 100)}...`,
        caseId: question.case.id,
        caseNumber: question.case.caseNumber || '',
        caseTitle: question.case.title,
        entityType: 'case',
        entityId: question.caseId,
        priority: 'low',
      });
    }

    // Sort by priority and limit
    items.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    const output: PendingActionsOutput = {
      totalCount: items.length,
      items: items.slice(0, limit),
    };

    return formatPendingActionsOutput(output);
  } catch (error) {
    logger.error('Flipboard tool error: read_my_pending_actions', {
      error: error instanceof Error ? error.message : String(error),
      userId: ctx.userId,
    });
    return errorResult('QUERY_FAILED', 'Nu am putut citi acțiunile în așteptare');
  }
}

function formatPendingActionsOutput(output: PendingActionsOutput): string {
  if (output.totalCount === 0) {
    return `# Acțiuni în Așteptare

Nu există acțiuni în așteptare. Toate sarcinile sunt la zi!`;
  }

  const lines: string[] = [`# Acțiuni în Așteptare (${output.totalCount})\n`];

  const byPriority = {
    high: output.items.filter((i) => i.priority === 'high'),
    medium: output.items.filter((i) => i.priority === 'medium'),
    low: output.items.filter((i) => i.priority === 'low'),
  };

  if (byPriority.high.length > 0) {
    lines.push('## 🔴 Prioritate Ridicată');
    for (const item of byPriority.high) {
      lines.push(
        `- [${item.type.toUpperCase()}] ${item.description} | Dosar: ${item.caseNumber || item.caseTitle} | ID: ${item.entityId}`
      );
    }
    lines.push('');
  }

  if (byPriority.medium.length > 0) {
    lines.push('## 🟡 Prioritate Medie');
    for (const item of byPriority.medium) {
      lines.push(
        `- [${item.type.toUpperCase()}] ${item.description} | Dosar: ${item.caseNumber || item.caseTitle} | ID: ${item.entityId}`
      );
    }
    lines.push('');
  }

  if (byPriority.low.length > 0) {
    lines.push('## 🟢 Prioritate Scăzută');
    for (const item of byPriority.low) {
      lines.push(
        `- [${item.type.toUpperCase()}] ${item.description} | Dosar: ${item.caseNumber || item.caseTitle} | ID: ${item.entityId}`
      );
    }
  }

  return lines.join('\n');
}

// ============================================================================
// Tool 2: Read My Case Alerts
// ============================================================================

export async function handleReadMyCaseAlerts(
  input: Record<string, unknown>,
  ctx: FlipboardAgentContext
): Promise<string> {
  const limit = Math.min((input.limit as number) ?? 15, 30);
  const deadlineDays =
    (input.deadlineDays as number) ?? FLIPBOARD_CONSTRAINTS.DEADLINE_WARNING_DAYS;
  const includeHealthAlerts = (input.includeHealthAlerts as boolean) ?? true;
  const communicationGapDays =
    (input.communicationGapDays as number) ?? FLIPBOARD_CONSTRAINTS.COMMUNICATION_GAP_DAYS;

  logger.debug('Flipboard tool: read_my_case_alerts', {
    correlationId: ctx.correlationId,
    userId: ctx.userId,
    deadlineDays,
  });

  try {
    const caseIds = await getUserCaseIds(ctx.userId, ctx.firmId, ctx.isPartner);
    if (caseIds.length === 0) {
      return formatCaseAlertsOutput({ totalCount: 0, items: [] });
    }

    const now = new Date();
    const deadlineThreshold = new Date(now.getTime() + deadlineDays * 24 * 60 * 60 * 1000);
    const communicationThreshold = new Date(
      now.getTime() - communicationGapDays * 24 * 60 * 60 * 1000
    );
    const items: CaseAlertItem[] = [];

    // 1. Approaching deadlines (tasks with dueDate in next N days)
    const upcomingDeadlines = await prisma.task.findMany({
      where: {
        caseId: { in: caseIds },
        status: { not: 'Completed' },
        dueDate: {
          gte: now,
          lte: deadlineThreshold,
        },
      },
      include: {
        case: { select: { id: true, caseNumber: true, title: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: limit,
    });

    for (const task of upcomingDeadlines) {
      const daysUntil = task.dueDate ? daysBetween(now, task.dueDate) : 0;
      const severity =
        daysUntil <= 1 ? 'critical' : daysUntil <= 3 ? 'high' : daysUntil <= 5 ? 'medium' : 'low';

      items.push({
        id: `deadline-${task.id}`,
        type: 'deadline',
        severity,
        message: `Termen în ${daysUntil} ${daysUntil === 1 ? 'zi' : 'zile'}: ${task.title}`,
        caseId: task.case.id,
        caseNumber: task.case.caseNumber || '',
        caseTitle: task.case.title,
        entityType: 'deadline',
        entityId: task.id,
        dueDate: task.dueDate?.toISOString(),
        daysUntil,
      });
    }

    // 2. Cases with low health score (from CaseHealthScore relation)
    if (includeHealthAlerts) {
      // Get latest health scores for user's cases
      const healthScores = await prisma.caseHealthScore.findMany({
        where: {
          caseId: { in: caseIds },
          score: { lt: 50 }, // Score is 0-100, so 50 = 50%
        },
        include: {
          case: { select: { id: true, caseNumber: true, title: true } },
        },
        orderBy: { calculatedAt: 'desc' },
        distinct: ['caseId'], // Only latest per case
        take: limit,
      });

      for (const hs of healthScores) {
        items.push({
          id: `health-${hs.case.id}`,
          type: 'health',
          severity: hs.score < 25 ? 'critical' : hs.score < 40 ? 'high' : 'medium',
          message: `Scor sănătate scăzut (${hs.score}%) - necesită atenție`,
          caseId: hs.case.id,
          caseNumber: hs.case.caseNumber || '',
          caseTitle: hs.case.title,
          entityType: 'case',
          entityId: hs.case.id,
        });
      }
    }

    // 3. Communication gaps (cases with no recent activity)
    // Check both caseActivityEntry AND case.updatedAt as fallback
    const casesWithActivity = await prisma.caseActivityEntry.groupBy({
      by: ['caseId'],
      where: {
        caseId: { in: caseIds },
        createdAt: { gte: communicationThreshold },
      },
    });
    const activeCaseIds = new Set(casesWithActivity.map((a) => a.caseId));

    // Get potentially inactive cases and check their updatedAt as fallback
    const potentiallyInactiveCases = await prisma.case.findMany({
      where: {
        id: { in: caseIds.filter((id) => !activeCaseIds.has(id)) },
      },
      select: {
        id: true,
        caseNumber: true,
        title: true,
        updatedAt: true,
        client: { select: { name: true } },
      },
      take: limit * 2, // Get more to filter after updatedAt check
    });

    // Filter to only truly inactive cases (no activity entries AND old updatedAt)
    const inactiveCases = potentiallyInactiveCases.filter(
      (c) => c.updatedAt < communicationThreshold
    );

    for (const c of inactiveCases.slice(0, limit)) {
      const daysSinceUpdate = daysBetween(c.updatedAt, now);
      items.push({
        id: `comm-gap-${c.id}`,
        type: 'communication',
        severity: daysSinceUpdate > 21 ? 'high' : 'medium',
        message: `Fără activitate de ${daysSinceUpdate} zile${c.client ? ` - Client: ${c.client.name}` : ''}`,
        caseId: c.id,
        caseNumber: c.caseNumber || '',
        caseTitle: c.title,
        entityType: 'case',
        entityId: c.id,
      });
    }

    // 4. Risk indicators
    const riskIndicators = await prisma.riskIndicator.findMany({
      where: {
        caseId: { in: caseIds },
        isResolved: false,
      },
      include: {
        case: { select: { id: true, caseNumber: true, title: true } },
      },
      orderBy: { severity: 'desc' },
      take: limit,
    });

    for (const risk of riskIndicators) {
      const severityMap: Record<string, CaseAlertItem['severity']> = {
        Critical: 'critical',
        High: 'high',
        Medium: 'medium',
        Low: 'low',
      };
      items.push({
        id: `risk-${risk.id}`,
        type: 'risk',
        severity: severityMap[risk.severity] || 'medium',
        message: risk.description,
        caseId: risk.case.id,
        caseNumber: risk.case.caseNumber || '',
        caseTitle: risk.case.title,
        entityType: 'case',
        entityId: risk.caseId,
      });
    }

    // Sort by severity and limit
    items.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    const output: CaseAlertsOutput = {
      totalCount: items.length,
      items: items.slice(0, limit),
    };

    return formatCaseAlertsOutput(output);
  } catch (error) {
    logger.error('Flipboard tool error: read_my_case_alerts', {
      error: error instanceof Error ? error.message : String(error),
      userId: ctx.userId,
    });
    return errorResult('QUERY_FAILED', 'Nu am putut citi alertele');
  }
}

function formatCaseAlertsOutput(output: CaseAlertsOutput): string {
  if (output.totalCount === 0) {
    return `# Alerte Dosare

Nu există alerte active. Toate dosarele sunt în parametri normali!`;
  }

  const lines: string[] = [`# Alerte Dosare (${output.totalCount})\n`];

  const bySeverity = {
    critical: output.items.filter((i) => i.severity === 'critical'),
    high: output.items.filter((i) => i.severity === 'high'),
    medium: output.items.filter((i) => i.severity === 'medium'),
    low: output.items.filter((i) => i.severity === 'low'),
  };

  if (bySeverity.critical.length > 0) {
    lines.push('## 🚨 CRITIC');
    for (const item of bySeverity.critical) {
      lines.push(
        `- [${item.type.toUpperCase()}] ${item.message} | Dosar: ${item.caseNumber || item.caseTitle} | ID: ${item.entityId}${item.daysUntil !== undefined ? ` | Zile: ${item.daysUntil}` : ''}`
      );
    }
    lines.push('');
  }

  if (bySeverity.high.length > 0) {
    lines.push('## 🔴 Ridicat');
    for (const item of bySeverity.high) {
      lines.push(
        `- [${item.type.toUpperCase()}] ${item.message} | Dosar: ${item.caseNumber || item.caseTitle} | ID: ${item.entityId}${item.daysUntil !== undefined ? ` | Zile: ${item.daysUntil}` : ''}`
      );
    }
    lines.push('');
  }

  if (bySeverity.medium.length > 0) {
    lines.push('## 🟡 Mediu');
    for (const item of bySeverity.medium) {
      lines.push(
        `- [${item.type.toUpperCase()}] ${item.message} | Dosar: ${item.caseNumber || item.caseTitle} | ID: ${item.entityId}`
      );
    }
    lines.push('');
  }

  if (bySeverity.low.length > 0) {
    lines.push('## 🟢 Scăzut');
    for (const item of bySeverity.low) {
      lines.push(
        `- [${item.type.toUpperCase()}] ${item.message} | Dosar: ${item.caseNumber || item.caseTitle} | ID: ${item.entityId}`
      );
    }
  }

  return lines.join('\n');
}

// ============================================================================
// Tool 3: Read My Case News
// ============================================================================

export async function handleReadMyCaseNews(
  input: Record<string, unknown>,
  ctx: FlipboardAgentContext
): Promise<string> {
  const limit = Math.min((input.limit as number) ?? DEFAULT_LIMIT, 50);
  const hoursBack = (input.hoursBack as number) ?? DEFAULT_HOURS_BACK;
  const includeCourtEmails = (input.includeCourtEmails as boolean) ?? true;

  logger.debug('Flipboard tool: read_my_case_news', {
    correlationId: ctx.correlationId,
    userId: ctx.userId,
    hoursBack,
  });

  try {
    const caseIds = await getUserCaseIds(ctx.userId, ctx.firmId, ctx.isPartner);
    if (caseIds.length === 0) {
      return formatCaseNewsOutput({ totalCount: 0, items: [] });
    }

    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    const items: CaseNewsItem[] = [];

    // 1. Recent inbound emails (inbox folder)
    const recentEmails = await prisma.email.findMany({
      where: {
        caseLinks: { some: { caseId: { in: caseIds } } },
        folderType: { in: ['inbox', 'Inbox'] },
        receivedDateTime: { gte: since },
      },
      include: {
        caseLinks: {
          include: {
            case: { select: { id: true, caseNumber: true, title: true } },
          },
          take: 1,
        },
      },
      orderBy: { receivedDateTime: 'desc' },
      take: limit,
    });

    // Court email domains for detection
    const courtDomains = ['just.ro', 'mpublic.ro', 'mai.gov.ro', 'anaf.ro'];

    for (const email of recentEmails) {
      const caseLink = email.caseLinks[0];
      if (!caseLink) continue;

      // Extract sender info from JSON 'from' field
      const fromData = email.from as { emailAddress?: { address?: string; name?: string } } | null;
      const fromEmail = fromData?.emailAddress?.address || '';
      const fromName = fromData?.emailAddress?.name || fromEmail;

      const isFromCourt =
        includeCourtEmails && fromEmail && courtDomains.some((d) => fromEmail.includes(d));

      items.push({
        id: `email-${email.id}`,
        type: isFromCourt ? 'email_from_court' : 'email_received',
        description: `${isFromCourt ? '⚖️ Email instanță: ' : 'Email primit: '}${email.subject || 'Fără subiect'}`,
        caseId: caseLink.case.id,
        caseNumber: caseLink.case.caseNumber || '',
        caseTitle: caseLink.case.title,
        entityType: 'email_thread',
        entityId: email.conversationId || email.id,
        actorName: fromName || undefined,
        occurredAt: email.receivedDateTime.toISOString(),
        isHighPriority: isFromCourt,
      });
    }

    // 2. Documents uploaded (not by current user)
    const recentDocs = await prisma.caseDocument.findMany({
      where: {
        caseId: { in: caseIds },
        linkedAt: { gte: since },
        linkedBy: { not: ctx.userId },
      },
      include: {
        case: { select: { id: true, caseNumber: true, title: true } },
        document: { select: { id: true, fileName: true } },
        linker: { select: { firstName: true, lastName: true } },
      },
      orderBy: { linkedAt: 'desc' },
      take: limit,
    });

    for (const doc of recentDocs) {
      if (!doc.case) continue; // Skip documents without case

      items.push({
        id: `doc-${doc.document.id}`,
        type: 'document_uploaded',
        description: `Document încărcat: ${doc.document.fileName}`,
        caseId: doc.case.id,
        caseNumber: doc.case.caseNumber || '',
        caseTitle: doc.case.title,
        entityType: 'document',
        entityId: doc.document.id,
        actorName: doc.linker ? `${doc.linker.firstName} ${doc.linker.lastName}` : undefined,
        occurredAt: doc.linkedAt.toISOString(),
        isHighPriority: false,
      });
    }

    // 3. Tasks completed by others (assigned to someone else but in user's cases)
    const completedTasks = await prisma.task.findMany({
      where: {
        caseId: { in: caseIds },
        status: 'Completed',
        completedAt: { gte: since },
        assignedTo: { not: ctx.userId }, // Not assigned to current user
      },
      include: {
        case: { select: { id: true, caseNumber: true, title: true } },
        assignee: { select: { firstName: true, lastName: true } },
      },
      orderBy: { completedAt: 'desc' },
      take: limit,
    });

    for (const task of completedTasks) {
      if (!task.case) continue;

      items.push({
        id: `task-done-${task.id}`,
        type: 'task_completed',
        description: `Task finalizat: ${task.title}`,
        caseId: task.case.id,
        caseNumber: task.case.caseNumber || '',
        caseTitle: task.case.title,
        entityType: 'task',
        entityId: task.id,
        actorName: task.assignee
          ? `${task.assignee.firstName} ${task.assignee.lastName}`
          : undefined,
        occurredAt: task.completedAt!.toISOString(),
        isHighPriority: false,
      });
    }

    // 4. Case activity entries (tasks, documents, communications)
    const recentActivity = await prisma.caseActivityEntry.findMany({
      where: {
        caseId: { in: caseIds },
        createdAt: { gte: since },
        activityType: {
          in: [
            'TaskCreated',
            'TaskStatusChanged',
            'DocumentUploaded',
            'CommunicationReceived',
            'DeadlineApproaching',
          ],
        },
        actorId: { not: ctx.userId },
      },
      include: {
        case: { select: { id: true, caseNumber: true, title: true } },
        actor: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    for (const activity of recentActivity) {
      const typeMap: Record<string, CaseNewsItem['type']> = {
        TaskCreated: 'status_changed',
        TaskStatusChanged: 'status_changed',
        DocumentUploaded: 'document_uploaded',
        CommunicationReceived: 'email_received',
        DeadlineApproaching: 'hearing_scheduled',
      };

      items.push({
        id: `activity-${activity.id}`,
        type: typeMap[activity.activityType] || 'status_changed',
        description: activity.title,
        caseId: activity.case.id,
        caseNumber: activity.case.caseNumber || '',
        caseTitle: activity.case.title,
        entityType: 'case',
        entityId: activity.caseId,
        actorName: activity.actor
          ? `${activity.actor.firstName} ${activity.actor.lastName}`
          : undefined,
        occurredAt: activity.createdAt.toISOString(),
        isHighPriority: activity.activityType === 'DeadlineApproaching',
      });
    }

    // 5. Count of recent unlinked inbox emails (for awareness)
    const unlinkedEmailCount = await prisma.email.count({
      where: {
        userId: ctx.userId,
        folderType: { in: ['inbox', 'Inbox'] },
        receivedDateTime: { gte: since },
        caseLinks: { none: {} },
      },
    });

    // Sort by priority and time
    items.sort((a, b) => {
      if (a.isHighPriority !== b.isHighPriority) {
        return a.isHighPriority ? -1 : 1;
      }
      return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
    });

    const output: CaseNewsOutput = {
      totalCount: items.length,
      items: items.slice(0, limit),
    };

    return formatCaseNewsOutput(output, unlinkedEmailCount);
  } catch (error) {
    logger.error('Flipboard tool error: read_my_case_news', {
      error: error instanceof Error ? error.message : String(error),
      userId: ctx.userId,
    });
    return errorResult('QUERY_FAILED', 'Nu am putut citi noutățile');
  }
}

function formatCaseNewsOutput(output: CaseNewsOutput, unlinkedEmailCount = 0): string {
  const lines: string[] = [];

  if (output.totalCount === 0 && unlinkedEmailCount === 0) {
    return `# Noutăți Dosare

Nu există noutăți în ultima săptămână.`;
  }

  lines.push(`# Noutăți Dosare (${output.totalCount})\n`);

  const highPriority = output.items.filter((i) => i.isHighPriority);
  const regular = output.items.filter((i) => !i.isHighPriority);

  if (highPriority.length > 0) {
    lines.push('## ⚡ Prioritare');
    for (const item of highPriority) {
      lines.push(
        `- [${item.type.toUpperCase()}] ${item.description} | Dosar: ${item.caseNumber || item.caseTitle} | ID: ${item.entityId}${item.actorName ? ` | De la: ${item.actorName}` : ''}`
      );
    }
    lines.push('');
  }

  if (regular.length > 0) {
    lines.push('## 📰 Actualizări');
    for (const item of regular) {
      lines.push(
        `- [${item.type.toUpperCase()}] ${item.description} | Dosar: ${item.caseNumber || item.caseTitle} | ID: ${item.entityId}${item.actorName ? ` | De la: ${item.actorName}` : ''}`
      );
    }
    lines.push('');
  }

  // Add unlinked emails info if any exist
  if (unlinkedEmailCount > 0) {
    lines.push('## 📧 Emailuri Neasociate');
    lines.push(
      `Ai **${unlinkedEmailCount} emailuri** din ultima săptămână care nu sunt asociate cu niciun dosar.`
    );
    lines.push('Consideră să le revizuiești și să le asociezi dosarelor relevante.');
  }

  return lines.join('\n');
}

// ============================================================================
// Tool 4: Read Firm Overview
// ============================================================================

export async function handleReadFirmOverview(
  input: Record<string, unknown>,
  ctx: FlipboardAgentContext
): Promise<string> {
  logger.debug('Flipboard tool: read_firm_overview', {
    correlationId: ctx.correlationId,
    userId: ctx.userId,
  });

  try {
    const caseIds = await getUserCaseIds(ctx.userId, ctx.firmId, ctx.isPartner);

    // Get counts and stats
    const [
      activeCasesCount,
      totalTasksCount,
      completedTasksCount,
      overdueTasksCount,
      upcomingDeadlinesCount,
      clientsCount,
      recentActivityCount,
    ] = await Promise.all([
      prisma.case.count({ where: { id: { in: caseIds }, status: 'Active' } }),
      prisma.task.count({ where: { caseId: { in: caseIds }, status: { not: 'Completed' } } }),
      prisma.task.count({
        where: {
          caseId: { in: caseIds },
          status: 'Completed',
          completedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.task.count({
        where: {
          caseId: { in: caseIds },
          status: { not: 'Completed' },
          dueDate: { lt: new Date() },
        },
      }),
      prisma.task.count({
        where: {
          caseId: { in: caseIds },
          status: { not: 'Completed' },
          dueDate: {
            gte: new Date(),
            lte: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.client.count({
        where: { cases: { some: { id: { in: caseIds } } } },
      }),
      prisma.caseActivityEntry.count({
        where: {
          caseId: { in: caseIds },
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    // Get recent cases
    const recentCases = await prisma.case.findMany({
      where: { id: { in: caseIds }, status: 'Active' },
      select: {
        id: true,
        caseNumber: true,
        title: true,
        client: { select: { name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const lines: string[] = [
      '# Prezentare Generală Firmă\n',
      '## Statistici',
      `- **Dosare active**: ${activeCasesCount}`,
      `- **Sarcini în lucru**: ${totalTasksCount}`,
      `- **Sarcini finalizate (săptămâna aceasta)**: ${completedTasksCount}`,
      `- **Sarcini întârziate**: ${overdueTasksCount}`,
      `- **Termene în 2 săptămâni**: ${upcomingDeadlinesCount}`,
      `- **Clienți activi**: ${clientsCount}`,
      `- **Activități (7 zile)**: ${recentActivityCount}`,
      '',
      '## Dosare Recente',
    ];

    for (const c of recentCases) {
      lines.push(
        `- ${c.caseNumber || c.title} | Client: ${c.client?.name || 'N/A'} | Creat: ${formatDate(c.createdAt)} | ID: ${c.id}`
      );
    }

    return lines.join('\n');
  } catch (error) {
    logger.error('Flipboard tool error: read_firm_overview', {
      error: error instanceof Error ? error.message : String(error),
      userId: ctx.userId,
    });
    return errorResult('QUERY_FAILED', 'Nu am putut citi prezentarea firmei');
  }
}

// ============================================================================
// Tool 5: Read Active Cases
// ============================================================================

export async function handleReadActiveCases(
  input: Record<string, unknown>,
  ctx: FlipboardAgentContext
): Promise<string> {
  const limit = Math.min((input.limit as number) ?? 10, 20);
  const sortBy = (input.sortBy as string) ?? 'recent_activity';

  logger.debug('Flipboard tool: read_active_cases', {
    correlationId: ctx.correlationId,
    userId: ctx.userId,
    limit,
    sortBy,
  });

  try {
    const caseIds = await getUserCaseIds(ctx.userId, ctx.firmId, ctx.isPartner);
    if (caseIds.length === 0) {
      return '# Dosare Active\n\nNu există dosare active.';
    }

    // Get cases with details
    const cases = await prisma.case.findMany({
      where: { id: { in: caseIds }, status: 'Active' },
      include: {
        client: { select: { name: true } },
        teamMembers: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: sortBy === 'created_at' ? { createdAt: 'desc' } : { updatedAt: 'desc' },
      take: limit,
    });

    // Get task counts separately
    const taskCounts = await prisma.task.groupBy({
      by: ['caseId'],
      where: {
        caseId: { in: cases.map((c) => c.id) },
        status: { not: 'Completed' },
      },
      _count: { id: true },
    });
    const taskCountMap = new Map(taskCounts.map((t) => [t.caseId, t._count.id]));

    const lines: string[] = [`# Dosare Active (${cases.length})\n`];

    for (const c of cases) {
      const team = c.teamMembers
        .map((t) => `${t.user.firstName} ${t.user.lastName} (${t.role})`)
        .join(', ');

      lines.push(`## ${c.caseNumber || c.title}`);
      lines.push(`- **Client**: ${c.client?.name || 'N/A'}`);
      lines.push(`- **Tip**: ${c.type || 'N/A'}`);
      lines.push(`- **Creat**: ${formatDate(c.createdAt)}`);
      lines.push(`- **Sarcini active**: ${taskCountMap.get(c.id) || 0}`);
      lines.push(`- **Echipă**: ${team || 'N/A'}`);
      lines.push(`- **ID**: ${c.id}`);
      lines.push('');
    }

    return lines.join('\n');
  } catch (error) {
    logger.error('Flipboard tool error: read_active_cases', {
      error: error instanceof Error ? error.message : String(error),
      userId: ctx.userId,
    });
    return errorResult('QUERY_FAILED', 'Nu am putut citi dosarele active');
  }
}

// ============================================================================
// Tool 6: Read Upcoming Events
// ============================================================================

export async function handleReadUpcomingEvents(
  input: Record<string, unknown>,
  ctx: FlipboardAgentContext
): Promise<string> {
  const daysAhead = (input.daysAhead as number) ?? 14;
  const limit = Math.min((input.limit as number) ?? 15, 30);

  logger.debug('Flipboard tool: read_upcoming_events', {
    correlationId: ctx.correlationId,
    userId: ctx.userId,
    daysAhead,
  });

  try {
    const caseIds = await getUserCaseIds(ctx.userId, ctx.firmId, ctx.isPartner);
    const futureDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
    const now = new Date();

    // Get tasks with due dates (as events/deadlines)
    const upcomingTasks = await prisma.task.findMany({
      where: {
        caseId: { in: caseIds },
        status: { not: 'Completed' },
        dueDate: { gte: now, lte: futureDate },
      },
      include: {
        case: { select: { id: true, caseNumber: true, title: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: limit,
    });

    // Get extracted deadlines for additional calendar-like events
    const extractedDeadlines = await prisma.extractedDeadline.findMany({
      where: {
        caseId: { in: caseIds },
        dueDate: { gte: now, lte: futureDate },
        status: 'Pending',
      },
      include: {
        case: { select: { id: true, caseNumber: true, title: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: limit,
    });

    if (upcomingTasks.length === 0 && extractedDeadlines.length === 0) {
      return (
        '# Evenimente Viitoare\n\nNu există evenimente programate în următoarele ' +
        daysAhead +
        ' zile.'
      );
    }

    const lines: string[] = [`# Evenimente Viitoare (${daysAhead} zile)\n`];

    if (extractedDeadlines.length > 0) {
      lines.push('## 📅 Termene Extrase');
      for (const deadline of extractedDeadlines) {
        const dateStr = deadline.dueDate ? formatDate(deadline.dueDate) : 'N/A';
        const daysUntil = deadline.dueDate ? daysBetween(now, deadline.dueDate) : 0;
        const urgency = daysUntil <= 1 ? '🔴' : daysUntil <= 3 ? '🟡' : '🟢';
        lines.push(
          `- ${urgency} **${deadline.description}** | ${dateStr}${deadline.case ? ` | Dosar: ${deadline.case.caseNumber || deadline.case.title}` : ''} | ID: ${deadline.id}`
        );
      }
      lines.push('');
    }

    if (upcomingTasks.length > 0) {
      lines.push('## 📋 Sarcini Programate');
      for (const task of upcomingTasks) {
        const daysUntil = task.dueDate ? daysBetween(now, task.dueDate) : 0;
        const urgency = daysUntil <= 1 ? '🔴' : daysUntil <= 3 ? '🟡' : '🟢';

        lines.push(
          `- ${urgency} **${task.title}** | În ${daysUntil} zile (${formatDate(task.dueDate)}) | Dosar: ${task.case?.caseNumber || task.case?.title || 'N/A'} | ID: ${task.id}`
        );
      }
    }

    return lines.join('\n');
  } catch (error) {
    logger.error('Flipboard tool error: read_upcoming_events', {
      error: error instanceof Error ? error.message : String(error),
      userId: ctx.userId,
    });
    return errorResult('QUERY_FAILED', 'Nu am putut citi evenimentele viitoare');
  }
}

// ============================================================================
// Factory: Create Tool Handlers
// ============================================================================

/**
 * Create tool handlers for the Flipboard agent.
 */
export function createFlipboardAgentToolHandlers(
  ctx: FlipboardAgentContext
): Record<string, ToolHandler> {
  return {
    read_my_pending_actions: (input: Record<string, unknown>) =>
      handleReadMyPendingActions(input, ctx),
    read_my_case_alerts: (input: Record<string, unknown>) => handleReadMyCaseAlerts(input, ctx),
    read_my_case_news: (input: Record<string, unknown>) => handleReadMyCaseNews(input, ctx),
    read_firm_overview: (input: Record<string, unknown>) => handleReadFirmOverview(input, ctx),
    read_active_cases: (input: Record<string, unknown>) => handleReadActiveCases(input, ctx),
    read_upcoming_events: (input: Record<string, unknown>) => handleReadUpcomingEvents(input, ctx),
  };
}
