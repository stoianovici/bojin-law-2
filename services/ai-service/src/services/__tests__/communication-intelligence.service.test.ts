/**
 * Communication Intelligence Service Tests
 * Story 5.2: Communication Intelligence Engine - Task 24
 *
 * Tests for email intelligence extraction with mocked Claude API responses.
 */

import {
  CommunicationIntelligenceService,
  type EmailForAnalysis,
  type EmailIntelligenceResult,
} from '../communication-intelligence.service';
import { providerManager } from '../provider-manager.service';
import { modelRouter } from '../model-router.service';
import { tokenTracker } from '../token-tracker.service';
import { ClaudeModel, AIOperationType, TaskComplexity } from '@legal-platform/types';

// Mock dependencies
jest.mock('../provider-manager.service');
jest.mock('../model-router.service');
jest.mock('../token-tracker.service');

describe('CommunicationIntelligenceService', () => {
  let service: CommunicationIntelligenceService;

  // Sample email for testing
  const sampleEmail: EmailForAnalysis = {
    id: 'email-123',
    subject: 'Re: Contract Review - Urgent',
    bodyContent: `
      Dear Team,

      Please review the attached contract by Friday, December 15th, 2024.
      We commit to providing our initial feedback within 48 hours.

      Can you confirm receipt of this email?

      The client has requested we prioritize this matter urgently.

      Best regards,
      John Smith
    `,
    from: { name: 'John Smith', address: 'john@lawfirm.ro' },
    toRecipients: [{ name: 'Legal Team', address: 'team@lawfirm.ro' }],
    receivedDateTime: new Date('2024-12-10T10:00:00Z'),
    conversationId: 'conv-456',
  };

  // Sample AI response with all extraction types
  const sampleAIResponse = {
    content: JSON.stringify({
      deadlines: [
        {
          description: 'Review attached contract',
          dueDate: '2024-12-15',
          confidence: 0.95,
        },
      ],
      commitments: [
        {
          party: 'John Smith',
          commitmentText: 'Providing initial feedback within 48 hours',
          dueDate: '2024-12-12',
          confidence: 0.85,
        },
      ],
      actionItems: [
        {
          description: 'Review the attached contract',
          suggestedAssignee: 'Legal Team',
          priority: 'Urgent',
          confidence: 0.9,
        },
      ],
      questions: [
        {
          questionText: 'Can you confirm receipt of this email?',
          respondBy: null,
          confidence: 0.95,
        },
      ],
    }),
    model: ClaudeModel.Sonnet,
    inputTokens: 500,
    outputTokens: 200,
    latencyMs: 1500,
  };

  beforeEach(() => {
    service = new CommunicationIntelligenceService();

    // Reset mocks
    jest.clearAllMocks();

    // Setup default mock implementations
    (modelRouter.selectModel as jest.Mock).mockReturnValue({
      model: ClaudeModel.Sonnet,
      provider: 'anthropic',
      fallbackModel: ClaudeModel.Haiku,
    });

    (providerManager.execute as jest.Mock).mockResolvedValue(sampleAIResponse);

    (tokenTracker.recordUsage as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('analyzeSingleEmail', () => {
    it('should extract deadlines from email content', async () => {
      const result = await service.analyzeSingleEmail(sampleEmail, 'user-1', 'firm-1');

      expect(result.deadlines).toHaveLength(1);
      expect(result.deadlines[0]).toEqual({
        description: 'Review attached contract',
        dueDate: '2024-12-15',
        confidence: 0.95,
      });
    });

    it('should extract commitments from email content', async () => {
      const result = await service.analyzeSingleEmail(sampleEmail, 'user-1', 'firm-1');

      expect(result.commitments).toHaveLength(1);
      expect(result.commitments[0].party).toBe('John Smith');
      expect(result.commitments[0].confidence).toBeGreaterThan(0.8);
    });

    it('should extract action items with priority', async () => {
      const result = await service.analyzeSingleEmail(sampleEmail, 'user-1', 'firm-1');

      expect(result.actionItems).toHaveLength(1);
      expect(result.actionItems[0].priority).toBe('Urgent');
      expect(result.actionItems[0].suggestedAssignee).toBe('Legal Team');
    });

    it('should extract questions requiring response', async () => {
      const result = await service.analyzeSingleEmail(sampleEmail, 'user-1', 'firm-1');

      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].questionText).toContain('confirm receipt');
    });

    it('should route to correct model for communication intelligence', async () => {
      await service.analyzeSingleEmail(sampleEmail, 'user-1', 'firm-1');

      expect(modelRouter.selectModel).toHaveBeenCalledWith({
        operationType: AIOperationType.CommunicationIntelligence,
        complexity: TaskComplexity.Standard,
      });
    });

    it('should track token usage after extraction', async () => {
      await service.analyzeSingleEmail(sampleEmail, 'user-1', 'firm-1');

      expect(tokenTracker.recordUsage).toHaveBeenCalledWith({
        userId: 'user-1',
        firmId: 'firm-1',
        operationType: AIOperationType.CommunicationIntelligence,
        modelUsed: ClaudeModel.Sonnet,
        inputTokens: 500,
        outputTokens: 200,
        latencyMs: 1500,
      });
    });

    it('should include token usage and processing time in result', async () => {
      const result = await service.analyzeSingleEmail(sampleEmail, 'user-1', 'firm-1');

      expect(result.tokensUsed).toBe(700); // 500 + 200
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should return empty arrays on API error', async () => {
      (providerManager.execute as jest.Mock).mockRejectedValue(new Error('API Error'));

      const result = await service.analyzeSingleEmail(sampleEmail, 'user-1', 'firm-1');

      expect(result.deadlines).toHaveLength(0);
      expect(result.commitments).toHaveLength(0);
      expect(result.actionItems).toHaveLength(0);
      expect(result.questions).toHaveLength(0);
      expect(result.tokensUsed).toBe(0);
    });

    it('should handle JSON response wrapped in markdown code blocks', async () => {
      const markdownResponse = {
        ...sampleAIResponse,
        content: '```json\n' + sampleAIResponse.content + '\n```',
      };
      (providerManager.execute as jest.Mock).mockResolvedValue(markdownResponse);

      const result = await service.analyzeSingleEmail(sampleEmail, 'user-1', 'firm-1');

      expect(result.deadlines).toHaveLength(1);
      expect(result.commitments).toHaveLength(1);
    });

    it('should return empty arrays for invalid JSON response', async () => {
      (providerManager.execute as jest.Mock).mockResolvedValue({
        ...sampleAIResponse,
        content: 'Invalid JSON response',
      });

      const result = await service.analyzeSingleEmail(sampleEmail, 'user-1', 'firm-1');

      expect(result.deadlines).toHaveLength(0);
      expect(result.commitments).toHaveLength(0);
      expect(result.actionItems).toHaveLength(0);
      expect(result.questions).toHaveLength(0);
    });
  });

  describe('batchAnalyze', () => {
    it('should process multiple emails sequentially', async () => {
      const emails: EmailForAnalysis[] = [
        sampleEmail,
        { ...sampleEmail, id: 'email-124', subject: 'Follow-up' },
        { ...sampleEmail, id: 'email-125', subject: 'Another Follow-up' },
      ];

      const result = await service.batchAnalyze(emails, 'user-1', 'firm-1');

      expect(result.results).toHaveLength(3);
      expect(providerManager.execute).toHaveBeenCalledTimes(3);
    });

    it('should calculate total tokens used across batch', async () => {
      const emails: EmailForAnalysis[] = [sampleEmail, { ...sampleEmail, id: 'email-124' }];

      const result = await service.batchAnalyze(emails, 'user-1', 'firm-1');

      expect(result.totalTokensUsed).toBe(1400); // 700 * 2
    });

    it('should calculate total processing time for batch', async () => {
      const emails: EmailForAnalysis[] = [sampleEmail, { ...sampleEmail, id: 'email-124' }];

      const result = await service.batchAnalyze(emails, 'user-1', 'firm-1');

      expect(result.totalProcessingTimeMs).toBeGreaterThan(0);
    });
  });

  describe('filterByConfidence', () => {
    it('should filter items below minimum confidence threshold (0.5)', () => {
      const result: EmailIntelligenceResult = {
        emailId: 'email-123',
        deadlines: [
          { description: 'High confidence', dueDate: '2024-12-15', confidence: 0.9 },
          { description: 'Low confidence', dueDate: '2024-12-20', confidence: 0.3 },
        ],
        commitments: [{ party: 'Test', commitmentText: 'Low confidence', confidence: 0.4 }],
        actionItems: [],
        questions: [{ questionText: 'High confidence', confidence: 0.8 }],
        tokensUsed: 100,
        processingTimeMs: 100,
      };

      const filtered = service.filterByConfidence(result);

      expect(filtered.deadlines).toHaveLength(1);
      expect(filtered.deadlines[0].description).toBe('High confidence');
      expect(filtered.commitments).toHaveLength(0);
      expect(filtered.questions).toHaveLength(1);
    });
  });

  describe('hasHighConfidenceItems', () => {
    it('should return true when any item has confidence >= 0.8', () => {
      const result: EmailIntelligenceResult = {
        emailId: 'email-123',
        deadlines: [{ description: 'Test', dueDate: '2024-12-15', confidence: 0.85 }],
        commitments: [],
        actionItems: [],
        questions: [],
        tokensUsed: 100,
        processingTimeMs: 100,
      };

      expect(service.hasHighConfidenceItems(result)).toBe(true);
    });

    it('should return false when no items have confidence >= 0.8', () => {
      const result: EmailIntelligenceResult = {
        emailId: 'email-123',
        deadlines: [{ description: 'Test', dueDate: '2024-12-15', confidence: 0.7 }],
        commitments: [{ party: 'Test', commitmentText: 'Test', confidence: 0.6 }],
        actionItems: [],
        questions: [],
        tokensUsed: 100,
        processingTimeMs: 100,
      };

      expect(service.hasHighConfidenceItems(result)).toBe(false);
    });
  });

  describe('getItemCountsByConfidence', () => {
    it('should categorize items by confidence level', () => {
      const result: EmailIntelligenceResult = {
        emailId: 'email-123',
        deadlines: [
          { description: 'High', dueDate: '2024-12-15', confidence: 0.9 },
          { description: 'Medium', dueDate: '2024-12-15', confidence: 0.7 },
        ],
        commitments: [{ party: 'Test', commitmentText: 'Low', confidence: 0.4 }],
        actionItems: [{ description: 'High', priority: 'High', confidence: 0.85 }],
        questions: [{ questionText: 'Medium', confidence: 0.65 }],
        tokensUsed: 100,
        processingTimeMs: 100,
      };

      const counts = service.getItemCountsByConfidence(result);

      expect(counts.high).toBe(2); // 0.9 and 0.85
      expect(counts.medium).toBe(2); // 0.7 and 0.65
      expect(counts.low).toBe(1); // 0.4
    });
  });

  describe('validation', () => {
    it('should handle missing optional fields in action items', async () => {
      (providerManager.execute as jest.Mock).mockResolvedValue({
        ...sampleAIResponse,
        content: JSON.stringify({
          deadlines: [],
          commitments: [],
          actionItems: [{ description: 'Action without optional fields', confidence: 0.8 }],
          questions: [],
        }),
      });

      const result = await service.analyzeSingleEmail(sampleEmail, 'user-1', 'firm-1');

      expect(result.actionItems[0].priority).toBe('Medium'); // default
      expect(result.actionItems[0].suggestedAssignee).toBeUndefined();
    });

    it('should normalize confidence values outside 0-1 range', async () => {
      (providerManager.execute as jest.Mock).mockResolvedValue({
        ...sampleAIResponse,
        content: JSON.stringify({
          deadlines: [
            { description: 'Over 1', dueDate: '2024-12-15', confidence: 1.5 },
            { description: 'Under 0', dueDate: '2024-12-15', confidence: -0.5 },
          ],
          commitments: [],
          actionItems: [],
          questions: [],
        }),
      });

      const result = await service.analyzeSingleEmail(sampleEmail, 'user-1', 'firm-1');

      expect(result.deadlines[0].confidence).toBe(1);
      expect(result.deadlines[1].confidence).toBe(0);
    });

    it('should filter out invalid items with missing required fields', async () => {
      (providerManager.execute as jest.Mock).mockResolvedValue({
        ...sampleAIResponse,
        content: JSON.stringify({
          deadlines: [
            { description: 'Valid', dueDate: '2024-12-15', confidence: 0.9 },
            { description: 'Missing dueDate', confidence: 0.9 }, // invalid
            { dueDate: '2024-12-15', confidence: 0.9 }, // missing description
          ],
          commitments: [
            { party: 'Valid', commitmentText: 'Valid', confidence: 0.9 },
            { commitmentText: 'Missing party', confidence: 0.9 }, // invalid
          ],
          actionItems: [],
          questions: [],
        }),
      });

      const result = await service.analyzeSingleEmail(sampleEmail, 'user-1', 'firm-1');

      expect(result.deadlines).toHaveLength(1);
      expect(result.commitments).toHaveLength(1);
    });
  });
});
