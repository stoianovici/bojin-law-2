/**
 * Case Query Intent Handler
 * OPS-073: Case Query Intent Handler
 *
 * Handles queries about case information: status, deadlines, summaries, actors, documents.
 * Leverages existing CaseSummaryService for AI-generated summaries.
 */

import { prisma } from '@legal-platform/database';
import { caseSummaryService } from '../case-summary.service';
import type { AssistantContext, UserContext, HandlerResult } from './types';

// ============================================================================
// Types
// ============================================================================

export type CaseQueryType = 'status' | 'deadline' | 'summary' | 'actors' | 'documents' | 'general';

export interface CaseQueryParams {
  queryType: CaseQueryType;
  caseId?: string;
  caseReference?: string; // e.g., "2024-1234" or "Ionescu"
  question?: string; // Free-form question for general queries
}

// ============================================================================
// Handler
// ============================================================================

export class CaseQueryHandler {
  readonly name = 'CaseQueryHandler';

  /**
   * Main entry point for case queries.
   * Resolves case ID and routes to the appropriate handler.
   */
  async handle(
    params: CaseQueryParams,
    context: AssistantContext,
    userContext: UserContext
  ): Promise<HandlerResult> {
    // Resolve case ID from params, context, or reference search
    const caseId =
      params.caseId ||
      context.currentCaseId ||
      (await this.findCaseByReference(params.caseReference, userContext.firmId));

    if (!caseId) {
      return {
        success: false,
        message: 'Nu am putut identifica dosarul. Specificați numărul sau numele dosarului.',
      };
    }

    // Route to specific handler based on query type
    switch (params.queryType) {
      case 'status':
        return this.handleStatusQuery(caseId, userContext);
      case 'deadline':
        return this.handleDeadlineQuery(caseId, userContext);
      case 'summary':
        return this.handleSummaryQuery(caseId, userContext);
      case 'actors':
        return this.handleActorsQuery(caseId, userContext);
      case 'documents':
        return this.handleDocumentsQuery(caseId, userContext);
      default:
        return this.handleGeneralQuery(caseId, params.question || '', userContext);
    }
  }

  // ============================================================================
  // Query Handlers
  // ============================================================================

  /**
   * Handle status queries: "Care e statusul dosarului Ionescu?"
   */
  private async handleStatusQuery(
    caseId: string,
    userContext: UserContext
  ): Promise<HandlerResult> {
    const caseData = await prisma.case.findUnique({
      where: { id: caseId, firmId: userContext.firmId },
      include: {
        client: { select: { name: true } },
        tasks: {
          where: { status: 'Pending' },
          take: 3,
          orderBy: { dueDate: 'asc' },
          select: { id: true, title: true, dueDate: true, priority: true },
        },
      },
    });

    if (!caseData) {
      return { success: false, message: 'Dosarul nu a fost găsit.' };
    }

    const statusText = this.formatCaseStatus(caseData);

    return {
      success: true,
      data: caseData,
      message: statusText,
    };
  }

  /**
   * Handle deadline queries: "Când e următorul termen în dosarul 2024-1234?"
   */
  private async handleDeadlineQuery(
    caseId: string,
    userContext: UserContext
  ): Promise<HandlerResult> {
    const tasks = await prisma.task.findMany({
      where: {
        caseId,
        case: { firmId: userContext.firmId },
        status: 'Pending',
        dueDate: { gte: new Date() },
      },
      orderBy: { dueDate: 'asc' },
      take: 5,
      select: {
        id: true,
        title: true,
        dueDate: true,
        priority: true,
        type: true,
      },
    });

    if (tasks.length === 0) {
      return {
        success: true,
        data: { tasks: [] },
        message: 'Nu există termene viitoare în acest dosar.',
      };
    }

    const deadlinesText = tasks
      .map((t) => `• ${this.formatDate(t.dueDate)}: ${t.title}`)
      .join('\n');

    return {
      success: true,
      data: { tasks },
      message: `Următoarele termene:\n${deadlinesText}`,
    };
  }

