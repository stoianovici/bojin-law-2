/**
 * Firm Operations Agent Tool Handlers
 *
 * Implements the 7 read-only tools for the Firm Operations agent.
 * All handlers return formatted strings suitable for LLM consumption.
 * Role-based filtering: partners see all data, others see assigned only.
 */

import { prisma, Prisma } from '@legal-platform/database';
import { CaseActivityType } from '@prisma/client';
import { ToolHandler } from './ai-client.service';
import {
  FirmOperationsToolContext,
  ActiveCasesSummary,
  DeadlinesOverview,
  DeadlineItem,
  EmailStatus,
  PlatformMetrics,
} from './firm-operations.types';
import logger from '../utils/logger';

// ============================================================================
// Constants
// ============================================================================

const MAX_CASES_LIMIT = 50;
const DEFAULT_DAYS_AHEAD = 14;
const DEFAULT_INACTIVE_DAYS = 30;
const DEFAULT_PENDING_RESPONSE_HOURS = 48;

// ============================================================================
// Structured Error Response
// ============================================================================

/**
 * Structured tool result for consistent error handling.
 * The agent can detect errors by checking result.error instead of parsing strings.
 */
export interface ToolResult {
  success: boolean;
  data?: string;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Error codes for tool failures.
 */
export const ToolErrorCode = {
  QUERY_FAILED: 'QUERY_FAILED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

/**
 * Format a successful result for the agent.
 */
function successResult(data: string): string {
  return data;
}

/**
 * Format an error result for the agent.
 * Returns a structured format that the agent can recognize.
 */
function errorResult(code: string, message: string): string {
  return `[TOOL_ERROR]
code: ${code}
message: ${message}
[/TOOL_ERROR]`;
}

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

function getDayOfWeek(date: Date): string {
  return date.toLocaleDateString('ro-RO', { weekday: 'long' });
}

function daysBetween(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function hoursBetween(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60));
}

// ============================================================================
// Tool 1: Read Active Cases Summary
// ============================================================================

export async function handleReadActiveCasesSummary(
  input: Record<string, unknown>,
  ctx: FirmOperationsToolContext
): Promise<string> {
  const limit = Math.min((input.limit as number) ?? 10, MAX_CASES_LIMIT);
  const includeRiskAlerts = (input.includeRiskAlerts as boolean) ?? true;

  logger.debug('Firm operations tool: read_active_cases_summary', {
    correlationId: ctx.correlationId,
    firmId: ctx.firmId,
    isPartner: ctx.isPartner,
    limit,
  });

  // Build where clause based on role
  const baseWhere: Prisma.CaseWhereInput = {
    firmId: ctx.firmId,
    status: 'Active',
  };

  // Non-partners only see cases they're assigned to
  if (!ctx.isPartner) {
    baseWhere.teamMembers = { some: { userId: ctx.userId } };
  }

  // Get total count and cases with related data
  const [totalActive, allCases] = await Promise.all([
    prisma.case.count({ where: baseWhere }),
    prisma.case.findMany({
      where: baseWhere,
      select: {
        id: true,
        caseNumber: true,
        title: true,
        status: true,
        client: { select: { name: true } },
        teamMembers: { select: { user: { select: { firstName: true, lastName: true } } } },
        tasks: {
          where: { status: { not: 'Completed' }, dueDate: { gte: new Date(0) } },
          orderBy: { dueDate: 'asc' },
          take: 1,
          select: { dueDate: true },
        },
        comprehension: { select: { isStale: true } },
        healthScores: {
          orderBy: { calculatedAt: 'desc' },
          take: 1,
          select: { score: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    }),
  ]);

  // Calculate urgency and format
  const urgentCases = allCases.map((c) => {
    // Convert 0-100 score to 0-1 for display
    const rawScore = c.healthScores[0]?.score ?? 100;
    const healthScore = rawScore / 100;
    return {
      id: c.id,
      caseNumber: c.caseNumber,
      title: c.title,
      clientName: c.client?.name || 'N/A',
      healthScore,
      nextDeadline: c.tasks[0]?.dueDate ? formatDate(c.tasks[0].dueDate) : undefined,
      assignedTo: c.teamMembers.map((t) => `${t.user.firstName} ${t.user.lastName}`),
    };
  });

  // Sort by health score (lowest first = most urgent)
  urgentCases.sort((a, b) => a.healthScore - b.healthScore);

  // Get risk alerts (cases with low health score)
  const riskAlerts: ActiveCasesSummary['riskAlerts'] = [];
  if (includeRiskAlerts) {
    for (const c of urgentCases) {
      if (c.healthScore < 0.5) {
        riskAlerts.push({
          caseId: c.id,
          caseNumber: c.caseNumber,
          title: c.title,
          alertType: 'low_health',
          message: `Scor sănătate ${Math.round(c.healthScore * 100)}%`,
        });
      }
    }

    // Check for stale comprehensions
    for (const c of allCases) {
      if (c.comprehension?.isStale) {
        riskAlerts.push({
          caseId: c.id,
          caseNumber: c.caseNumber,
          title: c.title,
          alertType: 'stale_comprehension',
          message: 'Comprehensiunea dosarului este învechită',
        });
      }
    }
  }

  // Format output
  let result = '# Rezumat Dosare Active\n\n';
  result += `**Total dosare active:** ${totalActive}\n\n`;

  if (urgentCases.length > 0) {
    result += '## Top Dosare după Urgență\n\n';
    for (const c of urgentCases) {
      const healthDisplay = c.healthScore < 0.5 ? '⚠️' : c.healthScore < 0.8 ? '🟡' : '✓';
      result += `### ${c.caseNumber}: ${c.title} ${healthDisplay}\n`;
      result += `- **ID:** ${c.id}\n`;
      result += `- **Client:** ${c.clientName}\n`;
      result += `- **Scor sănătate:** ${Math.round(c.healthScore * 100)}%\n`;
      if (c.nextDeadline) {
        result += `- **Următorul termen:** ${c.nextDeadline}\n`;
      }
      result += `- **Echipă:** ${c.assignedTo.join(', ') || 'Neasignat'}\n\n`;
    }
  }

  if (riskAlerts.length > 0) {
    result += '## Alerte de Risc\n\n';
    for (const alert of riskAlerts) {
      result += `- ⚠️ **${alert.caseNumber}** (ID: ${alert.caseId}): ${alert.message}\n`;
    }
  }

  return result;
}

// ============================================================================
// Tool 2: Read Deadlines Overview
// ============================================================================

export async function handleReadDeadlinesOverview(
  input: Record<string, unknown>,
  ctx: FirmOperationsToolContext
): Promise<string> {
  const daysAhead = (input.daysAhead as number) ?? DEFAULT_DAYS_AHEAD;
  const includeConflicts = (input.includeConflicts as boolean) ?? true;

  logger.debug('Firm operations tool: read_deadlines_overview', {
    correlationId: ctx.correlationId,
    firmId: ctx.firmId,
    daysAhead,
  });

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + daysAhead);

  // Build where clause
  const taskWhere: Prisma.TaskWhereInput = {
    firmId: ctx.firmId,
    dueDate: { gte: today, lte: endDate },
    status: { not: 'Completed' },
  };

  // Filter by case assignment for non-partners
  if (!ctx.isPartner) {
    taskWhere.case = {
      status: 'Active',
      teamMembers: { some: { userId: ctx.userId } },
    };
  } else {
    taskWhere.case = { status: 'Active' };
  }

  const tasks = await prisma.task.findMany({
    where: taskWhere,
    select: {
      id: true,
      title: true,
      type: true,
      dueDate: true,
      dueTime: true,
      priority: true,
      status: true,
      assignedTo: true,
      case: {
        select: {
          id: true,
          caseNumber: true,
        },
      },
    },
    orderBy: { dueDate: 'asc' },
  });

  // Get user names
  const userIds = [...new Set(tasks.map((t) => t.assignedTo))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, firstName: true, lastName: true },
  });
  const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

  // Helper to create deadline item
  const toDeadlineItem = (t: (typeof tasks)[0]): DeadlineItem => ({
    id: t.id,
    caseId: t.case?.id || '',
    caseNumber: t.case?.caseNumber || 'N/A',
    title: t.title,
    type: t.type,
    dueDate: formatDate(t.dueDate),
    dueTime: t.dueTime || undefined,
    assignedTo: userMap.get(t.assignedTo) || 'Neasignat',
    priority: t.priority,
    status: t.status,
  });

  // Group by time period
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const todayTasks = tasks.filter((t) => t.dueDate && t.dueDate.getTime() < tomorrow.getTime());
  const thisWeekTasks = tasks.filter(
    (t) =>
      t.dueDate &&
      t.dueDate.getTime() >= tomorrow.getTime() &&
      t.dueDate.getTime() < weekEnd.getTime()
  );
  const nextTwoWeeksTasks = tasks.filter(
    (t) => t.dueDate && t.dueDate.getTime() >= weekEnd.getTime()
  );

  // Find conflicts (multiple deadlines same day)
  const conflicts: DeadlinesOverview['conflicts'] = [];
  if (includeConflicts) {
    const dateMap = new Map<string, DeadlineItem[]>();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      const dateKey = t.dueDate.toISOString().split('T')[0];
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, []);
      }
      dateMap.get(dateKey)!.push(toDeadlineItem(t));
    }

    for (const [date, items] of dateMap) {
      if (items.length > 1) {
        conflicts.push({ date, deadlines: items });
      }
    }
  }

  // Format output
  let result = '# Termene Viitoare\n\n';
  result += `**Total:** ${tasks.length} termene în următoarele ${daysAhead} zile\n\n`;

  if (todayTasks.length > 0) {
    result += '## 🔴 Astăzi\n\n';
    for (const t of todayTasks) {
      result += `- **${t.case?.caseNumber || 'N/A'}** (caseId: ${t.case?.id || 'N/A'}): ${t.title}`;
      if (t.dueTime) result += ` (${t.dueTime})`;
      result += ` - ${userMap.get(t.assignedTo) || 'Neasignat'}\n`;
    }
    result += '\n';
  }

  if (thisWeekTasks.length > 0) {
    result += '## 🟡 Săptămâna aceasta\n\n';
    for (const t of thisWeekTasks) {
      const dayName = t.dueDate ? getDayOfWeek(t.dueDate) : '';
      result += `- **${t.case?.caseNumber || 'N/A'}** (caseId: ${t.case?.id || 'N/A'}): ${t.title} - ${dayName}`;
      result += ` - ${userMap.get(t.assignedTo) || 'Neasignat'}\n`;
    }
    result += '\n';
  }

  if (nextTwoWeeksTasks.length > 0) {
    result += '## 🟢 Următoarele 2 săptămâni\n\n';
    for (const t of nextTwoWeeksTasks) {
      result += `- **${t.case?.caseNumber || 'N/A'}** (caseId: ${t.case?.id || 'N/A'}): ${t.title} - ${formatDate(t.dueDate)}\n`;
    }
    result += '\n';
  }

  if (conflicts.length > 0) {
    result += '## ⚠️ Conflicte de termene\n\n';
    for (const conflict of conflicts) {
      result += `### ${conflict.date} (${conflict.deadlines.length} termene)\n`;
      for (const d of conflict.deadlines) {
        result += `- ${d.caseNumber} (caseId: ${d.caseId}): ${d.title}\n`;
      }
      result += '\n';
    }
  }

  return result;
}

