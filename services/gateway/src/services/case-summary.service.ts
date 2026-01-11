/**
 * Case Summary Service
 * OPS-047: Event-Driven Summary Invalidation
 * OPS-048: AI Summary Generation Service
 *
 * Manages case summary staleness, event tracking, and AI-powered summary generation.
 * Summaries are marked stale when case data changes, triggering background regeneration.
 */

import { prisma } from '@legal-platform/database';
import { AIOperationType, CoreContext, ClaudeModel } from '@legal-platform/types';
import { aiService } from './ai.service';
import { caseContextService } from './case-context.service';
import { getModelForFeature } from './ai-client.service';
import logger from '../utils/logger';
import crypto from 'crypto';

// ============================================================================
// Model Mapping
// ============================================================================

/**
 * Map model ID string to ClaudeModel enum value
 */
function modelIdToClaudeModel(modelId: string): ClaudeModel {
  const enumValues = Object.values(ClaudeModel) as string[];
  if (enumValues.includes(modelId)) return modelId as ClaudeModel;
  if (modelId.includes('haiku')) return ClaudeModel.Haiku;
  if (modelId.includes('opus')) return ClaudeModel.Opus;
  return ClaudeModel.Sonnet;
}

// ============================================================================
// Types
// ============================================================================

interface CaseContext {
  // Full identity context from CaseContextService
  coreContext: CoreContext | null;
  // Legacy case data for backward compatibility
  caseData: {
    id: string;
    title: string;
    caseNumber: string;
    type: string | null;
    status: string;
    client: { name: string } | null;
    actors: Array<{ name: string; role: string }>;
    teamMembers: Array<{ user: { firstName: string; lastName: string }; role: string }>;
  } | null;
  emails: Array<{
    id: string;
    subject: string;
    bodyPreview: string | null;
    from: unknown;
    receivedDateTime: Date;
  }>;
  documents: Array<{
    id: string;
    fileName: string;
    fileType: string;
    createdAt: Date;
  }>;
  notes: Array<{
    id: string;
    body: string;
    sentAt: Date;
    senderName: string;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: Date | null;
    completedAt: Date | null;
  }>;
}

interface SummaryResult {
  executiveSummary: string;
  currentStatus: string;
  keyDevelopments: string[];
  openIssues: string[];
}

// ============================================================================
// Service
// ============================================================================

export class CaseSummaryService {
  /**
   * Generate or refresh the summary for a case
   */
  async generateSummary(caseId: string, firmId: string): Promise<void> {
    console.log(`[CaseSummary] Generating summary for case ${caseId}`);

    try {
      // 1. Gather context
      const context = await this.gatherCaseContext(caseId);
      if (!context.caseData) {
        throw new Error(`Case ${caseId} not found`);
      }

      // 2. Check if summary is needed (compare hash)
      const dataVersionHash = this.computeHash(context);
      const existingSummary = await prisma.caseSummary.findUnique({
        where: { caseId },
        select: { dataVersionHash: true, isStale: true },
      });

      // Skip if data hasn't changed and not marked stale
      if (existingSummary?.dataVersionHash === dataVersionHash && !existingSummary.isStale) {
        console.log(`[CaseSummary] Case ${caseId} summary is up to date, skipping`);
        return;
      }

      // 3. Build prompt
      const prompt = this.buildPrompt(context);

      // 4. Get configured model for case_health feature (used for case summaries)
      const modelId = await getModelForFeature(firmId, 'case_health');
      const modelOverride = modelIdToClaudeModel(modelId);

      // 5. Call AI service
      const response = await aiService.generate({
        prompt,
        systemPrompt: this.getSystemPrompt(),
        operationType: AIOperationType.ThreadAnalysis,
        firmId,
        modelOverride,
        maxTokens: 2000,
        temperature: 0.3,
        useCache: false,
      });

      // 5. Parse response
      const summary = this.parseResponse(response.content);

      // 6. Store in database
      await prisma.caseSummary.upsert({
        where: { caseId },
        update: {
          executiveSummary: summary.executiveSummary,
          currentStatus: summary.currentStatus,
          keyDevelopments: summary.keyDevelopments,
          openIssues: summary.openIssues,
          generatedAt: new Date(),
          isStale: false,
          dataVersionHash,
          emailCount: context.emails.length,
          documentCount: context.documents.length,
          noteCount: context.notes.length,
          taskCount: context.tasks.length,
        },
        create: {
          caseId,
          executiveSummary: summary.executiveSummary,
          currentStatus: summary.currentStatus,
          keyDevelopments: summary.keyDevelopments,
          openIssues: summary.openIssues,
          generatedAt: new Date(),
          isStale: false,
          dataVersionHash,
          emailCount: context.emails.length,
          documentCount: context.documents.length,
          noteCount: context.notes.length,
          taskCount: context.tasks.length,
        },
      });

      console.log(`[CaseSummary] Generated summary for case ${caseId}`);
    } catch (error) {
      console.error(`[CaseSummary] Failed to generate summary for case ${caseId}:`, error);
      // Keep isStale = true so it retries later
      throw error;
    }
  }

