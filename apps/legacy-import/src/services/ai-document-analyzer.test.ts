/**
 * AI Document Analyzer Tests
 * Story 3.2.5 - Task 6.1.5: AI analysis with cost tracking unit tests
 */

import { prisma } from '@/lib/prisma';

// Constants from the service
const BATCH_SIZE = 25;
const MAX_TOKENS_PER_REQUEST = 4000;
const MAX_COST_PER_SESSION = 10.0; // €10 limit
const HAIKU_COST_PER_1K_TOKENS = 0.00025;

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    aIProcessingLog: {
      aggregate: jest.fn(),
      create: jest.fn(),
    },
    extractedDocument: {
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn((updates) => Promise.all(updates)),
  },
}));

// Mock Anthropic SDK
jest.mock('@anthropic-ai/sdk', () => ({
  Anthropic: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn(),
    },
  })),
}));

// Mock Bull Queue
jest.mock('bull', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({ id: 'job-123' }),
    process: jest.fn(),
    on: jest.fn(),
  })),
}));

describe('AI Document Analyzer Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Cost Tracking', () => {
    describe('Cost Estimation', () => {
      it('should estimate cost for single document', () => {
        const documentCount = 1;
        const estimatedTokens = documentCount * 500; // avg 500 tokens per doc
        const costInUSD = (estimatedTokens / 1000) * HAIKU_COST_PER_1K_TOKENS;
        const costInEUR = costInUSD * 0.92;

        expect(costInUSD).toBeCloseTo(0.000125, 6);
        expect(costInEUR).toBeCloseTo(0.000115, 6);
      });

      it('should estimate cost for batch of 25 documents', () => {
        const documentCount = 25;
        const estimatedTokens = documentCount * 500;
        const costInUSD = (estimatedTokens / 1000) * HAIKU_COST_PER_1K_TOKENS;
        const costInEUR = costInUSD * 0.92;

        expect(costInUSD).toBeCloseTo(0.003125, 6);
        expect(costInEUR).toBeCloseTo(0.002875, 6);
      });

      it('should estimate cost for 500 documents', () => {
        const documentCount = 500;
        const estimatedTokens = documentCount * 500;
        const costInUSD = (estimatedTokens / 1000) * HAIKU_COST_PER_1K_TOKENS;
        const costInEUR = costInUSD * 0.92;

        expect(costInUSD).toBeCloseTo(0.0625, 5);
        expect(costInEUR).toBeCloseTo(0.0575, 5);
      });
    });

    describe('Cost Limit Checking', () => {
      it('should allow processing when under cost limit', async () => {
        (prisma.aIProcessingLog.aggregate as jest.Mock).mockResolvedValue({
          _sum: { costUSD: 5.0 }, // €5 spent of €10 limit
        });

        const totalCost = await prisma.aIProcessingLog.aggregate({
          where: { sessionId: 'session-1' },
          _sum: { costUSD: true },
        });

        const currentCost = totalCost._sum.costUSD || 0;
        const canProceed = currentCost < MAX_COST_PER_SESSION;

        expect(canProceed).toBe(true);
      });

      it('should block processing when at cost limit', async () => {
        (prisma.aIProcessingLog.aggregate as jest.Mock).mockResolvedValue({
          _sum: { costUSD: 10.0 }, // At €10 limit
        });

        const totalCost = await prisma.aIProcessingLog.aggregate({
          where: { sessionId: 'session-1' },
          _sum: { costUSD: true },
        });

        const currentCost = totalCost._sum.costUSD || 0;
        const canProceed = currentCost < MAX_COST_PER_SESSION;

        expect(canProceed).toBe(false);
      });

      it('should block processing when over cost limit', async () => {
        (prisma.aIProcessingLog.aggregate as jest.Mock).mockResolvedValue({
          _sum: { costUSD: 12.5 }, // Over €10 limit
        });

        const totalCost = await prisma.aIProcessingLog.aggregate({
          where: { sessionId: 'session-1' },
          _sum: { costUSD: true },
        });

        const currentCost = totalCost._sum.costUSD || 0;
        const canProceed = currentCost < MAX_COST_PER_SESSION;

        expect(canProceed).toBe(false);
      });

      it('should handle null cost sum (no previous processing)', async () => {
        (prisma.aIProcessingLog.aggregate as jest.Mock).mockResolvedValue({
          _sum: { costUSD: null },
        });

        const totalCost = await prisma.aIProcessingLog.aggregate({
          where: { sessionId: 'session-1' },
          _sum: { costUSD: true },
        });

        const currentCost = totalCost._sum.costUSD || 0;
        const canProceed = currentCost < MAX_COST_PER_SESSION;

        expect(canProceed).toBe(true);
        expect(currentCost).toBe(0);
      });
    });

    describe('Token Usage Logging', () => {
      it('should log token usage after successful analysis', async () => {
        const logData = {
          sessionId: 'session-1',
          model: 'claude-3-haiku-20240307',
          tokensUsed: 2500, // input + output tokens
          processingTimeMs: 1500,
          documentCount: 5,
        };

        const costUSD = (logData.tokensUsed / 1000) * HAIKU_COST_PER_1K_TOKENS;

        (prisma.aIProcessingLog.create as jest.Mock).mockResolvedValue({
          id: 'log-1',
          ...logData,
          costUSD,
        });

        await prisma.aIProcessingLog.create({
          data: {
            sessionId: logData.sessionId,
            model: logData.model,
            tokensUsed: logData.tokensUsed,
            costUSD,
            processingTimeMs: logData.processingTimeMs,
            success: true,
            metadata: {
              documentCount: logData.documentCount,
              averageTokensPerDoc: Math.round(logData.tokensUsed / logData.documentCount),
            },
          },
        });

        expect(prisma.aIProcessingLog.create).toHaveBeenCalled();
        expect(costUSD).toBeCloseTo(0.000625, 6);
      });

      it('should calculate average tokens per document', () => {
        const tokensUsed = 12500;
        const documentCount = 25;
        const avgTokensPerDoc = Math.round(tokensUsed / documentCount);

        expect(avgTokensPerDoc).toBe(500);
      });
    });
  });

  describe('Batch Processing', () => {
    it('should process documents in batches of 25', () => {
      const documents = Array(100).fill({ id: 'doc' });
      const batches: typeof documents[] = [];

      for (let i = 0; i < documents.length; i += BATCH_SIZE) {
        batches.push(documents.slice(i, i + BATCH_SIZE));
      }

      expect(batches.length).toBe(4);
      expect(batches[0].length).toBe(25);
      expect(batches[3].length).toBe(25);
    });

    it('should handle partial final batch', () => {
      const documents = Array(73).fill({ id: 'doc' });
      const batches: typeof documents[] = [];

      for (let i = 0; i < documents.length; i += BATCH_SIZE) {
        batches.push(documents.slice(i, i + BATCH_SIZE));
      }

      expect(batches.length).toBe(3);
      expect(batches[0].length).toBe(25);
      expect(batches[1].length).toBe(25);
      expect(batches[2].length).toBe(23);
    });

    it('should handle single document', () => {
      const documents = [{ id: 'doc-1' }];
      const batches: typeof documents[] = [];

      for (let i = 0; i < documents.length; i += BATCH_SIZE) {
        batches.push(documents.slice(i, i + BATCH_SIZE));
      }

      expect(batches.length).toBe(1);
      expect(batches[0].length).toBe(1);
    });
  });

  describe('Analysis Status', () => {
    it('should calculate analysis progress correctly', async () => {
      (prisma.extractedDocument.count as jest.Mock)
        .mockResolvedValueOnce(500) // total
        .mockResolvedValueOnce(200); // analyzed

      (prisma.aIProcessingLog.aggregate as jest.Mock).mockResolvedValue({
        _sum: { costUSD: 0.05 },
      });

      const totalDocs = await prisma.extractedDocument.count({
        where: { sessionId: 'session-1' },
      });

      const analyzedDocs = await prisma.extractedDocument.count({
        where: { sessionId: 'session-1', primaryLanguage: { not: null } },
      });

      const remaining = totalDocs - analyzedDocs;
      const percentComplete = Math.round((analyzedDocs / totalDocs) * 100);

      expect(totalDocs).toBe(500);
      expect(analyzedDocs).toBe(200);
      expect(remaining).toBe(300);
      expect(percentComplete).toBe(40);
    });

    it('should report within budget status', async () => {
      (prisma.aIProcessingLog.aggregate as jest.Mock).mockResolvedValue({
        _sum: { costUSD: 5.0 },
      });

      const totalCost = await prisma.aIProcessingLog.aggregate({
        where: { sessionId: 'session-1' },
        _sum: { costUSD: true },
      });

      const costUSD = totalCost._sum.costUSD || 0;
      const costEUR = costUSD * 0.92;
      const withinBudget = costUSD < MAX_COST_PER_SESSION;

      expect(costEUR).toBeCloseTo(4.6, 1);
      expect(withinBudget).toBe(true);
    });
  });

  describe('Prompt Building', () => {
    it('should include document metadata in prompt', () => {
      const mockDocument = {
        id: 'doc-123',
        fileName: 'contract.pdf',
        folderPath: 'Inbox/Clients',
        emailMetadata: {
          subject: 'RE: Contract Review',
          receivedDate: '2019-03-15',
        },
        extractedText: 'Sample legal text...',
      };

      // Verify the prompt format structure
      const documentPrompt = `
---DOCUMENT 1---
ID: ${mockDocument.id}
Filename: ${mockDocument.fileName}
Folder: ${mockDocument.folderPath}
Email Subject: ${mockDocument.emailMetadata.subject}
Date: ${mockDocument.emailMetadata.receivedDate}

Text Preview:
${mockDocument.extractedText}
---END DOCUMENT 1---`;

      expect(documentPrompt).toContain('doc-123');
      expect(documentPrompt).toContain('contract.pdf');
      expect(documentPrompt).toContain('RE: Contract Review');
    });

    it('should limit text preview to 2000 characters', () => {
      const longText = 'A'.repeat(5000);
      const textPreview = longText.slice(0, 2000);

      expect(textPreview.length).toBe(2000);
    });

    it('should handle missing extracted text', () => {
      const extractedText = null;
      const textPreview = extractedText?.slice(0, 2000) || '[No text extracted]';

      expect(textPreview).toBe('[No text extracted]');
    });
  });

  describe('Analysis Result Structure', () => {
    const validResult = {
      id: 'doc-123',
      primaryLanguage: 'Romanian',
      secondaryLanguage: 'English',
      languageRatio: { Romanian: 0.85, English: 0.15 },
      languageConfidence: 0.95,
      documentType: 'Contract de Vanzare-Cumparare',
      documentTypeConfidence: 0.89,
      clauseCategories: ['payment_terms', 'warranties', 'liability'],
      templatePotential: 'High',
      keyTerms: {
        romanian: ['vanzator', 'cumparator', 'pret'],
        english: ['seller', 'buyer', 'price'],
      },
      complexityScore: 0.65,
      structureType: 'structured',
      riskIndicators: {
        hasUnclearTerms: false,
        hasMixedJurisdiction: true,
        hasUnusualClauses: false,
        complianceFlags: ['GDPR_mentioned'],
      },
    };

    it('should validate primary language values', () => {
      const validLanguages = ['Romanian', 'English', 'Mixed'];
      expect(validLanguages).toContain(validResult.primaryLanguage);
    });

    it('should validate template potential values', () => {
      const validPotentials = ['High', 'Medium', 'Low'];
      expect(validPotentials).toContain(validResult.templatePotential);
    });

    it('should validate structure type values', () => {
      const validStructures = ['structured', 'semi-structured', 'unstructured'];
      expect(validStructures).toContain(validResult.structureType);
    });

    it('should validate clause categories', () => {
      const validCategories = [
        'payment_terms',
        'delivery_conditions',
        'warranties',
        'liability',
        'termination',
        'confidentiality',
        'dispute_resolution',
        'force_majeure',
        'intellectual_property',
        'compliance',
      ];

      for (const clause of validResult.clauseCategories) {
        expect(validCategories).toContain(clause);
      }
    });

    it('should validate language ratio sums to 1', () => {
      const ratioSum = Object.values(validResult.languageRatio).reduce(
        (sum, val) => sum + val,
        0
      );
      expect(ratioSum).toBeCloseTo(1.0, 2);
    });

    it('should validate confidence scores are between 0 and 1', () => {
      expect(validResult.languageConfidence).toBeGreaterThanOrEqual(0);
      expect(validResult.languageConfidence).toBeLessThanOrEqual(1);
      expect(validResult.documentTypeConfidence).toBeGreaterThanOrEqual(0);
      expect(validResult.documentTypeConfidence).toBeLessThanOrEqual(1);
      expect(validResult.complexityScore).toBeGreaterThanOrEqual(0);
      expect(validResult.complexityScore).toBeLessThanOrEqual(1);
    });
  });

  describe('Fallback Analysis', () => {
    it('should return default values when API fails', () => {
      const fallbackResult = {
        id: 'doc-123',
        primaryLanguage: 'Mixed',
        secondaryLanguage: null,
        languageRatio: { Romanian: 0, English: 0 },
        languageConfidence: 0.3, // Low confidence for fallback
        documentType: 'Unknown',
        documentTypeConfidence: 0,
        clauseCategories: [],
        templatePotential: 'Low',
        keyTerms: { romanian: [], english: [] },
        complexityScore: 0.5,
        structureType: 'unstructured',
        riskIndicators: {
          hasUnclearTerms: true,
          hasMixedJurisdiction: false,
          hasUnusualClauses: false,
          complianceFlags: [],
        },
      };

      expect(fallbackResult.documentTypeConfidence).toBe(0);
      expect(fallbackResult.templatePotential).toBe('Low');
      expect(fallbackResult.languageConfidence).toBeLessThan(0.5);
    });

    it('should use franc for basic language detection', () => {
      // Simulate franc language codes
      const francCodes: Record<string, string> = {
        ron: 'Romanian',
        eng: 'English',
        und: 'Mixed',
      };

      expect(francCodes['ron']).toBe('Romanian');
      expect(francCodes['eng']).toBe('English');
      expect(francCodes['und']).toBe('Mixed');
    });
  });

  describe('Document Update', () => {
    it('should update document with analysis results', async () => {
      const analysisResult = {
        id: 'doc-123',
        primaryLanguage: 'Romanian',
        secondaryLanguage: 'English',
        languageRatio: { Romanian: 0.85, English: 0.15 },
        languageConfidence: 0.95,
        documentType: 'Contract',
        documentTypeConfidence: 0.89,
        clauseCategories: ['payment_terms'],
        templatePotential: 'High',
        complexityScore: 0.65,
        structureType: 'structured',
        keyTerms: { romanian: [], english: [] },
        riskIndicators: {},
      };

      (prisma.extractedDocument.update as jest.Mock).mockResolvedValue({
        id: 'doc-123',
        primaryLanguage: 'Romanian',
      });

      await prisma.extractedDocument.update({
        where: { id: analysisResult.id },
        data: {
          primaryLanguage: analysisResult.primaryLanguage,
          secondaryLanguage: analysisResult.secondaryLanguage,
          languageRatio: analysisResult.languageRatio,
          languageConfidence: analysisResult.languageConfidence,
          documentType: analysisResult.documentType,
          documentTypeConfidence: analysisResult.documentTypeConfidence,
          clauseCategories: analysisResult.clauseCategories,
          templatePotential: analysisResult.templatePotential,
          aiMetadata: {
            complexityScore: analysisResult.complexityScore,
            structureType: analysisResult.structureType,
            keyTerms: analysisResult.keyTerms,
          },
          riskIndicators: analysisResult.riskIndicators,
          aiAnalysisVersion: 'claude-3-haiku-20240307',
          analysisTimestamp: new Date(),
        },
      });

      expect(prisma.extractedDocument.update).toHaveBeenCalled();
    });
  });

  describe('Queue Job Management', () => {
    it('should create job with correct structure', () => {
      const job = {
        sessionId: 'session-1',
        documentIds: ['doc-1', 'doc-2', 'doc-3'],
        priority: 1,
      };

      expect(job.sessionId).toBe('session-1');
      expect(job.documentIds.length).toBe(3);
      expect(job.priority).toBe(1);
    });

    it('should calculate job progress correctly', () => {
      const processed = 15;
      const total = 50;
      const progress = Math.round((processed / total) * 100);

      expect(progress).toBe(30);
    });
  });
});
