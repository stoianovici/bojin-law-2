/**
 * Comprehension Agent Tool Handlers
 *
 * Implements the 8 read-only tools for the Case Comprehension agent.
 * All handlers return formatted strings suitable for LLM consumption.
 */

import { prisma } from '@legal-platform/database';
import { ToolHandler } from './ai-client.service';
import logger from '../utils/logger';

// ============================================================================
// Security: Multi-Tenancy Validation
// ============================================================================

/**
 * Validate that the user has access to the specified case.
 * Throws if the case doesn't exist or belongs to a different firm.
 */
async function validateCaseAccess(caseId: string, firmId: string): Promise<void> {
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    select: { firmId: true },
  });
  if (!caseData || caseData.firmId !== firmId) {
    throw new Error(`Access denied to case ${caseId}`);
  }
}

/**
 * Validate that the user has access to the specified client.
 * Throws if the client doesn't exist or belongs to a different firm.
 */
async function validateClientAccess(clientId: string, firmId: string): Promise<void> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { firmId: true },
  });
  if (!client || client.firmId !== firmId) {
    throw new Error(`Access denied to client ${clientId}`);
  }
}

// ============================================================================
// Helper: Format Date
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

function formatUserName(user: { firstName: string; lastName: string } | null | undefined): string {
  if (!user) return 'Necunoscut';
  return `${user.firstName} ${user.lastName}`;
}

// ============================================================================
// Tool 1: Read Case Identity
// ============================================================================

export async function handleReadCaseIdentity(
  input: Record<string, unknown>,
  firmId: string
): Promise<string> {
  const caseId = input.caseId as string;
  await validateCaseAccess(caseId, firmId);

  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      caseNumber: true,
      title: true,
      status: true,
      type: true,
      description: true,
      value: true,
      openedDate: true,
      closedDate: true,
      billingType: true,
      keywords: true,
      referenceNumbers: true,
      client: {
        select: {
          id: true,
          name: true,
          clientType: true,
          cui: true,
        },
      },
    },
  });

  if (!caseData) {
    return `Dosarul cu ID-ul ${caseId} nu a fost găsit.`;
  }

  const valueStr = caseData.value
    ? `${Number(caseData.value).toLocaleString('ro-RO')} RON`
    : 'Nespecificată';

  return `# Identitate Dosar

## Date de bază
- **Număr dosar:** ${caseData.caseNumber}
- **Titlu:** ${caseData.title}
- **Status:** ${caseData.status}
- **Tip:** ${caseData.type}
- **Valoare:** ${valueStr}
- **Data deschiderii:** ${formatDate(caseData.openedDate)}
${caseData.closedDate ? `- **Data închiderii:** ${formatDate(caseData.closedDate)}` : ''}
- **Tip facturare:** ${caseData.billingType}

## Descriere
${caseData.description || 'Fără descriere'}

## Client
${
  caseData.client
    ? `- **Nume:** ${caseData.client.name}