  /**
   * Get the cached summary for a case
   */
  async getCaseSummary(caseId: string) {
    return prisma.caseSummary.findUnique({
      where: { caseId },
    });
  }

  /**
   * OPS-047: Mark a case summary as stale, triggering background regeneration.
   * Uses upsert to handle cases without existing summaries.
   */
  async markSummaryStale(caseId: string): Promise<void> {
    try {
      await prisma.caseSummary.upsert({
        where: { caseId },
        update: { isStale: true },
        create: {
          caseId,
          isStale: true,
          executiveSummary: '',
          currentStatus: '',
          keyDevelopments: [],
          openIssues: [],
          generatedAt: new Date(0), // Epoch = never generated
        },
      });

      logger.debug('Case summary marked stale', { caseId });

      // Enqueue regeneration job (with debouncing)
      await this.enqueueRegeneration(caseId);
    } catch (error: any) {
      logger.error('Failed to mark summary stale', {
        caseId,
        error: error.message,
      });
      // Don't throw - staleness marking is best-effort
    }
  }

  /**
   * OPS-047: Enqueue a summary regeneration job with debouncing.
   */
  async enqueueRegeneration(caseId: string): Promise<void> {
    try {
      // Dynamic import to avoid circular dependencies
      const { queueSummaryRegeneration } = await import('../workers/summary-regeneration.worker');
      await queueSummaryRegeneration(caseId);
    } catch (error: any) {
      // Worker may not be initialized yet - log and continue
      logger.debug('Could not enqueue regeneration (worker not ready)', {
        caseId,
        error: error.message,
      });
    }
  }

  /**
   * Get all stale summaries that need regeneration
   */
  async getStaleSummaries(limit: number = 10) {
    return prisma.caseSummary.findMany({
      where: { isStale: true },
      take: limit,
      orderBy: { updatedAt: 'asc' },
      include: {
        case: {
          select: { id: true, firmId: true },
        },
      },
    });
  }

