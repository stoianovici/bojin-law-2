/**
 * Time Estimation Service Tests
 * Story 4.3: Time Estimation & Manual Time Logging
 * AC: 1 - Estimated time field required on task creation (AI can suggest based on similar past tasks)
 */

import { TimeEstimationService } from './time-estimation.service';
import { prisma } from '@legal-platform/database';
import { tokenTracker } from './token-tracker.service';
import type { TimeEstimationRequest } from '@legal-platform/types';

// Mock dependencies
jest.mock('@legal-platform/database', () => ({
  prisma: {
    task: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('./token-tracker.service', () => ({
  tokenTracker: {
    recordUsage: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock Claude client
jest.mock('../lib/claude/client', () => ({
  chat: jest.fn().mockResolvedValue({
    content: JSON.stringify({
      estimatedHours: 4,
      reasoning: 'Based on similar tasks',
      rangeMin: 2,
      rangeMax: 6,
    }),
    inputTokens: 100,
    outputTokens: 50,
    stopReason: 'end_turn',
  }),
}));

describe('TimeEstimationService', () => {
  let service: TimeEstimationService;

  const mockRequest: TimeEstimationRequest = {
    taskType: 'DocumentDrafting',
    taskTitle: 'Draft employment contract',
    taskDescription: 'Draft a standard employment contract for new hire',
    caseType: 'Employment',
    firmId: '123e4567-e89b-12d3-a456-426614174000',
  };

  beforeEach(() => {
    service = new TimeEstimationService();
    jest.clearAllMocks();

    // Setup mock implementations
    const { chat } = require('../lib/claude/client');
    chat.mockResolvedValue({
      content: JSON.stringify({
        estimatedHours: 4,
        reasoning: 'Based on similar tasks',
        rangeMin: 2,
        rangeMax: 6,
      }),
      inputTokens: 100,
      outputTokens: 50,
      stopReason: 'end_turn',
    });
  });

  describe('estimateTaskDuration', () => {
    describe('with sufficient historical data (≥5 tasks)', () => {
      beforeEach(() => {
        // Mock historical tasks with time entries
        (prisma.task.findMany as jest.Mock).mockResolvedValue([
          {
            id: 'task-1',
            title: 'Draft contract',
            estimatedHours: 6.0,
            timeEntries: [{ hours: 5.5 }, { hours: 0.5 }],
          },
          {
            id: 'task-2',
            title: 'Contract review',
            estimatedHours: 5.0,
            timeEntries: [{ hours: 4.75 }],
          },
          {
            id: 'task-3',
            title: 'Draft agreement',
            estimatedHours: 7.0,
            timeEntries: [{ hours: 6.25 }, { hours: 1.0 }],
          },
          {
            id: 'task-4',
            title: 'Document drafting',
            estimatedHours: 6.5,
            timeEntries: [{ hours: 6.0 }],
          },
          {
            id: 'task-5',
            title: 'Prepare contract',
            estimatedHours: 5.5,
            timeEntries: [{ hours: 5.25 }],
          },
        ]);
      });

      it('should calculate estimate from historical averages', async () => {
        const result = await service.estimateTaskDuration(mockRequest);

        expect(result).toBeDefined();
        expect(result.estimatedHours).toBeGreaterThan(0);
        expect(result.confidence).toBe(0.9); // High confidence with 5+ tasks
        expect(result.basedOnSimilarTasks).toBe(5);
        expect(result.reasoning).toContain('similar completed tasks');
      });

      it('should provide a reasonable range (min-max)', async () => {
        const result = await service.estimateTaskDuration(mockRequest);

        expect(result.range).toBeDefined();
        expect(result.range.min).toBeGreaterThan(0);
        expect(result.range.max).toBeGreaterThan(result.range.min);
        expect(result.estimatedHours).toBeGreaterThanOrEqual(result.range.min);
        expect(result.estimatedHours).toBeLessThanOrEqual(result.range.max);
      });

      it('should round estimates to nearest 0.25 hours', async () => {
        const result = await service.estimateTaskDuration(mockRequest);

        // Check if estimate is a multiple of 0.25
        expect((result.estimatedHours * 4) % 1).toBe(0);
        expect((result.range.min * 4) % 1).toBe(0);
        expect((result.range.max * 4) % 1).toBe(0);
      });
    });

    describe('with insufficient historical data (<5 tasks)', () => {
      beforeEach(() => {
        // Mock fewer tasks
        (prisma.task.findMany as jest.Mock).mockResolvedValue([
          {
            id: 'task-1',
            title: 'Draft contract',
            estimatedHours: 6.0,
            timeEntries: [{ hours: 5.5 }],
          },
          {
            id: 'task-2',
            title: 'Contract review',
            estimatedHours: 5.0,
            timeEntries: [{ hours: 4.75 }],
          },
        ]);
      });

      it('should use AI estimation with low confidence', async () => {
        // Mock AI response
        const { chat } = require('../lib/claude/client');
        chat.mockResolvedValueOnce({
          content: JSON.stringify({
            estimatedHours: 6.0,
            reasoning: 'Based on task complexity and type',
            rangeMin: 4.5,
            rangeMax: 8.0,
          }),
          inputTokens: 100,
          outputTokens: 50,
          stopReason: 'end_turn',
        });

        const result = await service.estimateTaskDuration(mockRequest);

        expect(result).toBeDefined();
        expect(result.confidence).toBe(0.5); // Medium-low confidence with 2 tasks
        expect(result.basedOnSimilarTasks).toBe(2);
        expect(tokenTracker.recordUsage).toHaveBeenCalled();
      });
    });

    describe('with no historical data', () => {
      beforeEach(() => {
        (prisma.task.findMany as jest.Mock).mockResolvedValue([]);
      });

      it('should use AI estimation with very low confidence', async () => {
        // Mock AI response
        const { chat } = require('../lib/claude/client');
        chat.mockResolvedValueOnce({
          content: JSON.stringify({
            estimatedHours: 6.0,
            reasoning: 'Default estimate for document drafting',
            rangeMin: 3.0,
            rangeMax: 9.0,
          }),
          inputTokens: 100,
          outputTokens: 50,
          stopReason: 'end_turn',
        });

        const result = await service.estimateTaskDuration(mockRequest);

        expect(result).toBeDefined();
        expect(result.confidence).toBe(0.3); // Low confidence with no data
        expect(result.basedOnSimilarTasks).toBe(0);
      });
    });

    describe('confidence scoring', () => {
      it('should return 0.3 confidence with 0 historical tasks', async () => {
        (prisma.task.findMany as jest.Mock).mockResolvedValue([]);

        // Mock AI to avoid actual call
        const { chat } = require('../lib/claude/client');
        chat.mockResolvedValueOnce({
          content: JSON.stringify({
            estimatedHours: 6.0,
            reasoning: 'Default',
            rangeMin: 3.0,
            rangeMax: 9.0,
          }),
          inputTokens: 100,
          outputTokens: 50,
          stopReason: 'end_turn',
        });

        const result = await service.estimateTaskDuration(mockRequest);
        expect(result.confidence).toBe(0.3);
      });

      it('should return 0.5 confidence with 1-2 historical tasks', async () => {
        (prisma.task.findMany as jest.Mock).mockResolvedValue([
          {
            id: 'task-1',
            title: 'Test',
            estimatedHours: 5.0,
            timeEntries: [{ hours: 5.0 }],
          },
        ]);

        // Mock AI
        const { chat } = require('../lib/claude/client');
        chat.mockResolvedValueOnce({
          content: JSON.stringify({
            estimatedHours: 5.0,
            reasoning: 'Test',
            rangeMin: 4.0,
            rangeMax: 6.0,
          }),
          inputTokens: 100,
          outputTokens: 50,
          stopReason: 'end_turn',
        });

        const result = await service.estimateTaskDuration(mockRequest);
        expect(result.confidence).toBe(0.5);
      });

      it('should return 0.7 confidence with 3-4 historical tasks', async () => {
        (prisma.task.findMany as jest.Mock).mockResolvedValue([
          {
            id: 'task-1',
            title: 'Test 1',
            estimatedHours: 5.0,
            timeEntries: [{ hours: 5.0 }],
          },
          {
            id: 'task-2',
            title: 'Test 2',
            estimatedHours: 5.0,
            timeEntries: [{ hours: 5.0 }],
          },
          {
            id: 'task-3',
            title: 'Test 3',
            estimatedHours: 5.0,
            timeEntries: [{ hours: 5.0 }],
          },
        ]);

        // Mock AI
        const { chat } = require('../lib/claude/client');
        chat.mockResolvedValueOnce({
          content: JSON.stringify({
            estimatedHours: 5.0,
            reasoning: 'Test',
            rangeMin: 4.0,
            rangeMax: 6.0,
          }),
          inputTokens: 100,
          outputTokens: 50,
          stopReason: 'end_turn',
        });

        const result = await service.estimateTaskDuration(mockRequest);
        expect(result.confidence).toBe(0.7);
      });

      it('should return 0.9 confidence with 5+ historical tasks', async () => {
        (prisma.task.findMany as jest.Mock).mockResolvedValue([
          { id: '1', title: 'T1', estimatedHours: 5.0, timeEntries: [{ hours: 5.0 }] },
          { id: '2', title: 'T2', estimatedHours: 5.0, timeEntries: [{ hours: 5.0 }] },
          { id: '3', title: 'T3', estimatedHours: 5.0, timeEntries: [{ hours: 5.0 }] },
          { id: '4', title: 'T4', estimatedHours: 5.0, timeEntries: [{ hours: 5.0 }] },
          { id: '5', title: 'T5', estimatedHours: 5.0, timeEntries: [{ hours: 5.0 }] },
        ]);

        const result = await service.estimateTaskDuration(mockRequest);
        expect(result.confidence).toBe(0.9);
      });
    });

    describe('error handling', () => {
      it('should return default estimate on database error', async () => {
        (prisma.task.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

        const result = await service.estimateTaskDuration(mockRequest);

        expect(result).toBeDefined();
        expect(result.estimatedHours).toBe(6.0); // Default for DocumentDrafting
        expect(result.confidence).toBe(0.3);
        expect(result.basedOnSimilarTasks).toBe(0);
        expect(result.reasoning).toContain('Default estimate');
      });

      it('should return default estimate on AI error', async () => {
        (prisma.task.findMany as jest.Mock).mockResolvedValue([]);

        // Mock AI to throw error
        const { chat } = require('../lib/claude/client');
        chat.mockRejectedValueOnce(new Error('AI service error'));

        const result = await service.estimateTaskDuration(mockRequest);

        expect(result).toBeDefined();
        expect(result.estimatedHours).toBe(6.0); // Default for DocumentDrafting
        expect(result.confidence).toBe(0.3);
      });
    });

    describe('default estimates by task type', () => {
      it('should provide correct default for Research', async () => {
        (prisma.task.findMany as jest.Mock).mockRejectedValue(new Error('Test'));

        const result = await service.estimateTaskDuration({
          ...mockRequest,
          taskType: 'Research',
        });

        expect(result.estimatedHours).toBe(4.0);
      });

      it('should provide correct default for DocumentReview', async () => {
        (prisma.task.findMany as jest.Mock).mockRejectedValue(new Error('Test'));

        const result = await service.estimateTaskDuration({
          ...mockRequest,
          taskType: 'DocumentReview',
        });

        expect(result.estimatedHours).toBe(2.0);
      });

      it('should provide correct default for ClientMeeting', async () => {
        (prisma.task.findMany as jest.Mock).mockRejectedValue(new Error('Test'));

        const result = await service.estimateTaskDuration({
          ...mockRequest,
          taskType: 'ClientMeeting',
        });

        expect(result.estimatedHours).toBe(1.0);
      });

      it('should provide correct default for Administrative', async () => {
        (prisma.task.findMany as jest.Mock).mockRejectedValue(new Error('Test'));

        const result = await service.estimateTaskDuration({
          ...mockRequest,
          taskType: 'Administrative',
        });

        expect(result.estimatedHours).toBe(0.5);
      });

      it('should provide default of 2.0 for unknown task types', async () => {
        (prisma.task.findMany as jest.Mock).mockRejectedValue(new Error('Test'));

        const result = await service.estimateTaskDuration({
          ...mockRequest,
          taskType: 'UnknownTaskType' as any,
        });

        expect(result.estimatedHours).toBe(2.0);
        expect(result.range.min).toBe(1.0);
        expect(result.range.max).toBe(3.0);
      });
    });
  });
});
