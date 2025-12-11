/**
 * Semantic Version Control GraphQL Resolvers
 * Story 3.5: Semantic Version Control System
 *
 * Implements resolvers for version comparison, semantic diff,
 * risk assessment, and response suggestion generation
 */

import { GraphQLError } from 'graphql';
import { prisma } from '@legal-platform/database';
import logger from '../../utils/logger';

// AI Service base URL
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:3002';
const AI_SERVICE_API_KEY = process.env.AI_SERVICE_API_KEY || 'dev-api-key';

// Cache TTL in hours
const COMPARISON_CACHE_TTL_HOURS = parseInt(process.env.AI_COMPARISON_CACHE_TTL_HOURS || '24', 10);

// Context type
export interface Context {
  user?: {
    id: string;
    firmId: string;
    role: 'Partner' | 'Associate' | 'Paralegal' | 'BusinessOwner';
    email: string;
  };
}

// Helper function to check authentication
function requireAuth(context: Context) {
  if (!context.user) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return context.user;
}

// Helper function to require Associate or Partner role for version operations
function requireVersionControlRole(user: Context['user']) {
  if (!user) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }

  if (user.role !== 'Partner' && user.role !== 'Associate') {
    throw new GraphQLError('Version control operations require Associate or Partner role', {
      extensions: { code: 'FORBIDDEN' },
    });
  }

  return user;
}

// Helper to check document access
async function canAccessDocument(documentId: string, user: Context['user']): Promise<boolean> {
  if (!user) return false;

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { firmId: true, clientId: true },
  });

  if (!document || document.firmId !== user.firmId) return false;

  return true;
}

// Helper to validate version belongs to document
async function validateVersion(versionId: string, documentId: string): Promise<void> {
  const version = await prisma.documentVersion.findFirst({
    where: { id: versionId, documentId },
  });

  if (!version) {
    throw new GraphQLError(`Version ${versionId} not found for document`, {
      extensions: { code: 'NOT_FOUND' },
    });
  }
}

