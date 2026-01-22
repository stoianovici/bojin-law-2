/**
 * Context Aggregator Service
 * Main entry point for AI agents to request context
 *
 * Combines client and case context documents based on agent type,
 * with specialized methods for common use cases.
 */

import { prisma } from '@legal-platform/database';
import type {
  AgentContextRequest,
  AgentContextResponse,
  ContextTier,
  AgentType,
  AGENT_SECTION_DEFAULTS,
} from '@legal-platform/types';
import { caseContextDocumentService } from './case-context-document.service';
import { clientContextDocumentService } from './client-context-document.service';

// ============================================================================
// Types
// ============================================================================

export interface EmailReplyContext {
  caseId: string;
  clientId: string;
  caseContext: string;
  clientContext: string;
  actorContext: string | null;
  threadContext: string | null;
  tokenCount: number;
}

export interface DocumentDraftContext {
  caseId: string;
  clientId: string;
  caseContext: string;
  clientContext: string;
  documentType: string;
  tokenCount: number;
}

// ============================================================================
// Service Class
// ============================================================================

export class ContextAggregatorService {
  /**
   * Main entry point for getting context for an agent
   * Returns context document optimized for the agent type
   */
  async getContextForAgent(request: AgentContextRequest): Promise<AgentContextResponse> {
    return caseContextDocumentService.getForAgent(request);
  }

