/**
 * Training Pipeline Routes Tests
 * Story 3.2.6: AI Training Pipeline for Legacy Document Processing
 */

import request from 'supertest';
import express from 'express';
import trainingPipelineRoutes from './training-pipeline.routes';
import { trainingPipelineService } from '../services/training-pipeline.service';
import { semanticSearchService } from '../services/semantic-search.service';

// Mock dependencies
jest.mock('../services/training-pipeline.service', () => ({
  trainingPipelineService: {
    runPipeline: jest.fn(),
    getPipelineRunStatus: jest.fn(),
    getRecentRuns: jest.fn(),
  },
}));

jest.mock('../services/semantic-search.service', () => ({
  semanticSearchService: {
    search: jest.fn(),
    getCategoryPatterns: jest.fn(),
    getCategoryTemplates: jest.fn(),
  },
}));

jest.mock('../lib/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('Training Pipeline Routes', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/ai/training-pipeline', trainingPipelineRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/ai/training-pipeline/trigger', () => {
    it('should trigger pipeline with valid request', async () => {
      (trainingPipelineService.runPipeline as jest.Mock).mockResolvedValue({
        id: 'run-123',
        status: 'running',
      });
      (trainingPipelineService.getRecentRuns as jest.Mock).mockResolvedValue([
        { id: 'run-123', status: 'running' },
      ]);

      const response = await request(app)
        .post('/api/ai/training-pipeline/trigger')
        .send({
          categories: ['Contract', 'Agreement'],
          accessToken: 'test-token',
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('running');
      expect(response.body.message).toBe('Training pipeline started');
    });

    it('should return 400 if categories missing', async () => {
      const response = await request(app).post('/api/ai/training-pipeline/trigger').send({
        accessToken: 'test-token',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('categories array is required');
    });

    it('should return 400 if categories is not an array', async () => {
      const response = await request(app).post('/api/ai/training-pipeline/trigger').send({
        categories: 'Contract',
        accessToken: 'test-token',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('categories array is required');
    });

    it('should return 400 if categories is empty', async () => {
      const response = await request(app).post('/api/ai/training-pipeline/trigger').send({
        categories: [],
        accessToken: 'test-token',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('categories array is required');
    });

    it('should return 400 if accessToken missing', async () => {
      const response = await request(app)
        .post('/api/ai/training-pipeline/trigger')
        .send({
          categories: ['Contract'],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('accessToken is required');
    });

    it('should handle service errors', async () => {
      (trainingPipelineService.getRecentRuns as jest.Mock).mockRejectedValue(
        new Error('Service error')
      );

      const response = await request(app)
        .post('/api/ai/training-pipeline/trigger')
        .send({
          categories: ['Contract'],
          accessToken: 'test-token',
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to trigger training pipeline');
    });
  });

  describe('GET /api/ai/training-pipeline/runs/:runId', () => {
    it('should return pipeline run status', async () => {
      const mockRun = {
        id: 'run-123',
        status: 'completed',
        documentsProcessed: 10,
        patternsIdentified: 5,
      };

      (trainingPipelineService.getPipelineRunStatus as jest.Mock).mockResolvedValue(mockRun);

      const response = await request(app).get('/api/ai/training-pipeline/runs/run-123');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockRun);
    });

    it('should return 404 if run not found', async () => {
      (trainingPipelineService.getPipelineRunStatus as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get('/api/ai/training-pipeline/runs/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Pipeline run not found');
    });

    it('should handle service errors', async () => {
      (trainingPipelineService.getPipelineRunStatus as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app).get('/api/ai/training-pipeline/runs/run-123');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to get pipeline run status');
    });
  });

  describe('GET /api/ai/training-pipeline/runs', () => {
    it('should return recent pipeline runs', async () => {
      const mockRuns = [
        { id: 'run-1', status: 'completed' },
        { id: 'run-2', status: 'running' },
      ];

      (trainingPipelineService.getRecentRuns as jest.Mock).mockResolvedValue(mockRuns);

      const response = await request(app).get('/api/ai/training-pipeline/runs');

      expect(response.status).toBe(200);
      expect(response.body.runs).toEqual(mockRuns);
      expect(response.body.total).toBe(2);
    });

    it('should respect limit query parameter', async () => {
      (trainingPipelineService.getRecentRuns as jest.Mock).mockResolvedValue([]);

      await request(app).get('/api/ai/training-pipeline/runs?limit=5');

      expect(trainingPipelineService.getRecentRuns).toHaveBeenCalledWith(5);
    });

    it('should use default limit of 10', async () => {
      (trainingPipelineService.getRecentRuns as jest.Mock).mockResolvedValue([]);

      await request(app).get('/api/ai/training-pipeline/runs');

      expect(trainingPipelineService.getRecentRuns).toHaveBeenCalledWith(10);
    });
  });

  describe('POST /api/ai/training-pipeline/knowledge-base/search', () => {
    it('should perform semantic search', async () => {
      const mockResults = {
        results: [{ documentId: 'doc-1', chunkText: 'text', similarity: 0.9 }],
        totalResults: 1,
      };

      (semanticSearchService.search as jest.Mock).mockResolvedValue(mockResults);

      const response = await request(app)
        .post('/api/ai/training-pipeline/knowledge-base/search')
        .send({
          query: 'liability clause',
          category: 'Contract',
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResults);
    });

    it('should return 400 if query missing', async () => {
      const response = await request(app)
        .post('/api/ai/training-pipeline/knowledge-base/search')
        .send({
          category: 'Contract',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('query is required');
    });

    it('should use default limit of 5', async () => {
      (semanticSearchService.search as jest.Mock).mockResolvedValue({
        results: [],
        totalResults: 0,
      });

      await request(app).post('/api/ai/training-pipeline/knowledge-base/search').send({
        query: 'test',
      });

      expect(semanticSearchService.search).toHaveBeenCalledWith({
        query: 'test',
        category: undefined,
        limit: 5,
      });
    });

    it('should handle service errors', async () => {
      (semanticSearchService.search as jest.Mock).mockRejectedValue(new Error('Search error'));

      const response = await request(app)
        .post('/api/ai/training-pipeline/knowledge-base/search')
        .send({
          query: 'test',
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Semantic search failed');
    });
  });

  describe('GET /api/ai/training-pipeline/knowledge-base/patterns/:category', () => {
    it('should return patterns for category', async () => {
      const mockPatterns = [{ id: '1', patternText: 'hereby agrees', frequency: 10 }];

      (semanticSearchService.getCategoryPatterns as jest.Mock).mockResolvedValue(mockPatterns);

      const response = await request(app).get(
        '/api/ai/training-pipeline/knowledge-base/patterns/Contract'
      );

      expect(response.status).toBe(200);
      expect(response.body.category).toBe('Contract');
      expect(response.body.patterns).toEqual(mockPatterns);
    });

    it('should respect limit query parameter', async () => {
      (semanticSearchService.getCategoryPatterns as jest.Mock).mockResolvedValue([]);

      await request(app).get('/api/ai/training-pipeline/knowledge-base/patterns/Contract?limit=5');

      expect(semanticSearchService.getCategoryPatterns).toHaveBeenCalledWith('Contract', 5);
    });
  });

  describe('GET /api/ai/training-pipeline/knowledge-base/templates/:category', () => {
    it('should return templates for category', async () => {
      const mockTemplates = [{ id: '1', name: 'Standard Contract', qualityScore: 0.95 }];

      (semanticSearchService.getCategoryTemplates as jest.Mock).mockResolvedValue(mockTemplates);

      const response = await request(app).get(
        '/api/ai/training-pipeline/knowledge-base/templates/Contract'
      );

      expect(response.status).toBe(200);
      expect(response.body.category).toBe('Contract');
      expect(response.body.templates).toEqual(mockTemplates);
    });

    it('should respect limit query parameter', async () => {
      (semanticSearchService.getCategoryTemplates as jest.Mock).mockResolvedValue([]);

      await request(app).get('/api/ai/training-pipeline/knowledge-base/templates/Contract?limit=3');

      expect(semanticSearchService.getCategoryTemplates).toHaveBeenCalledWith('Contract', 3);
    });
  });
});
