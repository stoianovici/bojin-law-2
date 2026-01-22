/**
 * Task Parser GraphQL Resolvers
 * Story 4.1: Natural Language Task Parser
 *
 * Implements resolvers for parsing natural language task input.
 * NOTE: Pattern learning (taskParsePattern, taskParseHistory) has been removed.
 */

import { prisma } from '@legal-platform/database';
import { GraphQLError } from 'graphql';
import logger from '../../utils/logger';
import { requireAuth, type Context } from '../utils/auth';

// AI Service base URL
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:4003';
const AI_SERVICE_API_KEY = process.env.AI_SERVICE_API_KEY || '';

// Call AI service for task parsing
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

export const taskParserResolvers = {
  Query: {
    /**
     * Get autocomplete suggestions based on partial input
     * NOTE: Pattern learning has been removed. Returns empty array.
     */
    taskPatternSuggestions: async (
      _: unknown,
      { partialInput }: { partialInput: string },
      context: Context
    ) => {
      requireAuth(context);

      // Pattern learning removed - return empty suggestions
      if (!partialInput || partialInput.length < 3) {
        return [];
      }

      // TODO: Could be reimplemented with a different approach in the future
      return [];
    },
  },

  Mutation: {
    /**
     * Parse natural language task input
     */
    parseTask: async (
      _: unknown,
      {
        input,
        context: parseContext,
      }: {
        input: string;
        context?: {
          activeCaseIds?: string[];
          teamMemberNames?: string[];
          recentTaskPatterns?: string[];
        };
      },
      context: Context
    ) => {
      const user = requireAuth(context);

      if (!input || input.trim().length === 0) {
        throw new GraphQLError('Input text is required', {
          extensions: { code: 'BAD_REQUEST' },
        });
      }

      if (input.length > 2000) {
        throw new GraphQLError('Input text exceeds maximum length of 2000 characters', {
          extensions: { code: 'BAD_REQUEST' },
        });
      }

      try {
        // Call AI service to parse task
        const result = await callAIService('/api/ai/parse-task', {
          text: input,
          language: 'auto',
          context: {
            userId: user.id,
            firmId: user.firmId,
            activeCaseIds: parseContext?.activeCaseIds,
            teamMemberNames: parseContext?.teamMemberNames,
            recentTaskPatterns: parseContext?.recentTaskPatterns,
          },
        });

        logger.info('Task parsed successfully', {
          parseId: result.parseId,
          userId: user.id,
          confidence: result.overallConfidence,
        });

        return result;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        logger.error('Task parsing failed', { error, userId: user.id });
        throw new GraphQLError('Failed to parse task input', {
          extensions: { code: 'INTERNAL_ERROR' },
        });
      }
    },

    /**
     * Resolve a clarification question with an answer
     */
    resolveClarification: async (
      _: unknown,
      {
        parseId,
        questionId,
        answer,
      }: {
        parseId: string;
        questionId: string;
        answer: string;
      },
      context: Context
    ) => {
      const user = requireAuth(context);

      if (!answer || answer.trim().length === 0) {
        throw new GraphQLError('Answer is required', {
          extensions: { code: 'BAD_REQUEST' },
        });
      }

      try {
        // Get active cases and team members for context
        const [cases, teamMembers] = await Promise.all([
          prisma.case.findMany({
            where: { firmId: user.firmId, status: 'Active' },
            select: { id: true, caseNumber: true, title: true, client: { select: { name: true } } },
            take: 100,
          }),
          prisma.user.findMany({
            where: { firmId: user.firmId },
            select: { id: true, firstName: true, lastName: true, role: true },
          }),
        ]);

        // Call AI service to apply clarification
        const result = await callAIService('/api/ai/parse-task/clarify', {
          parseId,
          questionId,
          answer,
          context: {
            activeCases: cases.map((c) => ({
              id: c.id,
              caseNumber: c.caseNumber,
              title: c.title,
              clientName: c.client.name,
            })),
            teamMembers: teamMembers.map((u) => ({
              id: u.id,
              name: `${u.firstName} ${u.lastName}`,
              role: u.role,
            })),
          },
        });

        logger.info('Clarification resolved', {
          parseId,
          questionId,
          userId: user.id,
        });

        return result;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        logger.error('Clarification resolution failed', { error, parseId, questionId });
        throw new GraphQLError('Failed to resolve clarification', {
          extensions: { code: 'INTERNAL_ERROR' },
        });
      }
    },

    /**
     * Confirm task creation with optional corrections
     * Creates the actual task in the database
     *
     * NOTE: Parse history tracking has been removed.
     * This mutation now creates tasks directly from the provided corrections.
     */
    confirmTaskCreation: async (
      _: unknown,
      {
        parseId,
        corrections,
      }: {
        parseId: string;
        corrections?: {
          taskType?: string;
          title?: string;
          description?: string;
          dueDate?: Date;
          dueTime?: string;
          priority?: string;
          assigneeId?: string;
          caseId?: string;
        };
      },
      context: Context
    ) => {
      const user = requireAuth(context);

      try {
        // Use corrections directly (parse history tracking removed)
        const finalTitle = corrections?.title || 'New Task';
        const finalDescription = corrections?.description || '';
        const finalDueDate = corrections?.dueDate || null;
        const finalPriority = corrections?.priority || 'Medium';
        const finalAssigneeId = corrections?.assigneeId || null;
        const finalCaseId = corrections?.caseId || null;
        const finalTaskType = corrections?.taskType || 'Meeting';

        // Verify case access if caseId provided
        if (finalCaseId) {
          const caseRecord = await prisma.case.findUnique({
            where: { id: finalCaseId },
            select: { firmId: true },
          });

          if (!caseRecord || caseRecord.firmId !== user.firmId) {
            throw new GraphQLError('Case not found or access denied', {
              extensions: { code: 'NOT_FOUND' },
            });
          }
        }

        // Verify assignee is from the same firm
        if (finalAssigneeId) {
          const assignee = await prisma.user.findUnique({
            where: { id: finalAssigneeId },
            select: { firmId: true },
          });

          if (!assignee || assignee.firmId !== user.firmId) {
            throw new GraphQLError('Assignee not found or access denied', {
              extensions: { code: 'NOT_FOUND' },
            });
          }
        }

        // Create actual task using TaskService (Story 4.2)
        const { TaskService } = await import('../../services/task.service');
        const taskService = new TaskService();

        // Create task
        const task = await taskService.createTask(
          {
            caseId: finalCaseId,
            type: finalTaskType as any,
            title: finalTitle,
            description: finalDescription,
            assignedTo: finalAssigneeId,
            dueDate: finalDueDate ? new Date(finalDueDate) : new Date(),
            dueTime: corrections?.dueTime,
            priority: finalPriority as any,
          },
          user.id
        );

        logger.info('Task created from NLP input', {
          taskId: task.id,
          parseId,
          userId: user.id,
        });

        return task;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        logger.error('Task creation failed', { error, parseId });
        throw new GraphQLError('Failed to create task', {
          extensions: { code: 'INTERNAL_ERROR' },
        });
      }
    },

    /**
     * Record that a parsed task was accepted or rejected
     * NOTE: Pattern learning has been removed. This is now a no-op stub.
     */
    recordParsedTask: async (
      _: unknown,
      {
        parseId,
        wasAccepted,
      }: {
        parseId: string;
        wasAccepted: boolean;
        corrections?: {
          taskType?: string;
          title?: string;
          description?: string;
          dueDate?: Date;
          dueTime?: string;
          priority?: string;
          assigneeId?: string;
          caseId?: string;
        };
        finalTaskId?: string;
      },
      context: Context
    ) => {
      const user = requireAuth(context);

      // Pattern learning removed - just log and return success
      logger.info('Parse task recorded (stub)', {
        parseId,
        wasAccepted,
        userId: user.id,
      });

      return true;
    },
  },
};

export default taskParserResolvers;