// ============================================================================
// Tool 3: Read Team Workload
// ============================================================================

export async function handleReadTeamWorkload(
  input: Record<string, unknown>,
  ctx: FirmOperationsToolContext
): Promise<string> {
  const includeOverdue = (input.includeOverdue as boolean) ?? true;
  const includeUpcoming = (input.includeUpcoming as boolean) ?? true;

  logger.debug('Firm operations tool: read_team_workload', {
    correlationId: ctx.correlationId,
    firmId: ctx.firmId,
  });

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAhead = new Date(today);
  weekAhead.setDate(weekAhead.getDate() + 7);

  // Get team members - partners see all, others see just themselves for simplicity
  const userWhere: Prisma.UserWhereInput = {
    firmId: ctx.firmId,
    status: 'Active',
  };

  if (!ctx.isPartner) {
    userWhere.id = ctx.userId;
  }

  const teamMembers = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: true,
    },
  });

  // Get task counts for each member
  const memberStats = await Promise.all(
    teamMembers.map(async (member) => {
      const baseTaskWhere: Prisma.TaskWhereInput = {
        assignedTo: member.id,
        firmId: ctx.firmId,
        status: { not: 'Completed' },
      };

      const [activeTasks, overdueTasks, upcomingTasks] = await Promise.all([
        prisma.task.count({ where: baseTaskWhere }),
        includeOverdue
          ? prisma.task.count({
              where: {
                ...baseTaskWhere,
                dueDate: { lt: today },
              },
            })
          : 0,
        includeUpcoming
          ? prisma.task.count({
              where: {
                ...baseTaskWhere,
                dueDate: { gte: today, lte: weekAhead },
              },
            })
          : 0,
      ]);

      // Simple utilization score based on tasks
      const utilizationScore = Math.min(100, activeTasks * 10);
      let status: 'available' | 'busy' | 'overloaded' = 'available';
      if (overdueTasks > 2 || activeTasks > 15) {
        status = 'overloaded';
      } else if (activeTasks > 8) {
        status = 'busy';
      }

      return {
        userId: member.id,
        name: `${member.firstName} ${member.lastName}`,
        role: member.role,
        activeTasks,
        overdueTasks,
        upcomingTasks,
        utilizationScore,
        status,
      };
    })
  );

  // Calculate firm totals
  const firmTotals = {
    totalActiveTasks: memberStats.reduce((sum, m) => sum + m.activeTasks, 0),
    totalOverdueTasks: memberStats.reduce((sum, m) => sum + m.overdueTasks, 0),
    averageUtilization:
      memberStats.length > 0
        ? Math.round(
            memberStats.reduce((sum, m) => sum + m.utilizationScore, 0) / memberStats.length
          )
        : 0,
  };

  // Format output
  let result = '# Încărcare Echipă\n\n';
  result += `**Membri:** ${memberStats.length}\n`;
  result += `**Total sarcini active:** ${firmTotals.totalActiveTasks}\n`;
  result += `**Sarcini întârziate:** ${firmTotals.totalOverdueTasks}\n`;
  result += `**Utilizare medie:** ${firmTotals.averageUtilization}%\n\n`;

  // Sort by overdue first, then by active tasks
  const sorted = [...memberStats].sort((a, b) => {
    if (a.overdueTasks !== b.overdueTasks) return b.overdueTasks - a.overdueTasks;
    return b.activeTasks - a.activeTasks;
  });

  for (const member of sorted) {
    const statusIcon =
      member.status === 'overloaded' ? '🔴' : member.status === 'busy' ? '🟡' : '🟢';
    result += `## ${statusIcon} ${member.name} (${member.role})\n`;
    result += `- **userId:** ${member.userId}\n`;
    result += `- **Sarcini active:** ${member.activeTasks}\n`;
    if (includeOverdue) {
      result += `- **Întârziate:** ${member.overdueTasks}\n`;
    }
    if (includeUpcoming) {
      result += `- **Săptămâna viitoare:** ${member.upcomingTasks}\n`;
    }
    result += `- **Status:** ${member.status === 'overloaded' ? 'Suprasarcină' : member.status === 'busy' ? 'Ocupat' : 'Disponibil'}\n\n`;
  }

  return result;
}

