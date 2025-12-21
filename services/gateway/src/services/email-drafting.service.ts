/**
 * Email Drafting Service
 * OPS-077: Service Wrappers for AI Assistant Handlers
 *
 * Thin wrapper around email drafting functionality for consistent
 * interface used by AI assistant intent handlers.
 */

import { prisma } from '@legal-platform/database';
import { GraphQLError } from 'graphql';
import { attachmentSuggestionService } from './attachment-suggestion.service';

// ============================================================================
// Configuration
// ============================================================================

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:3002';
const AI_SERVICE_API_KEY = process.env.AI_SERVICE_API_KEY || 'dev-api-key';

// ============================================================================
// Types
// ============================================================================

export type EmailTone = 'Formal' | 'Professional' | 'Brief' | 'Detailed';
export type RecipientType = 'Client' | 'Court' | 'OpposingCounsel' | 'ThirdParty' | 'Internal';

export interface UserContext {
  userId: string;
  firmId: string;
  accessToken?: string;
}

export interface GenerateDraftInput {
  emailId: string;
  tone?: EmailTone;
  recipientType?: RecipientType;
  instructions?: string;
}

export interface RefineDraftInput {
  draftId: string;
  instruction: string;
}

export interface EmailDraft {
  id: string;
  emailId: string;
  caseId: string | null;
  subject: string;
  body: string;
  htmlBody: string | null;
  tone: string;
  recipientType: string;
  confidence: number | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Service
// ============================================================================

export class EmailDraftingService {
  /**
   * Generate a draft reply to an email.
   * Extracts and wraps logic from email-drafting.resolvers.ts
   */
  async generateDraft(input: GenerateDraftInput, userContext: UserContext): Promise<EmailDraft> {
    const { emailId, tone = 'Professional', recipientType = 'Client' } = input;
    const { userId, firmId } = userContext;

    // Get the original email
    const email = await prisma.email.findFirst({
      where: {
        id: emailId,
        userId,
      },
      include: {
        caseLinks: {
          include: {
            case: {
              include: {
                client: true,
              },
            },
          },
        },
      },
    });

    if (!email) {
      throw new GraphQLError('Email not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Get primary case from links
    const primaryLink = email.caseLinks.find((link) => link.isPrimary) || email.caseLinks[0];
    const caseId = primaryLink?.caseId || null;

    // Call AI service to generate draft
    const response = await fetch(`${AI_SERVICE_URL}/api/email-drafting/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_SERVICE_API_KEY}`,
      },
      body: JSON.stringify({
        originalEmail: {
          id: email.id,
          graphMessageId: email.graphMessageId,
          subject: email.subject,
          bodyContent: email.bodyContent,
          bodyContentType: email.bodyContentType,
          from: email.from,
          toRecipients: email.toRecipients,
          ccRecipients: email.ccRecipients,
          receivedDateTime: email.receivedDateTime,
          sentDateTime: email.sentDateTime,
          hasAttachments: email.hasAttachments,
        },
        caseId,
        tone,
        recipientType,
        instructions: input.instructions,
        firmId,
        userId,
      }),
    });

    if (!response.ok) {
      throw new GraphQLError('Failed to generate draft', {
        extensions: { code: 'AI_SERVICE_ERROR' },
      });
    }

    const result = (await response.json()) as {
      subject: string;
      body: string;
      htmlBody?: string;
      confidence?: number;
      suggestedAttachments?: string[];
    };

    // Create draft in database
    const draft = await prisma.emailDraft.create({
      data: {
        emailId: email.id,
        caseId,
        firmId,
        userId,
        tone,
        recipientType,
        subject: result.subject,
        body: result.body,
        htmlBody: result.htmlBody || null,
        confidence: result.confidence || null,
        suggestedAttachments: result.suggestedAttachments || [],
        status: 'Generated',
      },
    });

    // Generate attachment suggestions asynchronously
    if (caseId) {
      attachmentSuggestionService
        .suggestAttachments(
          { id: email.id, subject: email.subject, bodyContent: email.bodyContent },
          caseId,
          result.body,
          firmId,
          userId
        )
        .then(async (suggestions) => {
          await prisma.attachmentSuggestion.createMany({
            data: suggestions.map((s) => ({
              draftId: draft.id,
              documentId: s.documentId,
              title: s.title,
              reason: s.reason,
              relevanceScore: s.relevanceScore,
              isSelected: false,
            })),
          });
        })
        .catch((err) => {
          console.error('Failed to generate attachment suggestions:', err);
        });
    }

    return draft as EmailDraft;
  }

