/**
 * Training Pipeline Service Tests
 * Story 3.2.6: AI Training Pipeline for Legacy Document Processing
 */

import { TrainingPipelineService } from './training-pipeline.service';
import { prisma } from '@legal-platform/database';
import { documentDiscoveryService } from './document-discovery.service';
import { textExtractionService } from './text-extraction.service';
import { embeddingGenerationService } from './embedding-generation.service';
import { patternAnalysisService } from './pattern-analysis.service';
import { templateExtractionService } from './template-extraction.service';

// Mock all dependencies
jest.mock('@legal-platform/database', () => ({
  prisma: {
    trainingPipelineRun: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    trainingDocument: {
      create: jest.fn(),
    },
    documentEmbedding: {
      create: jest.fn(),
    },
  },
}));

jest.mock('./document-discovery.service', () => ({
  documentDiscoveryService: {
    discoverDocuments: jest.fn(),
    downloadFile: jest.fn(),
  },
}));

jest.mock('./text-extraction.service', () => ({
  textExtractionService: {
    extractText: jest.fn(),
  },
}));

jest.mock('./embedding-generation.service', () => ({
  embeddingGenerationService: {
    generateEmbeddings: jest.fn(),
  },
}));

jest.mock('./pattern-analysis.service', () => ({
  patternAnalysisService: {
    identifyPatterns: jest.fn(),
  },
}));

jest.mock('./template-extraction.service', () => ({
  templateExtractionService: {
    extractTemplates: jest.fn(),
  },
}));

