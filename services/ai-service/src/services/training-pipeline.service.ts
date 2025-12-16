/**
 * Training Pipeline Service
 * Story 3.2.6: AI Training Pipeline for Legacy Document Processing
 *
 * Orchestrates the full training pipeline from discovery to template extraction
 */

import { prisma } from '@legal-platform/database';
import type {
  TrainingPipelineRun,
  PipelineRunType,
  DEFAULT_PIPELINE_CONFIG,
} from '@legal-platform/types';
import { documentDiscoveryService } from './document-discovery.service';
import { textExtractionService } from './text-extraction.service';
import { embeddingGenerationService } from './embedding-generation.service';
import { patternAnalysisService } from './pattern-analysis.service';
import { templateExtractionService } from './template-extraction.service';
import logger from '../lib/logger';

const BATCH_SIZE = 10;
const MAX_RETRIES = 3;

/**
 * Training Pipeline Service Class
 * Coordinates all pipeline stages
 */
export class TrainingPipelineService {
  /**
   * Run training pipeline
   * @param runType - Type of pipeline run (scheduled or manual)
   * @param accessToken - OneDrive access token
   * @param categories - Categories to process
   * @returns Pipeline run result
   */
  async runPipeline(
    runType: PipelineRunType,
    accessToken: string,
    categories: string[]
  ): Promise<TrainingPipelineRun> {
    // Create pipeline run record
    const run = await prisma.trainingPipelineRun.create({
      data: {
        runType,
        status: 'running',
        metadata: { categories },
      },
    });

    logger.info('Training pipeline started', {
      runId: run.id,
      runType,
      categories,
    });

    try {
      // Phase 1: Discovery
      const discovered = await documentDiscoveryService.discoverDocuments(accessToken, {
        categoryFolders: categories,
      });

      await prisma.trainingPipelineRun.update({
        where: { id: run.id },
        data: { documentsDiscovered: discovered.totalFound },
      });

      // Phase 2: Process documents in batches
      const batches = this.createBatches(discovered.newDocuments, BATCH_SIZE);
      let processedCount = 0;
      let failedCount = 0;
      let totalTokensUsed = 0;

      for (const batch of batches) {
        const results = await Promise.allSettled(
          batch.map((doc) => this.processDocumentWithRetry(accessToken, doc))
        );

        for (const result of results) {
          if (result.status === 'fulfilled') {
            processedCount++;
            totalTokensUsed += result.value.tokensUsed;
          } else {
            failedCount++;
          }
        }

        // Update progress
        await prisma.trainingPipelineRun.update({
          where: { id: run.id },
          data: {
            documentsProcessed: processedCount,
            documentsFailed: failedCount,
            totalTokensUsed,
          },
        });
      }

      // Phase 3: Pattern Analysis
      let totalPatterns = 0;
      for (const category of categories) {
        const patterns = await patternAnalysisService.identifyPatterns({
          category,
        });
        totalPatterns += patterns.totalPatternsFound;
      }

      // Phase 4: Template Extraction
      let totalTemplates = 0;
      for (const category of categories) {
        const templates = await templateExtractionService.extractTemplates({
          category,
        });
        totalTemplates += templates.totalTemplatesCreated;
      }

      // Complete run
      const completedRun = await prisma.trainingPipelineRun.update({
        where: { id: run.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          patternsIdentified: totalPatterns,
          templatesCreated: totalTemplates,
        },
      });

      logger.info('Training pipeline completed', {
        runId: run.id,
        documentsProcessed: processedCount,
        patternsIdentified: totalPatterns,
        templatesCreated: totalTemplates,
      });

      return completedRun as unknown as TrainingPipelineRun;
    } catch (error) {
      // Mark run as failed
      await prisma.trainingPipelineRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorLog: {
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date(),
          },
        },
      });

      logger.error('Training pipeline failed', {
        runId: run.id,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Process single document with retry logic
   * Retries up to MAX_RETRIES times on failure
   * @param accessToken - OneDrive access token
   * @param doc - Document metadata
   * @returns Processing result
   */
  private async processDocumentWithRetry(
    accessToken: string,
    doc: {
      oneDriveFileId: string;
      fileName: string;
      category: string;
      folderPath: string;
      metadata?: any;
    }
  ): Promise<{ tokensUsed: number }> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.processDocument(accessToken, doc);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        logger.warn('Document processing attempt failed, retrying', {
          fileName: doc.fileName,
          attempt,
          maxRetries: MAX_RETRIES,
          error: lastError.message,
        });

        if (attempt < MAX_RETRIES) {
          // Exponential backoff: 1s, 2s, 4s
          const backoffMs = Math.pow(2, attempt - 1) * 1000;
          await this.sleep(backoffMs);
        }
      }
    }

    // All retries exhausted
    logger.error('Document processing failed after all retries', {
      fileName: doc.fileName,
      totalAttempts: MAX_RETRIES,
      error: lastError?.message,
    });

    throw lastError;
  }

  /**
   * Sleep for specified milliseconds
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Process single document through extraction and embedding
   * @param accessToken - OneDrive access token
   * @param doc - Document metadata
   * @returns Processing result
   */
  private async processDocument(
    accessToken: string,
    doc: {
      oneDriveFileId: string;
      fileName: string;
      category: string;
      folderPath: string;
      metadata?: any;
    }
  ): Promise<{ tokensUsed: number }> {
    const startTime = Date.now();

    try {
      // Download file
      const fileBuffer = await documentDiscoveryService.downloadFile(
        accessToken,
        doc.oneDriveFileId
      );

      // Extract file type
      const fileExtension = doc.fileName.substring(doc.fileName.lastIndexOf('.') + 1).toLowerCase();

      // Extract text
      const extracted = await textExtractionService.extractText(
        {
          oneDriveFileId: doc.oneDriveFileId,
          fileName: doc.fileName,
          fileType: fileExtension as 'pdf' | 'docx' | 'doc',
        },
        fileBuffer
      );

      // Generate embeddings
      const embeddings = await embeddingGenerationService.generateEmbeddings({
        text: extracted.text,
      });

      // Store training document
      const trainingDoc = await prisma.trainingDocument.create({
        data: {
          category: doc.category,
          originalFilename: doc.fileName,
          originalFolderPath: doc.folderPath,
          oneDriveFileId: doc.oneDriveFileId,
          textContent: extracted.text,
          language: extracted.language,
          wordCount: extracted.wordCount,
          metadata: doc.metadata || {},
          processingDurationMs: Date.now() - startTime,
        },
      });

      // Store embeddings using raw SQL (required for pgvector type)
      for (const chunk of embeddings.chunks) {
        const embeddingStr = `[${chunk.embedding.join(',')}]`;
        await prisma.$executeRaw`
          INSERT INTO document_embeddings (id, document_id, chunk_index, chunk_text, embedding, token_count, created_at)
          VALUES (
            uuid_generate_v4(),
            ${trainingDoc.id}::uuid,
            ${chunk.index},
            ${chunk.text},
            ${embeddingStr}::vector,
            ${chunk.tokenCount},
            NOW()
          )
        `;
      }

      logger.info('Document processed successfully', {
        fileName: doc.fileName,
        category: doc.category,
        tokensUsed: embeddings.totalTokensUsed,
        processingTimeMs: Date.now() - startTime,
      });

      return { tokensUsed: embeddings.totalTokensUsed };
    } catch (error) {
      logger.error('Document processing failed', {
        fileName: doc.fileName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Create batches from array
   * @param items - Items to batch
   * @param batchSize - Size of each batch
   * @returns Array of batches
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Get pipeline run status
   * @param runId - Pipeline run ID
   * @returns Pipeline run
   */
  async getPipelineRunStatus(runId: string): Promise<TrainingPipelineRun | null> {
    const run = await prisma.trainingPipelineRun.findUnique({
      where: { id: runId },
    });
    return run as unknown as TrainingPipelineRun | null;
  }

  /**
   * Get recent pipeline runs
   * @param limit - Number of runs to return
   * @returns Array of pipeline runs
   */
  async getRecentRuns(limit: number = 10): Promise<TrainingPipelineRun[]> {
    const runs = await prisma.trainingPipelineRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
    return runs as unknown as TrainingPipelineRun[];
  }
}

export const trainingPipelineService = new TrainingPipelineService();