- **Tip:** ${caseData.client.clientType === 'individual' ? 'Persoană fizică' : 'Persoană juridică'}
${caseData.client.cui ? `- **CUI:** ${caseData.client.cui}` : ''}
- **ID Client:** ${caseData.client.id}`
    : '- Niciun client asociat'
}

${caseData.keywords.length > 0 ? `## Cuvinte cheie\n${caseData.keywords.join(', ')}` : ''}
${caseData.referenceNumbers.length > 0 ? `## Numere de referință\n${caseData.referenceNumbers.join(', ')}` : ''}`;
}

// ============================================================================
// Tool 2: Read Case Actors
// ============================================================================

export async function handleReadCaseActors(
  input: Record<string, unknown>,
  firmId: string
): Promise<string> {
  const caseId = input.caseId as string;
  await validateCaseAccess(caseId, firmId);

  // Get team members
  const teamMembers = await prisma.caseTeam.findMany({
    where: { caseId },
    select: {
      role: true,
      assignedAt: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  // Get external actors
  const actors = await prisma.caseActor.findMany({
    where: { caseId },
    select: {
      id: true,
      role: true,
      customRoleCode: true,
      name: true,
      organization: true,
      email: true,
      phone: true,
      address: true,
      notes: true,
      communicationNotes: true,
      preferredTone: true,
    },
  });

  // Get client contacts
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      client: {
        select: {
          name: true,
          contacts: true,
          administrators: true,
        },
      },
    },
  });

  let result = '# Actori în Dosar\n\n';

  // Internal team
  result += '## Echipa Internă\n';
  if (teamMembers.length === 0) {
    result += 'Nu sunt membri asignați.\n';
  } else {
    for (const member of teamMembers) {
      result += `- **${formatUserName(member.user)}** (${member.role})\n`;
      result += `  Email: ${member.user.email}\n`;
    }
  }

  // External actors
  result += '\n## Actori Externi\n';
  if (actors.length === 0) {
    result += 'Nu sunt actori externi înregistrați.\n';
  } else {
    for (const actor of actors) {
      const roleDisplay = actor.customRoleCode || actor.role;
      result += `\n### ${actor.name} (${roleDisplay})\n`;
      if (actor.organization) result += `- Organizație: ${actor.organization}\n`;
      if (actor.email) result += `- Email: ${actor.email}\n`;
      if (actor.phone) result += `- Telefon: ${actor.phone}\n`;
      if (actor.address) result += `- Adresă: ${actor.address}\n`;
      if (actor.notes) result += `- Note: ${actor.notes}\n`;
      if (actor.communicationNotes) result += `- Note comunicare: ${actor.communicationNotes}\n`;
      if (actor.preferredTone) result += `- Ton preferat: ${actor.preferredTone}\n`;
    }
  }

  // Client contacts
  if (caseData?.client) {
    result += '\n## Contacte Client\n';
    result += `Client: **${caseData.client.name}**\n`;

    const contacts = caseData.client.contacts as Array<{
      name?: string;
      email?: string;
      phone?: string;
      role?: string;
    }>;
    if (contacts && contacts.length > 0) {
      result += '\nContacte:\n';
      for (const contact of contacts) {
        result += `- ${contact.name || 'Fără nume'}`;
        if (contact.role) result += ` (${contact.role})`;
        if (contact.email) result += ` - ${contact.email}`;
        if (contact.phone) result += ` - ${contact.phone}`;
        result += '\n';
      }
    }

    const admins = caseData.client.administrators as Array<{
      name?: string;
      role?: string;
    }>;
    if (admins && admins.length > 0) {
      result += '\nAdministratori:\n';
      for (const admin of admins) {
        result += `- ${admin.name || 'Fără nume'}`;
        if (admin.role) result += ` (${admin.role})`;
        result += '\n';
      }
    }
  }

  return result;
}

// ============================================================================
// Tool 3: Read Case Documents
// ============================================================================

