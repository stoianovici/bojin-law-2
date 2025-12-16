/**
 * AI Learning and Personalization Integration Tests
 * Story 5.6: AI Learning and Personalization - Task 42
 *
 * Tests GraphQL resolvers for writing style, snippets, task patterns,
 * document preferences, and response time patterns
 */

// Set environment variables before imports
process.env.SKIP_AUTH_VALIDATION = 'true';
process.env.SKIP_GRAPH_VALIDATION = 'true';
process.env.AI_SERVICE_URL = 'http://localhost:3002';

// Mock Prisma
jest.mock('@legal-platform/database', () => {
  const mockPrisma: Record<string, unknown> = {
    writingStyleProfile: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    personalSnippet: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    taskCreationPattern: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    documentStructurePreference: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
    },
    responseTimePattern: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      upsert: jest.fn(),
    },
    draftEditHistory: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    emailDraft: {
      findFirst: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((fn: (prisma: Record<string, unknown>) => unknown) => fn(mockPrisma)),
  };
  return { prisma: mockPrisma };
});

// Mock services used by resolvers
jest.mock('../../src/services/personal-snippets.service', () => ({
  personalSnippetsService: {
    getUserSnippets: jest.fn(),
    getSnippetById: jest.fn(),
    searchSnippets: jest.fn(),
    createSnippet: jest.fn(),
    updateSnippet: jest.fn(),
    deleteSnippet: jest.fn(),
    recordUsage: jest.fn(),
    acceptSuggestion: jest.fn(),
  },
}));

jest.mock('../../src/services/draft-edit-tracker.service', () => ({
  draftEditTrackerService: {
    trackDraftEdit: jest.fn(),
    getUnanalyzedEdits: jest.fn(),
    markAsAnalyzed: jest.fn(),
  },
}));

jest.mock('../../src/services/document-structure-preference.service', () => ({
  documentStructurePreferenceService: {
    getUserPreferences: jest.fn(),
    getPreferenceByType: jest.fn(),
    createPreference: jest.fn(),
    updatePreference: jest.fn(),
  },
}));

jest.mock('../../src/services/response-time-pattern.service', () => ({
  responseTimePatternService: {
    getUserPatterns: jest.fn(),
    predictCompletionTime: jest.fn(),
  },
}));

jest.mock('../../src/services/personalization-dashboard.service', () => ({
  personalizationDashboardService: {
    getSnippetSuggestions: jest.fn(),
    getLearningStatus: jest.fn(),
    getPersonalizationSettings: jest.fn(),
    resetWritingStyleProfile: jest.fn(),
    updatePersonalizationSettings: jest.fn(),
    clearAllLearningData: jest.fn(),
  },
}));

import { prisma } from '@legal-platform/database';
import { personalSnippetsService } from '../../src/services/personal-snippets.service';
import { draftEditTrackerService } from '../../src/services/draft-edit-tracker.service';
import { documentStructurePreferenceService } from '../../src/services/document-structure-preference.service';
import { responseTimePatternService } from '../../src/services/response-time-pattern.service';
import { personalizationDashboardService } from '../../src/services/personalization-dashboard.service';
import { aiLearningResolvers } from '../../src/graphql/resolvers/ai-learning.resolvers';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// Test fixtures
const testContext = {
  user: {
    id: 'user-test-123',
    role: 'Associate',
    firmId: 'firm-test-456',
  },
};

