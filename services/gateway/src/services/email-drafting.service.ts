/**
 * Email Drafting Service
 * OPS-077: Service Wrappers for AI Assistant Handlers
 *
 * AI-powered email drafting using the gateway's centralized aiClient.
 * Migrated from external ai-service to use getModelForFeature for admin model selection.
 */

import { prisma } from '@legal-platform/database';
import { GraphQLError } from 'graphql';
import { attachmentSuggestionService } from './attachment-suggestion.service';
import { caseContextService } from './case-context.service';
import { aiClient, getModelForFeature } from './ai-client.service';
import logger from '../utils/logger';

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
// Prompt Templates
// ============================================================================

// Tone-specific instructions
const TONE_PROMPTS: Record<EmailTone, string> = {
  Formal: `Use formal legal language appropriate for court or official correspondence.
Address the recipient by their title (e.g., "Onorate Instanță", "Stimat Domn/Doamnă").
Use passive voice where appropriate. Include proper salutations and closings.
Maintain maximum formality throughout.`,

  Professional: `Use standard business communication language.
Be clear and concise while maintaining professionalism.
Address the recipient appropriately based on relationship.
Include appropriate salutation and professional closing.`,

  Brief: `Keep the response concise and to the point.
Acknowledge receipt or confirm understanding.
Omit unnecessary pleasantries while remaining polite.
Maximum 3-4 sentences for simple matters. Focus on essential information only.`,

  Detailed: `Provide comprehensive explanations.
Address all points raised in the original email.
Include relevant background context.
Use numbered lists for multiple items. Be thorough while maintaining clarity.`,
};

// Recipient type adaptations
const RECIPIENT_ADAPTATIONS: Record<
  RecipientType,
  { languageLevel: string; toneGuidance: string }
> = {
  Client: {
    languageLevel: 'accessible',
    toneGuidance:
      'Use warm, reassuring language. Explain legal concepts in simple terms. Show empathy and professionalism.',
  },
  OpposingCounsel: {
    languageLevel: 'legal-technical',
    toneGuidance:
      'Use formal legal terminology. Be precise and professional. Maintain clear position statements.',
  },
  Court: {
    languageLevel: 'legal-formal',
    toneGuidance:
      'Use highest formality. Follow court correspondence protocols. Be respectful and precise.',
  },
  ThirdParty: {
    languageLevel: 'professional',
    toneGuidance: 'Maintain neutrality. Be clear and professional. Avoid assuming legal knowledge.',
  },
  Internal: {
    languageLevel: 'casual-professional',
    toneGuidance:
      'Be direct and efficient. Use familiar tone appropriate for colleagues. Focus on action items.',
  },
};

// System prompt template
const SYSTEM_PROMPT = `You are an AI assistant for a Romanian law firm, specializing in drafting professional email responses.

CRITICAL RULES:
1. Generate complete, contextually appropriate email responses
2. Use appropriate language based on recipient type
3. Reference case-specific information when relevant
4. Address all points from the original email
5. Maintain appropriate legal formality
6. Ensure the response is ready to send with minimal editing
7. IMPORTANT: Default to Romanian (limba română) for all responses. Only use English if the original email is explicitly in English.
8. Use proper Romanian legal terminology and formulations (e.g., "Cu stimă", "Vă rugăm", "Cu respect").`;

// User prompt template for draft generation
const DRAFT_PROMPT = `Generate a reply to the following email.

RECIPIENT TYPE: {recipientType}
Language Level: {languageLevel}
Tone Guidance: {toneGuidance}

REQUESTED TONE: {tone}
{toneInstructions}

CASE CONTEXT:
{caseContext}

ORIGINAL EMAIL:
From: {originalFrom}
Subject: {originalSubject}
Date: {originalDate}

Body:
{originalBody}

Generate a complete email response with:
1. Appropriate subject line (with "Re:" prefix if replying)
2. Email body matching the requested tone and recipient type
3. Address all questions or points from the original email
4. Include relevant case references where appropriate
5. Proper salutation and closing

Return your response as JSON with this exact structure:
{
  "subject": "string",
  "body": "string (plain text)",
  "htmlBody": "string (formatted HTML with <p>, <br>, <ul>, etc.)",
  "keyPointsAddressed": ["string array of main points you addressed"],
  "confidence": number (0-1, your confidence in the quality of this response)
}`;

// User prompt template for draft refinement
const REFINE_PROMPT = `Refine the following email draft based on the user's instruction.

CURRENT DRAFT:
{currentBody}

USER INSTRUCTION:
{instruction}

CASE CONTEXT:
{caseContext}

Refine the draft according to the instruction while:
1. Maintaining the original tone and style
2. Preserving any case-specific references
3. Keeping proper Romanian legal formulations

Return your response as JSON with this exact structure:
{
  "refinedBody": "string (plain text)",
  "refinedHtmlBody": "string (formatted HTML)"
}`;