  /**
   * Get context specifically optimized for email reply
   * Includes actor-specific communication notes and thread history
   */
  async getEmailReplyContext(
    caseId: string,
    actorId?: string,
    threadId?: string
  ): Promise<EmailReplyContext> {
    // Get case to find client
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        clientId: true,
        firmId: true,
      },
    });

    if (!caseData) {
      throw new Error(`Case not found: ${caseId}`);
    }

    // Get case context with email_reply agent settings
    const caseResponse = await caseContextDocumentService.getForAgent({
      caseId,
      agentType: 'email_reply',
      tier: 'full',
      targetActorId: actorId,
      threadId,
    });

    // Get client context at standard tier
    const clientContext = await clientContextDocumentService.getContextMarkdown(
      caseData.clientId,
      caseData.firmId,
      'standard'
    );

    // Get actor-specific context if provided
    let actorContext: string | null = null;
    if (actorId) {
      const actor = await prisma.caseActor.findUnique({
        where: { id: actorId },
        select: {
          name: true,
          role: true,
          email: true,
          communicationNotes: true,
          preferredTone: true,
        },
      });

      if (actor) {
        const lines = [`## Interlocutor: ${actor.name}`];
        lines.push(`Rol: ${actor.role}`);
        if (actor.email) lines.push(`Email: ${actor.email}`);
        if (actor.preferredTone) lines.push(`Ton preferat: ${actor.preferredTone}`);
        if (actor.communicationNotes) lines.push(`⚠️ Note: ${actor.communicationNotes}`);
        actorContext = lines.join('\n');
      }
    }

    // Get thread context if provided
    let threadContext: string | null = null;
    if (threadId) {
      const threadEmails = await prisma.email.findMany({
        where: {
          caseId,
          conversationId: threadId,
        },
        select: {
          subject: true,
          from: true,
          bodyPreview: true,
          receivedDateTime: true,
        },
        orderBy: { receivedDateTime: 'asc' },
        take: 10,
      });

      if (threadEmails.length > 0) {
        const lines = [`## Thread: ${threadEmails[0].subject || 'Fără subiect'}`];
        for (const email of threadEmails) {
          const date = email.receivedDateTime?.toLocaleDateString('ro-RO') || '';
          // Extract sender name from 'from' JSON field
          const fromObj = email.from as { emailAddress?: { name?: string } } | null;
          const senderName = fromObj?.emailAddress?.name || 'Necunoscut';
          lines.push(`\n[${date}] ${senderName}:`);
          lines.push(email.bodyPreview || '(fără conținut)');
        }
        threadContext = lines.join('\n');
      }
    }

    return {
      caseId,
      clientId: caseData.clientId,
      caseContext: caseResponse.contextMarkdown,
      clientContext,
      actorContext,
      threadContext,
      tokenCount:
        caseResponse.tokenCount +
        estimateTokens(clientContext) +
        (actorContext ? estimateTokens(actorContext) : 0) +
        (threadContext ? estimateTokens(threadContext) : 0),
    };
  }

  /**
   * Get context specifically optimized for document drafting
   * Includes detailed client info and document type specifics
   */
  async getDocumentDraftContext(
    caseId: string,
    documentType: string
  ): Promise<DocumentDraftContext> {
    // Get case to find client
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        clientId: true,
        firmId: true,
      },
    });

    if (!caseData) {
      throw new Error(`Case not found: ${caseId}`);
    }

    // Get case context with document_draft agent settings
    const caseResponse = await caseContextDocumentService.getForAgent({
      caseId,
      agentType: 'document_draft',
      tier: 'full',
    });

    // Get full client context for documents
    const clientContext = await clientContextDocumentService.getContextMarkdown(
      caseData.clientId,
      caseData.firmId,
      'full'
    );

    return {
      caseId,
      clientId: caseData.clientId,
      caseContext: caseResponse.contextMarkdown,
      clientContext,
      documentType,
      tokenCount: caseResponse.tokenCount + estimateTokens(clientContext),
    };
  }

  /**
   * Get context for Word Add-in
   * Full context optimized for interactive document creation
   */
  async getWordAddinContext(caseId: string): Promise<string> {
    const response = await caseContextDocumentService.getForAgent({
      caseId,
      agentType: 'word_addin',
      tier: 'full',
    });

    return response.contextMarkdown;
  }

  /**
   * Get context for AI Assistant chat
   * Full context with all sections for comprehensive assistance
   */
  async getAssistantContext(caseId: string): Promise<string> {
    const response = await caseContextDocumentService.getForAgent({
      caseId,
      agentType: 'assistant',
      tier: 'full',
    });

    return response.contextMarkdown;
  }

  /**
   * Get minimal context for quick operations
   * Used for email categorization, document summarization, etc.
   */
  async getMinimalContext(caseId: string): Promise<string> {
    return caseContextDocumentService.getContextMarkdown(caseId, 'critical');
  }

  /**
   * Get combined context for case analysis
   * Returns both client and case context at full tier
   */
  async getCaseAnalysisContext(
    caseId: string
  ): Promise<{ caseContext: string; clientContext: string }> {
    // Get case to find client
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        clientId: true,
        firmId: true,
      },
    });

    if (!caseData) {
      throw new Error(`Case not found: ${caseId}`);
    }

    const caseContext = await caseContextDocumentService.getContextMarkdown(caseId, 'full');
    const clientContext = await clientContextDocumentService.getContextMarkdown(
      caseData.clientId,
      caseData.firmId,
      'full'
    );

    return { caseContext, clientContext };
  }

  /**
   * Get context with custom section selection
   */
  async getCustomContext(
    caseId: string,
    agentType: AgentType,
    tier: ContextTier,
    sections?: string[]
  ): Promise<AgentContextResponse> {
    return caseContextDocumentService.getForAgent({
      caseId,
      agentType,
      tier,
      sections: sections as any,
    });
  }

  /**
   * Invalidate context for a case
   */
  async invalidateCase(caseId: string): Promise<void> {
    await caseContextDocumentService.invalidate(caseId);
  }

  /**
   * Invalidate context for a client and all their cases
   */
  async invalidateClient(clientId: string): Promise<void> {
    await clientContextDocumentService.invalidate(clientId);
    await caseContextDocumentService.invalidateForClient(clientId);
  }

  /**
   * Force regeneration of all context for a case
   */
  async regenerateCase(caseId: string): Promise<void> {
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: { firmId: true, clientId: true },
    });

    if (!caseData) {
      throw new Error(`Case not found: ${caseId}`);
    }

    // Regenerate client context first
    await clientContextDocumentService.regenerate(caseData.clientId, caseData.firmId);

    // Then regenerate case context
    await caseContextDocumentService.regenerate(caseId, caseData.firmId);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ============================================================================
// Singleton Export
// ============================================================================

export const contextAggregatorService = new ContextAggregatorService();
