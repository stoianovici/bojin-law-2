/**
 * Case Chapters Service
 * AI-generated archival history structure for case timeline
 *
 * Generates chapters based on detected case phases:
 * - Consultanță inițială, Negociere, Prima instanță, Apel, Executare, etc.
 * - Chapters regenerated weekly via batch job
 * - No financial events (separate billing section handles this)
 */

import { prisma } from '@legal-platform/database';
import { AIOperationType } from '@legal-platform/types';
import { CasePhase, CaseChapterEventType } from '@prisma/client';
import { aiService } from './ai.service';
import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

interface CaseContext {
  caseData: {
    id: string;
    title: string;
    caseNumber: string;
    type: string | null;
    status: string;
    openedDate: Date;
    closedDate: Date | null;
    client: { name: string } | null;
    actors: Array<{ name: string; role: string }>;
    teamMembers: Array<{
      user: { firstName: string; lastName: string };
      role: string;
      assignedAt: Date;
    }>;
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
  statusChanges: Array<{
    id: string;
    oldValue: string | null;
    newValue: string | null;
    timestamp: Date;
  }>;
  teamChanges: Array<{
    userId: string;
    userName: string;
    role: string;
    assignedAt: Date;
    action: 'added' | 'removed';
  }>;
}

interface DetectedPhase {
  phase: CasePhase;
  title: string;
  startDate: Date | null;
  endDate: Date | null;
  summary: string;
}

interface TimelineEvent {
  eventType: CaseChapterEventType;
  title: string;
  summary: string;
  occurredAt: Date;
  metadata: {
    documentIds?: string[];
    emailIds?: string[];
    taskIds?: string[];
  };
}

interface ChapterResult {
  phase: CasePhase;
  title: string;
  summary: string;
  startDate: Date | null;
  endDate: Date | null;
  events: TimelineEvent[];
}

// ============================================================================
// Phase Title Mapping (Romanian)
// ============================================================================

const PHASE_TITLES: Record<CasePhase, string> = {
  ConsultantaInitiala: 'Consultanță Inițială',
  Negociere: 'Negociere',
  DueDiligence: 'Due Diligence',
  PrimaInstanta: 'Prima Instanță',
  Apel: 'Apel',
  Executare: 'Executare',
  Mediere: 'Mediere',
  Arbitraj: 'Arbitraj',
  Inchis: 'Încheiat',
};

// ============================================================================
// Service
// ============================================================================

export class CaseChaptersService {
  /**
   * Generate or refresh chapters for a case
   * Alias: generateChapters (used by worker)
   */
  async generateChaptersForCase(caseId: string, firmId: string): Promise<void> {
    console.log(`[CaseChapters] Generating chapters for case ${caseId}`);

    try {
      // 1. Gather context
      const context = await this.gatherCaseContext(caseId);
      if (!context.caseData) {
        throw new Error(`Case ${caseId} not found`);
      }

      // 2. Check if regeneration is needed (compare hash)
      const dataVersionHash = this.computeHash(context);
      const existingChapters = await prisma.caseChapter.findMany({
        where: { caseId },
        select: { dataVersionHash: true, isStale: true },
        take: 1,
      });

      // Skip if data hasn't changed and not marked stale
      if (
        existingChapters.length > 0 &&
        existingChapters[0].dataVersionHash === dataVersionHash &&
        !existingChapters[0].isStale
      ) {
        console.log(`[CaseChapters] Case ${caseId} chapters are up to date, skipping`);
        return;
      }

      // 3. Detect phases using AI
      const phases = await this.detectPhases(context, firmId);

      // 4. Extract timeline events for each phase
      const chapters: ChapterResult[] = [];
      for (const phase of phases) {
        const events = await this.extractTimelineEvents(context, phase, firmId);
        chapters.push({
          ...phase,
          events,
        });
      }

      // 5. Store in database (transaction)
      await prisma.$transaction(async (tx) => {
        // Delete existing chapters and events for this case
        await tx.caseChapterEvent.deleteMany({
          where: { chapter: { caseId } },
        });
        await tx.caseChapter.deleteMany({
          where: { caseId },
        });

        // Create new chapters with events
        for (let i = 0; i < chapters.length; i++) {
          const chapter = chapters[i];
          await tx.caseChapter.create({
            data: {
              caseId,
              firmId,
              phase: chapter.phase,
              title: chapter.title,
              summary: chapter.summary,
              startDate: chapter.startDate,
              endDate: chapter.endDate,
              generatedAt: new Date(),
              dataVersionHash,
              isStale: false,
              sortOrder: i,
              events: {
                create: chapter.events.map((event, eventIndex) => ({
                  eventType: event.eventType,
                  title: event.title,
                  summary: event.summary,
                  occurredAt: event.occurredAt,
                  metadata: event.metadata,
                  sortOrder: eventIndex,
                })),
              },
            },
          });
        }
      });

      console.log(`[CaseChapters] Generated ${chapters.length} chapters for case ${caseId}`);
    } catch (error) {
      console.error(`[CaseChapters] Failed to generate chapters for case ${caseId}:`, error);
      throw error;
    }
  }