  /**
   * Refine an existing draft with AI.
   */
  async refineDraft(input: RefineDraftInput, userContext: UserContext): Promise<EmailDraft> {
    const { draftId, instruction } = input;
    const { userId, firmId } = userContext;

    // Get the draft
    const draft = await prisma.emailDraft.findFirst({
      where: {
        id: draftId,
        firmId,
      },
    });

    if (!draft) {
      throw new GraphQLError('Draft not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Call AI service to refine draft
    const response = await fetch(`${AI_SERVICE_URL}/api/email-drafting/refine`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_SERVICE_API_KEY}`,
      },
      body: JSON.stringify({
        draftId: draft.id,
        currentBody: draft.body,
        instruction,
        caseId: draft.caseId,
        firmId,
        userId,
      }),
    });

    if (!response.ok) {
      throw new GraphQLError('Failed to refine draft', {
        extensions: { code: 'AI_SERVICE_ERROR' },
      });
    }

    const result = (await response.json()) as {
      refinedBody: string;
      refinedHtmlBody?: string;
      tokensUsed?: number;
    };

    // Create refinement record
    await prisma.draftRefinement.create({
      data: {
        draftId: draft.id,
        instruction,
        previousBody: draft.body,
        refinedBody: result.refinedBody,
        tokensUsed: result.tokensUsed || 0,
      },
    });

    // Update draft with refined content
    const updatedDraft = await prisma.emailDraft.update({
      where: { id: draft.id },
      data: {
        body: result.refinedBody,
        htmlBody: result.refinedHtmlBody || null,
        status: 'Editing',
      },
    });

    return updatedDraft as EmailDraft;
  }

  /**
   * Get a draft by ID.
   */
  async getDraft(draftId: string, userContext: UserContext): Promise<EmailDraft | null> {
    const draft = await prisma.emailDraft.findFirst({
      where: {
        id: draftId,
        firmId: userContext.firmId,
      },
    });

    return draft as EmailDraft | null;
  }

  /**
   * Get drafts for an email.
   */
  async getDraftsByEmail(emailId: string, userContext: UserContext): Promise<EmailDraft[]> {
    const drafts = await prisma.emailDraft.findMany({
      where: {
        emailId,
        firmId: userContext.firmId,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return drafts as EmailDraft[];
  }

  /**
   * Send a draft via Microsoft Graph API.
   */
  async sendDraft(draftId: string, userContext: UserContext): Promise<boolean> {
    const { firmId, accessToken } = userContext;

    if (!accessToken) {
      throw new GraphQLError('Authentication required with valid access token', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Get the draft with email
    const draft = await prisma.emailDraft.findFirst({
      where: {
        id: draftId,
        firmId,
      },
      include: {
        email: true,
      },
    });

    if (!draft) {
      throw new GraphQLError('Draft not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Build recipient address
    const email = draft.email as { from?: { address?: string } } | null;
    const replyToAddress = email?.from?.address;

    if (!replyToAddress) {
      throw new GraphQLError('Cannot determine recipient address', {
        extensions: { code: 'INVALID_DATA' },
      });
    }

    // Send via Graph API
    const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject: draft.subject,
          body: {
            contentType: draft.htmlBody ? 'HTML' : 'Text',
            content: draft.htmlBody || draft.body,
          },
          toRecipients: [
            {
              emailAddress: { address: replyToAddress },
            },
          ],
        },
        saveToSentItems: true,
      }),
    });

    if (!graphResponse.ok) {
      const error = await graphResponse.text();
      console.error('Graph API error:', error);
      throw new GraphQLError('Failed to send email', {
        extensions: { code: 'GRAPH_API_ERROR' },
      });
    }

    // Update draft status
    await prisma.emailDraft.update({
      where: { id: draft.id },
      data: {
        status: 'Sent',
        sentAt: new Date(),
      },
    });

    return true;
  }

  /**
   * Discard a draft.
   */
  async discardDraft(draftId: string, userContext: UserContext): Promise<boolean> {
    const draft = await prisma.emailDraft.findFirst({
      where: {
        id: draftId,
        firmId: userContext.firmId,
      },
    });

    if (!draft) {
      throw new GraphQLError('Draft not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    await prisma.emailDraft.update({
      where: { id: draft.id },
      data: { status: 'Discarded' },
    });

    return true;
  }
}

// Export singleton instance
export const emailDraftingService = new EmailDraftingService();