// ============================================================================
// Tool 4: Read Client Portfolio
// ============================================================================

export async function handleReadClientPortfolio(
  input: Record<string, unknown>,
  ctx: FirmOperationsToolContext
): Promise<string> {
  const activeOnly = (input.activeOnly as boolean) ?? true;
  const inactiveDaysThreshold = (input.inactiveDaysThreshold as number) ?? DEFAULT_INACTIVE_DAYS;
  const limit = Math.min((input.limit as number) ?? 20, MAX_CASES_LIMIT);

  logger.debug('Firm operations tool: read_client_portfolio', {
    correlationId: ctx.correlationId,
    firmId: ctx.firmId,
    activeOnly,
  });

  const now = new Date();

  // Build where clause
  const clientWhere: Prisma.ClientWhereInput = { firmId: ctx.firmId };

  if (activeOnly) {
    clientWhere.cases = { some: { status: 'Active' } };
  }

  if (!ctx.isPartner) {
    clientWhere.cases = {
      some: {
        status: 'Active',
        teamMembers: { some: { userId: ctx.userId } },
      },
    };
  }

  const clients = await prisma.client.findMany({
    where: clientWhere,
    select: {
      id: true,
      name: true,
      updatedAt: true,
      _count: {
        select: {
          cases: true,
        },
      },
      cases: {
        where: { status: 'Active' },
        select: {
          id: true,
          value: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 1,
      },
    },
    take: limit,
    orderBy: { updatedAt: 'desc' },
  });

  // Calculate metrics
  const clientsWithMetrics = clients.map((c) => {
    const lastActivity = c.cases[0]?.updatedAt || c.updatedAt;
    const daysSinceActivity = daysBetween(lastActivity, now);
    const totalValue = c.cases.reduce((sum, cs) => sum + (cs.value ? Number(cs.value) : 0), 0);

    return {
      id: c.id,
      name: c.name,
      activeCases: c.cases.length,
      totalCases: c._count.cases,
      lastActivityDate: formatDate(lastActivity),
      daysSinceActivity,
      needsAttention: daysSinceActivity > inactiveDaysThreshold,
      totalValue: totalValue > 0 ? totalValue : undefined,
    };
  });

  // Identify clients needing attention
  const needsAttention = clientsWithMetrics
    .filter((c) => c.needsAttention)
    .map((c) => ({
      clientId: c.id,
      clientName: c.name,
      reason: `Fără activitate de ${c.daysSinceActivity} zile`,
      daysSinceActivity: c.daysSinceActivity,
    }));

  // Format output
  let result = '# Portofoliu Clienți\n\n';
  result += `**Total clienți:** ${clients.length}\n`;
  result += `**Necesită atenție:** ${needsAttention.length}\n\n`;

  if (needsAttention.length > 0) {
    result += '## ⚠️ Clienți care necesită atenție\n\n';
    for (const c of needsAttention) {
      result += `- **${c.clientName}** (clientId: ${c.clientId}): ${c.reason}\n`;
    }
    result += '\n';
  }

  result += '## Toți clienții\n\n';
  for (const c of clientsWithMetrics) {
    const attentionIcon = c.needsAttention ? ' ⚠️' : '';
    result += `### ${c.name}${attentionIcon}\n`;
    result += `- **clientId:** ${c.id}\n`;
    result += `- **Dosare active:** ${c.activeCases}\n`;
    result += `- **Total dosare:** ${c.totalCases}\n`;
    result += `- **Ultima activitate:** ${c.lastActivityDate}\n`;
    if (c.totalValue) {
      result += `- **Valoare totală:** ${c.totalValue.toLocaleString('ro-RO')} RON\n`;
    }
    result += '\n';
  }

  return result;
}

// ============================================================================
// Tool 5: Read Email Status
// ============================================================================

export async function handleReadEmailStatus(
  input: Record<string, unknown>,
  ctx: FirmOperationsToolContext
): Promise<string> {
  const pendingResponseHours =
    (input.pendingResponseHours as number) ?? DEFAULT_PENDING_RESPONSE_HOURS;

  logger.debug('Firm operations tool: read_email_status', {
    correlationId: ctx.correlationId,
    firmId: ctx.firmId,
  });

  const now = new Date();
  const pendingThreshold = new Date(now.getTime() - pendingResponseHours * 60 * 60 * 1000);

  // Get unread count - only business-relevant emails (classified or client inbox)
  const unreadWhere: Prisma.EmailWhereInput = {
    firmId: ctx.firmId,
    isRead: false,
    isPrivate: false,
    isIgnored: false,
    classificationState: { in: ['Classified', 'ClientInbox'] },
  };
  if (!ctx.isPartner) {
    unreadWhere.userId = ctx.userId;
  }
  const unreadCount = await prisma.email.count({ where: unreadWhere });

  // Get emails awaiting response (we sent, no reply yet)
  // Only include business-relevant emails linked to cases
  const sentEmailWhere: Prisma.EmailWhereInput = {
    firmId: ctx.firmId,
    sentDateTime: { lt: pendingThreshold, gte: new Date(0) },
    caseId: { not: null }, // Only case-linked emails
    isPrivate: false,
    isIgnored: false,
  };
  if (!ctx.isPartner) {
    sentEmailWhere.userId = ctx.userId;
  }

  const sentEmails = await prisma.email.findMany({
    where: sentEmailWhere,
    select: {
      id: true,
      conversationId: true,
      subject: true,
      sentDateTime: true,
      caseId: true,
      case: { select: { caseNumber: true } },
      user: { select: { firstName: true, lastName: true } },
    },
    orderBy: { sentDateTime: 'asc' },
    take: 20,
  });

  // Filter to only emails that haven't received a response
  // Batch approach: get all conversation IDs and find those with replies in one query
  const conversationIds = sentEmails
    .filter((e) => e.conversationId && e.sentDateTime)
    .map((e) => e.conversationId!);

  // Single query to get conversations with replies (received emails after sent)
  const conversationsWithReplies = await prisma.email.groupBy({
    by: ['conversationId'],
    where: {
      conversationId: { in: conversationIds },
      receivedDateTime: { gte: new Date(0) },
    },
    _max: { receivedDateTime: true },
  });

  // Create a map for O(1) lookup: conversationId -> latest received date
  const replyMap = new Map(
    conversationsWithReplies.map((c) => [c.conversationId, c._max.receivedDateTime])
  );

  // Filter in memory instead of N individual queries
  const pendingResponses: EmailStatus['pendingResponses'] = [];
  for (const email of sentEmails) {
    if (!email.conversationId || !email.sentDateTime) continue;

    // Check if there's a reply newer than when we sent it
    const latestReply = replyMap.get(email.conversationId);
    if (!latestReply || latestReply <= email.sentDateTime) {
      pendingResponses.push({
        conversationId: email.conversationId,
        subject: email.subject || 'Fără subiect',
        caseId: email.caseId || undefined,
        caseNumber: email.case?.caseNumber,
        lastSentAt: formatDateTime(email.sentDateTime),
        hoursSinceSent: hoursBetween(email.sentDateTime, now),
        sentBy: `${email.user?.firstName || ''} ${email.user?.lastName || ''}`.trim() || 'N/A',
      });
    }
  }

  // Get threads with action items - only case-linked threads
  const threadSummaries = await prisma.threadSummary.findMany({
    where: {
      firmId: ctx.firmId,
      actionItems: { not: Prisma.DbNull },
      caseId: { not: null }, // Only case-linked threads
    },
    select: {
      conversationId: true,
      overview: true,
      actionItems: true,
      caseId: true,
      case: { select: { caseNumber: true } },
    },
    take: 10,
    orderBy: { lastAnalyzedAt: 'desc' },
  });

  const awaitingAction: EmailStatus['awaitingAction'] = threadSummaries
    .filter((ts) => {
      const items = ts.actionItems as string[] | null;
      return items && items.length > 0;
    })
    .map((ts) => {
      const items = ts.actionItems as string[];
      return {
        conversationId: ts.conversationId,
        subject: ts.overview?.slice(0, 100) || 'Thread de email',
        caseId: ts.caseId || undefined,
        caseNumber: ts.case?.caseNumber,
        actionRequired: items[0] || 'Acțiune necesară',
        receivedAt: 'N/A',
      };
    });

  // Format output
  let result = '# Stare Emailuri\n\n';
  result += `**Necitite:** ${unreadCount}\n`;
  result += `**Așteaptă răspuns:** ${pendingResponses.length}\n`;
  result += `**Thread-uri cu acțiuni:** ${awaitingAction.length}\n\n`;

  if (pendingResponses.length > 0) {
    result += '## ⏳ Așteaptă răspuns (48h+)\n\n';
    for (const email of pendingResponses.slice(0, 10)) {
      result += `### ${email.subject}\n`;
      result += `- **conversationId:** ${email.conversationId}\n`;
      if (email.caseNumber) {
        result += `- **Dosar:** ${email.caseNumber}\n`;
      }
      result += `- **Trimis de:** ${email.sentBy}\n`;
      result += `- **Acum:** ${email.hoursSinceSent} ore\n\n`;
    }
  }

  if (awaitingAction.length > 0) {
    result += '## 📌 Necesită acțiune\n\n';
    for (const thread of awaitingAction) {
      result += `- **${thread.subject}** (conversationId: ${thread.conversationId}): ${thread.actionRequired}\n`;
    }
  }

  return result;
}

// ============================================================================
// Tool 6: Read Platform Metrics
// ============================================================================

export async function handleReadPlatformMetrics(
  input: Record<string, unknown>,
  ctx: FirmOperationsToolContext
): Promise<string> {
  const includeTrends = (input.includeTrends as boolean) ?? true;
  const includeAIMetrics = (input.includeAIMetrics as boolean) ?? true;

  logger.debug('Firm operations tool: read_platform_metrics', {
    correlationId: ctx.correlationId,
    firmId: ctx.firmId,
  });

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Get this week's stats
  const [
    tasksCompletedThisWeek,
    tasksCompletedLastWeek,
    totalActiveTasks,
    overdueTasks,
    documentsGenerated,
    comprehensionsGenerated,
    emailsProcessed,
  ] = await Promise.all([
    prisma.task.count({
      where: {
        firmId: ctx.firmId,
        status: 'Completed',
        completedAt: { gte: weekAgo },
      },
    }),
    prisma.task.count({
      where: {
        firmId: ctx.firmId,
        status: 'Completed',
        completedAt: { gte: twoWeeksAgo, lt: weekAgo },
      },
    }),
    prisma.task.count({
      where: {
        firmId: ctx.firmId,
        status: { not: 'Completed' },
      },
    }),
    prisma.task.count({
      where: {
        firmId: ctx.firmId,
        status: { not: 'Completed' },
        dueDate: { lt: now },
      },
    }),
    prisma.document.count({
      where: {
        firmId: ctx.firmId,
        createdAt: { gte: weekAgo },
        status: 'FINAL',
      },
    }),
    prisma.caseComprehension.count({
      where: {
        firmId: ctx.firmId,
        generatedAt: { gte: weekAgo },
      },
    }),
    prisma.email.count({
      where: {
        firmId: ctx.firmId,
        receivedDateTime: { gte: weekAgo },
      },
    }),
  ]);

  // Calculate metrics
  const totalTasksForCompletion = tasksCompletedThisWeek + totalActiveTasks;
  const taskCompletionRate =
    totalTasksForCompletion > 0
      ? Math.round((tasksCompletedThisWeek / totalTasksForCompletion) * 100)
      : 100;

  // Health score based on overdue ratio and completion rate
  const overdueRatio = totalActiveTasks > 0 ? overdueTasks / totalActiveTasks : 0;
  const healthScore = Math.round(
    Math.max(0, Math.min(100, taskCompletionRate * (1 - overdueRatio * 0.5)))
  );

  // AI adoption based on comprehensions/documents ratio
  const aiAdoptionRate =
    documentsGenerated > 0
      ? Math.round(Math.min(100, (comprehensionsGenerated / Math.max(1, documentsGenerated)) * 100))
      : 0;

  // Trends
  let trends: PlatformMetrics['trends'];
  if (includeTrends) {
    const taskCompletionChange =
      tasksCompletedLastWeek > 0
        ? Math.round(
            ((tasksCompletedThisWeek - tasksCompletedLastWeek) / tasksCompletedLastWeek) * 100
          )
        : 0;

    trends = {
      healthScoreChange: 0, // Would need historical data
      taskCompletionChange,
      aiAdoptionChange: 0, // Would need historical data
    };
  }

  // Format output
  let result = '# Metrici Platformă\n\n';
  result += `**Scor sănătate:** ${healthScore}%\n`;
  result += `**Rata completare sarcini:** ${taskCompletionRate}%\n`;
  if (includeAIMetrics) {
    result += `**Rata adopție AI:** ${aiAdoptionRate}%\n`;
  }
  result += '\n';

  result += '## Statistici săptămâna aceasta\n\n';
  result += `- **Sarcini completate:** ${tasksCompletedThisWeek}\n`;
  result += `- **Documente finalizate:** ${documentsGenerated}\n`;
  result += `- **Emailuri procesate:** ${emailsProcessed}\n`;
  if (includeAIMetrics) {
    result += `- **Comprehensiuni generate:** ${comprehensionsGenerated}\n`;
  }
  result += '\n';

  if (trends) {
    result += '## Tendințe\n\n';
    const changeIcon = (val: number) => (val > 0 ? '📈' : val < 0 ? '📉' : '➡️');
    result += `- Completare sarcini: ${changeIcon(trends.taskCompletionChange)} ${trends.taskCompletionChange > 0 ? '+' : ''}${trends.taskCompletionChange}%\n`;
  }

  // Health assessment
  result += '\n## Evaluare\n\n';
  if (healthScore >= 80) {
    result += '✅ Firma funcționează eficient.\n';
  } else if (healthScore >= 60) {
    result += '🟡 Performanță acceptabilă, dar există loc de îmbunătățire.\n';
  } else {
    result += '⚠️ Atenție! Există probleme care necesită intervenție.\n';
  }

  if (overdueTasks > 0) {
    result += `\n⚠️ **${overdueTasks} sarcini întârziate** necesită atenție imediată.\n`;
  }

  return result;
}

// ============================================================================
// Tool 7: Read Recent Case Events
// ============================================================================

interface RecentCaseEvent {
  caseId: string;
  caseNumber: string;
  caseTitle: string;
  activityType: string;
  title: string;
  summary: string | null;
  createdAt: Date;
  metadata: unknown;
}

/**
 * Read recent events across all cases for the firm.
 * Returns communications, documents, tasks, and other activity.
 */
export async function handleReadRecentCaseEvents(
  input: Record<string, unknown>,
  ctx: FirmOperationsToolContext
): Promise<string> {
  const hoursBack = Math.min(Math.max((input.hoursBack as number) ?? 24, 1), 168); // 1h to 7 days
  const limit = Math.min((input.limit as number) ?? 50, 100);
  const eventTypes = input.eventTypes as string[] | undefined;

  logger.debug('Firm operations tool: read_recent_case_events', {
    correlationId: ctx.correlationId,
    firmId: ctx.firmId,
    hoursBack,
    eventTypes,
    limit,
  });

  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

  // Build base case filter
  const caseFilter: Prisma.CaseWhereInput = {
    firmId: ctx.firmId,
    status: { not: 'Closed' },
  };

  // For non-partners, only show events from their assigned cases
  if (!ctx.isPartner) {
    caseFilter.teamMembers = { some: { userId: ctx.userId } };
  }

  // Build where clause
  const where: Prisma.CaseActivityEntryWhereInput = {
    case: caseFilter,
    createdAt: { gte: since },
  };

  // Filter by event types if specified
  if (eventTypes && eventTypes.length > 0) {
    where.activityType = { in: eventTypes as CaseActivityType[] };
  }

  const events = await prisma.caseActivityEntry.findMany({
    where,
    select: {
      id: true,
      caseId: true,
      activityType: true,
      title: true,
      summary: true,
      metadata: true,
      createdAt: true,
      case: {
        select: {
          caseNumber: true,
          title: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  // Group by activity type for summary
  const byType: Record<string, number> = {};
  for (const event of events) {
    byType[event.activityType] = (byType[event.activityType] || 0) + 1;
  }

  // Format output
  let result = '# Evenimente Recente\n\n';
  result += `**Perioada:** ultimele ${hoursBack} ore\n`;
  result += `**Total evenimente:** ${events.length}\n\n`;

  if (Object.keys(byType).length > 0) {
    result += '## Rezumat pe tip\n\n';
    const typeLabels: Record<string, string> = {
      CommunicationReceived: 'Emailuri primite',
      CommunicationSent: 'Emailuri trimise',
      DocumentUploaded: 'Documente încărcate',
      TaskCreated: 'Sarcini create',
      TaskCompleted: 'Sarcini finalizate',
      TaskStatusChanged: 'Sarcini actualizate',
      DeadlineApproaching: 'Termene apropiate',
      MilestoneReached: 'Etape atinse',
    };
    for (const [type, count] of Object.entries(byType)) {
      const label = typeLabels[type] || type;
      result += `- ${label}: ${count}\n`;
    }
    result += '\n';
  }

  if (events.length > 0) {
    result += '## Evenimente\n\n';
    for (const event of events) {
      const timeStr = formatDate(event.createdAt);
      const typeIcon = getActivityIcon(event.activityType);
      result += `### ${typeIcon} ${event.case.caseNumber}: ${event.title}\n`;
      result += `- **Dosar:** ${event.case.title}\n`;
      result += `- **Data:** ${timeStr}\n`;
      if (event.summary) {
        result += `- **Detalii:** ${event.summary}\n`;
      }
      result += '\n';
    }
  } else {
    result += '*Nu există evenimente recente în această perioadă.*\n';
  }

  return result;
}

/**
 * Get icon for activity type
 */
function getActivityIcon(activityType: string): string {
  const icons: Record<string, string> = {
    CommunicationReceived: '📨',
    CommunicationSent: '📤',
    DocumentUploaded: '📄',
    DocumentVersioned: '📝',
    TaskCreated: '📋',
    TaskCompleted: '✅',
    TaskStatusChanged: '🔄',
    TaskAssigned: '👤',
    DeadlineApproaching: '⏰',
    MilestoneReached: '🎯',
  };
  return icons[activityType] || '📌';
}

// ============================================================================
// Handler Factory
// ============================================================================

/**
 * Create tool handlers map for use with chatWithTools.
 * All handlers are bound to the provided context for authorization.
 */
export function createFirmOperationsToolHandlers(
  ctx: FirmOperationsToolContext
): Record<string, ToolHandler> {
  const wrapHandler = (
    name: string,
    handler: (input: Record<string, unknown>, ctx: FirmOperationsToolContext) => Promise<string>
  ): ToolHandler => {
    return async (input: Record<string, unknown>) => {
      logger.debug('Firm operations tool called', {
        tool: name,
        input,
        correlationId: ctx.correlationId,
        firmId: ctx.firmId,
      });
      const start = Date.now();
      try {
        const result = await handler(input, ctx);
        logger.debug('Firm operations tool completed', {
          tool: name,
          durationMs: Date.now() - start,
          resultLength: result.length,
          correlationId: ctx.correlationId,
        });
        return successResult(result);
      } catch (error) {
        const durationMs = Date.now() - start;
        const errorMessage = error instanceof Error ? error.message : 'Eroare necunoscută';

        // Determine error code based on error type
        let errorCode: string = ToolErrorCode.UNKNOWN_ERROR;
        if (error instanceof Error) {
          if (error.message.includes('permission') || error.message.includes('unauthorized')) {
            errorCode = ToolErrorCode.PERMISSION_DENIED;
          } else if (error.message.includes('not found') || error.message.includes('no rows')) {
            errorCode = ToolErrorCode.NOT_FOUND;
          } else if (error.message.includes('validation') || error.message.includes('invalid')) {
            errorCode = ToolErrorCode.VALIDATION_ERROR;
          } else {
            errorCode = ToolErrorCode.QUERY_FAILED;
          }
        }

        logger.error('Firm operations tool error', {
          tool: name,
          error: errorMessage,
          errorCode,
          durationMs,
          correlationId: ctx.correlationId,
          firmId: ctx.firmId,
        });

        // Return structured error for consistent agent parsing
        return errorResult(errorCode, `${name}: ${errorMessage}`);
      }
    };
  };

  return {
    read_active_cases_summary: wrapHandler(
      'read_active_cases_summary',
      handleReadActiveCasesSummary
    ),
    read_deadlines_overview: wrapHandler('read_deadlines_overview', handleReadDeadlinesOverview),
    read_team_workload: wrapHandler('read_team_workload', handleReadTeamWorkload),
    read_client_portfolio: wrapHandler('read_client_portfolio', handleReadClientPortfolio),
    read_email_status: wrapHandler('read_email_status', handleReadEmailStatus),
    read_platform_metrics: wrapHandler('read_platform_metrics', handleReadPlatformMetrics),
    read_recent_case_events: wrapHandler('read_recent_case_events', handleReadRecentCaseEvents),
  };
}
