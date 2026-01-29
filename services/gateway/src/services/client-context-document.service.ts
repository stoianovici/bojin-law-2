/**
 * Client Context Document Service
 * Generates and manages comprehensive AI context documents for clients
 *
 * Features:
 * - Full, standard, and critical tier context generation
 * - Tiered compression using Haiku for cost optimization
 * - Automatic invalidation on related entity changes
 * - Markdown format for AI consumption
 */

import { prisma } from '@legal-platform/database';
import type {
  ClientContextDocumentContent,
  ClientIdentity,
  ClientContact,
  ClientRelationship,
  ClientActiveCaseSummary,
  ContextWarning,
  ContextTier,
} from '@legal-platform/types';
import { aiClient, getModelForFeature } from './ai-client.service';

// ============================================================================
// Constants
// ============================================================================

// Validity period in hours
const VALIDITY_HOURS = 24;

// Token targets for each tier
const TOKEN_TARGETS = {
  full: 1000,
  standard: 300,
  critical: 100,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Estimate token count from string (rough approximation)
 */
function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters for English/Romanian
  return Math.ceil(text.length / 4);
}

/**
 * Format date to Romanian locale string
 */
function formatDate(date: Date | null | undefined): string {
  if (!date) return '';
  return date.toLocaleDateString('ro-RO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Map client type to Romanian label
 */
function getClientTypeLabel(type: string | null): string {
  switch (type) {
    case 'company':
      return 'Persoană juridică';
    case 'individual':
      return 'Persoană fizică';
    default:
      return type || 'Necunoscut';
  }
}

// ============================================================================
// Context Generation
// ============================================================================

/**
 * Build structured content from database data
 */
async function buildClientContextContent(
  clientId: string,
  firmId: string
): Promise<ClientContextDocumentContent> {
  // Fetch client with all related data
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      cases: {
        where: {
          status: { in: ['Active', 'OnHold', 'PendingApproval'] },
        },
        include: {
          tasks: {
            where: {
              status: { not: 'Completed' },
              dueDate: { not: null },
            },
            orderBy: { dueDate: 'asc' },
            take: 1,
          },
        },
        orderBy: { openedDate: 'desc' },
      },
    },
  });

  if (!client) {
    throw new Error(`Client not found: ${clientId}`);
  }

  // Get email stats
  const emailCount = await prisma.email.count({
    where: {
      case: { clientId },
    },
  });

  // Get closed case count
  const closedCaseCount = await prisma.case.count({
    where: {
      clientId,
      status: { in: ['Closed', 'Archived'] },
    },
  });

  // Build identity
  const identity: ClientIdentity = {
    name: client.name,
    type: (client.clientType as 'individual' | 'company') || 'company',
    companyType: client.companyType || undefined,
    cui: client.cui || undefined,
    registrationNumber: client.registrationNumber || undefined,
    address: client.address || undefined,
  };

  // Build contacts
  const rawContacts = (client.contacts as Array<Record<string, unknown>>) || [];
  const rawAdmins = (client.administrators as Array<Record<string, unknown>>) || [];

  const contacts: ClientContact[] = rawContacts.map((c, i) => ({
    id: String(c.id || `contact-${i}`),
    name: String(c.name || ''),
    role: String(c.role || 'Contact'),
    email: c.email ? String(c.email) : undefined,
    phone: c.phone ? String(c.phone) : undefined,
    isPrimary: i === 0,
  }));

  const administrators: ClientContact[] = rawAdmins.map((a, i) => ({
    id: String(a.id || `admin-${i}`),
    name: String(a.name || ''),
    role: String(a.role || 'Administrator'),
    email: a.email ? String(a.email) : undefined,
    phone: a.phone ? String(a.phone) : undefined,
  }));

  // Find primary contact
  const primaryContact = contacts.find((c) => c.isPrimary) || contacts[0];

  // Build relationship
  const relationship: ClientRelationship = {
    startDate: formatDate(client.createdAt),
    activeCaseCount: client.cases.length,
    closedCaseCount,
    totalEmailCount: emailCount,
    lastActivityDate: formatDate(client.cases[0]?.updatedAt || client.updatedAt),
  };

  // Build active cases summary
  const activeCasesSummary: ClientActiveCaseSummary[] = client.cases.map((c) => {
    const nextTask = c.tasks[0];
    return {
      caseId: c.id,
      caseNumber: c.caseNumber,
      title: c.title,
      type: c.type,
      status: c.status,
      nextDeadline: nextTask?.dueDate ? formatDate(nextTask.dueDate) : undefined,
      nextDeadlineDescription: nextTask?.title,
    };
  });

  // Build warnings
  const warnings: ContextWarning[] = [];

  // Check for cases without recent activity
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  for (const caseItem of client.cases) {
    if (caseItem.updatedAt < thirtyDaysAgo) {
      warnings.push({
        type: 'communication',
        message: `Dosarul ${caseItem.caseNumber} nu a avut activitate în ultimele 30 de zile`,
        severity: 'medium',
        relatedEntityId: caseItem.id,
        relatedEntityType: 'case',
      });
    }
  }

  // Check for overdue tasks
  const overdueTasks = await prisma.task.count({
    where: {
      case: { clientId },
      status: { not: 'Completed' },
      dueDate: { lt: new Date() },
    },
  });

  if (overdueTasks > 0) {
    warnings.push({
      type: 'deadline',
      message: `${overdueTasks} task-uri restante pentru acest client`,
      severity: overdueTasks > 5 ? 'high' : 'medium',
    });
  }

  return {
    identity,
    contacts: {
      primary: primaryContact,
      administrators,
      other: contacts.filter((c) => !c.isPrimary),
    },
    relationship,
    activeCasesSummary,
    warnings,
    customNotes: undefined,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generate full tier markdown context (~1000 tokens)
 */
function generateFullContextMarkdown(content: ClientContextDocumentContent): string {
  const lines: string[] = [];

  lines.push(`# Context Client: ${content.identity.name}`);
  lines.push(`Generat: ${new Date().toLocaleDateString('ro-RO')} | Versiune: 1`);
  lines.push('');

  // Identity section
  lines.push('## 🏢 IDENTITATE');
  lines.push(`Nume: ${content.identity.name}`);
  lines.push(`Tip: ${getClientTypeLabel(content.identity.type)}`);
  if (content.identity.companyType) {
    lines.push(`Formă juridică: ${content.identity.companyType}`);
  }
  if (content.identity.cui) {
    lines.push(`CUI: ${content.identity.cui}`);
  }
  if (content.identity.registrationNumber) {
    lines.push(`Nr. Reg. Comerț: ${content.identity.registrationNumber}`);
  }
  if (content.identity.address) {
    lines.push(`Adresă: ${content.identity.address}`);
  }
  lines.push('');

  // Contacts section
  lines.push('## 👥 CONTACTE');
  if (content.contacts.primary) {
    const p = content.contacts.primary;
    lines.push(`**Contact principal**: ${p.name} (${p.role})`);
    if (p.email) lines.push(`  Email: ${p.email}`);
    if (p.phone) lines.push(`  Telefon: ${p.phone}`);
  }
  if (content.contacts.administrators.length > 0) {
    lines.push('**Administratori**:');
    for (const admin of content.contacts.administrators) {
      lines.push(`- ${admin.name} (${admin.role})${admin.email ? ` - ${admin.email}` : ''}`);
    }
  }
  lines.push('');

  // Relationship section
  lines.push('## 📊 RELAȚIE');
  lines.push(`Client din: ${content.relationship.startDate}`);
  lines.push(`Dosare active: ${content.relationship.activeCaseCount}`);
  lines.push(`Dosare încheiate: ${content.relationship.closedCaseCount}`);
  lines.push(`Total emailuri: ${content.relationship.totalEmailCount}`);
  lines.push(`Ultima activitate: ${content.relationship.lastActivityDate}`);
  lines.push('');

  // Active cases section
  if (content.activeCasesSummary.length > 0) {
    lines.push('## 📋 DOSARE ACTIVE');
    for (const caseItem of content.activeCasesSummary) {
      lines.push(`- **${caseItem.caseNumber}**: ${caseItem.title}`);
      lines.push(`  Tip: ${caseItem.type} | Status: ${caseItem.status}`);
      if (caseItem.nextDeadline) {
        lines.push(
          `  Următorul termen: ${caseItem.nextDeadline} - ${caseItem.nextDeadlineDescription}`
        );
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

  return lines.join('\n');
}

/**
 * Generate compressed context for standard tier (~300 tokens)
 */
async function generateStandardContext(fullContext: string, firmId: string): Promise<string> {
  const model = await getModelForFeature(firmId, 'context_compression');

  const prompt = `Comprimă următorul context de client la aproximativ 300 de tokeni, păstrând:
- Numele și tipul clientului
- Contact principal și email
- Număr dosare active și următorul termen important
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
        entityType: 'client',
      },
      {
        model,
        maxTokens: 400,
        temperature: 0.2,
      }
    );
    return response.content;
  } catch (error) {
    console.error('[ClientContextDocument] Failed to compress to standard tier:', error);
    // Fall back to first part of full context
    return fullContext.slice(0, 1200);
  }
}

/**
 * Generate compressed context for critical tier (~100 tokens)
 */
async function generateCriticalContext(fullContext: string, firmId: string): Promise<string> {
  const model = await getModelForFeature(firmId, 'context_compression');

  const prompt = `Comprimă următorul context de client la maxim 100 de tokeni, păstrând doar:
- Numele clientului
- Tipul (persoană fizică/juridică)
- Număr dosare active

Context complet:
${fullContext}

Răspunde doar cu contextul comprimat, o singură propoziție.`;

  try {
    const response = await aiClient.complete(
      prompt,
      {
        feature: 'context_compression',
        firmId,
        entityType: 'client',
      },
      {
        model,
        maxTokens: 150,
        temperature: 0.2,
      }
    );
    return response.content;
  } catch (error) {
    console.error('[ClientContextDocument] Failed to compress to critical tier:', error);
    // Fall back to minimal context
    const name = fullContext.match(/Nume: (.+)/)?.[1] || 'Client necunoscut';
    return `Client: ${name}`;
  }
}

// ============================================================================
// Service Class
// ============================================================================

export class ClientContextDocumentService {
  /**
   * Get or generate context document for a client
   * Returns cached document if valid, otherwise generates new one
   */
  async getDocument(clientId: string, firmId: string) {
    // Check for existing valid document
    const existing = await prisma.clientContextDocument.findUnique({
      where: { clientId },
    });

    if (existing && existing.validUntil > new Date()) {
      return existing;
    }

    // Generate new document
    return this.regenerate(clientId, firmId);
  }

  /**
   * Get context markdown for a specific tier
   */
  async getContextMarkdown(
    clientId: string,
    firmId: string,
    tier: ContextTier = 'full'
  ): Promise<string> {
    const doc = await this.getDocument(clientId, firmId);

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
   * Force regeneration of context document
   */
  async regenerate(clientId: string, firmId: string) {
    // Build content
    const content = await buildClientContextContent(clientId, firmId);

    // Generate full markdown
    const contextFull = generateFullContextMarkdown(content);
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
    const existing = await prisma.clientContextDocument.findUnique({
      where: { clientId },
    });

    if (existing) {
      // Update existing
      return prisma.clientContextDocument.update({
        where: { clientId },
        data: {
          content: JSON.parse(JSON.stringify(content)),
          contextFull,
          contextStandard,
          contextCritical,
          tokenCountFull,
          tokenCountStandard,
          tokenCountCritical,
          version: existing.version + 1,
          generatedAt: new Date(),
          validUntil,
        },
      });
    }

    // Create new
    return prisma.clientContextDocument.create({
      data: {
        clientId,
        firmId,
        content: JSON.parse(JSON.stringify(content)),
        contextFull,
        contextStandard,
        contextCritical,
        tokenCountFull,
        tokenCountStandard,
        tokenCountCritical,
        version: 1,
        generatedAt: new Date(),
        validUntil,
      },
    });
  }

  /**
   * Invalidate context document for a client
   * Marks as expired so it will be regenerated on next access
   */
  async invalidate(clientId: string): Promise<void> {
    await prisma.clientContextDocument.updateMany({
      where: { clientId },
      data: {
        validUntil: new Date(), // Set to now to force regeneration
      },
    });
  }

  /**
   * Batch invalidate context documents for multiple clients
   */
  async batchInvalidate(clientIds: string[]): Promise<void> {
    await prisma.clientContextDocument.updateMany({
      where: { clientId: { in: clientIds } },
      data: {
        validUntil: new Date(),
      },
    });
  }

  /**
   * Get parsed content from document
   */
  async getContent(clientId: string, firmId: string): Promise<ClientContextDocumentContent> {
    const doc = await this.getDocument(clientId, firmId);
    return doc.content as unknown as ClientContextDocumentContent;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const clientContextDocumentService = new ClientContextDocumentService();