  /**
   * Get cases without summaries
   */
  async getCasesWithoutSummary(firmId: string, limit: number = 10) {
    return prisma.case.findMany({
      where: {
        firmId,
        summary: null,
        status: { not: 'Closed' },
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, firmId: true },
    });
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Gather all relevant case data for AI context
   */
  private async gatherCaseContext(caseId: string): Promise<CaseContext> {
    // Fetch core identity context and summary-specific data in parallel
    const [coreContext, caseData, emails, caseDocuments, notes, tasks] = await Promise.all([
      // Full identity context from CaseContextService
      caseContextService.getCoreContext(caseId).catch((error) => {
        logger.warn('Failed to get core context for case summary, using minimal context', {
          caseId,
          error,
        });
        return null;
      }),
      prisma.case.findUnique({
        where: { id: caseId },
        include: {
          client: { select: { name: true } },
          actors: { select: { name: true, role: true } },
          teamMembers: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
      prisma.email.findMany({
        where: { caseId },
        orderBy: { receivedDateTime: 'desc' },
        take: 50,
        select: {
          id: true,
          subject: true,
          bodyPreview: true,
          from: true,
          receivedDateTime: true,
        },
      }),
      // Get documents linked to this case via CaseDocument
      prisma.caseDocument.findMany({
        where: { caseId },
        orderBy: { linkedAt: 'desc' },
        take: 30,
        include: {
          document: {
            select: {
              id: true,
              fileName: true,
              fileType: true,
              createdAt: true,
            },
          },
        },
      }),
      // Use CommunicationEntry with InternalNote channel for internal notes
      prisma.communicationEntry.findMany({
        where: {
          caseId,
          channelType: 'InternalNote',
        },
        orderBy: { sentAt: 'desc' },
        take: 20,
        select: {
          id: true,
          body: true,
          sentAt: true,
          senderName: true,
        },
      }),
      prisma.task.findMany({
        where: { caseId },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          completedAt: true,
        },
      }),
    ]);

    return {
      coreContext,
      caseData: caseData
        ? {
            ...caseData,
            actors: caseData.actors.map((a) => ({
              name: a.name,
              role: a.role,
            })),
            teamMembers: caseData.teamMembers.map((tm) => ({
              user: tm.user,
              role: tm.role,
            })),
          }
        : null,
      emails,
      documents: caseDocuments.map((cd) => cd.document),
      notes,
      tasks,
    };
  }

  /**
   * Compute a hash of the case data to detect changes
   */
  private computeHash(context: CaseContext): string {
    const data = {
      emailIds: context.emails.map((e) => e.id).sort(),
      documentIds: context.documents.map((d) => d.id).sort(),
      noteIds: context.notes.map((n) => n.id).sort(),
      taskIds: context.tasks.map((t) => t.id).sort(),
      caseStatus: context.caseData?.status,
    };
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex').substring(0, 32);
  }

  /**
   * Get the system prompt for AI summary generation
   */
  private getSystemPrompt(): string {
    return `Ești un asistent juridic AI. Analizezi datele unui dosar juridic și generezi un rezumat structurat pentru avocatul responsabil.

IMPORTANT: Răspunde EXCLUSIV în limba ROMÂNĂ.

Reguli:
- Fii CONCIS și DIRECT - avocatul cunoaște deja contextul general
- Extrage doar faptele și dezvoltările esențiale
- Evidențiază: termene, angajamente, riscuri, decizii importante, probleme nerezolvate
- Ignoră detalii administrative nesemnificative

Returnează JSON valid:
{
  "executiveSummary": "1-2 paragrafe - esența situației actuale a dosarului",
  "currentStatus": "O propoziție - starea curentă",
  "keyDevelopments": ["Dezvoltare cheie 1", "Dezvoltare cheie 2", ...],
  "openIssues": ["Problemă nerezolvată 1", "Problemă nerezolvată 2", ...]
}

RĂSPUNDE DOAR CU JSON VALID, fără explicații suplimentare.`;
  }

  /**
   * Build the prompt with case context
   */
  private buildPrompt(context: CaseContext): string {
    const { coreContext, caseData, emails, documents, notes, tasks } = context;

    if (!caseData) {
      throw new Error('Case data is required');
    }

    // Build client section with full identity if available
    let clientSection = `CLIENT: ${caseData.client?.name || 'Necunoscut'}`;
    if (coreContext?.client) {
      const c = coreContext.client;
      const clientLines = [`CLIENT: ${c.name}`];
      if (c.companyType) clientLines.push(`Tip societate: ${c.companyType}`);
      if (c.cui) clientLines.push(`CUI: ${c.cui}`);
      if (c.registrationNumber) clientLines.push(`Nr. Reg. Com.: ${c.registrationNumber}`);
      if (c.address) clientLines.push(`Adresă: ${c.address}`);
      if (c.email) clientLines.push(`Email: ${c.email}`);
      if (c.phone) clientLines.push(`Tel: ${c.phone}`);

      if (c.administrators && c.administrators.length > 0) {
        clientLines.push('\nAdministratori:');
        for (const admin of c.administrators) {
          const details = [admin.name];
          if (admin.role) details.push(`(${admin.role})`);
          if (admin.email) details.push(`- ${admin.email}`);
          clientLines.push(`- ${details.join(' ')}`);
        }
      }

      if (c.contacts && c.contacts.length > 0) {
        clientLines.push('\nContacte:');
        for (const contact of c.contacts) {
          const details = [contact.name];
          if (contact.role) details.push(`(${contact.role})`);
          if (contact.email) details.push(`- ${contact.email}`);
          clientLines.push(`- ${details.join(' ')}`);
        }
      }

      clientSection = clientLines.join('\n');
    }

    // Build case section with full identity if available
    let caseSection = `DOSAR: ${caseData.title} (${caseData.caseNumber})\nSTATUS: ${caseData.status}\nTIP: ${caseData.type || 'General'}`;
    if (coreContext?.case) {
      const cs = coreContext.case;
      const caseLines = [`DOSAR: ${cs.title} (${cs.number})`];
      caseLines.push(`STATUS: ${cs.status}`);
      caseLines.push(`TIP: ${cs.type || 'General'}`);
      if (cs.court) caseLines.push(`Instanță: ${cs.court}`);
      if (cs.currentPhase) caseLines.push(`Fază curentă: ${cs.currentPhase}`);
      if (cs.keywords && cs.keywords.length > 0)
        caseLines.push(`Cuvinte cheie: ${cs.keywords.join(', ')}`);
      if (cs.referenceNumbers && cs.referenceNumbers.length > 0)
        caseLines.push(`Nr. referință: ${cs.referenceNumbers.join(', ')}`);
      if (cs.summary) caseLines.push(`\nDescriere: ${cs.summary}`);
      caseSection = caseLines.join('\n');
    }

    // Build actors section with full details if available
    let actorsSection =
      caseData.actors.map((a) => `- ${a.name} (${a.role})`).join('\n') || '- Nu sunt părți';
    if (coreContext?.actors && coreContext.actors.length > 0) {
      actorsSection = coreContext.actors
        .map((a) => {
          const details = [`${a.role}: ${a.name}`];
          if (a.organization) details.push(`(${a.organization})`);
          if (a.email) details.push(`- ${a.email}`);
          if (a.phone) details.push(`- ${a.phone}`);
          return `- ${details.join(' ')}`;
        })
        .join('\n');
    }

    // Build team section
    let teamSection =
      caseData.teamMembers
        .map((tm) => `- ${tm.user.firstName} ${tm.user.lastName} (${tm.role})`)
        .join('\n') || '- Nu sunt membri asignați';
    if (coreContext?.team && coreContext.team.length > 0) {
      teamSection = coreContext.team.map((m) => `- ${m.name} (${m.role})`).join('\n');
    }

    // Format emails
    const emailSummaries = emails
      .slice(0, 30)
      .map((e) => {
        const fromData = e.from as { name?: string; address?: string } | null;
        return `- [${e.receivedDateTime.toISOString().split('T')[0]}] ${fromData?.name || fromData?.address || 'Unknown'}: ${e.subject || '(fără subiect)'}`;
      })
      .join('\n');

    // Format documents
    const documentList = documents
      .slice(0, 20)
      .map((d) => `- ${d.fileName} (${d.fileType || 'document'})`)
      .join('\n');

    // Format notes (internal communication entries)
    const noteSummaries = notes
      .slice(0, 15)
      .map((n) => {
        const preview = n.body.substring(0, 150).replace(/\n/g, ' ');
        return `- [${n.sentAt.toISOString().split('T')[0]}] ${n.senderName}: ${preview}...`;
      })
      .join('\n');

    // Format tasks
    const completedTasks = tasks.filter((t) => t.status === 'Completed').length;
    const taskSummaries = tasks
      .slice(0, 15)
      .map((t) => {
        const status = t.status === 'Completed' ? '✓' : '○';
        const due = t.dueDate ? ` (termen: ${t.dueDate.toISOString().split('T')[0]})` : '';
        return `- ${status} ${t.title}${due}`;
      })
      .join('\n');

    return `${caseSection}

${clientSection}

ECHIPĂ:
${teamSection}

PĂRȚI/CONTACTE:
${actorsSection}

EMAILURI RECENTE (${emails.length} total):
${emailSummaries || '- Nu sunt emailuri'}

DOCUMENTE (${documents.length} total):
${documentList || '- Nu sunt documente'}

NOTE INTERNE (${notes.length} total):
${noteSummaries || '- Nu sunt note'}

SARCINI (${tasks.length} total, ${completedTasks} finalizate):
${taskSummaries || '- Nu sunt sarcini'}

Generează un rezumat structurat în format JSON.`;
  }

  /**
   * Parse AI response to extract summary
   */
  private parseResponse(content: string): SummaryResult {
    try {
      // Try to extract JSON from potential markdown code blocks
      let jsonContent = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonContent);

      return {
        executiveSummary: parsed.executiveSummary || 'Rezumat indisponibil.',
        currentStatus: parsed.currentStatus || 'Status necunoscut.',
        keyDevelopments: Array.isArray(parsed.keyDevelopments) ? parsed.keyDevelopments : [],
        openIssues: Array.isArray(parsed.openIssues) ? parsed.openIssues : [],
      };
    } catch (error) {
      console.error('[CaseSummary] Failed to parse AI response:', content);
      // Return fallback
      return {
        executiveSummary: content.substring(0, 500),
        currentStatus: 'Rezumat generat parțial.',
        keyDevelopments: [],
        openIssues: [],
      };
    }
  }
}

// Export singleton instance
export const caseSummaryService = new CaseSummaryService();