jest.mock('../lib/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('TrainingPipelineService', () => {
  let service: TrainingPipelineService;

  beforeEach(() => {
    service = new TrainingPipelineService();
    jest.clearAllMocks();
  });

  describe('runPipeline', () => {
    const mockAccessToken = 'test-access-token';
    const mockCategories = ['Contract', 'Agreement'];
    const mockRunId = 'run-123';

    beforeEach(() => {
      (prisma.trainingPipelineRun.create as jest.Mock).mockResolvedValue({
        id: mockRunId,
        runType: 'manual',
        status: 'running',
      });

      (prisma.trainingPipelineRun.update as jest.Mock).mockResolvedValue({
        id: mockRunId,
        status: 'completed',
      });

      (documentDiscoveryService.discoverDocuments as jest.Mock).mockResolvedValue({
        newDocuments: [],
        totalFound: 0,
      });

      (patternAnalysisService.identifyPatterns as jest.Mock).mockResolvedValue({
        patterns: [],
        totalPatternsFound: 0,
      });

      (templateExtractionService.extractTemplates as jest.Mock).mockResolvedValue({
        templates: [],
        totalTemplatesCreated: 0,
      });
    });

    it('should create a pipeline run record', async () => {
      await service.runPipeline('manual', mockAccessToken, mockCategories);

      expect(prisma.trainingPipelineRun.create).toHaveBeenCalledWith({
        data: {
          runType: 'manual',
          status: 'running',
          metadata: { categories: mockCategories },
        },
      });
    });

    it('should process discovered documents in batches', async () => {
      const mockDocuments = [
        {
          oneDriveFileId: 'file-1',
          fileName: 'doc1.pdf',
          category: 'Contract',
          folderPath: '/path',
        },
        {
          oneDriveFileId: 'file-2',
          fileName: 'doc2.pdf',
          category: 'Contract',
          folderPath: '/path',
        },
      ];

      (documentDiscoveryService.discoverDocuments as jest.Mock).mockResolvedValue({
        newDocuments: mockDocuments,
        totalFound: 2,
      });

      (documentDiscoveryService.downloadFile as jest.Mock).mockResolvedValue(
        Buffer.from('test content')
      );

      (textExtractionService.extractText as jest.Mock).mockResolvedValue({
        text: 'extracted text',
        language: 'en',
        wordCount: 2,
      });

      (embeddingGenerationService.generateEmbeddings as jest.Mock).mockResolvedValue({
        chunks: [{ index: 0, text: 'chunk', embedding: [], tokenCount: 10 }],
        totalTokensUsed: 10,
      });

      (prisma.trainingDocument.create as jest.Mock).mockResolvedValue({
        id: 'doc-id',
      });

      await service.runPipeline('manual', mockAccessToken, mockCategories);

      expect(prisma.trainingPipelineRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockRunId },
          data: expect.objectContaining({
            documentsDiscovered: 2,
          }),
        })
      );
    });

    it('should handle document processing failures gracefully', async () => {
      const mockDocuments = [
        {
          oneDriveFileId: 'file-1',
          fileName: 'doc1.pdf',
          category: 'Contract',
          folderPath: '/path',
        },
      ];

      (documentDiscoveryService.discoverDocuments as jest.Mock).mockResolvedValue({
        newDocuments: mockDocuments,
        totalFound: 1,
      });

      (documentDiscoveryService.downloadFile as jest.Mock).mockRejectedValue(
        new Error('Download failed')
      );

      await service.runPipeline('manual', mockAccessToken, mockCategories);

      // Pipeline should still complete even if individual docs fail
      expect(prisma.trainingPipelineRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'completed',
          }),
        })
      );
    });

    it('should run pattern analysis for each category', async () => {
      await service.runPipeline('manual', mockAccessToken, mockCategories);

      expect(patternAnalysisService.identifyPatterns).toHaveBeenCalledTimes(2);
      expect(patternAnalysisService.identifyPatterns).toHaveBeenCalledWith({
        category: 'Contract',
      });
      expect(patternAnalysisService.identifyPatterns).toHaveBeenCalledWith({
        category: 'Agreement',
      });
    });

    it('should run template extraction for each category', async () => {
      await service.runPipeline('manual', mockAccessToken, mockCategories);

      expect(templateExtractionService.extractTemplates).toHaveBeenCalledTimes(2);
      expect(templateExtractionService.extractTemplates).toHaveBeenCalledWith({
        category: 'Contract',
      });
      expect(templateExtractionService.extractTemplates).toHaveBeenCalledWith({
        category: 'Agreement',
      });
    });

    it('should mark run as failed on critical error', async () => {
      (documentDiscoveryService.discoverDocuments as jest.Mock).mockRejectedValue(
        new Error('Critical failure')
      );

      await expect(service.runPipeline('manual', mockAccessToken, mockCategories)).rejects.toThrow(
        'Critical failure'
      );

      expect(prisma.trainingPipelineRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'failed',
            errorLog: expect.any(Object),
          }),
        })
      );
    });

    it('should track total tokens used', async () => {
      const mockDocuments = [
        {
          oneDriveFileId: 'file-1',
          fileName: 'doc1.pdf',
          category: 'Contract',
          folderPath: '/path',
        },
      ];

      (documentDiscoveryService.discoverDocuments as jest.Mock).mockResolvedValue({
        newDocuments: mockDocuments,
        totalFound: 1,
      });

      (documentDiscoveryService.downloadFile as jest.Mock).mockResolvedValue(Buffer.from('test'));

      (textExtractionService.extractText as jest.Mock).mockResolvedValue({
        text: 'text',
        language: 'en',
        wordCount: 1,
      });

      (embeddingGenerationService.generateEmbeddings as jest.Mock).mockResolvedValue({
        chunks: [],
        totalTokensUsed: 150,
      });

      (prisma.trainingDocument.create as jest.Mock).mockResolvedValue({ id: 'doc' });

      await service.runPipeline('manual', mockAccessToken, mockCategories);

      expect(prisma.trainingPipelineRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            totalTokensUsed: 150,
          }),
        })
      );
    });
  });

  describe('getPipelineRunStatus', () => {
    it('should return pipeline run by ID', async () => {
      const mockRun = {
        id: 'run-123',
        status: 'completed',
        documentsProcessed: 10,
      };

      (prisma.trainingPipelineRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result = await service.getPipelineRunStatus('run-123');

      expect(result).toEqual(mockRun);
      expect(prisma.trainingPipelineRun.findUnique).toHaveBeenCalledWith({
        where: { id: 'run-123' },
      });
    });

    it('should return null for non-existent run', async () => {
      (prisma.trainingPipelineRun.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getPipelineRunStatus('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getRecentRuns', () => {
    it('should return recent pipeline runs', async () => {
      const mockRuns = [
        { id: 'run-1', status: 'completed', startedAt: new Date() },
        { id: 'run-2', status: 'running', startedAt: new Date() },
      ];

      (prisma.trainingPipelineRun.findMany as jest.Mock).mockResolvedValue(mockRuns);

      const result = await service.getRecentRuns();

      expect(result).toHaveLength(2);
      expect(prisma.trainingPipelineRun.findMany).toHaveBeenCalledWith({
        orderBy: { startedAt: 'desc' },
        take: 10,
      });
    });

    it('should respect custom limit', async () => {
      (prisma.trainingPipelineRun.findMany as jest.Mock).mockResolvedValue([]);

      await service.getRecentRuns(5);

      expect(prisma.trainingPipelineRun.findMany).toHaveBeenCalledWith({
        orderBy: { startedAt: 'desc' },
        take: 5,
      });
    });
  });

  describe('retry logic', () => {
    it('should retry failed document processing up to 3 times', async () => {
      const mockDocuments = [
        {
          oneDriveFileId: 'file-1',
          fileName: 'doc1.pdf',
          category: 'Contract',
          folderPath: '/path',
        },
      ];

      (documentDiscoveryService.discoverDocuments as jest.Mock).mockResolvedValue({
        newDocuments: mockDocuments,
        totalFound: 1,
      });

      let attempts = 0;
      (documentDiscoveryService.downloadFile as jest.Mock).mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('Transient error'));
        }
        return Promise.resolve(Buffer.from('content'));
      });

      (textExtractionService.extractText as jest.Mock).mockResolvedValue({
        text: 'text',
        language: 'en',
        wordCount: 1,
      });

      (embeddingGenerationService.generateEmbeddings as jest.Mock).mockResolvedValue({
        chunks: [],
        totalTokensUsed: 10,
      });

      (prisma.trainingDocument.create as jest.Mock).mockResolvedValue({ id: 'doc' });

      await service.runPipeline('manual', 'token', ['Contract']);

      expect(attempts).toBe(3);
    });
  });
});
