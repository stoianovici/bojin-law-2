/**
 * Communication Intelligence Resolvers
 * Story 5.2: Communication Intelligence Engine
 *
 * GraphQL resolvers for extracted items, risk indicators, and thread summaries.
 */

import { PrismaClient, ExtractionStatus } from '@legal-platform/database';
import { getConfidenceLevel } from '@legal-platform/database';
import { createCalendarSuggestionService } from '../../services/calendar-suggestion.service';
import { createExtractionConversionService } from '../../services/extraction-conversion.service';
import { getCommunicationIntelligenceLoaders } from '../dataloaders/communication-intelligence.dataloaders';

// ============================================================================
// Types
// ============================================================================

interface Context {
  prisma: PrismaClient;
  userId: string;
  firmId: string;
}

interface ExtractedItemsFilter {
  caseId?: string;
  emailId?: string;
  status?: ExtractionStatus;
  minConfidence?: number;
  fromDate?: Date;
  toDate?: Date;
}

interface RiskIndicatorsFilter {
  caseId?: string;
  type?: string;
  severity?: string;
  isResolved?: boolean;
}

interface ConvertToTaskInput {
  extractionId: string;
  extractionType: 'deadline' | 'commitment' | 'actionItem';
  title?: string;
  description?: string;
  assignedTo?: string;
  dueDate?: Date;
  priority?: string;
  taskType?: string;
}