// Sanitize content for AI prompt injection protection
function sanitizeForPrompt(content: string): string {
  return content.replace(/```/g, '\\`\\`\\`').replace(/\${/g, '\\${').substring(0, 10000);
}

// Convert plain text to basic HTML
function convertToHtml(text: string): string {
  return text
    .split('\n\n')
    .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
    .join('');
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

    // Get comprehensive case context for AI
    let caseContext = 'No case context available.';
    if (caseId) {
      try {
        const context = await caseContextService.getContextForOperation(caseId, 'email.reply');
        caseContext = caseContextService.formatForPrompt(context);
        logger.debug('Email drafting context built', {
          caseId,
          tokenEstimate: context.tokenEstimate,
        });
      } catch (error) {
        logger.warn(
          'Failed to get case context for email drafting, continuing with minimal context',
          {
            caseId,
            error,
          }
        );
      }
    }

    // Get configured model for email_drafting feature
    const model = await getModelForFeature(firmId, 'email_drafting');
    logger.debug('Using model for email_drafting', { firmId, model });

    // Build the prompt with interpolated values
    const recipientAdapt = RECIPIENT_ADAPTATIONS[recipientType];
    const fromAddress = email.from as { name?: string; address: string } | null;

    const userPrompt = DRAFT_PROMPT.replace('{recipientType}', recipientType)
      .replace('{languageLevel}', recipientAdapt.languageLevel)
      .replace('{toneGuidance}', recipientAdapt.toneGuidance)
      .replace('{tone}', tone)
      .replace('{toneInstructions}', TONE_PROMPTS[tone])
      .replace('{caseContext}', caseContext)
      .replace(
        '{originalFrom}',
        `${fromAddress?.name || ''} <${fromAddress?.address || 'unknown'}>`
      )
      .replace('{originalSubject}', sanitizeForPrompt(email.subject || ''))
      .replace('{originalDate}', email.receivedDateTime?.toISOString() || 'unknown')
      .replace('{originalBody}', sanitizeForPrompt(email.bodyContent || ''));

    // Generate draft using aiClient
    const aiResponse = await aiClient.complete(
      userPrompt,
      {
        feature: 'email_drafting',
        userId,
        firmId,
        entityType: 'email',
        entityId: email.id,
      },
      {
        system: SYSTEM_PROMPT,
        model,
        maxTokens: 2048,
        temperature: 0.3,
      }
    );

    // Parse JSON response from AI
    let result: {
      subject: string;
      body: string;
      htmlBody?: string;
      confidence?: number;
      keyPointsAddressed?: string[];
    };

    try {
      const jsonMatch = aiResponse.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      result = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      logger.warn('Failed to parse AI response as JSON, using fallback', {
        response: aiResponse.content.substring(0, 500),
      });
      result = {
        subject: `Re: ${email.subject || 'Reply'}`,
        body: aiResponse.content,
        confidence: 0.5,
      };
    }

    // Ensure htmlBody exists
    if (!result.htmlBody) {
      result.htmlBody = convertToHtml(result.body);
    }

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
        suggestedAttachments: [], // Will be populated by attachment suggestion service
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

    // Get comprehensive case context for AI
    let caseContext = 'No case context available.';
    if (draft.caseId) {
      try {
        const context = await caseContextService.getContextForOperation(
          draft.caseId,
          'email.reply'
        );
        caseContext = caseContextService.formatForPrompt(context);
      } catch (error) {
        logger.warn('Failed to get case context for draft refinement', {
          caseId: draft.caseId,
          error,
        });
      }
    }

    // Get configured model for email_drafting feature
    const model = await getModelForFeature(firmId, 'email_drafting');
    logger.debug('Using model for email_drafting (refine)', { firmId, model });

    // Build the prompt with interpolated values
    const userPrompt = REFINE_PROMPT.replace('{currentBody}', sanitizeForPrompt(draft.body))
      .replace('{instruction}', sanitizeForPrompt(instruction))
      .replace('{caseContext}', caseContext);

    // Generate refinement using aiClient
    const aiResponse = await aiClient.complete(
      userPrompt,
      {
        feature: 'email_drafting',
        userId,
        firmId,
        entityType: 'email_draft',
        entityId: draft.id,
      },
      {
        system: SYSTEM_PROMPT,
        model,
        maxTokens: 2048,
        temperature: 0.3,
      }
    );

    // Parse JSON response from AI
    let result: {
      refinedBody: string;
      refinedHtmlBody?: string;
    };

    try {
      const jsonMatch = aiResponse.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      result = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      logger.warn('Failed to parse AI refinement response as JSON, using fallback', {
        response: aiResponse.content.substring(0, 500),
      });
      result = {
        refinedBody: aiResponse.content,
      };
    }

    // Ensure refinedHtmlBody exists
    if (!result.refinedHtmlBody) {
      result.refinedHtmlBody = convertToHtml(result.refinedBody);
    }

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
