/**
 * Cron Scheduler for Training Pipeline
 * Story 3.2.6: AI Training Pipeline for Legacy Document Processing
 *
 * Schedules automated daily runs of the training pipeline
 */

import * as cron from 'node-cron';
import { trainingPipelineService } from '../services/training-pipeline.service';
import logger from './logger';

const DEFAULT_CATEGORIES = [
  'Contract',
  'Notificare Avocateasca',
  'Intampinare',
  'Cerere',
  'Hotarare',
];

/**
 * Setup cron scheduler for training pipeline
 * Runs daily at 2 AM
 */
export function setupCronScheduler(): void {
  const schedule = process.env.TRAINING_PIPELINE_SCHEDULE || '0 2 * * *'; // Daily at 2 AM
  const accessToken = process.env.ONEDRIVE_SERVICE_ACCESS_TOKEN || '';

  if (!accessToken) {
    logger.warn('OneDrive service access token not configured, cron scheduler disabled');
    return;
  }

  const task = cron.schedule(schedule, async () => {
    logger.info('Scheduled training pipeline run starting');

    try {
      const result = await trainingPipelineService.runPipeline(
        'scheduled',
        accessToken,
        DEFAULT_CATEGORIES
      );

      logger.info('Scheduled training pipeline run completed', {
        runId: result.id,
        documentsProcessed: result.documentsProcessed,
        patternsIdentified: result.patternsIdentified,
        templatesCreated: result.templatesCreated,
      });
    } catch (error) {
      logger.error('Scheduled training pipeline run failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  logger.info('Training pipeline cron scheduler initialized', {
    schedule,
    categories: DEFAULT_CATEGORIES,
  });

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('Stopping cron scheduler');
    task.stop();
  });
}