interface DismissExtractionInput {
  extractionId: string;
  extractionType: 'deadline' | 'commitment' | 'actionItem' | 'question';
  reason?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildWhereClause(filter?: ExtractedItemsFilter, firmId?: string) {
  const where: Record<string, unknown> = {};

  if (firmId) where.firmId = firmId;
  if (filter?.caseId) where.caseId = filter.caseId;
  if (filter?.emailId) where.emailId = filter.emailId;
  if (filter?.status) where.status = filter.status;
  if (filter?.minConfidence) where.confidence = { gte: filter.minConfidence };
  if (filter?.fromDate || filter?.toDate) {
    where.createdAt = {};
    if (filter?.fromDate) (where.createdAt as Record<string, Date>).gte = filter.fromDate;
    if (filter?.toDate) (where.createdAt as Record<string, Date>).lte = filter.toDate;
  }

  return where;
}

// ============================================================================
// Query Resolvers
// ============================================================================

export const communicationIntelligenceQueryResolvers = {
  // Extracted Deadlines
  extractedDeadlines: async (
    _: unknown,
    { filter }: { filter?: ExtractedItemsFilter },
    { prisma, firmId }: Context
  ) => {
    const where = buildWhereClause(filter, firmId);
    return prisma.extractedDeadline.findMany({
      where,
      orderBy: { dueDate: 'asc' },
      include: {
        email: { select: { id: true, subject: true } },
        case: { select: { id: true, title: true } },
        convertedTask: { select: { id: true, title: true } },
      },
    });
  },

  // Extracted Commitments
  extractedCommitments: async (
    _: unknown,
    { filter }: { filter?: ExtractedItemsFilter },
    { prisma, firmId }: Context
  ) => {
    const where = buildWhereClause(filter, firmId);
    return prisma.extractedCommitment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        email: { select: { id: true, subject: true } },
        case: { select: { id: true, title: true } },
        convertedTask: { select: { id: true, title: true } },
      },
    });
  },

  // Extracted Action Items
  extractedActionItems: async (
    _: unknown,
    { filter }: { filter?: ExtractedItemsFilter },
    { prisma, firmId }: Context
  ) => {
    const where = buildWhereClause(filter, firmId);
    return prisma.extractedActionItem.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        email: { select: { id: true, subject: true } },
        case: { select: { id: true, title: true } },
        convertedTask: { select: { id: true, title: true } },
      },
    });
  },

  // Extracted Questions
  extractedQuestions: async (
    _: unknown,
    { filter }: { filter?: ExtractedItemsFilter },
    { prisma, firmId }: Context
  ) => {
    const where = buildWhereClause(filter, firmId);
    return prisma.extractedQuestion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        email: { select: { id: true, subject: true } },
        case: { select: { id: true, title: true } },
      },
    });
  },

  // Risk Indicators
  riskIndicators: async (
    _: unknown,
    { filter }: { filter?: RiskIndicatorsFilter },
    { prisma, firmId }: Context
  ) => {
    const where: Record<string, unknown> = { firmId };
    if (filter?.caseId) where.caseId = filter.caseId;
    if (filter?.type) where.type = filter.type;
    if (filter?.severity) where.severity = filter.severity;
    if (filter?.isResolved !== undefined) where.isResolved = filter.isResolved;

    return prisma.riskIndicator.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  },

  // Case Risk Summary
  caseRiskSummary: async (
    _: unknown,
    { caseId }: { caseId: string },
    { prisma, firmId }: Context
  ) => {
    const risks = await prisma.riskIndicator.findMany({
      where: { caseId, firmId },
    });

    const highSeverityCount = risks.filter((r) => r.severity === 'High').length;
    const mediumSeverityCount = risks.filter((r) => r.severity === 'Medium').length;
    const lowSeverityCount = risks.filter((r) => r.severity === 'Low').length;
    const unresolvedCount = risks.filter((r) => !r.isResolved).length;

    // Count by type
    const risksByType = Object.entries(
      risks.reduce(
        (acc, r) => {
          acc[r.type] = (acc[r.type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      )
    ).map(([type, count]) => ({ type, count }));

    return {
      highSeverityCount,
      mediumSeverityCount,
      lowSeverityCount,
      unresolvedCount,
      risksByType,
    };
  },

  // Thread Summary
  threadSummary: async (
    _: unknown,
    { conversationId }: { conversationId: string },
    { prisma }: Context
  ) => {
    return prisma.threadSummary.findUnique({
      where: { conversationId },
    });
  },

  // Case Thread Summaries
  caseThreadSummaries: async (
    _: unknown,
    { caseId }: { caseId: string },
    { prisma, firmId }: Context
  ) => {
    return prisma.threadSummary.findMany({
      where: { caseId, firmId },
      orderBy: { lastAnalyzedAt: 'desc' },
    });
  },

  // Case Intelligence Summary
  caseIntelligenceSummary: async (
    _: unknown,
    { caseId }: { caseId: string },
    { prisma, firmId }: Context
  ) => {
    const [deadlines, commitments, actionItems, questions, risks] = await Promise.all([
      prisma.extractedDeadline.count({ where: { caseId, firmId, status: 'Pending' } }),
      prisma.extractedCommitment.count({ where: { caseId, firmId, status: 'Pending' } }),
      prisma.extractedActionItem.count({ where: { caseId, firmId, status: 'Pending' } }),
      prisma.extractedQuestion.count({ where: { caseId, firmId, status: 'Pending' } }),
      prisma.riskIndicator.findMany({ where: { caseId, firmId, isResolved: false } }),
    ]);

    const highSeverityRisks = risks.filter((r) => r.severity === 'High').length;
    const hasHighPriorityItems = highSeverityRisks > 0 || deadlines > 0;

    // Get last analysis time
    const lastDeadline = await prisma.extractedDeadline.findFirst({
      where: { caseId, firmId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    return {
      caseId,
      extractedItemsCounts: {
        deadlines,
        commitments,
        actionItems,
        questions,
        total: deadlines + commitments + actionItems + questions,
      },
      riskSummary: {
        highSeverityCount: highSeverityRisks,
        mediumSeverityCount: risks.filter((r) => r.severity === 'Medium').length,
        lowSeverityCount: risks.filter((r) => r.severity === 'Low').length,
        unresolvedCount: risks.length,
        risksByType: [],
      },
      hasHighPriorityItems,
      lastAnalyzedAt: lastDeadline?.createdAt,
    };
  },

  // Extracted Items Counts
  extractedItemsCounts: async (
    _: unknown,
    { caseId }: { caseId: string },
    { prisma, firmId }: Context
  ) => {
    const [deadlines, commitments, actionItems, questions] = await Promise.all([
      prisma.extractedDeadline.count({ where: { caseId, firmId, status: 'Pending' } }),
      prisma.extractedCommitment.count({ where: { caseId, firmId, status: 'Pending' } }),
      prisma.extractedActionItem.count({ where: { caseId, firmId, status: 'Pending' } }),
      prisma.extractedQuestion.count({ where: { caseId, firmId, status: 'Pending' } }),
    ]);

    return {
      deadlines,
      commitments,
      actionItems,
      questions,
      total: deadlines + commitments + actionItems + questions,
    };
  },

  // Conversion Suggestion
  conversionSuggestion: async (
    _: unknown,
    { extractionId, extractionType }: { extractionId: string; extractionType: string },
    { prisma }: Context
  ) => {
    const conversionService = createExtractionConversionService(prisma);

    switch (extractionType) {
      case 'deadline':
        return conversionService.suggestFromDeadline(extractionId);
      case 'commitment':
        return conversionService.suggestFromCommitment(extractionId);
      case 'actionItem':
        return conversionService.suggestFromActionItem(extractionId);
      default:
        return null;
    }
  },

  // Calendar Suggestions
  calendarSuggestions: async (_: unknown, { caseId }: { caseId: string }, { prisma }: Context) => {
    const calendarService = createCalendarSuggestionService(prisma);
    return calendarService.suggestForCase(caseId);
  },
};

// ============================================================================
// Mutation Resolvers
// ============================================================================

export const communicationIntelligenceMutationResolvers = {
  // Convert Extraction to Task
  convertExtractionToTask: async (
    _: unknown,
    { input }: { input: ConvertToTaskInput },
    { prisma, userId, firmId }: Context
  ) => {
    const conversionService = createExtractionConversionService(prisma);

    return conversionService.convertToTask({
      extractionId: input.extractionId,
      extractionType: input.extractionType,
      userId,
      firmId,
      overrides: {
        title: input.title,
        description: input.description,
        assignedTo: input.assignedTo,
        dueDate: input.dueDate,
        priority: input.priority,
        taskType: input.taskType,
      } as unknown as undefined, // Remove undefined fields
    });
  },

  // Dismiss Extraction
  dismissExtraction: async (
    _: unknown,
    { input }: { input: DismissExtractionInput },
    { prisma }: Context
  ) => {
    const conversionService = createExtractionConversionService(prisma);
    return conversionService.dismissExtraction(
      input.extractionId,
      input.extractionType,
      input.reason
    );
  },

  // Mark Question Answered
  markQuestionAnswered: async (
    _: unknown,
    { input }: { input: { questionId: string } },
    { prisma }: Context
  ) => {
    return prisma.extractedQuestion.update({
      where: { id: input.questionId },
      data: {
        isAnswered: true,
        answeredAt: new Date(),
        status: 'Converted',
      },
    });
  },

  // Resolve Risk
  resolveRisk: async (
    _: unknown,
    { input }: { input: { riskId: string } },
    { prisma, userId }: Context
  ) => {
    return prisma.riskIndicator.update({
      where: { id: input.riskId },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        resolvedBy: userId,
      },
    });
  },

  // Trigger Email Analysis (manual)
  triggerEmailAnalysis: async (
    _: unknown,
    { emailId }: { emailId: string },
    { prisma }: Context
  ) => {
    // This would call the AI service to analyze the email
    // For now, just verify the email exists
    const email = await prisma.email.findUnique({
      where: { id: emailId },
    });

    if (!email) return false;

    // In production, this would trigger the worker or call the AI service directly
    console.log(`[Resolver] Manual analysis triggered for email ${emailId}`);
    return true;
  },

  // Trigger Thread Analysis (manual)
  triggerThreadAnalysis: async (
    _: unknown,
    { conversationId }: { conversationId: string },
    { prisma }: Context
  ) => {
    // This would call the thread analysis service
    // For now, return existing summary if any
    const summary = await prisma.threadSummary.findUnique({
      where: { conversationId },
    });

    // In production, this would trigger re-analysis
    console.log(`[Resolver] Thread analysis triggered for ${conversationId}`);
    return summary;
  },

  // Create Calendar Event from Suggestion (AC: 3)
  createCalendarEvent: async (
    _: unknown,
    { suggestionId }: { suggestionId: string },
    { prisma, userId }: Context
  ) => {
    const calendarService = createCalendarSuggestionService(prisma);

    // Parse suggestion ID to get source type and extraction ID
    // Format: suggestion-{type}-{id}
    const parts = suggestionId.split('-');
    if (parts.length < 3) {
      return { success: false, error: 'Invalid suggestion ID format' };
    }

    const sourceType = parts[1] as 'deadline' | 'commitment';
    const extractionId = parts.slice(2).join('-');

    // Get the extraction item
    let suggestion;
    if (sourceType === 'deadline') {
      const deadline = await prisma.extractedDeadline.findUnique({
        where: { id: extractionId },
      });
      if (!deadline) {
        return { success: false, error: 'Deadline not found' };
      }
      suggestion = await calendarService.suggestFromDeadline({
        id: deadline.id,
        description: deadline.description,
        dueDate: deadline.dueDate,
        confidence: deadline.confidence,
        caseId: deadline.caseId,
        emailId: deadline.emailId,
      });
    } else if (sourceType === 'commitment') {
      const commitment = await prisma.extractedCommitment.findUnique({
        where: { id: extractionId },
      });
      if (!commitment || !commitment.dueDate) {
        return { success: false, error: 'Commitment not found or has no due date' };
      }
      suggestion = await calendarService.suggestFromCommitment({
        id: commitment.id,
        description: commitment.commitmentText,
        dueDate: commitment.dueDate,
        confidence: commitment.confidence,
        caseId: commitment.caseId,
        emailId: commitment.emailId,
        party: commitment.party,
      });
    } else {
      return { success: false, error: 'Unknown source type' };
    }

    // Create the calendar event
    const result = await calendarService.createCalendarEvent({
      suggestion,
      userId,
    });

    // If successful, mark the extraction as converted
    if (result.success) {
      await calendarService.markAsConverted(sourceType, extractionId);
    }

    return result;
  },
};

// ============================================================================
// Field Resolvers (with DataLoaders for efficient batching)
// ============================================================================

export const communicationIntelligenceFieldResolvers = {
  ExtractedDeadline: {
    confidenceLevel: (parent: { confidence: number }) => getConfidenceLevel(parent.confidence),
    email: (parent: { emailId: string }) => {
      const loaders = getCommunicationIntelligenceLoaders();
      return loaders.emailLoader.load(parent.emailId);
    },
    case: (parent: { caseId: string | null }) => {
      if (!parent.caseId) return null;
      const loaders = getCommunicationIntelligenceLoaders();
      return loaders.caseLoader.load(parent.caseId);
    },
    convertedTask: (parent: { convertedTaskId: string | null }) => {
      if (!parent.convertedTaskId) return null;
      const loaders = getCommunicationIntelligenceLoaders();
      return loaders.taskLoader.load(parent.convertedTaskId);
    },
  },

  ExtractedCommitment: {
    confidenceLevel: (parent: { confidence: number }) => getConfidenceLevel(parent.confidence),
    email: (parent: { emailId: string }) => {
      const loaders = getCommunicationIntelligenceLoaders();
      return loaders.emailLoader.load(parent.emailId);
    },
    case: (parent: { caseId: string | null }) => {
      if (!parent.caseId) return null;
      const loaders = getCommunicationIntelligenceLoaders();
      return loaders.caseLoader.load(parent.caseId);
    },
    convertedTask: (parent: { convertedTaskId: string | null }) => {
      if (!parent.convertedTaskId) return null;
      const loaders = getCommunicationIntelligenceLoaders();
      return loaders.taskLoader.load(parent.convertedTaskId);
    },
  },

  ExtractedActionItem: {
    confidenceLevel: (parent: { confidence: number }) => getConfidenceLevel(parent.confidence),
    email: (parent: { emailId: string }) => {
      const loaders = getCommunicationIntelligenceLoaders();
      return loaders.emailLoader.load(parent.emailId);
    },
    case: (parent: { caseId: string | null }) => {
      if (!parent.caseId) return null;
      const loaders = getCommunicationIntelligenceLoaders();
      return loaders.caseLoader.load(parent.caseId);
    },
    convertedTask: (parent: { convertedTaskId: string | null }) => {
      if (!parent.convertedTaskId) return null;
      const loaders = getCommunicationIntelligenceLoaders();
      return loaders.taskLoader.load(parent.convertedTaskId);
    },
  },

  ExtractedQuestion: {
    confidenceLevel: (parent: { confidence: number }) => getConfidenceLevel(parent.confidence),
    email: (parent: { emailId: string }) => {
      const loaders = getCommunicationIntelligenceLoaders();
      return loaders.emailLoader.load(parent.emailId);
    },
    case: (parent: { caseId: string | null }) => {
      if (!parent.caseId) return null;
      const loaders = getCommunicationIntelligenceLoaders();
      return loaders.caseLoader.load(parent.caseId);
    },
  },

  RiskIndicator: {
    email: (parent: { emailId: string }) => {
      const loaders = getCommunicationIntelligenceLoaders();
      return loaders.emailLoader.load(parent.emailId);
    },
    case: (parent: { caseId: string | null }) => {
      if (!parent.caseId) return null;
      const loaders = getCommunicationIntelligenceLoaders();
      return loaders.caseLoader.load(parent.caseId);
    },
  },

  ThreadSummary: {
    case: (parent: { caseId: string | null }) => {
      if (!parent.caseId) return null;
      const loaders = getCommunicationIntelligenceLoaders();
      return loaders.caseLoader.load(parent.caseId);
    },
  },
};

// ============================================================================
// Export Combined Resolvers
// ============================================================================

export const communicationIntelligenceResolvers = {
  Query: communicationIntelligenceQueryResolvers,
  Mutation: communicationIntelligenceMutationResolvers,
  ...communicationIntelligenceFieldResolvers,
};