// Call AI service for comparison
async function callAIService(endpoint: string, data: object): Promise<any> {
  try {
    const response = await fetch(`${AI_SERVICE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_SERVICE_API_KEY}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`AI Service error: ${error}`);
    }

    return response.json();
  } catch (error) {
    logger.error('AI Service call failed', { endpoint, error });
    throw new GraphQLError('AI service unavailable', {
      extensions: { code: 'SERVICE_UNAVAILABLE' },
    });
  }
}

export const semanticVersionControlResolvers = {
  Query: {
    // Compare two document versions
    compareVersions: async (
      _: unknown,
      { input }: { input: { documentId: string; fromVersionId: string; toVersionId: string } },
      context: Context
    ) => {
      const user = requireAuth(context);
      requireVersionControlRole(user);

      const { documentId, fromVersionId, toVersionId } = input;

      // Check document access
      if (!(await canAccessDocument(documentId, user))) {
        throw new GraphQLError('Document not found or access denied', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Validate versions
      await validateVersion(fromVersionId, documentId);
      await validateVersion(toVersionId, documentId);

      // Check cache first
      const cached = await prisma.versionComparisonCache.findUnique({
        where: {
          fromVersionId_toVersionId: { fromVersionId, toVersionId },
        },
      });

      if (cached && cached.expiresAt > new Date()) {
        logger.info('Version comparison cache hit', { fromVersionId, toVersionId });

        const [fromVersion, toVersion] = await Promise.all([
          getVersionInfo(fromVersionId),
          getVersionInfo(toVersionId),
        ]);

        return {
          fromVersion,
          toVersion,
          ...(cached.comparisonData as object),
          executiveSummary: cached.summary,
          aggregateRisk: cached.aggregateRisk,
          comparedAt: cached.createdAt,
        };
      }

      // Get document context
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: { clientId: true, fileType: true },
      });

      // Compute comparison via AI service
      const comparison = await callAIService('/api/semantic-diff/compare', {
        documentId,
        fromVersionId,
        toVersionId,
        documentContext: {
          documentId,
          documentType: document?.fileType || 'contract',
          language: 'ro', // Default to Romanian
          firmId: user.firmId,
        },
      });

      // Cache the result
      const expiresAt = new Date(Date.now() + COMPARISON_CACHE_TTL_HOURS * 60 * 60 * 1000);
      await prisma.versionComparisonCache.upsert({
        where: {
          fromVersionId_toVersionId: { fromVersionId, toVersionId },
        },
        create: {
          fromVersionId,
          toVersionId,
          comparisonData: comparison,
          summary: comparison.executiveSummary || '',
          aggregateRisk: comparison.aggregateRisk || 'LOW',
          expiresAt,
        },
        update: {
          comparisonData: comparison,
          summary: comparison.executiveSummary || '',
          aggregateRisk: comparison.aggregateRisk || 'LOW',
          expiresAt,
          createdAt: new Date(),
        },
      });

      // Store semantic changes
      if (comparison.changes && comparison.changes.length > 0) {
        await prisma.semanticChange.deleteMany({
          where: { fromVersionId, toVersionId },
        });

        await prisma.semanticChange.createMany({
          data: comparison.changes.map((change: any) => ({
            documentId,
            fromVersionId,
            toVersionId,
            changeType: change.changeType,
            significance: change.significance,
            beforeText: change.beforeText,
            afterText: change.afterText,
            sectionPath: change.sectionPath,
            plainSummary: change.plainSummary || '',
            legalClassification: change.legalClassification,
            riskLevel: change.riskLevel,
            riskExplanation: change.riskExplanation,
            aiConfidence: change.aiConfidence,
          })),
        });
      }

      const [fromVersion, toVersion] = await Promise.all([
        getVersionInfo(fromVersionId),
        getVersionInfo(toVersionId),
      ]);

      return {
        fromVersion,
        toVersion,
        changes: comparison.changes || [],
        executiveSummary: comparison.executiveSummary || '',
        aggregateRisk: comparison.aggregateRisk || 'LOW',
        totalChanges: comparison.totalChanges || 0,
        changeBreakdown: comparison.changeBreakdown || {
          formatting: 0,
          minorWording: 0,
          substantive: 0,
          critical: 0,
        },
        comparedAt: new Date(),
      };
    },

    // Get version timeline for a document
    documentVersionTimeline: async (
      _: unknown,
      { documentId }: { documentId: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      if (!(await canAccessDocument(documentId, user))) {
        throw new GraphQLError('Document not found or access denied', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const versions = await prisma.documentVersion.findMany({
        where: { documentId },
        orderBy: { versionNumber: 'desc' },
        include: {
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      return {
        documentId,
        versions: versions.map((v) => ({
          id: v.id,
          documentId: v.documentId,
          versionNumber: v.versionNumber,
          oneDriveVersionId: v.oneDriveVersionId,
          changesSummary: v.changesSummary,
          createdBy: v.creator,
          createdAt: v.createdAt,
          riskLevel: null, // Would need to be calculated or stored
        })),
        totalVersions: versions.length,
      };
    },

    // Get filtered semantic changes
    semanticChanges: async (
      _: unknown,
      {
        input,
      }: {
        input: {
          documentId: string;
          fromVersionId: string;
          toVersionId: string;
          significance?: string;
          legalClassification?: string;
        };
      },
      context: Context
    ) => {
      const user = requireAuth(context);

      if (!(await canAccessDocument(input.documentId, user))) {
        throw new GraphQLError('Document not found or access denied', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const where: any = {
        documentId: input.documentId,
        fromVersionId: input.fromVersionId,
        toVersionId: input.toVersionId,
      };

      if (input.significance) {
        where.significance = input.significance;
      }

      if (input.legalClassification) {
        where.legalClassification = input.legalClassification;
      }

      const changes = await prisma.semanticChange.findMany({
        where,
        include: {
          responseSuggestions: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      return changes;
    },

    // Get a single semantic change
    semanticChange: async (_: unknown, { id }: { id: string }, context: Context) => {
      const user = requireAuth(context);

      const change = await prisma.semanticChange.findUnique({
        where: { id },
        include: {
          document: { select: { firmId: true } },
          responseSuggestions: true,
        },
      });

      if (!change || change.document.firmId !== user.firmId) {
        throw new GraphQLError('Semantic change not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      return change;
    },

    // Get response suggestions for a change
    responseSuggestions: async (
      _: unknown,
      { changeId }: { changeId: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      const change = await prisma.semanticChange.findUnique({
        where: { id: changeId },
        include: {
          document: { select: { firmId: true } },
          responseSuggestions: true,
        },
      });

      if (!change || change.document.firmId !== user.firmId) {
        throw new GraphQLError('Change not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      return change.responseSuggestions;
    },

    // Get aggregate risk for a version comparison
    versionComparisonRisk: async (
      _: unknown,
      args: { documentId: string; fromVersionId: string; toVersionId: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      if (!(await canAccessDocument(args.documentId, user))) {
        throw new GraphQLError('Document not found or access denied', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Check cache
      const cached = await prisma.versionComparisonCache.findUnique({
        where: {
          fromVersionId_toVersionId: {
            fromVersionId: args.fromVersionId,
            toVersionId: args.toVersionId,
          },
        },
      });

      if (cached) {
        return {
          riskLevel: cached.aggregateRisk,
          explanation: cached.summary,
          contributingFactors: [],
          highRiskChanges: [],
        };
      }

      // Calculate risk via AI service
      const result = await callAIService('/api/semantic-diff/risk', {
        documentId: args.documentId,
        fromVersionId: args.fromVersionId,
        toVersionId: args.toVersionId,
        firmId: user.firmId,
      });

      return result;
    },
  },

  Mutation: {
    // Rollback document to a previous version
    rollbackToVersion: async (
      _: unknown,
      { input }: { input: { documentId: string; targetVersionId: string; reason?: string } },
      context: Context
    ) => {
      const user = requireAuth(context);
      requireVersionControlRole(user);

      const { documentId, targetVersionId, reason } = input;

      if (!(await canAccessDocument(documentId, user))) {
        throw new GraphQLError('Document not found or access denied', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Get target version
      const targetVersion = await prisma.documentVersion.findUnique({
        where: { id: targetVersionId },
      });

      if (!targetVersion || targetVersion.documentId !== documentId) {
        throw new GraphQLError('Target version not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Get current version number
      const latestVersion = await prisma.documentVersion.findFirst({
        where: { documentId },
        orderBy: { versionNumber: 'desc' },
      });

      const newVersionNumber = (latestVersion?.versionNumber || 0) + 1;

      // Create new version as rollback
      const newVersion = await prisma.documentVersion.create({
        data: {
          documentId,
          versionNumber: newVersionNumber,
          oneDriveVersionId: targetVersion.oneDriveVersionId,
          changesSummary: `Rollback to version ${targetVersion.versionNumber}${reason ? `: ${reason}` : ''}`,
          createdBy: user.id,
        },
      });

      // Log the rollback in audit
      logger.info('Document version rollback', {
        documentId,
        targetVersionId,
        newVersionId: newVersion.id,
        userId: user.id,
        reason,
      });

      const document = await prisma.document.findUnique({
        where: { id: documentId },
      });

      return {
        success: true,
        newVersionId: newVersion.id,
        newVersionNumber,
        message: `Successfully rolled back to version ${targetVersion.versionNumber}`,
        document,
      };
    },

    // Generate AI response suggestions for a change
    generateResponseSuggestions: async (
      _: unknown,
      { input }: { input: { changeId: string; partyRole: string; language?: string } },
      context: Context
    ) => {
      const user = requireAuth(context);
      requireVersionControlRole(user);

      const { changeId, partyRole, language = 'ro' } = input;

      const change = await prisma.semanticChange.findUnique({
        where: { id: changeId },
        include: {
          document: { select: { firmId: true, clientId: true } },
        },
      });

      if (!change || change.document.firmId !== user.firmId) {
        throw new GraphQLError('Change not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Generate suggestions via AI service
      const result = await callAIService('/api/semantic-diff/suggestions', {
        change: {
          id: change.id,
          beforeText: change.beforeText,
          afterText: change.afterText,
          significance: change.significance,
          legalClassification: change.legalClassification,
          plainSummary: change.plainSummary,
        },
        partyRole,
        language,
        documentContext: {
          documentId: change.documentId,
          firmId: user.firmId,
          language,
        },
      });

      // Store suggestions
      if (result.suggestions && result.suggestions.length > 0) {
        await prisma.responseSuggestion.deleteMany({
          where: { changeId },
        });

        await prisma.responseSuggestion.createMany({
          data: result.suggestions.map((s: any) => ({
            changeId,
            suggestionType: s.suggestionType,
            suggestedText: s.suggestedText,
            reasoning: s.reasoning,
            language,
          })),
        });
      }

      // Return stored suggestions
      const suggestions = await prisma.responseSuggestion.findMany({
        where: { changeId },
      });

      return suggestions;
    },

    // Apply a response suggestion to the document
    applyResponseSuggestion: async (
      _: unknown,
      { suggestionId, documentId }: { suggestionId: string; documentId: string },
      context: Context
    ) => {
      const user = requireAuth(context);
      requireVersionControlRole(user);

      if (!(await canAccessDocument(documentId, user))) {
        throw new GraphQLError('Document not found or access denied', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const suggestion = await prisma.responseSuggestion.findUnique({
        where: { id: suggestionId },
        include: {
          change: {
            include: {
              document: true,
            },
          },
        },
      });

      if (!suggestion || suggestion.change.document.firmId !== user.firmId) {
        throw new GraphQLError('Suggestion not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Log the application (actual document update would happen via Word integration)
      logger.info('Response suggestion applied', {
        suggestionId,
        documentId,
        userId: user.id,
        suggestionType: suggestion.suggestionType,
      });

      const document = await prisma.document.findUnique({
        where: { id: documentId },
      });

      return document;
    },

    // Refresh comparison cache
    refreshVersionComparison: async (
      _: unknown,
      args: { documentId: string; fromVersionId: string; toVersionId: string },
      context: Context
    ) => {
      const user = requireAuth(context);
      requireVersionControlRole(user);

      // Delete existing cache
      await prisma.versionComparisonCache.deleteMany({
        where: {
          fromVersionId: args.fromVersionId,
          toVersionId: args.toVersionId,
        },
      });

      // Re-run comparison
      const input = {
        documentId: args.documentId,
        fromVersionId: args.fromVersionId,
        toVersionId: args.toVersionId,
      };

      return semanticVersionControlResolvers.Query.compareVersions(_, { input }, context);
    },

    // Dismiss a semantic change
    dismissSemanticChange: async (
      _: unknown,
      { changeId }: { changeId: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      const change = await prisma.semanticChange.findUnique({
        where: { id: changeId },
        include: {
          document: { select: { firmId: true } },
        },
      });

      if (!change || change.document.firmId !== user.firmId) {
        throw new GraphQLError('Change not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Mark as formatting (effectively dismissing it)
      const updated = await prisma.semanticChange.update({
        where: { id: changeId },
        data: {
          significance: 'FORMATTING',
        },
      });

      return updated;
    },
  },
};

// Helper function to get version info with creator
async function getVersionInfo(versionId: string) {
  const version = await prisma.documentVersion.findUnique({
    where: { id: versionId },
    include: {
      creator: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  if (!version) {
    throw new GraphQLError('Version not found', {
      extensions: { code: 'NOT_FOUND' },
    });
  }

  return {
    id: version.id,
    documentId: version.documentId,
    versionNumber: version.versionNumber,
    oneDriveVersionId: version.oneDriveVersionId,
    changesSummary: version.changesSummary,
    createdBy: version.creator,
    createdAt: version.createdAt,
    riskLevel: null,
  };
}

export default semanticVersionControlResolvers;