export async function handleReadCaseDocuments(
  input: Record<string, unknown>,
  firmId: string
): Promise<string> {
  const caseId = input.caseId as string;
  await validateCaseAccess(caseId, firmId);
  const includeContent = (input.includeContent as boolean) ?? true;
  const maxContentLength = (input.maxContentLength as number) ?? 2000;
  const filter = (input.filter as string) ?? 'all';
  const since = input.since as string | undefined;

  // Build where clause for documents
  interface DocumentWhere {
    status?: string;
    updatedAt?: { gte: Date };
  }
  const documentWhere: DocumentWhere = {};

  if (filter === 'finalized') {
    documentWhere.status = 'FINALIZED';
  }

  if (filter === 'recent' && since) {
    documentWhere.updatedAt = { gte: new Date(since) };
  }

  const caseDocuments = await prisma.caseDocument.findMany({
    where: { caseId },
    orderBy: { linkedAt: 'desc' },
    take: 50,
    select: {
      id: true,
      linkedAt: true,
      document: {
        select: {
          id: true,
          fileName: true,
          fileType: true,
          fileSize: true,
          status: true,
          extractedContent: true,
          userDescription: true,
          updatedAt: true,
        },
      },
    },
  });

  // Apply document-level filters
  let filteredDocs = caseDocuments;
  if (filter === 'finalized') {
    filteredDocs = caseDocuments.filter((cd) => cd.document.status === 'FINAL');
  }
  if (filter === 'recent' && since) {
    const sinceDate = new Date(since);
    filteredDocs = caseDocuments.filter((cd) => cd.document.updatedAt >= sinceDate);
  }

  let result = '# Documente Dosar\n\n';
  result += `Total: ${filteredDocs.length} documente\n\n`;

  if (filteredDocs.length === 0) {
    result += 'Nu sunt documente în acest dosar.';
    return result;
  }

  for (const caseDoc of filteredDocs) {
    const doc = caseDoc.document;
    result += `## ${doc.fileName}\n`;
    result += `- **Tip:** ${doc.fileType}\n`;
    result += `- **Status:** ${doc.status}\n`;
    result += `- **Mărime:** ${Math.round(doc.fileSize / 1024)} KB\n`;
    result += `- **Adăugat:** ${formatDateTime(caseDoc.linkedAt)}\n`;

    if (doc.userDescription) {
      result += `- **Descriere:** ${doc.userDescription}\n`;
    }

    if (includeContent && doc.extractedContent) {
      const content = doc.extractedContent.slice(0, maxContentLength);
      const truncated = doc.extractedContent.length > maxContentLength;
      result += `\n### Conținut extras\n\`\`\`\n${content}${truncated ? '\n...[truncat]' : ''}\n\`\`\`\n`;
    }

    result += '\n';
  }

  return result;
}

// ============================================================================
// Tool 4: Read Case Emails
// ============================================================================

export async function handleReadCaseEmails(
  input: Record<string, unknown>,
  firmId: string
): Promise<string> {
  const caseId = input.caseId as string;
  await validateCaseAccess(caseId, firmId);
  const includeBody = (input.includeBody as boolean) ?? false;
  const maxThreads = (input.maxThreads as number) ?? 10;

  // Get thread summaries for the case
  const summaries = await prisma.threadSummary.findMany({
    where: { caseId },
    orderBy: { lastAnalyzedAt: 'desc' },
    take: maxThreads,
    select: {
      conversationId: true,
      overview: true,
      keyPoints: true,
      actionItems: true,
      sentiment: true,
      participants: true,
      opposingCounselPosition: true,
      keyArguments: true,
      messageCount: true,
      lastAnalyzedAt: true,
    },
  });

  // Get recent emails for threads without summaries
  const emails = await prisma.email.findMany({
    where: { caseId },
    orderBy: { receivedDateTime: 'desc' },
    take: maxThreads * 3,
    select: {
      conversationId: true,
      subject: true,
      bodyPreview: true,
      bodyContentClean: true,
      from: true,
      receivedDateTime: true,
      hasAttachments: true,
    },
  });

  let result = '# Comunicări Email\n\n';

  // Thread summaries
  if (summaries.length > 0) {
    result += '## Thread-uri cu Rezumat AI\n\n';

    for (const summary of summaries) {
      result += `### Thread (${summary.messageCount} mesaje)\n`;
      result += `- **Ultima analiză:** ${formatDateTime(summary.lastAnalyzedAt)}\n`;

      if (summary.sentiment) {
        result += `- **Sentiment:** ${summary.sentiment}\n`;
      }

      if (summary.overview) {
        result += `\n**Rezumat:**\n${summary.overview}\n`;
      }

      const keyPoints = summary.keyPoints as string[] | null;
      if (keyPoints && keyPoints.length > 0) {
        result += `\n**Puncte cheie:**\n`;
        for (const point of keyPoints) {
          result += `- ${point}\n`;
        }
      }

      const actionItems = summary.actionItems as string[] | null;
      if (actionItems && actionItems.length > 0) {
        result += `\n**Acțiuni necesare:**\n`;
        for (const item of actionItems) {
          result += `- ${item}\n`;
        }
      }

      if (summary.opposingCounselPosition) {
        result += `\n**Poziția părții adverse:**\n${summary.opposingCounselPosition}\n`;
      }

      const keyArguments = summary.keyArguments as string[] | null;
      if (keyArguments && keyArguments.length > 0) {
        result += `\n**Argumente cheie:**\n`;
        for (const arg of keyArguments) {
          result += `- ${arg}\n`;
        }
      }

      result += '\n---\n\n';
    }
  }

  // Group emails by conversation
  const conversationIds = new Set(summaries.map((s) => s.conversationId));
  const emailsWithoutSummary = emails.filter((e) => !conversationIds.has(e.conversationId));

  if (emailsWithoutSummary.length > 0) {
    result += '## Emailuri Recente (fără rezumat)\n\n';

    for (const email of emailsWithoutSummary.slice(0, maxThreads)) {
      const from = email.from as { emailAddress?: { name?: string; address?: string } };
      const senderName = from?.emailAddress?.name || from?.emailAddress?.address || 'Necunoscut';

      result += `### ${email.subject}\n`;
      result += `- **De la:** ${senderName}\n`;
      result += `- **Data:** ${formatDateTime(email.receivedDateTime)}\n`;
      result += `- **Atașamente:** ${email.hasAttachments ? 'Da' : 'Nu'}\n`;

      if (includeBody && email.bodyContentClean) {
        const body = email.bodyContentClean.slice(0, 1000);
        result += `\n**Conținut:**\n${body}${email.bodyContentClean.length > 1000 ? '\n...[truncat]' : ''}\n`;
      } else {
        result += `\n**Preview:** ${email.bodyPreview}\n`;
      }

      result += '\n';
    }
  }

  if (summaries.length === 0 && emailsWithoutSummary.length === 0) {
    result += 'Nu sunt emailuri asociate acestui dosar.';
  }

  return result;
}

