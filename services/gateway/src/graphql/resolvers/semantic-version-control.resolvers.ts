/**
 * Semantic Version Control GraphQL Resolvers
 * Story 3.5: Semantic Version Control System
 *
 * Implements resolvers for version comparison, semantic diff,
 * risk assessment, and response suggestion generation
 *
 * NOTE: The versionComparisonCache, semanticChange, and responseSuggestion
 * models have been removed. This file provides stubbed implementations
 * that return empty/default values where those models were used.
 */

import { GraphQLError } from 'graphql';
import { prisma } from '@legal-platform/database';
import logger from '../../utils/logger';
import { requireAuth, type Context } from '../utils/auth';

// AI Service base URL
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:3002';
const AI_SERVICE_API_KEY = process.env.AI_SERVICE_API_KEY || 'dev-api-key';

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
    // NOTE: versionComparisonCache and semanticChange models removed - no caching or change storage
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
    // NOTE: semanticChange model removed - returns empty array
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

      // semanticChange model removed - return empty array
      return [];
    },

    // Get a single semantic change
    // NOTE: semanticChange model removed - always returns not found
    semanticChange: async (_: unknown, { id }: { id: string }, context: Context) => {
      requireAuth(context);

      // semanticChange model removed - always throw not found
      throw new GraphQLError('Semantic change feature is not available', {
        extensions: { code: 'NOT_FOUND' },
      });
    },

    // Get response suggestions for a change
    // NOTE: responseSuggestion model removed - always returns empty array
    responseSuggestions: async (
      _: unknown,
      { changeId }: { changeId: string },
      context: Context
    ) => {
      requireAuth(context);

      // responseSuggestion model removed - return empty array
      logger.info('responseSuggestions called but model removed', { changeId });
      return [];
    },

    // Get aggregate risk for a version comparison
    // NOTE: versionComparisonCache model removed - no caching, always call AI service
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

      // Calculate risk via AI service (no caching available)
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
    // NOTE: semanticChange and responseSuggestion models removed - feature unavailable
    generateResponseSuggestions: async (
      _: unknown,
      { input }: { input: { changeId: string; partyRole: string; language?: string } },
      context: Context
    ) => {
      requireAuth(context);
      requireVersionControlRole(context.user);

      // semanticChange and responseSuggestion models removed - feature unavailable
      logger.info('generateResponseSuggestions called but models removed', { changeId: input.changeId });
      throw new GraphQLError('Response suggestion feature is not available', {
        extensions: { code: 'NOT_FOUND' },
      });
    },

    // Apply a response suggestion to the document
    // NOTE: responseSuggestion model removed - feature unavailable
    applyResponseSuggestion: async (
      _: unknown,
      { suggestionId, documentId }: { suggestionId: string; documentId: string },
      context: Context
    ) => {
      requireAuth(context);
      requireVersionControlRole(context.user);

      // responseSuggestion model removed - feature unavailable
      logger.info('applyResponseSuggestion called but model removed', { suggestionId, documentId });
      throw new GraphQLError('Response suggestion feature is not available', {
        extensions: { code: 'NOT_FOUND' },
      });
    },

    // Refresh comparison cache
    // NOTE: versionComparisonCache model removed - just re-runs comparison
    refreshVersionComparison: async (
      _: unknown,
      args: { documentId: string; fromVersionId: string; toVersionId: string },
      context: Context
    ) => {
      requireAuth(context);
      requireVersionControlRole(context.user);

      // versionComparisonCache model removed - just re-run comparison
      const input = {
        documentId: args.documentId,
        fromVersionId: args.fromVersionId,
        toVersionId: args.toVersionId,
      };

      return semanticVersionControlResolvers.Query.compareVersions(_, { input }, context);
    },

    // Dismiss a semantic change
    // NOTE: semanticChange model removed - feature unavailable
    dismissSemanticChange: async (
      _: unknown,
      { changeId }: { changeId: string },
      context: Context
    ) => {
      requireAuth(context);

      // semanticChange model removed - feature unavailable
      logger.info('dismissSemanticChange called but model removed', { changeId });
      throw new GraphQLError('Semantic change feature is not available', {
        extensions: { code: 'NOT_FOUND' },
      });
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