  /**
   * Handle summary queries: "Fă-mi un rezumat al dosarului curent"
   */
  private async handleSummaryQuery(
    caseId: string,
    userContext: UserContext
  ): Promise<HandlerResult> {
    // Check for cached summary in database
    const cachedSummary = await prisma.caseSummary.findUnique({
      where: { caseId },
      include: { case: { select: { firmId: true } } },
    });

    // Verify firm access
    if (cachedSummary && cachedSummary.case.firmId !== userContext.firmId) {
      return { success: false, message: 'Dosarul nu a fost găsit.' };
    }

    // If no summary or marked as stale, regenerate
    if (!cachedSummary || cachedSummary.isStale) {
      try {
        // Generate new summary (stores in database)
        await caseSummaryService.generateSummary(caseId, userContext.firmId);

        // Fetch the newly generated summary
        const newSummary = await prisma.caseSummary.findUnique({
          where: { caseId },
        });

        if (!newSummary) {
          return {
            success: false,
            message: 'Nu am putut genera rezumatul. Încercați din nou.',
          };
        }

        return this.formatSummaryResponse(newSummary);
      } catch (error) {
        console.error('[CaseQueryHandler] Failed to generate summary:', error);
        return {
          success: false,
          message: 'A apărut o eroare la generarea rezumatului. Încercați din nou.',
        };
      }
    }

    return this.formatSummaryResponse(cachedSummary);
  }