// ============================================================================
// Tool 5: Read Case Timeline
// ============================================================================

export async function handleReadCaseTimeline(
  input: Record<string, unknown>,
  firmId: string
): Promise<string> {
  const caseId = input.caseId as string;
  await validateCaseAccess(caseId, firmId);
  const includePast = (input.includePast as boolean) ?? true;
  const includeFuture = (input.includeFuture as boolean) ?? true;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Build where clause
  interface TaskWhere {
    caseId: string;
    dueDate?: { gte?: Date; lt?: Date };
  }

  const whereClause: TaskWhere = { caseId };

  if (!includePast && includeFuture) {
    whereClause.dueDate = { gte: today };
  } else if (includePast && !includeFuture) {
    whereClause.dueDate = { lt: today };
  }
  // if both true, no date filter

  // Get tasks with due dates
  const tasks = await prisma.task.findMany({
    where: whereClause,
    orderBy: { dueDate: 'asc' },
    take: 50,
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      status: true,
      priority: true,
      dueDate: true,
      dueTime: true,
      completedAt: true,
      assignedTo: true,
    },
  });

  // Get assigned user names
  const userIds = [...new Set(tasks.map((t) => t.assignedTo))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, firstName: true, lastName: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  let result = '# Cronologie Dosar\n\n';

  // Split into past and future
  const pastTasks = tasks.filter((t) => new Date(t.dueDate) < today);
  const futureTasks = tasks.filter((t) => new Date(t.dueDate) >= today);

  if (includeFuture && futureTasks.length > 0) {
    result += '## Evenimente Viitoare\n\n';

    for (const task of futureTasks) {
      const dueStr = formatDate(task.dueDate);
      const timeStr = task.dueTime ? ` la ${task.dueTime}` : '';
      const isPastDue = new Date(task.dueDate) < now && task.status !== 'Completed';
      const assignee = userMap.get(task.assignedTo);

      result += `### ${dueStr}${timeStr}${isPastDue ? ' ⚠️ ÎNTÂRZIAT' : ''}\n`;
      result += `**${task.title}**\n`;
      result += `- Tip: ${task.type}\n`;
      result += `- Status: ${task.status}\n`;
      result += `- Prioritate: ${task.priority}\n`;
      if (assignee) result += `- Asignat: ${formatUserName(assignee)}\n`;
      if (task.description) result += `- Detalii: ${task.description}\n`;
      result += '\n';
    }
  }

  if (includePast && pastTasks.length > 0) {
    result += '## Evenimente Trecute\n\n';

    // Show most recent first for past events
    const recentPast = pastTasks.reverse().slice(0, 20);

    for (const task of recentPast) {
      const dueStr = formatDate(task.dueDate);
      const completed = task.status === 'Completed';

      result += `### ${dueStr} ${completed ? '✓' : '✗'}\n`;
      result += `**${task.title}**\n`;
      result += `- Tip: ${task.type}\n`;
      result += `- Status: ${task.status}\n`;
      if (task.completedAt) result += `- Finalizat: ${formatDateTime(task.completedAt)}\n`;
      result += '\n';
    }
  }

  if (tasks.length === 0) {
    result += 'Nu sunt evenimente în cronologie.';
  }

  return result;
}

