/**
 * Document Templates Resolvers
 * Provides access to extracted document templates for Word Add-in
 *
 * Templates are extracted from legacy document clusters and used by
 * the Word Add-in AI agent to assist with document drafting.
 */

import { GraphQLError } from 'graphql';
import { prisma } from '@legal-platform/database';

interface Context {
  user?: {
    id: string;
    role: string;
    firmId: string;
  };
}

interface TemplateSection {
  name: string;
  description?: string;
  isRequired: boolean;
  order: number;
}

interface TemplateVariableField {
  name: string;
  description?: string;
  fieldType: string;
  isRequired: boolean;
  exampleValue?: string;
}

interface TemplateStyleGuide {
  language: string;
  formality: string;
  commonPhrases: string[];
  formatting?: string;
}

/**
 * Safely parse JSON field with type checking
 */
function parseJsonArray<T>(json: unknown, defaultValue: T[] = []): T[] {
  if (!json) return defaultValue;
  if (Array.isArray(json)) return json as T[];
  return defaultValue;
}

function parseJsonObject<T extends object>(json: unknown, defaultValue: T): T {
  if (!json) return defaultValue;
  if (typeof json === 'object' && json !== null) return json as T;
  return defaultValue;
}

export const documentTemplatesResolvers = {
  Query: {
    /**
     * Get all available document templates
     */
    documentTemplates: async (_: unknown, __: unknown, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Get all templates with their cluster info
      const templates = await prisma.documentTemplate.findMany({
        include: {
          cluster: {
            select: {
              id: true,
              suggestedName: true,
              approvedName: true,
              description: true,
              documentCount: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return {
        templates: templates.map((template) => ({
          id: template.id,
          name: template.name,
          nameEn: template.nameEn,
          description: template.description,
          sections: parseJsonArray<TemplateSection>(template.sections),
          variableFields: parseJsonArray<TemplateVariableField>(template.variableFields),
          boilerplateClauses: parseJsonArray<string>(template.boilerplateClauses),
          styleGuide: parseJsonObject<TemplateStyleGuide>(template.styleGuide, {
            language: template.language || 'ro',
            formality: 'formal',
            commonPhrases: [],
          }),
          sourceDocumentCount: template.sourceDocumentIds?.length || 0,
          extractionConfidence: template.extractionConfidence,
          language: template.language,
          createdAt: template.createdAt,
          cluster: {
            id: template.cluster.id,
            suggestedName: template.cluster.suggestedName,
            approvedName: template.cluster.approvedName,
            description: template.cluster.description,
            documentCount: template.cluster.documentCount,
          },
        })),
        totalCount: templates.length,
      };
    },

    /**
     * Get a specific document template by ID
     */
    documentTemplate: async (_: unknown, args: { id: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const template = await prisma.documentTemplate.findUnique({
        where: { id: args.id },
        include: {
          cluster: {
            select: {
              id: true,
              suggestedName: true,
              approvedName: true,
              description: true,
              documentCount: true,
            },
          },
        },
      });

      if (!template) {
        return null;
      }

      return {
        id: template.id,
        name: template.name,
        nameEn: template.nameEn,
        description: template.description,
        sections: parseJsonArray<TemplateSection>(template.sections),
        variableFields: parseJsonArray<TemplateVariableField>(template.variableFields),
        boilerplateClauses: parseJsonArray<string>(template.boilerplateClauses),
        styleGuide: parseJsonObject<TemplateStyleGuide>(template.styleGuide, {
          language: template.language || 'ro',
          formality: 'formal',
          commonPhrases: [],
        }),
        sourceDocumentCount: template.sourceDocumentIds?.length || 0,
        extractionConfidence: template.extractionConfidence,
        language: template.language,
        createdAt: template.createdAt,
        cluster: {
          id: template.cluster.id,
          suggestedName: template.cluster.suggestedName,
          approvedName: template.cluster.approvedName,
          description: template.cluster.description,
          documentCount: template.cluster.documentCount,
        },
      };
    },
  },
};
