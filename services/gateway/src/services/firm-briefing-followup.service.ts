/**
 * Firm Briefing Follow-up Service
 *
 * Handles follow-up questions about briefing items.
 * Loads relevant entity context and uses Claude to generate contextual answers.
 */

import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@legal-platform/database';
import { aiClient, AIMessage } from './ai-client.service';
import { StoryEntityType, BriefingFollowUpOutput, StoryItem } from './firm-operations.types';
import { FOLLOW_UP_SYSTEM_PROMPT } from './firm-operations-agent.prompts';
import logger from '../utils/logger';

// ============================================================================
// Constants
// ============================================================================

const FOLLOWUP_MODEL = process.env.FIRM_OPS_FOLLOWUP_MODEL || 'claude-sonnet-4-5-20250929';
const FOLLOWUP_MAX_TOKENS = 1024;

// ============================================================================
// Types
// ============================================================================

interface EntityContext {
  type: StoryEntityType;
  id: string;
  summary: string;
  details: Record<string, unknown>;
}

interface FollowUpOptions {
  briefingItem?: StoryItem;
  onProgress?: (event: { type: string; data?: unknown }) => void;
}

// ============================================================================
// Entity Context Loaders
// ============================================================================

/**
 * Load case context for follow-up questions.
 */
async function loadCaseContext(caseId: string, firmId: string): Promise<EntityContext | null> {
  const caseData = await prisma.case.findFirst({
    where: { id: caseId, firmId },
    select: {
      id: true,
      caseNumber: true,
      title: true,
      status: true,
      description: true,
      client: { select: { name: true } },
      teamMembers: {
        select: {
          user: { select: { firstName: true, lastName: true } },
        },
      },
      tasks: {
        where: { status: { not: 'Completed' } },
        orderBy: { dueDate: 'asc' },
        take: 5,
        select: {
          title: true,
          dueDate: true,
          status: true,
          priority: true,
        },
      },
      updatedAt: true,
    },
  });

  if (!caseData) return null;

  const summary = `Dosar ${caseData.caseNumber}: ${caseData.title} (${caseData.status})`;
  const teamNames = caseData.teamMembers.map((tm) => `${tm.user.firstName} ${tm.user.lastName}`);

  return {
    type: 'case',
    id: caseId,
    summary,
    details: {
      caseNumber: caseData.caseNumber,
      title: caseData.title,
      status: caseData.status,
      description: caseData.description,
      clientName: caseData.client?.name,
      teamMembers: teamNames,
      pendingTasks: caseData.tasks.map((t) => ({
        title: t.title,
        dueDate: t.dueDate?.toISOString().split('T')[0],
        status: t.status,
        priority: t.priority,
      })),
      lastUpdated: caseData.updatedAt.toISOString(),
    },
  };
}

/**
 * Load client context for follow-up questions.
 */
async function loadClientContext(clientId: string, firmId: string): Promise<EntityContext | null> {
  const clientData = await prisma.client.findFirst({
    where: { id: clientId, firmId },
    select: {
      id: true,
      name: true,
      contactInfo: true,
      contacts: true,
      updatedAt: true,
      cases: {
        where: { status: 'Active' },
        select: {
          caseNumber: true,
          title: true,
          status: true,
        },
        take: 10,
      },
    },
  });

  if (!clientData) return null;

  const summary = `Client: ${clientData.name} (${clientData.cases.length} dosare active)`;

  // Parse contact info from JSON
  const contactInfo = (clientData.contactInfo as Record<string, unknown>) || {};
  const contacts = Array.isArray(clientData.contacts) ? clientData.contacts : [];

  return {
    type: 'client',
    id: clientId,
    summary,
    details: {
      name: clientData.name,
      email: contactInfo.email,
      phone: contactInfo.phone,
      activeCases: clientData.cases.map((c) => ({
        caseNumber: c.caseNumber,
        title: c.title,
        status: c.status,
      })),
      contacts: contacts.slice(0, 5),
      lastUpdated: clientData.updatedAt.toISOString(),
    },
  };
}

