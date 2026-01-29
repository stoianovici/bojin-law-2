/**
 * Case Context Document Service
 * Generates and manages comprehensive AI context documents for cases
 *
 * Features:
 * - Full, standard, and critical tier context generation
 * - Actor-specific communication context
 * - Document summaries with user descriptions for scans
 * - Embedded client context snapshot
 * - Tiered compression using Haiku
 */

import { prisma } from '@legal-platform/database';
import type { CaseActorRole } from '@prisma/client';
import type {
  CaseContextDocumentContent,
  CaseIdentity,
  CaseClientInfo,
  CaseActorContext,
  CaseTeamMemberContext,
  KeyDocumentContext,
  TimelinePhase,
  CaseDeadlineInfo,
  RecentActivity,
  CommunicationThreadSummary,
  PendingAction,
  ActorCommunicationHistory,
  ContextWarning,
  ContextTier,
  AgentContextRequest,
  AgentContextResponse,
  ContextDocumentSection,
  ClientContextDocumentContent,
} from '@legal-platform/types';
import { AGENT_SECTION_DEFAULTS } from '@legal-platform/types';
import { aiClient, getModelForFeature } from './ai-client.service';
import { clientContextDocumentService } from './client-context-document.service';

// ============================================================================
// Constants
// ============================================================================

const VALIDITY_HOURS = 12;

// ============================================================================
// Helper Functions
// ============================================================================

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return '';
  return date.toLocaleDateString('ro-RO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatShortDate(date: Date | null | undefined): string {
  if (!date) return '';
  return date.toLocaleDateString('ro-RO', {
    month: 'short',
    day: 'numeric',
  });
}

function translateActorRole(role: CaseActorRole): string {
  const translations: Record<string, string> = {
    Client: 'Client',
    OpposingParty: 'Parte adversă',
    Court: 'Instanță',
    Witness: 'Martor',
    Expert: 'Expert',
    Executor: 'Executor',
    Notary: 'Notar',
    Authority: 'Autoritate',
    Other: 'Altele',
  };
  return translations[role] || role;
}

/**
 * Extract sender name from Microsoft Graph email 'from' JSON field
 * Format: { emailAddress: { name: "John Doe", address: "john@example.com" } }
 */
function getEmailSenderName(from: unknown): string | undefined {
  if (!from || typeof from !== 'object') return undefined;
  const emailAddress = (from as Record<string, unknown>).emailAddress;
  if (!emailAddress || typeof emailAddress !== 'object') return undefined;
  return (emailAddress as Record<string, unknown>).name as string | undefined;
}

// ============================================================================
// Context Generation
// ============================================================================