const mockWritingProfile = {
  id: 'profile-1',
  firmId: 'firm-test-456',
  userId: 'user-test-123',
  formalityLevel: 0.7,
  averageSentenceLength: 18,
  vocabularyComplexity: 0.6,
  preferredTone: 'Professional',
  commonPhrases: [
    { phrase: 'Cu stimă', frequency: 15, context: 'closing' },
    { phrase: 'Stimate Domn', frequency: 10, context: 'greeting' },
  ],
  punctuationStyle: {
    useOxfordComma: false,
    preferSemicolons: true,
    useDashes: 'em-dash',
    colonBeforeLists: true,
  },
  languagePatterns: {
    primaryLanguage: 'romanian',
    formalityByLanguage: { romanian: 0.8, english: 0.6 },
    preferredGreetingsByLanguage: {},
    legalTermsPreference: 'mixed',
  },
  sampleCount: 25,
  lastAnalyzedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockSnippet = {
  id: 'snip-1',
  firmId: 'firm-test-456',
  userId: 'user-test-123',
  shortcut: 'greet',
  title: 'Formal Greeting',
  content: 'Stimate Domn/Stimată Doamnă,',
  category: 'Greeting',
  usageCount: 10,
  lastUsedAt: new Date(),
  isAutoDetected: false,
  sourceContext: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockTaskPattern = {
  id: 'pattern-1',
  firmId: 'firm-test-456',
  userId: 'user-test-123',
  patternName: 'New Contract Review',
  triggerType: 'document_uploaded',
  triggerContext: { documentType: 'Contract' },
  taskTemplate: {
    type: 'DocumentReview',
    titleTemplate: 'Review contract: {documentName}',
    priority: 'High',
    estimatedHours: 2,
  },
  occurrenceCount: 5,
  confidence: 0.85,
  isActive: true,
  lastTriggeredAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AI Learning Resolvers Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Query.myWritingStyleProfile', () => {
    it('should return writing style profile for authenticated user', async () => {
      (mockPrisma.writingStyleProfile.findUnique as jest.Mock).mockResolvedValue(
        mockWritingProfile
      );

      const result = await aiLearningResolvers.Query.myWritingStyleProfile({}, {}, testContext);

      expect(result).toBeDefined();
      expect(result?.formalityLevel).toBe(0.7);
      expect(result?.preferredTone).toBe('Professional');
      expect(mockPrisma.writingStyleProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-test-123' },
      });
    });

    it('should return null when no profile exists', async () => {
      (mockPrisma.writingStyleProfile.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await aiLearningResolvers.Query.myWritingStyleProfile({}, {}, testContext);

      expect(result).toBeNull();
    });

    it('should throw error for unauthenticated request', async () => {
      await expect(
        aiLearningResolvers.Query.myWritingStyleProfile({}, {}, { user: null } as never)
      ).rejects.toThrow('Authentication required');
    });
  });

  describe('Query.mySnippets', () => {
    it('should return user snippets', async () => {
      (personalSnippetsService.getUserSnippets as jest.Mock).mockResolvedValue([mockSnippet]);

      const result = await aiLearningResolvers.Query.mySnippets({}, {}, testContext);

      expect(result).toHaveLength(1);
      expect(result[0].shortcut).toBe('greet');
      expect(personalSnippetsService.getUserSnippets).toHaveBeenCalledWith(
        'user-test-123',
        undefined
      );
    });

    it('should filter snippets by category', async () => {
      (personalSnippetsService.getUserSnippets as jest.Mock).mockResolvedValue([mockSnippet]);

      await aiLearningResolvers.Query.mySnippets(
        {},
        { category: 'Greeting' as const },
        testContext
      );

      expect(personalSnippetsService.getUserSnippets).toHaveBeenCalledWith(
        'user-test-123',
        'Greeting'
      );
    });
  });

  describe('Query.searchSnippets', () => {
    it('should search snippets by query', async () => {
      (personalSnippetsService.searchSnippets as jest.Mock).mockResolvedValue([mockSnippet]);

      const result = await aiLearningResolvers.Query.searchSnippets(
        {},
        { query: 'greet' },
        testContext
      );

      expect(result).toHaveLength(1);
      expect(personalSnippetsService.searchSnippets).toHaveBeenCalledWith('user-test-123', {
        query: 'greet',
      });
    });
  });

  describe('Query.myTaskPatterns', () => {
    it('should return active task patterns', async () => {
      (mockPrisma.taskCreationPattern.findMany as jest.Mock).mockResolvedValue([mockTaskPattern]);

      const result = await aiLearningResolvers.Query.myTaskPatterns(
        {},
        { isActive: true },
        testContext
      );

      expect(result).toHaveLength(1);
      expect(result[0].patternName).toBe('New Contract Review');
    });

    it('should return all patterns when no filter', async () => {
      (mockPrisma.taskCreationPattern.findMany as jest.Mock).mockResolvedValue([mockTaskPattern]);

      await aiLearningResolvers.Query.myTaskPatterns({}, {}, testContext);

      expect(mockPrisma.taskCreationPattern.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-test-123' },
        orderBy: [{ confidence: 'desc' }, { occurrenceCount: 'desc' }],
      });
    });
  });

  describe('Query.myDocumentPreferences', () => {
    it('should return document preferences', async () => {
      const mockPreference = {
        id: 'pref-1',
        documentType: 'Contract',
        preferredSections: [{ name: 'Parties', order: 1, required: true }],
        headerStyle: { format: 'numbered', numbering: 'decimal' },
      };
      (documentStructurePreferenceService.getUserPreferences as jest.Mock).mockResolvedValue([
        mockPreference,
      ]);

      const result = await aiLearningResolvers.Query.myDocumentPreferences({}, {}, testContext);

      expect(result).toHaveLength(1);
      expect(result[0].documentType).toBe('Contract');
    });

    it('should filter by document type', async () => {
      const mockPreference = {
        id: 'pref-1',
        documentType: 'Contract',
      };
      (documentStructurePreferenceService.getPreferenceByType as jest.Mock).mockResolvedValue(
        mockPreference
      );

      const result = await aiLearningResolvers.Query.myDocumentPreferences(
        {},
        { documentType: 'Contract' },
        testContext
      );

      expect(result).toHaveLength(1);
    });
  });

  describe('Query.myResponseTimePatterns', () => {
    it('should return response time patterns', async () => {
      const mockPattern = {
        taskType: 'DocumentReview',
        averageResponseHours: 4.5,
        medianResponseHours: 4.0,
        sampleCount: 20,
      };
      (responseTimePatternService.getUserPatterns as jest.Mock).mockResolvedValue([mockPattern]);

      const result = await aiLearningResolvers.Query.myResponseTimePatterns({}, {}, testContext);

      expect(result).toHaveLength(1);
      expect(result[0].averageResponseHours).toBe(4.5);
    });
  });

  describe('Query.predictCompletionTime', () => {
    it('should predict completion time based on patterns', async () => {
      const prediction = {
        estimatedHours: 4.5,
        confidenceLevel: 0.8,
        basedOnSamples: 15,
        adjustedForDayOfWeek: true,
        adjustedForTimeOfDay: false,
        factors: ['historical_average'],
      };
      (responseTimePatternService.predictCompletionTime as jest.Mock).mockResolvedValue(prediction);

      const result = await aiLearningResolvers.Query.predictCompletionTime(
        {},
        { taskType: 'DocumentReview' },
        testContext
      );

      expect(result?.estimatedHours).toBe(4.5);
      expect(result?.confidenceLevel).toBe(0.8);
    });
  });

  describe('Query.learningStatus', () => {
    it('should return learning status summary', async () => {
      const status = {
        userId: 'user-test-123',
        writingStyleSamples: 25,
        snippetsCount: 10,
        taskPatternsCount: 5,
        documentPreferencesCount: 3,
        responseTimePatternCount: 8,
        lastAnalysisAt: new Date(),
        nextScheduledAnalysis: new Date(),
      };
      (personalizationDashboardService.getLearningStatus as jest.Mock).mockResolvedValue(status);

      const result = await aiLearningResolvers.Query.learningStatus({}, {}, testContext);

      expect(result.writingStyleSamples).toBe(25);
      expect(result.snippetsCount).toBe(10);
    });
  });

  describe('Mutation.createSnippet', () => {
    it('should create a new snippet', async () => {
      (personalSnippetsService.createSnippet as jest.Mock).mockResolvedValue(mockSnippet);

      const input = {
        shortcut: 'greet',
        title: 'Formal Greeting',
        content: 'Stimate Domn/Stimată Doamnă,',
        category: 'Greeting' as const,
      };

      const result = await aiLearningResolvers.Mutation.createSnippet({}, { input }, testContext);

      expect(result.shortcut).toBe('greet');
      expect(personalSnippetsService.createSnippet).toHaveBeenCalledWith(
        input,
        'user-test-123',
        'firm-test-456'
      );
    });
  });

  describe('Mutation.updateSnippet', () => {
    it('should update a snippet', async () => {
      const updatedSnippet = { ...mockSnippet, title: 'Updated Title' };
      (personalSnippetsService.updateSnippet as jest.Mock).mockResolvedValue(updatedSnippet);

      const result = await aiLearningResolvers.Mutation.updateSnippet(
        {},
        { id: 'snip-1', input: { title: 'Updated Title' } },
        testContext
      );

      expect(result.title).toBe('Updated Title');
    });
  });

  describe('Mutation.deleteSnippet', () => {
    it('should delete a snippet', async () => {
      (personalSnippetsService.deleteSnippet as jest.Mock).mockResolvedValue(true);

      const result = await aiLearningResolvers.Mutation.deleteSnippet(
        {},
        { id: 'snip-1' },
        testContext
      );

      expect(result).toBe(true);
      expect(personalSnippetsService.deleteSnippet).toHaveBeenCalledWith('snip-1', 'user-test-123');
    });
  });

  describe('Mutation.recordSnippetUsage', () => {
    it('should record snippet usage', async () => {
      const usedSnippet = { ...mockSnippet, usageCount: 11 };
      (personalSnippetsService.recordUsage as jest.Mock).mockResolvedValue(usedSnippet);

      const result = await aiLearningResolvers.Mutation.recordSnippetUsage(
        {},
        { id: 'snip-1' },
        testContext
      );

      expect(result.usageCount).toBe(11);
    });
  });

  describe('Mutation.createTaskPattern', () => {
    it('should create a task creation pattern', async () => {
      (mockPrisma.taskCreationPattern.create as jest.Mock).mockResolvedValue(mockTaskPattern);

      const input = {
        patternName: 'New Contract Review',
        triggerType: 'document_uploaded',
        triggerContext: { documentType: 'Contract' },
        taskTemplate: {
          type: 'DocumentReview',
          titleTemplate: 'Review contract: {documentName}',
          priority: 'High',
          estimatedHours: 2,
        },
      };

      const result = await aiLearningResolvers.Mutation.createTaskPattern(
        {},
        { input },
        testContext
      );

      expect(result.patternName).toBe('New Contract Review');
      expect(mockPrisma.taskCreationPattern.create).toHaveBeenCalled();
    });
  });

  describe('Mutation.toggleTaskPattern', () => {
    it('should toggle task pattern active status', async () => {
      (mockPrisma.taskCreationPattern.findFirst as jest.Mock).mockResolvedValue(mockTaskPattern);
      (mockPrisma.taskCreationPattern.update as jest.Mock).mockResolvedValue({
        ...mockTaskPattern,
        isActive: false,
      });

      const result = await aiLearningResolvers.Mutation.toggleTaskPattern(
        {},
        { id: 'pattern-1', isActive: false },
        testContext
      );

      expect(result.isActive).toBe(false);
    });

    it('should throw error when pattern not found', async () => {
      (mockPrisma.taskCreationPattern.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        aiLearningResolvers.Mutation.toggleTaskPattern(
          {},
          { id: 'pattern-unknown', isActive: false },
          testContext
        )
      ).rejects.toThrow('Pattern not found');
    });
  });

  describe('Mutation.recordDraftEdit', () => {
    it('should record a draft edit for learning', async () => {
      (draftEditTrackerService.trackDraftEdit as jest.Mock).mockResolvedValue({
        id: 'edit-1',
        editType: 'Replacement',
      });

      const input = {
        draftId: 'draft-123',
        originalText: 'Original content',
        editedText: 'Edited content',
        editLocation: 'body',
      };

      const result = await aiLearningResolvers.Mutation.recordDraftEdit({}, { input }, testContext);

      expect(result).toBe(true);
      expect(draftEditTrackerService.trackDraftEdit).toHaveBeenCalledWith(
        input,
        'user-test-123',
        'firm-test-456'
      );
    });
  });

  describe('Mutation.analyzeWritingStyle', () => {
    it('should analyze writing style from edits', async () => {
      const mockEdits = [
        { id: 'edit-1', editedText: 'Some text' },
        { id: 'edit-2', editedText: 'More text' },
        { id: 'edit-3', editedText: 'Even more text' },
        { id: 'edit-4', editedText: 'Additional text' },
        { id: 'edit-5', editedText: 'Final text' },
      ];
      (draftEditTrackerService.getUnanalyzedEdits as jest.Mock).mockResolvedValue(mockEdits);
      (draftEditTrackerService.markAsAnalyzed as jest.Mock).mockResolvedValue(5);
      (mockPrisma.writingStyleProfile.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.writingStyleProfile.create as jest.Mock).mockResolvedValue(mockWritingProfile);

      const result = await aiLearningResolvers.Mutation.analyzeWritingStyle({}, {}, testContext);

      expect(result).toBeDefined();
      expect(draftEditTrackerService.getUnanalyzedEdits).toHaveBeenCalledWith('user-test-123', 50);
    });

    it('should return null when insufficient edits', async () => {
      (draftEditTrackerService.getUnanalyzedEdits as jest.Mock).mockResolvedValue([
        { id: 'edit-1' },
        { id: 'edit-2' },
      ]);

      const result = await aiLearningResolvers.Mutation.analyzeWritingStyle({}, {}, testContext);

      expect(result).toBeNull();
    });
  });

  describe('Mutation.resetWritingStyleProfile', () => {
    it('should reset writing style profile', async () => {
      (personalizationDashboardService.resetWritingStyleProfile as jest.Mock).mockResolvedValue(
        true
      );

      const result = await aiLearningResolvers.Mutation.resetWritingStyleProfile(
        {},
        {},
        testContext
      );

      expect(result).toBe(true);
      expect(personalizationDashboardService.resetWritingStyleProfile).toHaveBeenCalledWith(
        'user-test-123'
      );
    });
  });

  describe('Mutation.updatePersonalizationSettings', () => {
    it('should update personalization settings', async () => {
      const settings = {
        styleAdaptationEnabled: true,
        snippetSuggestionsEnabled: false,
      };
      (
        personalizationDashboardService.updatePersonalizationSettings as jest.Mock
      ).mockResolvedValue(settings);

      const result = await aiLearningResolvers.Mutation.updatePersonalizationSettings(
        {},
        { input: { styleAdaptationEnabled: true, snippetSuggestionsEnabled: false } },
        testContext
      );

      expect(result.styleAdaptationEnabled).toBe(true);
      expect(result.snippetSuggestionsEnabled).toBe(false);
    });
  });

  describe('Mutation.clearAllLearningData', () => {
    it('should clear all learning data', async () => {
      (personalizationDashboardService.clearAllLearningData as jest.Mock).mockResolvedValue(true);

      const result = await aiLearningResolvers.Mutation.clearAllLearningData({}, {}, testContext);

      expect(result).toBe(true);
      expect(personalizationDashboardService.clearAllLearningData).toHaveBeenCalledWith(
        'user-test-123'
      );
    });
  });
});
