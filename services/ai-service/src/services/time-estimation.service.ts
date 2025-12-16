/**
 * Time Estimation Service
 * Story 4.3: Time Estimation & Manual Time Logging
 *
 * Provides AI-powered time estimates for tasks based on historical data
 * AC: 1 - Estimated time field required on task creation (AI can suggest based on similar past tasks)
 */

import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@legal-platform/database';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StructuredOutputParser } from 'langchain/output_parsers';
import { z } from 'zod';
import {
  TimeEstimationRequest,
  TimeEstimationResponse,
  AIOperationType,
  ClaudeModel,
} from '@legal-platform/types';
import { createClaudeModel, AICallbackHandler } from '../lib/langchain/client';
import { tokenTracker } from './token-tracker.service';
import logger from '../lib/logger';

// Minimum number of similar tasks for high confidence
const MIN_TASKS_HIGH_CONFIDENCE = 5;

// Response schema for structured output
const timeEstimationSchema = z.object({
  estimatedHours: z.number().describe('Estimated hours for the task'),
  reasoning: z.string().describe('Brief explanation of the estimation'),
  rangeMin: z.number().describe('Minimum estimated hours'),
  rangeMax: z.number().describe('Maximum estimated hours'),
});

// System prompt for time estimation
const TIME_ESTIMATION_SYSTEM = `You are an expert legal time estimation assistant.
Your role is to estimate how long legal tasks will take based on historical data and task complexity.

Guidelines:
- Consider the task type, title, and description
- Factor in case complexity when available
- Provide realistic estimates based on historical averages
- Account for research, drafting, review, and administrative time
- Provide a range (min-max) to account for variability
- Be conservative but realistic - legal work often takes longer than expected
- Typical legal task durations:
  * Simple administrative tasks: 0.25-0.5 hours
  * Email correspondence: 0.25-1 hour
  * Document review: 1-3 hours
  * Legal research: 2-8 hours
  * Document drafting: 3-10 hours
  * Court preparation: 4-12 hours
  * Client meetings: 0.5-2 hours`;

const TIME_ESTIMATION_HUMAN = `Estimate the time required for this legal task:

Task Type: {taskType}
Task Title: {taskTitle}
{taskDescription}
{caseType}

Historical Data:
{historicalData}

Provide a time estimate in hours. Consider task complexity and similar historical tasks.`;