/**
 * Load user/team member context for follow-up questions.
 */
async function loadUserContext(userId: string, firmId: string): Promise<EntityContext | null> {
  const userData = await prisma.user.findFirst({
    where: { id: userId, firmId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      cases: {
        where: { case: { status: 'Active' } },
        select: {
          case: { select: { caseNumber: true, title: true } },
        },
        take: 10,
      },
    },
  });

  if (!userData) return null;

  const fullName = `${userData.firstName} ${userData.lastName}`;
  const summary = `${fullName} (${userData.role}) - ${userData.cases.length} dosare active`;

  return {
    type: 'user',
    id: userId,
    summary,
    details: {
      name: fullName,
      email: userData.email,
      role: userData.role,
      activeCases: userData.cases.length,
      assignedCases: userData.cases.map((c) => ({
        caseNumber: c.case.caseNumber,
        title: c.case.title,
      })),
    },
  };
}

/**
 * Load email thread context for follow-up questions.
 * Note: This loads from ThreadSummary, not real-time Graph API.
 */
async function loadEmailThreadContext(
  conversationId: string,
  firmId: string
): Promise<EntityContext | null> {
  const threadSummary = await prisma.threadSummary.findFirst({
    where: { conversationId, firmId },
    select: {
      conversationId: true,
      overview: true,
      keyPoints: true,
      actionItems: true,
      participants: true,
      caseId: true,
      case: { select: { caseNumber: true, title: true } },
      lastAnalyzedAt: true,
    },
  });

  if (!threadSummary) {
    // Fall back to basic email lookup
    const email = await prisma.email.findFirst({
      where: { conversationId, firmId },
      orderBy: { sentDateTime: 'desc' },
      select: {
        subject: true,
        from: true,
        receivedDateTime: true,
        case: { select: { caseNumber: true, title: true } },
      },
    });

    if (!email) return null;

    const fromData = email.from as { emailAddress?: { name?: string; address?: string } } | null;
    const fromName = fromData?.emailAddress?.name || fromData?.emailAddress?.address || 'Unknown';

    return {
      type: 'email_thread',
      id: conversationId,
      summary: `Email: ${email.subject || 'Fără subiect'} de la ${fromName}`,
      details: {
        subject: email.subject,
        from: fromName,
        receivedAt: email.receivedDateTime?.toISOString(),
        relatedCase: email.case
          ? { caseNumber: email.case.caseNumber, title: email.case.title }
          : null,
      },
    };
  }

  const summary = threadSummary.overview || 'Thread de email';

  return {
    type: 'email_thread',
    id: conversationId,
    summary: summary.slice(0, 100),
    details: {
      overview: threadSummary.overview,
      keyPoints: threadSummary.keyPoints,
      actionItems: threadSummary.actionItems,
      participants: threadSummary.participants,
      relatedCase: threadSummary.case
        ? { caseNumber: threadSummary.case.caseNumber, title: threadSummary.case.title }
        : null,
      lastAnalyzed: threadSummary.lastAnalyzedAt?.toISOString(),
    },
  };
}

// ============================================================================
// Main Service
// ============================================================================

/**
 * Load entity context based on type.
 */
async function loadEntityContext(
  entityType: StoryEntityType,
  entityId: string,
  firmId: string
): Promise<EntityContext | null> {
  switch (entityType) {
    case 'case':
      return loadCaseContext(entityId, firmId);
    case 'client':
      return loadClientContext(entityId, firmId);
    case 'user':
      return loadUserContext(entityId, firmId);
    case 'email_thread':
      return loadEmailThreadContext(entityId, firmId);
    default:
      logger.warn('[FollowUp] Unknown entity type', { entityType, entityId });
      return null;
  }
}

/**
 * Build the follow-up prompt with entity context.
 */
