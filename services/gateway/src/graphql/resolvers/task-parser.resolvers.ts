/**
 * Task Parser GraphQL Resolvers
 * Story 4.1: Natural Language Task Parser
 *
 * Implements resolvers for parsing natural language task input
 * and pattern learning for autocomplete suggestions
 */

import { prisma } from '@legal-platform/database';
import { GraphQLError } from 'graphql';
import logger from '../../utils/logger';
import { requireAuth, type Context } from '../utils/auth';

// AI Service base URL
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:3002';
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
     * Uses pattern learning to suggest common task patterns
     */
    taskPatternSuggestions: async (
      _: unknown,
      { partialInput }: { partialInput: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      // Return empty for very short input
      if (!partialInput || partialInput.length < 3) {
        return [];
      }

      try {
        // Get patterns from database
        const patterns = await prisma.taskParsePattern.findMany({
          where: {
            firmId: user.firmId,
            inputPattern: {
              contains: partialInput.toLowerCase(),
            },
          },
          orderBy: [{ frequency: 'desc' }, { lastUsed: 'desc' }],
          take: 5,
        });

        return patterns.map((p) => ({
          id: p.id,
          pattern: p.inputPattern.replace(/\{date\}/g, '[data]').replace(/\{time\}/g, '[ora]'),
          completedText: p.inputPattern,
          taskType: p.taskType,
          frequency: p.frequency,
          lastUsed: p.lastUsed,
        }));
      } catch (error) {
        logger.error('Failed to get pattern suggestions', { error });
        return [];
      }
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
     * NOTE: Task model will be added in Story 2.8 (Task Management)
     * Until then, this mutation validates input and returns a stub response
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
        // Get the parse history to retrieve the parsed result
        const parseHistory = await prisma.taskParseHistory.findFirst({
          where: {
            id: parseId,
            firmId: user.firmId,
          },
        });

        // Determine final values (corrections override parsed values)
        const parsedResult = parseHistory?.parsedResult as any;
        const finalTitle =
          corrections?.title || parsedResult?.parsedTask?.title?.value || 'New Task';
        const finalDescription =
          corrections?.description || parsedResult?.parsedTask?.description?.value || '';
        const finalDueDate =
          corrections?.dueDate || parsedResult?.parsedTask?.dueDate?.value || null;
        const finalPriority =
          corrections?.priority || parsedResult?.parsedTask?.priority?.value || 'Medium';
        const finalAssigneeId =
          corrections?.assigneeId || parsedResult?.parsedTask?.assigneeId?.value || null;
        const finalCaseId = corrections?.caseId || parsedResult?.parsedTask?.caseId?.value || null;
        const finalTaskType =
          corrections?.taskType || parsedResult?.parsedTask?.taskType?.value || 'Meeting';

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

        // Extract type metadata from parsed result if available
        const typeMetadata = parsedResult?.parsedTask?.typeMetadata?.value || undefined;

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
            typeMetadata,
          },
          user.id
        );

        // Update parse history with actual task ID
        if (parseHistory) {
          await prisma.taskParseHistory.update({
            where: { id: parseHistory.id },
            data: {
              wasAccepted: true,
              userCorrections: corrections as object,
              finalTaskId: task.id,
            },
          });
        }

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
     * Record that a parsed task was accepted or rejected (for pattern learning)
     */
    recordParsedTask: async (
      _: unknown,
      {
        parseId,
        wasAccepted,
        corrections,
        finalTaskId,
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

      try {
        // Find the parse history record
        const parseHistory = await prisma.taskParseHistory.findFirst({
          where: {
            id: parseId,
            firmId: user.firmId,
          },
        });

        if (!parseHistory) {
          // If no history record exists, create one for tracking
          logger.warn('Parse history not found', { parseId });
          return true;
        }

        // Update the parse history
        await prisma.taskParseHistory.update({
          where: { id: parseHistory.id },
          data: {
            wasAccepted,
            userCorrections: corrections as object,
            finalTaskId,
          },
        });

        // If accepted, update pattern frequency for learning
        if (wasAccepted) {
          const parsedResult = parseHistory.parsedResult as any;
          const taskType = corrections?.taskType || parsedResult?.parsedTask?.taskType?.value;

          if (taskType) {
            // Extract pattern from input text
            let pattern = parseHistory.inputText.toLowerCase();
            // Normalize dates
            pattern = pattern.replace(
              /\d{1,2}\s+(ianuarie|februarie|martie|aprilie|mai|iunie|iulie|august|septembrie|octombrie|noiembrie|decembrie)/gi,
              '{date}'
            );
            pattern = pattern.replace(
              /(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}/gi,
              '{date}'
            );
            pattern = pattern.replace(/\d{1,2}\/\d{1,2}(\/\d{2,4})?/g, '{date}');
            // Normalize times
            pattern = pattern.replace(/\bat\s+\d{1,2}(:\d{2})?\s*(am|pm)?/gi, '{time}');
            pattern = pattern.replace(/\bla\s+ora\s+\d{1,2}(:\d{2})?/gi, '{time}');
            pattern = pattern.trim();

            if (pattern.length >= 10) {
              // Try to find existing pattern
              const existingPattern = await prisma.taskParsePattern.findFirst({
                where: {
                  firmId: user.firmId,
                  inputPattern: pattern,
                  taskType: taskType,
                },
              });

              if (existingPattern) {
                await prisma.taskParsePattern.update({
                  where: { id: existingPattern.id },
                  data: {
                    frequency: existingPattern.frequency + 1,
                    lastUsed: new Date(),
                  },
                });
              } else {
                await prisma.taskParsePattern.create({
                  data: {
                    firmId: user.firmId,
                    inputPattern: pattern,
                    taskType: taskType,
                    frequency: 1,
                    lastUsed: new Date(),
                  },
                });
              }
            }
          }
        }

        logger.info('Parse task recorded', {
          parseId,
          wasAccepted,
          userId: user.id,
        });

        return true;
      } catch (error) {
        logger.error('Failed to record parsed task', { error, parseId });
        // Don't throw - pattern learning should not block task creation
        return false;
      }
    },
  },
};

export default taskParserResolvers;
