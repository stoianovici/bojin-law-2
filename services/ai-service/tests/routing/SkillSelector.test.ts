/**
 * Tests for SkillSelector
 */

import { SkillSelector } from '../../src/routing/SkillSelector';
import { SkillsRegistry } from '../../src/skills/SkillsRegistry';
import type { SkillMetadata } from '../../src/types/skills';

// Mock SkillsRegistry
jest.mock('../../src/skills/SkillsRegistry');

describe('SkillSelector', () => {
  let skillSelector: SkillSelector;
  let mockSkillsRegistry: jest.Mocked<SkillsRegistry>;

  // Mock skills data
  const mockSkills: SkillMetadata[] = [
    {
      id: '1',
      skill_id: 'contract-analysis',
      display_name: 'Contract Analysis Professional',
      description: 'Analyzes legal contracts for clauses and risks',
      version: '1.0.0',
      type: 'analysis',
      category: 'legal-analysis',
      effectiveness_score: 0.85,
      token_savings_avg: 0.7,
      usage_count: 150,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: '2',
      skill_id: 'document-drafting',
      display_name: 'Document Drafting Assistant',
      description: 'Creates legal documents from templates',
      version: '1.0.0',
      type: 'generation',
      category: 'drafting',
      effectiveness_score: 0.75,
      token_savings_avg: 0.65,
      usage_count: 100,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: '3',
      skill_id: 'legal-research',
      display_name: 'Legal Research Expert',
      description: 'Searches case law and legal precedents',
      version: '1.0.0',
      type: 'analysis',
      category: 'research',
      effectiveness_score: 0.65,
      token_savings_avg: 0.6,
      usage_count: 80,
      created_at: new Date(),
      updated_at: new Date(),
    },
  ];

  beforeEach(() => {
    mockSkillsRegistry = new SkillsRegistry(null as any) as jest.Mocked<SkillsRegistry>;
    skillSelector = new SkillSelector(mockSkillsRegistry);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('select', () => {
    it('should select contract-analysis for contract review tasks', async () => {
      mockSkillsRegistry.recommendSkills.mockResolvedValue([
        {
          skill: mockSkills[0],
          relevanceScore: 0.85,
          reason: 'Matches legal-analysis category',
        },
      ]);

      const result = await skillSelector.select({
        task: 'Review this contract for potential risks',
      });

      expect(result.skills).toHaveLength(1);
      expect(result.skills[0].skill_id).toBe('contract-analysis');
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      expect(result.strategy).toBe('single');
    });

    it('should return empty array when no patterns match', async () => {
      mockSkillsRegistry.recommendSkills.mockResolvedValue([]);

      const result = await skillSelector.select({
        task: 'Something completely unrelated',
      });

      expect(result.skills).toHaveLength(0);
      expect(result.strategy).toBe('none');
      expect(result.confidence).toBe(0);
    });

    it('should combine skills for complex multi-step tasks', async () => {
      mockSkillsRegistry.recommendSkills.mockResolvedValue([
        {
          skill: mockSkills[0],
          relevanceScore: 0.8,
          reason: 'Analysis match',
        },
        {
          skill: mockSkills[1],
          relevanceScore: 0.75,
          reason: 'Generation match',
        },
      ]);

      const result = await skillSelector.select({
        task: 'Analyze this contract and then draft an amendment',
        context: {
          complexity: 'high',
        },
      });

      expect(result.skills.length).toBeGreaterThanOrEqual(1);
      if (result.skills.length > 1) {
        expect(result.strategy).toBe('combined');
        expect(result.confidence).toBeGreaterThan(0);
      }
    });

    it('should respect minimum confidence threshold', async () => {
      mockSkillsRegistry.recommendSkills.mockResolvedValue([
        {
          skill: mockSkills[2],
          relevanceScore: 0.3, // Below default threshold of 0.5
          reason: 'Weak match',
        },
      ]);

      const result = await skillSelector.select({
        task: 'Find some legal information',
      });

      expect(result.skills).toHaveLength(0);
      expect(result.strategy).toBe('none');
      expect(result.reasoning).toContain('Confidence too low');
    });

    it('should apply pattern matching boost', async () => {
      mockSkillsRegistry.recommendSkills.mockResolvedValue([
        {
          skill: mockSkills[0],
          relevanceScore: 0.7,
          reason: 'Base match',
        },
      ]);

      const result = await skillSelector.select({
        task: 'Contract review and analysis of agreement terms',
      });

      // Pattern match should boost confidence
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.reasoning).toContain('Contract Analysis Professional');
    });

    it('should use fallback strategy for medium confidence', async () => {
      mockSkillsRegistry.recommendSkills.mockResolvedValue([
        {
          skill: mockSkills[2],
          relevanceScore: 0.6, // Between 0.5 and 0.8
          reason: 'Moderate match',
        },
      ]);

      const result = await skillSelector.select({
        task: 'Research some legal topics',
      });

      expect(result.skills).toHaveLength(1);
      expect(result.strategy).toBe('fallback');
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
      expect(result.confidence).toBeLessThan(0.8);
    });

    it('should boost confidence for previously successful skills', async () => {
      mockSkillsRegistry.recommendSkills.mockResolvedValue([
        {
          skill: mockSkills[0],
          relevanceScore: 0.7,
          reason: 'Base match',
        },
      ]);

      const resultWithContext = await skillSelector.select({
        task: 'Analyze contract',
        context: {
          previousSkills: ['contract-analysis'],
        },
      });

      const resultWithoutContext = await skillSelector.select({
        task: 'Analyze contract',
      });

      expect(resultWithContext.confidence).toBeGreaterThan(resultWithoutContext.confidence);
    });

    it('should respect maxSkills constraint', async () => {
      mockSkillsRegistry.recommendSkills.mockResolvedValue([
        {
          skill: mockSkills[0],
          relevanceScore: 0.85,
          reason: 'Match 1',
        },
        {
          skill: mockSkills[1],
          relevanceScore: 0.75,
          reason: 'Match 2',
        },
        {
          skill: mockSkills[2],
          relevanceScore: 0.65,
          reason: 'Match 3',
        },
      ]);

      const result = await skillSelector.select({
        task: 'Complex legal task requiring multiple skills',
        constraints: {
          maxSkills: 2,
        },
      });

      expect(result.skills.length).toBeLessThanOrEqual(2);
    });

    it('should respect custom minConfidence constraint', async () => {
      mockSkillsRegistry.recommendSkills.mockResolvedValue([
        {
          skill: mockSkills[0],
          relevanceScore: 0.65,
          reason: 'Base match',
        },
      ]);

      const result = await skillSelector.select({
        task: 'Analyze contract',
        constraints: {
          minConfidence: 0.8, // Higher than default
        },
      });

      expect(result.skills).toHaveLength(0);
      expect(result.reasoning).toContain('below required threshold');
    });
  });

  describe('getEffectiveness', () => {
    it('should return 0 for empty skill list', async () => {
      const effectiveness = await skillSelector.getEffectiveness([]);

      expect(effectiveness).toBe(0);
    });

    it('should calculate effectiveness from metrics', async () => {
      mockSkillsRegistry.getSkillMetrics.mockReturnValue({
        skillId: 'contract-analysis',
        totalExecutions: 100,
        successfulExecutions: 95,
        averageTokensSaved: 0.7,
        averageExecutionTime: 2000,
        successRate: 0.95,
      });

      const effectiveness = await skillSelector.getEffectiveness(['contract-analysis']);

      expect(effectiveness).toBeGreaterThan(0.5);
      expect(effectiveness).toBeLessThanOrEqual(1.0);
    });

    it('should use default score when no metrics available', async () => {
      mockSkillsRegistry.getSkillMetrics.mockReturnValue(null);

      const effectiveness = await skillSelector.getEffectiveness(['unknown-skill']);

      expect(effectiveness).toBe(0.6); // Default moderate score
    });

    it('should average effectiveness for multiple skills', async () => {
      mockSkillsRegistry.getSkillMetrics
        .mockReturnValueOnce({
          skillId: 'skill-1',
          totalExecutions: 50,
          successfulExecutions: 45,
          averageTokensSaved: 0.8,
          averageExecutionTime: 1500,
          successRate: 0.9,
        })
        .mockReturnValueOnce({
          skillId: 'skill-2',
          totalExecutions: 50,
          successfulExecutions: 40,
          averageTokensSaved: 0.6,
          averageExecutionTime: 2500,
          successRate: 0.8,
        });

      const effectiveness = await skillSelector.getEffectiveness(['skill-1', 'skill-2']);

      expect(effectiveness).toBeGreaterThan(0);
      expect(effectiveness).toBeLessThanOrEqual(1.0);
    });
  });

  describe('updateThresholds', () => {
    it('should update minimum confidence threshold', () => {
      skillSelector.updateThresholds({ minConfidence: 0.7 });

      const config = skillSelector.getConfig();
      expect(config.minConfidenceThreshold).toBe(0.7);
    });

    it('should update high confidence threshold', () => {
      skillSelector.updateThresholds({ highConfidence: 0.9 });

      const config = skillSelector.getConfig();
      expect(config.highConfidenceThreshold).toBe(0.9);
    });

    it('should update both thresholds', () => {
      skillSelector.updateThresholds({
        minConfidence: 0.6,
        highConfidence: 0.85,
      });

      const config = skillSelector.getConfig();
      expect(config.minConfidenceThreshold).toBe(0.6);
      expect(config.highConfidenceThreshold).toBe(0.85);
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const config = skillSelector.getConfig();

      expect(config).toHaveProperty('minConfidenceThreshold');
      expect(config).toHaveProperty('highConfidenceThreshold');
      expect(config).toHaveProperty('maxSkillsPerRequest');
      expect(config).toHaveProperty('combinationBonus');
    });

    it('should return copy of config, not reference', () => {
      const config1 = skillSelector.getConfig();
      config1.minConfidenceThreshold = 0.99;

      const config2 = skillSelector.getConfig();
      expect(config2.minConfidenceThreshold).not.toBe(0.99);
    });
  });

  describe('pattern matching', () => {
    it('should match contract patterns', async () => {
      mockSkillsRegistry.recommendSkills.mockResolvedValue([
        {
          skill: mockSkills[0],
          relevanceScore: 0.7,
          reason: 'Match',
        },
      ]);

      const patterns = [
        'contract review',
        'analyze agreement',
        'extract clauses',
        'identify risks in contract',
      ];

      for (const pattern of patterns) {
        const result = await skillSelector.select({ task: pattern });
        expect(result.confidence).toBeGreaterThan(0.7); // Should get boost
      }
    });

    it('should match drafting patterns', async () => {
      mockSkillsRegistry.recommendSkills.mockResolvedValue([
        {
          skill: mockSkills[1],
          relevanceScore: 0.7,
          reason: 'Match',
        },
      ]);

      const patterns = ['draft document', 'create agreement', 'generate NDA'];

      for (const pattern of patterns) {
        const result = await skillSelector.select({ task: pattern });
        expect(result.confidence).toBeGreaterThan(0.7);
      }
    });
  });

  describe('complexity detection', () => {
    it('should detect low complexity tasks', async () => {
      mockSkillsRegistry.recommendSkills.mockResolvedValue([
        {
          skill: mockSkills[0],
          relevanceScore: 0.8,
          reason: 'Match',
        },
        {
          skill: mockSkills[1],
          relevanceScore: 0.75,
          reason: 'Match',
        },
      ]);

      const result = await skillSelector.select({
        task: 'Simple contract review',
      });

      // Low complexity should not combine skills
      expect(result.skills.length).toBe(1);
    });

    it('should detect high complexity tasks', async () => {
      mockSkillsRegistry.recommendSkills.mockResolvedValue([
        {
          skill: mockSkills[0],
          relevanceScore: 0.8,
          reason: 'Match',
        },
        {
          skill: mockSkills[1],
          relevanceScore: 0.75,
          reason: 'Match',
        },
      ]);

      const result = await skillSelector.select({
        task: 'Comprehensive detailed analysis of complex contract terms',
      });

      // High complexity may combine if beneficial
      expect(result.confidence).toBeGreaterThan(0);
    });
  });
});