async function buildCaseContextContent(
  caseId: string,
  firmId: string
): Promise<CaseContextDocumentContent> {
  // Fetch case with all related data
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      client: true,
      actors: {
        include: {
          creator: {
            select: { firstName: true, lastName: true },
          },
        },
      },
      teamMembers: {
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, role: true },
          },
        },
      },
      documents: {
        include: {
          document: {
            select: {
              id: true,
              fileName: true,
              uploadedAt: true,
              extractionStatus: true,
              extractedContent: true,
              userDescription: true,
              userDescriptionAt: true,
              metadata: true,
            },
          },
        },
        take: 20,
        orderBy: { linkedAt: 'desc' },
      },
      tasks: {
        where: {
          status: { not: 'Completed' },
          dueDate: { not: null },
        },
        orderBy: { dueDate: 'asc' },
        take: 10,
      },
      emails: {
        select: {
          id: true,
          subject: true,
          from: true,
          toRecipients: true,
          receivedDateTime: true,
          conversationId: true,
          isRead: true,
        },
        orderBy: { receivedDateTime: 'desc' },
        take: 50,
      },
      chapters: {
        orderBy: { startDate: 'desc' },
      },
      notes: {
        include: {
          author: {
            select: { firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  });

  if (!caseData) {
    throw new Error(`Case not found: ${caseId}`);
  }

  // Build identity
  const identity: CaseIdentity = {
    caseNumber: caseData.caseNumber,
    title: caseData.title,
    type: caseData.type,
    status: caseData.status,
    court: (caseData.metadata as Record<string, unknown>)?.court as string | undefined,
    phase: caseData.chapters[0]?.phase || undefined,
    value: caseData.value ? Number(caseData.value) : undefined,
    openedDate: formatDate(caseData.openedDate),
    closedDate: caseData.closedDate ? formatDate(caseData.closedDate) : undefined,
  };

  // Build client info
  const client: CaseClientInfo = {
    clientId: caseData.client.id,
    name: caseData.client.name,
    type: caseData.client.clientType || 'company',
    primaryContactName:
      ((caseData.client.contacts as Array<Record<string, unknown>>)?.[0]?.name as string) ||
      undefined,
    primaryContactEmail:
      ((caseData.client.contacts as Array<Record<string, unknown>>)?.[0]?.email as string) ||
      undefined,
  };

  // Build actors
  const actors: CaseActorContext[] = caseData.actors.map((actor) => ({
    id: actor.id,
    role: translateActorRole(actor.role),
    customRoleCode: actor.customRoleCode || undefined,
    name: actor.name,
    organization: actor.organization || undefined,
    email: actor.email || undefined,
    phone: actor.phone || undefined,
    communicationNotes: actor.communicationNotes || undefined,
    preferredTone: actor.preferredTone || undefined,
    isClient: actor.role === 'Client',
  }));

  // Build team
  const team: CaseTeamMemberContext[] = caseData.teamMembers.map((tm) => ({
    userId: tm.user.id,
    name: `${tm.user.firstName} ${tm.user.lastName}`,
    role: tm.user.role,
    caseRole: tm.role,
  }));

  // Build key documents
  const keyDocuments: KeyDocumentContext[] = caseData.documents.slice(0, 10).map((cd) => {
    const doc = cd.document;
    const isScan = doc.extractionStatus === 'NONE' || doc.extractionStatus === 'FAILED';

    return {
      documentId: doc.id,
      fileName: doc.fileName,
      uploadedAt: formatDate(doc.uploadedAt),
      isScan,
      aiSummary: doc.extractedContent ? doc.extractedContent.slice(0, 200) + '...' : undefined,
      userDescription: doc.userDescription || undefined,
      documentType: (doc.metadata as Record<string, unknown>)?.documentType as string | undefined,
    };
  });

  // Build timeline
  const phases: TimelinePhase[] = caseData.chapters.map((ch, i) => ({
    phase: ch.phase,
    startDate: formatDate(ch.startDate),
    endDate: ch.endDate ? formatDate(ch.endDate) : undefined,
    description: ch.summary || undefined,
    isCurrent: i === 0,
  }));

  const deadlines: CaseDeadlineInfo[] = caseData.tasks.map((task) => ({
    id: task.id,
    title: task.title,
    dueDate: formatDate(task.dueDate),
    type: task.type || 'task',
    status: task.dueDate && task.dueDate < new Date() ? 'overdue' : 'pending',
  }));

  // Build recent activity
  const recentActivity: RecentActivity[] = [];

  // Add recent emails as activity
  for (const email of caseData.emails.slice(0, 5)) {
    recentActivity.push({
      date: formatShortDate(email.receivedDateTime),
      type: 'email',
      description: email.subject || 'Email fără subiect',
      actorName: getEmailSenderName(email.from),
    });
  }

  // Add recent notes as activity
  for (const note of caseData.notes) {
    recentActivity.push({
      date: formatShortDate(note.createdAt),
      type: 'note',
      description: note.content.slice(0, 100) + (note.content.length > 100 ? '...' : ''),
      actorName: `${note.author.firstName} ${note.author.lastName}`,
    });
  }

  // Build communication context
  const threads: CommunicationThreadSummary[] = [];
  const threadMap = new Map<string, typeof caseData.emails>();

  for (const email of caseData.emails) {
    if (email.conversationId) {
      if (!threadMap.has(email.conversationId)) {
        threadMap.set(email.conversationId, []);
      }
      threadMap.get(email.conversationId)!.push(email);
    }
  }

  for (const [threadId, emails] of threadMap.entries()) {
    const participants = new Set<string>();
    emails.forEach((e) => {
      const senderName = getEmailSenderName(e.from);
      if (senderName) participants.add(senderName);
    });

    threads.push({
      threadId,
      subject: emails[0].subject || 'Fără subiect',
      participants: Array.from(participants),
      lastMessageDate: formatShortDate(emails[0].receivedDateTime),
      messageCount: emails.length,
      hasUnread: emails.some((e) => !e.isRead),
    });
  }

  // Build pending actions
  const pendingActions: PendingAction[] = [];

  // Check for unanswered emails
  const unansweredEmails = caseData.emails.filter((e) => !e.isRead);
  if (unansweredEmails.length > 0) {
    pendingActions.push({
      id: `pending-reply-${unansweredEmails[0].id}`,
      type: 'reply',
      description: `${unansweredEmails.length} emailuri necitite`,
    });
  }

  // Check for overdue tasks
  const overdueTasks = deadlines.filter((d) => d.status === 'overdue');
  if (overdueTasks.length > 0) {
    pendingActions.push({
      id: 'pending-overdue',
      type: 'other',
      description: `${overdueTasks.length} task-uri restante`,
      dueDate: overdueTasks[0].dueDate,
    });
  }

  // Build actor communication history
  const actorHistory: ActorCommunicationHistory[] = [];

  for (const actor of actors.slice(0, 5)) {
    if (!actor.email) continue;

    const actorEmails = caseData.emails.filter((e) => {
      const senderName = getEmailSenderName(e.from);
      return senderName?.toLowerCase().includes(actor.name.toLowerCase());
    });

    if (actorEmails.length > 0) {
      actorHistory.push({
        actorId: actor.id,
        actorName: actor.name,
        recentInteractions: actorEmails.slice(0, 3).map((e) => ({
          date: formatShortDate(e.receivedDateTime),
          type: 'email_received',
          summary: e.subject || 'Email fără subiect',
        })),
        pendingResponses: actorEmails.some((e) => !e.isRead),
        lastContactDate: formatShortDate(actorEmails[0].receivedDateTime),
      });
    }
  }

  // Build warnings
  const warnings: ContextWarning[] = [];

  // Check for overdue tasks
  if (overdueTasks.length > 0) {
    warnings.push({
      type: 'deadline',
      message: `${overdueTasks.length} task-uri restante`,
      severity: overdueTasks.length > 3 ? 'high' : 'medium',
    });
  }

  // Check for upcoming deadlines (next 3 days)
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  const upcomingDeadlines = caseData.tasks.filter(
    (t) => t.dueDate && t.dueDate <= threeDaysFromNow && t.dueDate >= new Date()
  );

  if (upcomingDeadlines.length > 0) {
    warnings.push({
      type: 'deadline',
      message: `${upcomingDeadlines.length} termene în următoarele 3 zile`,
      severity: 'high',
    });
  }

  // Check for actors with preferred tone notes
  const actorsWithTone = actors.filter((a) => a.preferredTone || a.communicationNotes);
  if (actorsWithTone.length > 0) {
    for (const actor of actorsWithTone) {
      if (actor.communicationNotes) {
        warnings.push({
          type: 'communication',
          message: `${actor.name}: ${actor.communicationNotes}`,
          severity: 'medium',
          relatedEntityId: actor.id,
        });
      }
    }
  }

  return {
    identity,
    client,
    actors,
    team,
    keyDocuments,
    timeline: {
      phases,
      deadlines,
      recentActivity,
    },
    communication: {
      threads: threads.slice(0, 5),
      pendingActions,
      actorHistory,
    },
    warnings,
    customNotes: caseData.description || undefined,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generate full tier markdown context
 */
function generateFullContextMarkdown(
  content: CaseContextDocumentContent,
  clientContext?: ClientContextDocumentContent
): string {
  const lines: string[] = [];

  lines.push(`# Context: ${content.identity.caseNumber} - ${content.identity.title}`);
  lines.push(`Generat: ${new Date().toLocaleDateString('ro-RO')} | Versiune: 1`);
  lines.push('');

  // Client section
  lines.push('## 🏢 CLIENT');
  lines.push(`Nume: ${content.client.name}`);
  lines.push(`Tip: ${content.client.type === 'company' ? 'Persoană juridică' : 'Persoană fizică'}`);
  if (content.client.primaryContactName) {
    lines.push(
      `Contact principal: ${content.client.primaryContactName}${content.client.primaryContactEmail ? ` - ${content.client.primaryContactEmail}` : ''}`
    );
  }
  if (clientContext) {
    lines.push(
      `_Client din ${clientContext.relationship.startDate}, ${clientContext.relationship.activeCaseCount} dosare active_`
    );
  }
  lines.push('');

  // Case section
  lines.push('## 📋 DOSAR');
  lines.push(
    `Nr: ${content.identity.caseNumber} | Tip: ${content.identity.type} | Status: ${content.identity.status}`
  );
  if (content.identity.court) {
    lines.push(`Instanță: ${content.identity.court}`);
  }
  if (content.identity.phase) {
    lines.push(`Fază: ${content.identity.phase}`);
  }
  if (content.identity.value) {
    lines.push(`Valoare: ${content.identity.value.toLocaleString('ro-RO')} RON`);
  }
  lines.push('');

  // Actors section
  lines.push('## 👥 PĂRȚI');
  for (const actor of content.actors) {
    lines.push(
      `- **${actor.role}**: ${actor.name}${actor.organization ? ` (${actor.organization})` : ''}${actor.email ? ` - ${actor.email}` : ''}`
    );
    if (actor.preferredTone || actor.communicationNotes) {
      lines.push(
        `  _Ton: ${actor.preferredTone || 'standard'}${actor.communicationNotes ? `, ${actor.communicationNotes}` : ''}_`
      );
    }
  }
  lines.push('');

  // Team section
  if (content.team.length > 0) {
    lines.push('## 👔 ECHIPĂ');
    for (const member of content.team) {
      lines.push(`- ${member.name} (${member.caseRole})`);
    }
    lines.push('');
  }

  // Documents section
  if (content.keyDocuments.length > 0) {
    lines.push('## 📄 DOCUMENTE CHEIE');
    for (const doc of content.keyDocuments) {
      const scanMarker = doc.isScan ? ' ⚠️ scan' : '';
      lines.push(`- **${doc.fileName}**${scanMarker}`);
      if (doc.userDescription) {
        lines.push(`  _Descriere: ${doc.userDescription}_`);
      } else if (doc.aiSummary) {
        lines.push(`  _${doc.aiSummary}_`);
      }
    }
    lines.push('');
  }

  // Timeline section
  if (content.timeline.deadlines.length > 0) {
    lines.push('## 📅 TERMENE');
    for (const deadline of content.timeline.deadlines.slice(0, 5)) {
      const icon =
        deadline.status === 'overdue' ? '🔴' : deadline.status === 'pending' ? '🟡' : '🟢';
      lines.push(`${icon} ${deadline.dueDate}: ${deadline.title}`);
    }
    lines.push('');
  }

  // Communication section
  if (content.communication.threads.length > 0 || content.communication.pendingActions.length > 0) {
    lines.push('## 💬 COMUNICARE');

    if (content.communication.pendingActions.length > 0) {
      lines.push('### Acțiuni pending:');
      for (const action of content.communication.pendingActions) {
        lines.push(
          `- [ ] ${action.description}${action.dueDate ? ` (până la ${action.dueDate})` : ''}`
        );
      }
    }

    if (content.communication.actorHistory.length > 0) {
      for (const hist of content.communication.actorHistory.slice(0, 3)) {
        lines.push(`### Cu ${hist.actorName}:`);
        for (const interaction of hist.recentInteractions.slice(0, 2)) {
          lines.push(`- ${interaction.date}: ${interaction.summary}`);
        }
        if (hist.pendingResponses) {
          lines.push('  _Răspuns în așteptare_');
        }
      }
    }
    lines.push('');
  }

  // Warnings section
  if (content.warnings.length > 0) {
    lines.push('## ⚠️ ATENȚIE');
    for (const warning of content.warnings) {
      const icon =
        warning.severity === 'critical' ? '🔴' : warning.severity === 'high' ? '🟠' : '🟡';
      lines.push(`${icon} ${warning.message}`);
    }
    lines.push('');
  }

  // Custom notes section
  if (content.customNotes) {
    lines.push('## 📝 NOTE');
    lines.push(content.customNotes);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate compressed context for standard tier
 */
async function generateStandardContext(fullContext: string, firmId: string): Promise<string> {
  const model = await getModelForFeature(firmId, 'context_compression');

  const prompt = `Comprimă următorul context de dosar la aproximativ 300 de tokeni, păstrând:
- Număr dosar, tip, status
- Client și contact principal
- Părți principale cu note de comunicare
- Următoarele 2-3 termene importante
- Orice avertismente critice

Context complet:
${fullContext}

Răspunde doar cu contextul comprimat, fără explicații.`;

  try {
    const response = await aiClient.complete(
      prompt,
      {
        feature: 'context_compression',
        firmId,
        entityType: 'case',
      },
      {
        model,
        maxTokens: 400,
        temperature: 0.2,
      }
    );
    return response.content;
  } catch (error) {
    console.error('[CaseContextDocument] Failed to compress to standard tier:', error);
    return fullContext.slice(0, 1200);
  }
}

/**
 * Generate compressed context for critical tier
 */
async function generateCriticalContext(fullContext: string, firmId: string): Promise<string> {
  const model = await getModelForFeature(firmId, 'context_compression');

  const prompt = `Comprimă următorul context de dosar la maxim 100 de tokeni, păstrând doar:
- Număr dosar și titlu
- Client
- Status curent

Context complet:
${fullContext}

Răspunde doar cu contextul comprimat, o singură propoziție.`;

  try {
    const response = await aiClient.complete(
      prompt,
      {
        feature: 'context_compression',
        firmId,
        entityType: 'case',
      },
      {
        model,
        maxTokens: 150,
        temperature: 0.2,
      }
    );
    return response.content;
  } catch (error) {
    console.error('[CaseContextDocument] Failed to compress to critical tier:', error);
    const caseNumber = fullContext.match(/Nr: ([^|]+)/)?.[1] || 'Dosar necunoscut';
    return `Dosar: ${caseNumber}`;
  }
}

/**
 * Generate section-specific context for an agent
 */
function generateSectionContext(
  content: CaseContextDocumentContent,
  sections: ContextDocumentSection[],
  targetActorId?: string
): string {
  const lines: string[] = [];

  for (const section of sections) {
    switch (section) {
      case 'identity':
        lines.push(`## DOSAR: ${content.identity.caseNumber}`);
        lines.push(`Titlu: ${content.identity.title}`);
        lines.push(`Tip: ${content.identity.type} | Status: ${content.identity.status}`);
        if (content.identity.court) lines.push(`Instanță: ${content.identity.court}`);
        lines.push('');
        break;

      case 'client':
        lines.push('## CLIENT');
        lines.push(`${content.client.name} (${content.client.type})`);
        if (content.client.primaryContactEmail) {
          lines.push(
            `Contact: ${content.client.primaryContactName} - ${content.client.primaryContactEmail}`
          );
        }
        lines.push('');
        break;

      case 'actors':
        lines.push('## PĂRȚI');
        for (const actor of content.actors) {
          // If targeting specific actor, highlight them
          const highlight = targetActorId === actor.id ? '>>> ' : '';
          lines.push(
            `${highlight}${actor.role}: ${actor.name}${actor.email ? ` (${actor.email})` : ''}`
          );
          if (targetActorId === actor.id && (actor.communicationNotes || actor.preferredTone)) {
            lines.push(`  ⚠️ ${actor.preferredTone || ''} ${actor.communicationNotes || ''}`);
          }
        }
        lines.push('');
        break;

      case 'team':
        lines.push('## ECHIPĂ');
        for (const member of content.team) {
          lines.push(`- ${member.name}: ${member.caseRole}`);
        }
        lines.push('');
        break;

      case 'documents':
        lines.push('## DOCUMENTE');
        for (const doc of content.keyDocuments.slice(0, 5)) {
          lines.push(`- ${doc.fileName}${doc.isScan ? ' (scan)' : ''}`);
          if (doc.userDescription || doc.aiSummary) {
            lines.push(`  ${doc.userDescription || doc.aiSummary}`);
          }
        }
        lines.push('');
        break;

      case 'timeline':
        if (content.timeline.deadlines.length > 0) {
          lines.push('## TERMENE');
          for (const d of content.timeline.deadlines.slice(0, 3)) {
            lines.push(`- ${d.dueDate}: ${d.title} (${d.status})`);
          }
          lines.push('');
        }
        break;

      case 'communication':
        if (content.communication.pendingActions.length > 0) {
          lines.push('## COMUNICARE');
          for (const action of content.communication.pendingActions) {
            lines.push(`- ${action.description}`);
          }

          // If targeting specific actor, include their history
          if (targetActorId) {
            const actorHist = content.communication.actorHistory.find(
              (h) => h.actorId === targetActorId
            );
            if (actorHist) {
              lines.push(`\nIstoric cu ${actorHist.actorName}:`);
              for (const int of actorHist.recentInteractions) {
                lines.push(`- ${int.date}: ${int.summary}`);
              }
            }
          }
          lines.push('');
        }
        break;

      case 'warnings':
        if (content.warnings.length > 0) {
          lines.push('## ATENȚIE');
          for (const w of content.warnings) {
            lines.push(`⚠️ ${w.message}`);
          }
          lines.push('');
        }
        break;

      case 'customNotes':
        if (content.customNotes) {
          lines.push('## NOTE');
          lines.push(content.customNotes);
          lines.push('');
        }
        break;
    }
  }

  return lines.join('\n');
}

// ============================================================================
// Service Class
// ============================================================================

export class CaseContextDocumentService {
  /**
   * Get or generate context document for a case
   */
  async getDocument(caseId: string) {
    // Check for existing valid document
    const existing = await prisma.caseContextDocument.findUnique({
      where: { caseId },
    });

    if (existing && existing.validUntil > new Date()) {
      return existing;
    }

    // Get case to get firmId
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: { firmId: true },
    });

    if (!caseData) {
      throw new Error(`Case not found: ${caseId}`);
    }

    // Generate new document
    return this.regenerate(caseId, caseData.firmId);
  }

  /**
   * Get context markdown for a specific tier
   */
  async getContextMarkdown(caseId: string, tier: ContextTier = 'full'): Promise<string> {
    const doc = await this.getDocument(caseId);

    switch (tier) {
      case 'critical':
        return doc.contextCritical || doc.contextFull;
      case 'standard':
        return doc.contextStandard || doc.contextFull;
      case 'full':
      default:
        return doc.contextFull;
    }
  }

  /**
   * Get context for a specific agent type
   * Returns context filtered to only the sections the agent needs
   */
  async getForAgent(request: AgentContextRequest): Promise<AgentContextResponse> {
    const doc = await this.getDocument(request.caseId);
    const content = doc.content as unknown as CaseContextDocumentContent;

    // Get default sections for this agent type
    const defaults = AGENT_SECTION_DEFAULTS[request.agentType];
    const tier = request.tier || defaults.tier;
    const sections = request.sections || defaults.sections;

    // Get tier-based context or generate section-specific
    let contextMarkdown: string;

    if (sections.length === defaults.sections.length) {
      // Use pre-generated tier context
      switch (tier) {
        case 'critical':
          contextMarkdown = doc.contextCritical || doc.contextFull;
          break;
        case 'standard':
          contextMarkdown = doc.contextStandard || doc.contextFull;
          break;
        default:
          contextMarkdown = doc.contextFull;
      }
    } else {
      // Generate section-specific context
      contextMarkdown = generateSectionContext(content, sections, request.targetActorId);
    }

    return {
      caseId: request.caseId,
      clientId: content.client.clientId,
      agentType: request.agentType,
      tier,
      contextMarkdown,
      tokenCount: estimateTokens(contextMarkdown),
      version: doc.version,
      generatedAt: doc.generatedAt.toISOString(),
      validUntil: doc.validUntil.toISOString(),
      includedSections: sections,
    };
  }

  /**
   * Force regeneration of context document
   */
  async regenerate(caseId: string, firmId: string) {
    // Build content
    const content = await buildCaseContextContent(caseId, firmId);

    // Get client context for embedding
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: { clientId: true },
    });

    let clientContextSnapshot: ClientContextDocumentContent | null = null;
    if (caseData) {
      try {
        clientContextSnapshot = await clientContextDocumentService.getContent(
          caseData.clientId,
          firmId
        );
      } catch (error) {
        console.warn('[CaseContextDocument] Failed to get client context:', error);
      }
    }

    // Generate full markdown
    const contextFull = generateFullContextMarkdown(content, clientContextSnapshot || undefined);
    const tokenCountFull = estimateTokens(contextFull);

    // Generate compressed tiers
    const contextStandard = await generateStandardContext(contextFull, firmId);
    const contextCritical = await generateCriticalContext(contextFull, firmId);

    const tokenCountStandard = estimateTokens(contextStandard);
    const tokenCountCritical = estimateTokens(contextCritical);

    // Calculate validity
    const validUntil = new Date();
    validUntil.setHours(validUntil.getHours() + VALIDITY_HOURS);

    // Check if document exists
    const existing = await prisma.caseContextDocument.findUnique({
      where: { caseId },
    });

    if (existing) {
      return prisma.caseContextDocument.update({
        where: { caseId },
        data: {
          content: JSON.parse(JSON.stringify(content)),
          contextFull,
          contextStandard,
          contextCritical,
          tokenCountFull,
          tokenCountStandard,
          tokenCountCritical,
          clientContextSnapshot: clientContextSnapshot
            ? JSON.parse(JSON.stringify(clientContextSnapshot))
            : null,
          version: existing.version + 1,
          generatedAt: new Date(),
          validUntil,
        },
      });
    }

    return prisma.caseContextDocument.create({
      data: {
        caseId,
        firmId,
        content: JSON.parse(JSON.stringify(content)),
        contextFull,
        contextStandard,
        contextCritical,
        tokenCountFull,
        tokenCountStandard,
        tokenCountCritical,
        clientContextSnapshot: clientContextSnapshot
          ? JSON.parse(JSON.stringify(clientContextSnapshot))
          : null,
        version: 1,
        generatedAt: new Date(),
        validUntil,
      },
    });
  }

  /**
   * Invalidate context document for a case
   */
  async invalidate(caseId: string): Promise<void> {
    await prisma.caseContextDocument.updateMany({
      where: { caseId },
      data: {
        validUntil: new Date(),
      },
    });
  }

  /**
   * Invalidate all case context documents for a client
   * Used when client data changes
   */
  async invalidateForClient(clientId: string): Promise<void> {
    const cases = await prisma.case.findMany({
      where: { clientId },
      select: { id: true },
    });

    const caseIds = cases.map((c) => c.id);

    await prisma.caseContextDocument.updateMany({
      where: { caseId: { in: caseIds } },
      data: {
        validUntil: new Date(),
      },
    });
  }

  /**
   * Get parsed content from document
   */
  async getContent(caseId: string): Promise<CaseContextDocumentContent> {
    const doc = await this.getDocument(caseId);
    return doc.content as unknown as CaseContextDocumentContent;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const caseContextDocumentService = new CaseContextDocumentService();
