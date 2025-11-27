/**
 * Training Pipeline Routes
 * Story 3.2.6: AI Training Pipeline for Legacy Document Processing
 *
 * API endpoints for managing training pipeline
 */

import { Router, Request, Response } from 'express';
import { trainingPipelineService } from '../services/training-pipeline.service';
import { semanticSearchService } from '../services/semantic-search.service';
import logger from '../lib/logger';

const router = Router();

/**
 * POST /api/ai/training-pipeline/trigger
 * Manually trigger training pipeline
 */
router.post('/trigger', async (req: Request, res: Response) => {
  try {
    const { categories, accessToken } = req.body;

    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({
        error: 'categories array is required',
      });
    }

    if (!accessToken) {
      return res.status(400).json({
        error: 'accessToken is required',
      });
    }

    logger.info('Manual pipeline trigger requested', { categories });

    // Start pipeline asynchronously
    trainingPipelineService
      .runPipeline('manual', accessToken, categories)
      .catch((error) => {
        logger.error('Pipeline execution failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });

    // Return immediately with run ID
    const recentRuns = await trainingPipelineService.getRecentRuns(1);
    const latestRun = recentRuns[0];

    res.json({
      runId: latestRun?.id,
      status: 'running',
      message: 'Training pipeline started',
    });
  } catch (error) {
    logger.error('Failed to trigger pipeline', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      error: 'Failed to trigger training pipeline',
    });
  }
});

/**
 * GET /api/ai/training-pipeline/runs/:runId
 * Get pipeline run status
 */
router.get('/runs/:runId', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;

    const run = await trainingPipelineService.getPipelineRunStatus(runId);

    if (!run) {
      return res.status(404).json({
        error: 'Pipeline run not found',
      });
    }

    res.json(run);
  } catch (error) {
    logger.error('Failed to get pipeline run status', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      error: 'Failed to get pipeline run status',
    });
  }
});

/**
 * GET /api/ai/training-pipeline/runs
 * Get recent pipeline runs
 */
router.get('/runs', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const runs = await trainingPipelineService.getRecentRuns(limit);

    res.json({
      runs,
      total: runs.length,
    });
  } catch (error) {
    logger.error('Failed to get pipeline runs', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      error: 'Failed to get pipeline runs',
    });
  }
});

/**
 * POST /api/ai/knowledge-base/search
 * Semantic search in training documents
 */
router.post('/knowledge-base/search', async (req: Request, res: Response) => {
  try {
    const { query, category, limit } = req.body;

    if (!query) {
      return res.status(400).json({
        error: 'query is required',
      });
    }

    const results = await semanticSearchService.search({
      query,
      category,
      limit: limit || 5,
    });

    res.json(results);
  } catch (error) {
    logger.error('Semantic search failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      error: 'Semantic search failed',
    });
  }
});

/**
 * GET /api/ai/knowledge-base/patterns/:category
 * Get patterns for a category
 */
router.get('/knowledge-base/patterns/:category', async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    const patterns = await semanticSearchService.getCategoryPatterns(category, limit);

    res.json({
      category,
      patterns,
      total: patterns.length,
    });
  } catch (error) {
    logger.error('Failed to get category patterns', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      error: 'Failed to get category patterns',
    });
  }
});

/**
 * GET /api/ai/knowledge-base/templates/:category
 * Get templates for a category
 */
router.get('/knowledge-base/templates/:category', async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const limit = parseInt(req.query.limit as string) || 5;

    const templates = await semanticSearchService.getCategoryTemplates(category, limit);

    res.json({
      category,
      templates,
      total: templates.length,
    });
  } catch (error) {
    logger.error('Failed to get category templates', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      error: 'Failed to get category templates',
    });
  }
});

/**
 * POST /api/ai/knowledge-base/fulltext-search
 * Full-text search using PostgreSQL tsvector
 */
router.post('/knowledge-base/fulltext-search', async (req: Request, res: Response) => {
  try {
    const { query, category, limit } = req.body;

    if (!query) {
      return res.status(400).json({
        error: 'query is required',
      });
    }

    const results = await semanticSearchService.fullTextSearch(
      query,
      category,
      limit || 10
    );

    res.json({
      results,
      total: results.length,
    });
  } catch (error) {
    logger.error('Full-text search failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      error: 'Full-text search failed',
    });
  }
});

/**
 * POST /api/ai/knowledge-base/hybrid-search
 * Hybrid search combining semantic and full-text search
 */
router.post('/knowledge-base/hybrid-search', async (req: Request, res: Response) => {
  try {
    const { query, category, limit, semanticWeight } = req.body;

    if (!query) {
      return res.status(400).json({
        error: 'query is required',
      });
    }

    const results = await semanticSearchService.hybridSearch(
      query,
      category,
      limit || 10,
      semanticWeight ?? 0.7
    );

    res.json({
      results,
      total: results.length,
    });
  } catch (error) {
    logger.error('Hybrid search failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      error: 'Hybrid search failed',
    });
  }
});

export default router;