// ============================================================================
// Tool 6: Read Case Context
// ============================================================================

export async function handleReadCaseContext(
  input: Record<string, unknown>,
  firmId: string
): Promise<string> {
  const caseId = input.caseId as string;
  await validateCaseAccess(caseId, firmId);

  const comprehension = await prisma.caseComprehension.findUnique({
    where: { caseId },
    select: {
      id: true,
      currentPicture: true,
      dataMap: true,
      version: true,
      generatedAt: true,
      validUntil: true,
      isStale: true,
      corrections: {
        where: { isActive: true },
        select: {
          anchorText: true,
          correctionType: true,
          correctedValue: true,
          reason: true,
        },
      },
    },
  });

  if (!comprehension) {
    return `Nu există comprehensiune generată pentru dosarul ${caseId}. Aceasta este prima generare.`;
  }

  let result = '# Comprehensiune Existentă\n\n';
  result += `- **Versiune:** ${comprehension.version}\n`;
  result += `- **Generată:** ${formatDateTime(comprehension.generatedAt)}\n`;
  result += `- **Validă până:** ${formatDateTime(comprehension.validUntil)}\n`;
  result += `- **Marcată ca învechită:** ${comprehension.isStale ? 'Da' : 'Nu'}\n\n`;

  result += '## Imagine Curentă\n\n';
  result += comprehension.currentPicture;

  if (comprehension.corrections.length > 0) {
    result += '\n\n## Corecturi Active\n\n';
    result +=
      '**IMPORTANT:** Aceste corecturi au fost făcute de utilizator și trebuie păstrate.\n\n';

    for (const correction of comprehension.corrections) {
      result += `### Corecție (${correction.correctionType})\n`;
      result += `- **Text original:** "${correction.anchorText}"\n`;
      result += `- **Corectat la:** "${correction.correctedValue}"\n`;
      if (correction.reason) result += `- **Motiv:** ${correction.reason}\n`;
      result += '\n';
    }
  }

  return result;
}

// ============================================================================
// Tool 7: Read Client Context
// ============================================================================