function buildFollowUpPrompt(
  question: string,
  entityContext: EntityContext,
  briefingItem?: StoryItem
): string {
  let prompt = FOLLOW_UP_SYSTEM_PROMPT.replace('{entityType}', entityContext.type)
    .replace('{entityId}', entityContext.id)
    .replace('{question}', question);

  prompt += '\n\n## Context despre entitate\n\n';
  prompt += `**Sumar:** ${entityContext.summary}\n\n`;
  prompt += '**Detalii:**\n```json\n' + JSON.stringify(entityContext.details, null, 2) + '\n```\n';

  if (briefingItem) {
    prompt += '\n## Context din briefing\n\n';
    prompt += `**Titlu:** ${briefingItem.headline}\n`;
    prompt += `**Sumar:** ${briefingItem.summary}\n`;
    if (briefingItem.details.length > 0) {
      prompt += '**Detalii:**\n';
      briefingItem.details.forEach((d) => {
        prompt += `- ${d.title}: ${d.subtitle}\n`;
      });
    }
  }

  return prompt;
}

/**
 * Parse the follow-up response from Claude.
 */
function parseFollowUpResponse(content: string): BriefingFollowUpOutput {
  // Try to extract JSON from code block
  const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      return {
        answer: parsed.answer || content,
        suggestedActions: parsed.suggestedActions || [],
      };
    } catch {
      // Fall through to default
    }
  }

  // Try direct JSON parse
  try {
    const parsed = JSON.parse(content);
    if (parsed.answer) {
      return {
        answer: parsed.answer,
        suggestedActions: parsed.suggestedActions || [],
      };
    }
  } catch {
    // Fall through to default
  }

  // Return raw content as answer
  return {
    answer: content.trim(),
    suggestedActions: [],
  };
}

/**
 * Main follow-up service class.
 */
export class FirmBriefingFollowupService {
  /**
   * Ask a follow-up question about a briefing item.
   */
  async askFollowUp(
    briefingItemId: string,
    question: string,
    entityType: StoryEntityType,
    entityId: string,
    userId: string,
    firmId: string,
    options: FollowUpOptions = {}
  ): Promise<BriefingFollowUpOutput> {
    logger.info('[FollowUp] Processing follow-up question', {
      userId,
      firmId,
      briefingItemId,
      entityType,
      questionLength: question.length,
    });

    // Load entity context
    const entityContext = await loadEntityContext(entityType, entityId, firmId);

    if (!entityContext) {
      logger.warn('[FollowUp] Entity not found', { entityType, entityId, firmId });
      return {
        answer:
          'Nu am putut găsi informații despre acest element. Verificați dacă există în sistem.',
        suggestedActions: [],
      };
    }

    // Build prompt
    const prompt = buildFollowUpPrompt(question, entityContext, options.briefingItem);

    // Call Claude
    const messages: AIMessage[] = [{ role: 'user', content: prompt }];

    try {
      const response = await aiClient.chat(
        messages,
        {
          feature: 'firm_briefing_followup',
          userId,
          firmId,
        },
        {
          model: FOLLOWUP_MODEL,
          maxTokens: FOLLOWUP_MAX_TOKENS,
        }
      );

      // Extract text content
      const textContent = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n');

      const result = parseFollowUpResponse(textContent);

      // Add default action if none provided
      if (result.suggestedActions.length === 0) {
        const href =
          entityType === 'email_thread'
            ? `/email?thread=${encodeURIComponent(entityId)}`
            : `/${entityType}s/${entityId}`;

        result.suggestedActions.push({
          label: 'Vizualizare detalii',
          href,
        });
      }

      logger.info('[FollowUp] Response generated', {
        userId,
        entityType,
        answerLength: result.answer.length,
        actionsCount: result.suggestedActions.length,
      });

      return result;
    } catch (error) {
      logger.error('[FollowUp] Failed to generate response', {
        userId,
        entityType,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        answer: 'A apărut o eroare la procesarea întrebării. Vă rugăm încercați din nou.',
        suggestedActions: [],
      };
    }
  }
}

// Export singleton
export const firmBriefingFollowupService = new FirmBriefingFollowupService();