export class TimeEstimationService {
  /**
   * Estimate task duration using AI and historical data
   * AC: 1 - AI can suggest based on similar past tasks
   */
  async estimateTaskDuration(request: TimeEstimationRequest): Promise<TimeEstimationResponse> {
    const startTime = Date.now();
    const requestId = uuidv4();

    logger.debug('Time estimation requested', {
      requestId,
      taskType: request.taskType,
      taskTitle: request.taskTitle,
      firmId: request.firmId,
    });

    try {
      // Query historical time entries for similar tasks
      const historicalData = await this.getHistoricalData(request);

      // Calculate confidence based on historical data availability
      const confidence = this.calculateConfidence(historicalData);

      // If we have enough historical data, use it directly
      if (historicalData.completedTasks.length >= MIN_TASKS_HIGH_CONFIDENCE) {
        const simpleEstimate = this.calculateSimpleEstimate(historicalData);
        logger.info('Time estimate calculated from historical data', {
          requestId,
          estimatedHours: simpleEstimate.estimatedHours,
          basedOnTasks: historicalData.completedTasks.length,
          confidence,
        });

        return {
          ...simpleEstimate,
          confidence,
          basedOnSimilarTasks: historicalData.completedTasks.length,
        };
      }

      // Use AI estimation when historical data is insufficient
      const aiEstimate = await this.getAIEstimation(request, historicalData, requestId);

      const duration = Date.now() - startTime;
      logger.info('Time estimation completed', {
        requestId,
        estimatedHours: aiEstimate.estimatedHours,
        confidence,
        basedOnTasks: historicalData.completedTasks.length,
        duration,
      });

      return {
        ...aiEstimate,
        confidence,
        basedOnSimilarTasks: historicalData.completedTasks.length,
      };
    } catch (error) {
      logger.error('Time estimation failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return default estimate on error
      return this.getDefaultEstimate(request);
    }
  }

  /**
   * Query historical time entry data for similar tasks
   */
  private async getHistoricalData(request: TimeEstimationRequest) {
    // Query completed tasks of the same type in the same firm
    const completedTasks = await prisma.task.findMany({
      where: {
        firmId: request.firmId,
        type: request.taskType as any,
        status: 'Completed',
        completedAt: { not: null },
        estimatedHours: { not: null },
      },
      select: {
        id: true,
        title: true,
        estimatedHours: true,
        timeEntries: {
          select: {
            hours: true,
          },
        },
      },
      orderBy: {
        completedAt: 'desc',
      },
      take: 100, // Last 100 similar tasks
    });

    // Calculate actual hours for each task
    const tasksWithActualHours = completedTasks
      .map((task) => {
        const actualHours = task.timeEntries.reduce((sum, entry) => sum + Number(entry.hours), 0);
        return {
          id: task.id,
          title: task.title,
          estimatedHours: Number(task.estimatedHours),
          actualHours,
        };
      })
      .filter((task) => task.actualHours > 0); // Only tasks with logged time

    // Calculate averages
    const avgEstimated =
      tasksWithActualHours.length > 0
        ? tasksWithActualHours.reduce((sum, t) => sum + t.estimatedHours, 0) /
          tasksWithActualHours.length
        : 0;

    const avgActual =
      tasksWithActualHours.length > 0
        ? tasksWithActualHours.reduce((sum, t) => sum + t.actualHours, 0) /
          tasksWithActualHours.length
        : 0;

    return {
      completedTasks: tasksWithActualHours,
      avgEstimated,
      avgActual,
      count: tasksWithActualHours.length,
    };
  }

  /**
   * Calculate confidence score based on historical data
   */
  private calculateConfidence(historicalData: {
    completedTasks: any[];
    avgEstimated: number;
    avgActual: number;
    count: number;
  }): number {
    const taskCount = historicalData.count;

    if (taskCount === 0) return 0.3; // Low confidence with no data
    if (taskCount < 3) return 0.5; // Medium-low confidence
    if (taskCount < MIN_TASKS_HIGH_CONFIDENCE) return 0.7; // Medium confidence
    return 0.9; // High confidence with sufficient data
  }

  /**
   * Calculate simple estimate from historical averages
   */
  private calculateSimpleEstimate(historicalData: {
    completedTasks: any[];
    avgEstimated: number;
    avgActual: number;
    count: number;
  }) {
    // Use actual hours average (more accurate than estimates)
    const avgHours = historicalData.avgActual;

    // Calculate range using standard deviation
    const hours = historicalData.completedTasks.map((t) => t.actualHours);
    const mean = avgHours;
    const variance = hours.reduce((sum, h) => sum + Math.pow(h - mean, 2), 0) / hours.length;
    const stdDev = Math.sqrt(variance);

    // Range: mean +/- 1 standard deviation
    const rangeMin = Math.max(0.25, mean - stdDev);
    const rangeMax = mean + stdDev;

    return {
      estimatedHours: Math.round(avgHours * 4) / 4, // Round to nearest 0.25
      reasoning: `Based on ${historicalData.count} similar completed tasks. Average actual time: ${avgHours.toFixed(2)} hours.`,
      range: {
        min: Math.round(rangeMin * 4) / 4,
        max: Math.round(rangeMax * 4) / 4,
      },
    };
  }

  /**
   * Get AI-powered estimation when historical data is insufficient
   */
  private async getAIEstimation(
    request: TimeEstimationRequest,
    historicalData: any,
    requestId: string
  ): Promise<Omit<TimeEstimationResponse, 'confidence' | 'basedOnSimilarTasks'>> {
    // Prepare historical data summary for AI
    const historicalSummary =
      historicalData.count > 0
        ? `Similar tasks (${historicalData.count} examples):
- Average estimated: ${historicalData.avgEstimated.toFixed(2)} hours
- Average actual: ${historicalData.avgActual.toFixed(2)} hours`
        : 'No historical data available for this task type in your firm.';

    // Build prompt template
    const template = ChatPromptTemplate.fromMessages([
      ['system', TIME_ESTIMATION_SYSTEM],
      ['human', TIME_ESTIMATION_HUMAN],
    ]);

    // Create structured output parser
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parser = StructuredOutputParser.fromZodSchema(timeEstimationSchema as any);

    // Create model with callback handler for token tracking
    const callbackHandler = new AICallbackHandler();

    const model = createClaudeModel(ClaudeModel.Haiku, {
      temperature: 0.3, // Lower temperature for consistent estimates
      callbacks: [callbackHandler],
    });

    // Create chain
    const chain = template.pipe(model).pipe(parser);

    // Execute
    const result = await chain.invoke({
      taskType: request.taskType,
      taskTitle: request.taskTitle,
      taskDescription: request.taskDescription
        ? `Task Description: ${request.taskDescription}`
        : '',
      caseType: request.caseType ? `Case Type: ${request.caseType}` : '',
      historicalData: historicalSummary,
    });

    // Track token usage
    const metrics = callbackHandler.getMetrics();
    await tokenTracker.recordUsage({
      firmId: request.firmId,
      operationType: AIOperationType.TaskParsing, // Using TaskParsing as closest match
      modelUsed: 'claude-haiku-3.5',
      inputTokens: metrics.inputTokens,
      outputTokens: metrics.outputTokens,
      latencyMs: metrics.latencyMs,
    });

    // Cast result to expected shape
    const parsed = result as {
      estimatedHours: number;
      reasoning: string;
      rangeMin: number;
      rangeMax: number;
    };

    return {
      estimatedHours: parsed.estimatedHours,
      reasoning: parsed.reasoning,
      range: {
        min: parsed.rangeMin,
        max: parsed.rangeMax,
      },
    };
  }

  /**
   * Get default estimate when all else fails
   */
  private getDefaultEstimate(request: TimeEstimationRequest): TimeEstimationResponse {
    // Default estimates by common task types
    const defaults: Record<string, number> = {
      Research: 4.0,
      DocumentDrafting: 6.0,
      DocumentReview: 2.0,
      ClientMeeting: 1.0,
      CourtPreparation: 8.0,
      CourtAppearance: 3.0,
      Administrative: 0.5,
      Email: 0.25,
      PhoneCall: 0.5,
    };

    const defaultHours = defaults[request.taskType] || 2.0;

    return {
      estimatedHours: defaultHours,
      confidence: 0.3,
      reasoning: 'Default estimate based on task type (insufficient historical data).',
      basedOnSimilarTasks: 0,
      range: {
        min: defaultHours * 0.5,
        max: defaultHours * 1.5,
      },
    };
  }
}

export const timeEstimationService = new TimeEstimationService();