export async function handleReadClientContext(
  input: Record<string, unknown>,
  firmId: string
): Promise<string> {
  const clientId = input.clientId as string;
  await validateClientAccess(clientId, firmId);

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      clientType: true,
      companyType: true,
      cui: true,
      registrationNumber: true,
      address: true,
      contactInfo: true,
      contacts: true,
      administrators: true,
      billingType: true,
      cases: {
        where: { status: 'Active' },
        select: {
          id: true,
          caseNumber: true,
          title: true,
          type: true,
          openedDate: true,
        },
        take: 10,
      },
      _count: {
        select: {
          cases: true,
          invoices: true,
        },
      },
    },
  });

  if (!client) {
    return `Clientul cu ID-ul ${clientId} nu a fost găsit.`;
  }

  let result = '# Context Client\n\n';

  result += '## Date Identificare\n';
  result += `- **Nume:** ${client.name}\n`;
  result += `- **Tip:** ${client.clientType === 'individual' ? 'Persoană fizică' : 'Persoană juridică'}\n`;
  if (client.companyType) result += `- **Tip companie:** ${client.companyType}\n`;
  if (client.cui) result += `- **CUI:** ${client.cui}\n`;
  if (client.registrationNumber) result += `- **Nr. Reg. Com.:** ${client.registrationNumber}\n`;
  if (client.address) result += `- **Adresă:** ${client.address}\n`;
  result += `- **Tip facturare:** ${client.billingType}\n`;

  const contactInfo = client.contactInfo as { email?: string; phone?: string } | null;
  if (contactInfo) {
    if (contactInfo.email) result += `- **Email:** ${contactInfo.email}\n`;
    if (contactInfo.phone) result += `- **Telefon:** ${contactInfo.phone}\n`;
  }

  result += `\n## Statistici\n`;
  result += `- **Total dosare:** ${client._count.cases}\n`;
  result += `- **Dosare active:** ${client.cases.length}\n`;
  result += `- **Facturi:** ${client._count.invoices}\n`;

  if (client.cases.length > 0) {
    result += '\n## Dosare Active\n';
    for (const c of client.cases) {
      result += `- **${c.caseNumber}:** ${c.title} (${c.type}) - deschis ${formatDate(c.openedDate)}\n`;
    }
  }

  return result;
}

// ============================================================================
// Tool 8: Read Case Activities
// ============================================================================

export async function handleReadCaseActivities(
  input: Record<string, unknown>,
  firmId: string
): Promise<string> {
  const caseId = input.caseId as string;
  await validateCaseAccess(caseId, firmId);
  const limit = (input.limit as number) ?? 20;

  const activities = await prisma.caseActivityEntry.findMany({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      activityType: true,
      entityType: true,
      title: true,
      summary: true,
      createdAt: true,
      actor: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  let result = '# Activitate Recentă\n\n';

  if (activities.length === 0) {
    result += 'Nu există activități înregistrate pentru acest dosar.';
    return result;
  }

  for (const activity of activities) {
    const dateStr = formatDateTime(activity.createdAt);
    result += `## ${dateStr}\n`;
    result += `**${activity.title}**\n`;
    result += `- Tip: ${activity.activityType}\n`;
    result += `- Entitate: ${activity.entityType}\n`;
    result += `- Utilizator: ${formatUserName(activity.actor)}\n`;
    if (activity.summary) result += `- Rezumat: ${activity.summary}\n`;
    result += '\n';
  }

  return result;
}

// ============================================================================
// Handler Factory
// ============================================================================

/**
 * Create tool handlers map for use with chatWithTools.
 * All handlers are bound to the provided firmId for authorization.
 */
export function createComprehensionToolHandlers(firmId: string): Record<string, ToolHandler> {
  // Log tool usage for debugging and pass firmId to each handler
  const wrapHandler = (
    name: string,
    handler: (input: Record<string, unknown>, firmId: string) => Promise<string>
  ): ToolHandler => {
    return async (input: Record<string, unknown>) => {
      logger.debug('Comprehension tool called', { tool: name, input, firmId });
      const start = Date.now();
      try {
        const result = await handler(input, firmId);
        logger.debug('Comprehension tool completed', {
          tool: name,
          durationMs: Date.now() - start,
          resultLength: result.length,
        });
        return result;
      } catch (error) {
        logger.error('Comprehension tool error', { tool: name, error, firmId });
        throw error;
      }
    };
  };

  return {
    read_case_identity: wrapHandler('read_case_identity', handleReadCaseIdentity),
    read_case_actors: wrapHandler('read_case_actors', handleReadCaseActors),
    read_case_documents: wrapHandler('read_case_documents', handleReadCaseDocuments),
    read_case_emails: wrapHandler('read_case_emails', handleReadCaseEmails),
    read_case_timeline: wrapHandler('read_case_timeline', handleReadCaseTimeline),
    read_case_context: wrapHandler('read_case_context', handleReadCaseContext),
    read_client_context: wrapHandler('read_client_context', handleReadClientContext),
    read_case_activities: wrapHandler('read_case_activities', handleReadCaseActivities),
  };
}
