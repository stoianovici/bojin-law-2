/**
 * Court Filing Template Resolvers
 * Plan: Word Templates - CPC Court Filing Documents
 *
 * GraphQL resolvers for court filing template queries and document generation.
 */

import { GraphQLError } from 'graphql';
import { requireAuth, type Context } from '../utils/auth';
import {
  COURT_FILING_TEMPLATES,
  getTemplateById,
  getTemplatesByCategory,
  searchTemplates as searchTemplatesInData,
  type CourtFilingCategory,
  type CourtFilingTemplate,
} from '../../services/court-filing-templates';
import {
  buildCourtFilingPrompt,
  buildCourtFilingUserPrompt,
} from '../../services/court-filing-prompts';
import { aiClient, getModelForFeature } from '../../services/ai-client.service';
import { caseContextFileService } from '../../services/case-context-file.service';
import { docxGeneratorService } from '../../services/docx-generator.service';
import { prisma } from '@legal-platform/database';
import logger from '../../utils/logger';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map internal category to GraphQL enum.
 * GraphQL enums use underscores instead of hyphens.
 */
function categoryToGraphQL(category: CourtFilingCategory): string {
  return category.replace(/-/g, '_');
}

/**
 * Map GraphQL enum to internal category.
 */
function graphQLToCategory(graphQLCategory: string): CourtFilingCategory {
  return graphQLCategory.replace(/_/g, '-') as CourtFilingCategory;
}

/**
 * Transform template for GraphQL response.
 */
function templateToGraphQL(template: CourtFilingTemplate) {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    category: categoryToGraphQL(template.category),
    formCategory: template.formCategory,
    cpcArticles: template.cpcArticles,
    partyLabels: template.partyLabels,
    requiredSections: template.requiredSections,
    keywords: template.keywords,
  };
}

/**
 * Build context section for document generation.
 */
async function buildContextSection(
  contextType: string,
  caseId?: string,
  clientId?: string
): Promise<string> {
  if (contextType === 'case' && caseId) {
    const contextFile = await caseContextFileService.getContextFile(caseId, 'word_addin');
    if (!contextFile) {
      throw new GraphQLError('Contextul dosarului nu este disponibil', {
        extensions: { code: 'BAD_REQUEST' },
      });
    }
    return contextFile.content;
  }

  if (contextType === 'client' && clientId) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        name: true,
        clientType: true,
        address: true,
        contactInfo: true,
        cui: true,
        registrationNumber: true,
      },
    });

    if (!client) {
      throw new GraphQLError('Clientul nu a fost gasit', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    const contactInfo = client.contactInfo as { email?: string; phone?: string } | null;

    return `## Date client
- Nume: ${client.name}
- Tip: ${client.clientType === 'Individual' ? 'Persoana fizica' : 'Persoana juridica'}
${client.cui ? `- CUI: ${client.cui}` : ''}
${client.registrationNumber ? `- Nr. Reg. Com.: ${client.registrationNumber}` : ''}
${client.address ? `- Adresa: ${client.address}` : ''}
${contactInfo?.email ? `- Email: ${contactInfo.email}` : ''}
${contactInfo?.phone ? `- Telefon: ${contactInfo.phone}` : ''}`;
  }

  // Internal context - no case/client data
  return '## Context intern\nDocument generat fara context specific de dosar sau client.';
}

// ============================================================================
// Resolvers
// ============================================================================

export const courtFilingResolvers = {
  Query: {
    /**
     * Get all court filing templates.
     */
    courtFilingTemplates: async (_: unknown, __: unknown, context: Context) => {
      requireAuth(context);
      return COURT_FILING_TEMPLATES.map(templateToGraphQL);
    },

    /**
     * Get templates by category.
     */
    courtFilingTemplatesByCategory: async (
      _: unknown,
      args: { category: string },
      context: Context
    ) => {
      requireAuth(context);
      const internalCategory = graphQLToCategory(args.category);
      const templates = getTemplatesByCategory(internalCategory);
      return templates.map(templateToGraphQL);
    },

    /**
     * Get a single template by ID.
     */
    courtFilingTemplate: async (_: unknown, args: { id: string }, context: Context) => {
      requireAuth(context);
      const template = getTemplateById(args.id);
      if (!template) return null;
      return templateToGraphQL(template);
    },

    /**
     * Search templates by query.
     */
    searchCourtFilingTemplates: async (_: unknown, args: { query: string }, context: Context) => {
      requireAuth(context);
      const results = searchTemplatesInData(args.query);
      return results.map(templateToGraphQL);
    },
  },

  Mutation: {
    /**
     * Generate a court filing document using AI.
     */
    generateCourtFiling: async (
      _: unknown,
      args: {
        input: {
          templateId: string;
          contextType: string;
          caseId?: string;
          clientId?: string;
          instructions?: string;
          includeOoxml?: boolean;
        };
      },
      context: Context
    ) => {
      const user = requireAuth(context);
      const startTime = Date.now();
      const { templateId, contextType, caseId, clientId, instructions, includeOoxml } = args.input;

      // Validate template
      const template = getTemplateById(templateId);
      if (!template) {
        throw new GraphQLError(`Template nu exista: ${templateId}`, {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Validate context
      if (contextType === 'case' && !caseId) {
        throw new GraphQLError('caseId este obligatoriu pentru contextul de tip case', {
          extensions: { code: 'BAD_REQUEST' },
        });
      }
      if (contextType === 'client' && !clientId) {
        throw new GraphQLError('clientId este obligatoriu pentru contextul de tip client', {
          extensions: { code: 'BAD_REQUEST' },
        });
      }

      // Check case access if case context
      if (caseId) {
        const caseData = await prisma.case.findUnique({
          where: { id: caseId },
          select: { firmId: true },
        });

        if (!caseData || caseData.firmId !== user.firmId) {
          throw new GraphQLError('Nu aveti acces la acest dosar', {
            extensions: { code: 'FORBIDDEN' },
          });
        }
      }

      logger.info('Court filing generation started', {
        userId: user.id,
        firmId: user.firmId,
        templateId,
        contextType,
        caseId,
        clientId,
      });

      try {
        // Build context
        const caseContext = await buildContextSection(contextType, caseId, clientId);

        // Build prompts
        const systemPrompt = buildCourtFilingPrompt(template, instructions);
        const userPrompt = buildCourtFilingUserPrompt(template, caseContext, instructions);

        // Get model for this feature
        const model = await getModelForFeature(user.firmId, 'word_draft');

        // Call AI
        const response = await aiClient.complete(
          userPrompt,
          {
            feature: 'word_draft',
            userId: user.id,
            firmId: user.firmId,
            entityType: caseId ? 'case' : clientId ? 'client' : 'firm',
            entityId: caseId || clientId || user.firmId,
          },
          {
            system: systemPrompt,
            model,
            temperature: 0.4,
            maxTokens: 8192,
          }
        );

        // Generate OOXML if requested
        const ooxmlContent =
          includeOoxml !== false
            ? docxGeneratorService.markdownToOoxmlFragment(response.content)
            : undefined;

        const processingTimeMs = Date.now() - startTime;

        logger.info('Court filing generation completed', {
          userId: user.id,
          templateId,
          tokensUsed: response.inputTokens + response.outputTokens,
          processingTimeMs,
        });

        return {
          content: response.content,
          ooxmlContent,
          title: template.name,
          template: templateToGraphQL(template),
          tokensUsed: response.inputTokens + response.outputTokens,
          processingTimeMs,
        };
      } catch (error) {
        logger.error('Court filing generation failed', {
          userId: user.id,
          templateId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
  },
};

export default courtFilingResolvers;