  /**
   * Alias for generateChaptersForCase (used by worker)
   */
  async generateChapters(caseId: string, firmId: string): Promise<void> {
    return this.generateChaptersForCase(caseId, firmId);
  }

  /**
   * Get chapters for a case
   */
  async getCaseChapters(caseId: string) {
    return prisma.caseChapter.findMany({
      where: { caseId },
      include: {
        events: {
          orderBy: { occurredAt: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Mark chapters as stale for regeneration
   */
  async markChaptersStale(caseId: string): Promise<void> {
    await prisma.caseChapter.updateMany({
      where: { caseId },
      data: { isStale: true },
    });
  }

  /**
   * Get stale chapters that need regeneration
   */
  async getStaleChapters(limit: number = 10) {
    return prisma.caseChapter.findMany({
      where: { isStale: true },
      take: limit,
      orderBy: { updatedAt: 'asc' },
      include: {
        case: {
          select: { id: true, firmId: true },
        },
      },
      distinct: ['caseId'],
    });
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Gather all relevant case data for AI context
   */
  async gatherCaseContext(caseId: string): Promise<CaseContext> {
    const [caseData, emailLinks, caseDocuments, notes, tasks, auditLogs] = await Promise.all([
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
      // Use EmailCaseLink junction table (not deprecated Email.caseId field)
      prisma.emailCaseLink.findMany({
        where: { caseId },
        orderBy: { email: { receivedDateTime: 'asc' } },
        include: {
          email: {
            select: {
              id: true,
              subject: true,
              bodyPreview: true,
              from: true,
              receivedDateTime: true,
            },
          },
        },
      }),
      prisma.caseDocument.findMany({
        where: { caseId },
        orderBy: { linkedAt: 'asc' },
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
      prisma.communicationEntry.findMany({
        where: {
          caseId,
          channelType: 'InternalNote',
        },
        orderBy: { sentAt: 'asc' },
        select: {
          id: true,
          body: true,
          sentAt: true,
          senderName: true,
        },
      }),
      prisma.task.findMany({
        where: { caseId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          completedAt: true,
        },
      }),
      // Get status changes from audit log
      prisma.caseAuditLog.findMany({
        where: {
          caseId,
          fieldName: 'status',
        },
        orderBy: { timestamp: 'asc' },
        select: {
          id: true,
          oldValue: true,
          newValue: true,
          timestamp: true,
        },
      }),
    ]);

    // Extract team changes from team members
    const teamChanges: CaseContext['teamChanges'] = [];
    if (caseData?.teamMembers) {
      for (const tm of caseData.teamMembers) {
        teamChanges.push({
          userId: tm.userId,
          userName: `${tm.user.firstName} ${tm.user.lastName}`,
          role: tm.role,
          assignedAt: tm.assignedAt,
          action: 'added',
        });
      }
    }

    // Extract emails from EmailCaseLink records
    const emails = emailLinks.map((el) => el.email);

    return {
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
              assignedAt: tm.assignedAt,
            })),
          }
        : null,
      emails,
      documents: caseDocuments.map((cd) => cd.document),
      notes,
      tasks,
      statusChanges: auditLogs,
      teamChanges,
    };
  }

  /**
   * Use AI to detect what phases the case has been through
   */
  private async detectPhases(context: CaseContext, firmId: string): Promise<DetectedPhase[]> {
    const prompt = this.buildPhaseDetectionPrompt(context);

    const response = await aiService.generate({
      prompt,
      systemPrompt: this.getPhaseDetectionSystemPrompt(),
      operationType: AIOperationType.ThreadAnalysis,
      firmId,
      maxTokens: 2000,
      temperature: 0.3,
      useCache: false,
    });

    return this.parsePhaseResponse(response.content);
  }

  /**
   * Extract timeline events for a specific phase
   */
  private async extractTimelineEvents(
    context: CaseContext,
    phase: DetectedPhase,
    firmId: string
  ): Promise<TimelineEvent[]> {
    const prompt = this.buildEventExtractionPrompt(context, phase);

    const response = await aiService.generate({
      prompt,
      systemPrompt: this.getEventExtractionSystemPrompt(),
      operationType: AIOperationType.ThreadAnalysis,
      firmId,
      maxTokens: 3000,
      temperature: 0.3,
      useCache: false,
    });

    return this.parseEventResponse(response.content, context);
  }

  /**
   * Compute a hash of the case data to detect changes
   */
  computeHash(context: CaseContext): string {
    const data = {
      emailIds: context.emails.map((e) => e.id).sort(),
      documentIds: context.documents.map((d) => d.id).sort(),
      noteIds: context.notes.map((n) => n.id).sort(),
      taskIds: context.tasks.map((t) => t.id).sort(),
      statusChangeIds: context.statusChanges.map((s) => s.id).sort(),
      caseStatus: context.caseData?.status,
      teamMemberCount: context.teamChanges.length,
    };
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex').substring(0, 64);
  }

  /**
   * Get the system prompt for phase detection
   */
  getSystemPrompt(): string {
    return this.getPhaseDetectionSystemPrompt();
  }

  private getPhaseDetectionSystemPrompt(): string {
    return `Ești un asistent juridic AI specializat în analiza dosarelor juridice românești.
Analizezi cronologia unui dosar și identifici fazele prin care a trecut.

FAZELE POSIBILE (în ordine tipică):
- ConsultantaInitiala: Prima întâlnire cu clientul, evaluare inițială
- Negociere: Negocieri cu partea adversă, discuții de soluționare
- DueDiligence: Verificări, analize documente, investigații
- PrimaInstanta: Proces la prima instanță (tribunal/judecătorie)
- Apel: Recurs sau apel
- Executare: Executare silită
- Mediere: Procedură de mediere
- Arbitraj: Procedură arbitrală
- Inchis: Dosarul s-a încheiat

REGULI:
- Analizează emailurile, documentele, sarcinile și notele interne
- Identifică fazele REALE prin care a trecut dosarul (nu presupune)
- Estimează datele de început și sfârșit pentru fiecare fază
- Generează un rezumat concis pentru fiecare fază
- NU include faze care nu au dovezi în date
- Exclude informații financiare/facturare

RĂSPUNDE ÎN FORMAT JSON VALID:
{
  "phases": [
    {
      "phase": "CasePhase enum value",
      "title": "Titlu în română",
      "startDate": "YYYY-MM-DD sau null",
      "endDate": "YYYY-MM-DD sau null",
      "summary": "Rezumat concis al fazei"
    }
  ]
}

RĂSPUNDE DOAR CU JSON VALID.`;
  }

  private getEventExtractionSystemPrompt(): string {
    return `Ești un asistent juridic AI care extrage evenimente cronologice dintr-un dosar juridic.

TIPURI DE EVENIMENTE:
- Document: Document încărcat, semnat sau depus
- Email: Corespondență importantă
- Task: Sarcină finalizată
- CourtOutcome: Hotărâre sau decizie a instanței
- ContractSigned: Semnare contract
- Negotiation: Etapă importantă în negociere
- Deadline: Termen respectat sau ratat
- ClientDecision: Decizie importantă a clientului
- TeamChange: Schimbare în echipă
- StatusChange: Schimbare status dosar
- Milestone: Altă etapă importantă

REGULI:
- Extrage DOAR evenimente relevante pentru faza specificată
- Fiecare eveniment trebuie să aibă dată precisă
- Include ID-uri de documente/emailuri în metadata când sunt disponibile
- Rezumatele trebuie să fie concise dar informative
- Exclude informații financiare
- Răspunde în română

RĂSPUNDE ÎN FORMAT JSON VALID:
{
  "events": [
    {
      "eventType": "CaseChapterEventType enum value",
      "title": "Titlu scurt",
      "summary": "Rezumat eveniment",
      "occurredAt": "YYYY-MM-DDTHH:mm:ss.000Z",
      "metadata": {
        "documentIds": ["uuid1", "uuid2"],
        "emailIds": ["uuid1"],
        "taskIds": []
      }
    }
  ]
}

RĂSPUNDE DOAR CU JSON VALID.`;
  }

  /**
   * Build prompt for phase detection
   */
  private buildPhaseDetectionPrompt(context: CaseContext): string {
    if (!context.caseData) {
      throw new Error('Case data is required');
    }

    const { caseData, emails, documents, notes, tasks, statusChanges } = context;

    // Format emails chronologically
    const emailSummaries = emails
      .slice(0, 50)
      .map((e) => {
        const fromData = e.from as { name?: string; address?: string } | null;
        return `- [${e.receivedDateTime.toISOString().split('T')[0]}] ${fromData?.name || fromData?.address || 'Necunoscut'}: ${e.subject || '(fără subiect)'}`;
      })
      .join('\n');

    // Format documents
    const documentList = documents
      .slice(0, 30)
      .map((d) => `- [${d.createdAt.toISOString().split('T')[0]}] ${d.fileName}`)
      .join('\n');

    // Format tasks
    const taskSummaries = tasks
      .slice(0, 30)
      .map((t) => {
        const status = t.status === 'Completed' ? '✓' : '○';
        const date = t.completedAt || t.dueDate;
        return `- ${status} [${date?.toISOString().split('T')[0] || 'N/A'}] ${t.title}`;
      })
      .join('\n');

    // Format status changes
    const statusChangeSummaries = statusChanges
      .map((s) => `- [${s.timestamp.toISOString().split('T')[0]}] ${s.oldValue} → ${s.newValue}`)
      .join('\n');

    // Format notes
    const noteSummaries = notes
      .slice(0, 20)
      .map((n) => {
        const preview = n.body.substring(0, 100).replace(/\n/g, ' ');
        return `- [${n.sentAt.toISOString().split('T')[0]}] ${n.senderName}: ${preview}...`;
      })
      .join('\n');

    return `DOSAR: ${caseData.title} (${caseData.caseNumber})
CLIENT: ${caseData.client?.name || 'Necunoscut'}
TIP: ${caseData.type || 'General'}
STATUS CURENT: ${caseData.status}
DATA DESCHIDERE: ${caseData.openedDate.toISOString().split('T')[0]}
${caseData.closedDate ? `DATA ÎNCHIDERE: ${caseData.closedDate.toISOString().split('T')[0]}` : ''}

PĂRȚI:
${caseData.actors.map((a) => `- ${a.name} (${a.role})`).join('\n') || '- Nu sunt părți'}

EMAILURI CRONOLOGIC (${emails.length} total):
${emailSummaries || '- Nu sunt emailuri'}

DOCUMENTE CRONOLOGIC (${documents.length} total):
${documentList || '- Nu sunt documente'}

SARCINI (${tasks.length} total):
${taskSummaries || '- Nu sunt sarcini'}

SCHIMBĂRI STATUS:
${statusChangeSummaries || '- Nicio schimbare'}

NOTE INTERNE:
${noteSummaries || '- Nu sunt note'}

Analizează cronologia și identifică fazele prin care a trecut acest dosar.`;
  }

  /**
   * Build prompt for event extraction
   */
  private buildEventExtractionPrompt(context: CaseContext, phase: DetectedPhase): string {
    const { emails, documents, tasks, notes, statusChanges, teamChanges } = context;

    // Filter data to phase date range
    const filterByDate = <T extends { [key: string]: unknown }>(
      items: T[],
      dateField: keyof T
    ): T[] => {
      return items.filter((item) => {
        const date = item[dateField];
        if (!(date instanceof Date)) return false;
        if (phase.startDate && date < phase.startDate) return false;
        if (phase.endDate && date > phase.endDate) return false;
        return true;
      });
    };

    const phaseEmails = filterByDate(emails, 'receivedDateTime');
    const phaseDocs = filterByDate(documents, 'createdAt');
    const phaseTasks = filterByDate(tasks, 'completedAt');
    const phaseNotes = filterByDate(notes, 'sentAt');
    const phaseStatusChanges = filterByDate(statusChanges, 'timestamp');
    const phaseTeamChanges = filterByDate(teamChanges, 'assignedAt');

    // Format for prompt
    const emailDetails = phaseEmails
      .slice(0, 30)
      .map((e) => {
        const fromData = e.from as { name?: string; address?: string } | null;
        return `- [ID: ${e.id}] [${e.receivedDateTime.toISOString()}] ${fromData?.name || 'Necunoscut'}: ${e.subject}\n  Preview: ${e.bodyPreview?.substring(0, 150) || 'N/A'}`;
      })
      .join('\n');

    const docDetails = phaseDocs
      .slice(0, 20)
      .map((d) => `- [ID: ${d.id}] [${d.createdAt.toISOString()}] ${d.fileName} (${d.fileType})`)
      .join('\n');

    const taskDetails = phaseTasks
      .slice(0, 20)
      .map(
        (t) => `- [ID: ${t.id}] [${t.completedAt?.toISOString() || 'N/A'}] ${t.title} (${t.status})`
      )
      .join('\n');

    const noteDetails = phaseNotes
      .slice(0, 15)
      .map((n) => `- [${n.sentAt.toISOString()}] ${n.senderName}: ${n.body.substring(0, 200)}`)
      .join('\n');

    const statusDetails = phaseStatusChanges
      .map((s) => `- [${s.timestamp.toISOString()}] Status: ${s.oldValue} → ${s.newValue}`)
      .join('\n');

    const teamDetails = phaseTeamChanges
      .map((t) => `- [${t.assignedAt.toISOString()}] ${t.action}: ${t.userName} (${t.role})`)
      .join('\n');

    return `FAZĂ: ${phase.title} (${phase.phase})
PERIOADĂ: ${phase.startDate?.toISOString().split('T')[0] || 'N/A'} - ${phase.endDate?.toISOString().split('T')[0] || 'prezent'}
REZUMAT FAZĂ: ${phase.summary}

EMAILURI DIN ACEASTĂ FAZĂ:
${emailDetails || '- Niciun email'}

DOCUMENTE DIN ACEASTĂ FAZĂ:
${docDetails || '- Niciun document'}

SARCINI FINALIZATE ÎN ACEASTĂ FAZĂ:
${taskDetails || '- Nicio sarcină'}

NOTE INTERNE:
${noteDetails || '- Nicio notă'}

SCHIMBĂRI STATUS:
${statusDetails || '- Nicio schimbare'}

MODIFICĂRI ECHIPĂ:
${teamDetails || '- Nicio modificare'}

Extrage evenimentele cronologice importante din această fază. Include ID-urile documentelor și emailurilor în metadata.`;
  }

  /**
   * Parse AI response for phase detection
   */
  parseResponse(content: string): DetectedPhase[] {
    return this.parsePhaseResponse(content);
  }

  private parsePhaseResponse(content: string): DetectedPhase[] {
    try {
      // Extract JSON from potential markdown code blocks
      let jsonContent = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonContent);
      const phases: DetectedPhase[] = [];

      if (Array.isArray(parsed.phases)) {
        for (const p of parsed.phases) {
          // Validate phase enum
          if (!Object.values(CasePhase).includes(p.phase)) {
            console.warn(`[CaseChapters] Invalid phase: ${p.phase}`);
            continue;
          }

          phases.push({
            phase: p.phase as CasePhase,
            title: p.title || PHASE_TITLES[p.phase as CasePhase],
            startDate: p.startDate ? new Date(p.startDate) : null,
            endDate: p.endDate ? new Date(p.endDate) : null,
            summary: p.summary || '',
          });
        }
      }

      // Ensure at least ConsultantaInitiala phase exists
      if (phases.length === 0) {
        phases.push({
          phase: CasePhase.ConsultantaInitiala,
          title: PHASE_TITLES.ConsultantaInitiala,
          startDate: null,
          endDate: null,
          summary: 'Fază inițială a dosarului.',
        });
      }

      return phases;
    } catch (error) {
      console.error('[CaseChapters] Failed to parse phase response:', content);
      // Return default phase
      return [
        {
          phase: CasePhase.ConsultantaInitiala,
          title: PHASE_TITLES.ConsultantaInitiala,
          startDate: null,
          endDate: null,
          summary: 'Fază inițială a dosarului.',
        },
      ];
    }
  }

  /**
   * Parse AI response for event extraction
   */
  private parseEventResponse(content: string, context: CaseContext): TimelineEvent[] {
    try {
      // Extract JSON from potential markdown code blocks
      let jsonContent = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonContent);
      const events: TimelineEvent[] = [];

      // Create lookup sets for validation
      const validDocIds = new Set(context.documents.map((d) => d.id));
      const validEmailIds = new Set(context.emails.map((e) => e.id));
      const validTaskIds = new Set(context.tasks.map((t) => t.id));

      if (Array.isArray(parsed.events)) {
        for (const e of parsed.events) {
          // Validate event type
          if (!Object.values(CaseChapterEventType).includes(e.eventType)) {
            console.warn(`[CaseChapters] Invalid event type: ${e.eventType}`);
            continue;
          }

          // Validate and filter metadata IDs
          const metadata: TimelineEvent['metadata'] = {};

          if (Array.isArray(e.metadata?.documentIds)) {
            metadata.documentIds = e.metadata.documentIds.filter((id: string) =>
              validDocIds.has(id)
            );
          }

          if (Array.isArray(e.metadata?.emailIds)) {
            metadata.emailIds = e.metadata.emailIds.filter((id: string) => validEmailIds.has(id));
          }

          if (Array.isArray(e.metadata?.taskIds)) {
            metadata.taskIds = e.metadata.taskIds.filter((id: string) => validTaskIds.has(id));
          }

          events.push({
            eventType: e.eventType as CaseChapterEventType,
            title: e.title || 'Eveniment',
            summary: e.summary || '',
            occurredAt: new Date(e.occurredAt),
            metadata,
          });
        }
      }

      // Sort by date
      events.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

      return events;
    } catch (error) {
      console.error('[CaseChapters] Failed to parse event response:', content);
      return [];
    }
  }
}

// Export singleton instance
export const caseChaptersService = new CaseChaptersService();