  /**
   * Handle actors queries: "Cine sunt actorii din acest dosar?"
   */
  private async handleActorsQuery(
    caseId: string,
    userContext: UserContext
  ): Promise<HandlerResult> {
    const caseData = await prisma.case.findUnique({
      where: { id: caseId, firmId: userContext.firmId },
      include: {
        client: { select: { name: true, contactInfo: true } },
        actors: {
          select: { name: true, role: true, email: true, phone: true },
        },
        teamMembers: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
    });

    if (!caseData) {
      return { success: false, message: 'Dosarul nu a fost găsit.' };
    }

    const actorsText = this.formatActors(caseData);

    return {
      success: true,
      data: caseData,
      message: actorsText,
    };
  }

  /**
   * Handle documents queries: "Ce documente avem în dosar?"
   */
  private async handleDocumentsQuery(
    caseId: string,
    userContext: UserContext
  ): Promise<HandlerResult> {
    const documents = await prisma.caseDocument.findMany({
      where: { caseId, case: { firmId: userContext.firmId } },
      include: {
        document: {
          select: { id: true, fileName: true, fileType: true, createdAt: true },
        },
      },
      orderBy: { linkedAt: 'desc' },
      take: 10,
    });

    if (documents.length === 0) {
      return {
        success: true,
        data: { documents: [] },
        message: 'Nu există documente în acest dosar.',
      };
    }

    const docsText = documents
      .map((d) => `• ${d.document.fileName} (${this.formatDate(d.document.createdAt)})`)
      .join('\n');

    return {
      success: true,
      data: { documents: documents.map((d) => d.document) },
      message: `Ultimele documente:\n${docsText}`,
    };
  }

  /**
   * Handle general queries that don't fit specific categories.
   * Falls back to providing basic case info.
   */
  private async handleGeneralQuery(
    caseId: string,
    question: string,
    userContext: UserContext
  ): Promise<HandlerResult> {
    // For now, provide a fallback message with directions
    // Future: Could use AI to answer based on case context
    const caseData = await prisma.case.findUnique({
      where: { id: caseId, firmId: userContext.firmId },
      select: { title: true, caseNumber: true },
    });

    if (!caseData) {
      return { success: false, message: 'Dosarul nu a fost găsit.' };
    }

    return {
      success: true,
      data: { caseId, question },
      message: `Pentru întrebări complexe despre dosarul "${caseData.title}" (${caseData.caseNumber}), vă recomand să verificați direct detaliile dosarului sau să folosiți una din comenzile specifice: "status", "termene", "rezumat", "actori", sau "documente".`,
    };
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  /**
   * Find a case by reference (number, title, or client name)
   */
  private async findCaseByReference(
    reference: string | undefined,
    firmId: string
  ): Promise<string | null> {
    if (!reference) return null;

    const caseData = await prisma.case.findFirst({
      where: {
        firmId,
        OR: [
          { caseNumber: { contains: reference, mode: 'insensitive' } },
          { title: { contains: reference, mode: 'insensitive' } },
          { client: { name: { contains: reference, mode: 'insensitive' } } },
        ],
      },
      select: { id: true },
    });

    return caseData?.id ?? null;
  }

  /**
   * Format case status with pending tasks
   */
  private formatCaseStatus(caseData: {
    title: string;
    caseNumber: string;
    status: string;
    client: { name: string } | null;
    tasks: Array<{ title: string; dueDate: Date; priority: string }>;
  }): string {
    const statusMap: Record<string, string> = {
      Active: 'Activ',
      Pending: 'În așteptare',
      Closed: 'Închis',
      OnHold: 'Suspendat',
    };

    const lines = [
      `**Dosar:** ${caseData.title} (${caseData.caseNumber})`,
      `**Client:** ${caseData.client?.name || 'Necunoscut'}`,
      `**Status:** ${statusMap[caseData.status] || caseData.status}`,
    ];

    if (caseData.tasks.length > 0) {
      lines.push('', '**Sarcini în așteptare:**');
      for (const task of caseData.tasks) {
        const priority = this.translatePriority(task.priority);
        lines.push(`• ${task.title} - ${this.formatDate(task.dueDate)} (${priority})`);
      }
    } else {
      lines.push('', 'Nu există sarcini în așteptare.');
    }

    return lines.join('\n');
  }

  /**
   * Format case summary response
   */
  private formatSummaryResponse(summary: {
    executiveSummary: string;
    currentStatus: string;
    keyDevelopments: unknown; // Json field from Prisma
    openIssues: unknown; // Json field from Prisma
  }): HandlerResult {
    // Cast Json fields to string arrays
    const keyDev = (summary.keyDevelopments || []) as string[];
    const issues = (summary.openIssues || []) as string[];

    const lines = [
      '**Rezumat dosar:**',
      summary.executiveSummary,
      '',
      '**Status curent:**',
      summary.currentStatus,
    ];

    if (keyDev.length > 0) {
      lines.push('', '**Dezvoltări cheie:**');
      for (const d of keyDev) {
        lines.push(`• ${d}`);
      }
    }

    if (issues.length > 0) {
      lines.push('', '**Probleme deschise:**');
      for (const i of issues) {
        lines.push(`• ${i}`);
      }
    }

    return {
      success: true,
      data: summary,
      message: lines.join('\n'),
    };
  }

  /**
   * Format actors list including client, parties, and team members
   */
  private formatActors(caseData: {
    client: { name: string; contactInfo: unknown } | null;
    actors: Array<{ name: string; role: string; email: string | null; phone: string | null }>;
    teamMembers: Array<{
      role: string;
      user: { firstName: string; lastName: string; email: string };
    }>;
  }): string {
    const lines: string[] = [];

    // Client
    if (caseData.client) {
      lines.push('**Client:**');
      lines.push(`• ${caseData.client.name}`);
      // contactInfo is a JSON field, extract email if present
      const contactInfo = caseData.client.contactInfo as Record<string, unknown> | null;
      if (contactInfo?.email) {
        lines.push(`  Email: ${contactInfo.email}`);
      }
      if (contactInfo?.phone) {
        lines.push(`  Tel: ${contactInfo.phone}`);
      }
    }

    // Parties
    if (caseData.actors.length > 0) {
      lines.push('', '**Părți:**');
      for (const actor of caseData.actors) {
        const roleLabel = this.translateRole(actor.role);
        lines.push(`• ${actor.name} (${roleLabel})`);
        if (actor.email) {
          lines.push(`  Email: ${actor.email}`);
        }
        if (actor.phone) {
          lines.push(`  Tel: ${actor.phone}`);
        }
      }
    }

    // Team members
    if (caseData.teamMembers.length > 0) {
      lines.push('', '**Echipa firmei:**');
      for (const member of caseData.teamMembers) {
        const roleLabel = this.translateTeamRole(member.role);
        lines.push(`• ${member.user.firstName} ${member.user.lastName} (${roleLabel})`);
      }
    }

    if (lines.length === 0) {
      return 'Nu sunt informații despre participanții din acest dosar.';
    }

    return lines.join('\n');
  }

  /**
   * Format a date in Romanian format
   */
  private formatDate(date: Date): string {
    const months = [
      'ian',
      'feb',
      'mar',
      'apr',
      'mai',
      'iun',
      'iul',
      'aug',
      'sep',
      'oct',
      'nov',
      'dec',
    ];
    const d = new Date(date);
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  /**
   * Translate task priority to Romanian
   */
  private translatePriority(priority: string): string {
    const map: Record<string, string> = {
      High: 'Urgentă',
      Medium: 'Medie',
      Low: 'Scăzută',
      Critical: 'Critică',
    };
    return map[priority] || priority;
  }

  /**
   * Translate actor role to Romanian
   */
  private translateRole(role: string): string {
    const map: Record<string, string> = {
      Plaintiff: 'Reclamant',
      Defendant: 'Pârât',
      Witness: 'Martor',
      Expert: 'Expert',
      Other: 'Altul',
      Client: 'Client',
      OpposingCounsel: 'Avocat adversar',
      Court: 'Instanță',
    };
    return map[role] || role;
  }

  /**
   * Translate team member role to Romanian
   */
  private translateTeamRole(role: string): string {
    const map: Record<string, string> = {
      Lead: 'Responsabil',
      Support: 'Suport',
      Reviewer: 'Verificator',
      Paralegal: 'Paralegal',
      Partner: 'Partener',
      Associate: 'Asociat',
    };
    return map[role] || role;
  }
}

// Export singleton instance
export const caseQueryHandler = new CaseQueryHandler();
