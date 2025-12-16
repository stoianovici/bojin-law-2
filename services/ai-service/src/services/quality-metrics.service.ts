/**
 * Quality Metrics Service
 * Story 3.3: Intelligent Document Drafting
 *
 * Tracks document changes from initial AI draft to final version
 * Calculates edit percentage and aggregates metrics for quality monitoring
 */

import { prisma } from '@legal-platform/database';
import { Prisma } from '@prisma/client';
import {
  DocumentDraftMetrics,
  QualityMetricsInput,
  QualityMetricsSummary,
  DocumentTypeMetrics,
  DocumentType,
} from '@legal-platform/types';
import logger from '../lib/logger';

// Quality threshold - alert if exceeded
const QUALITY_THRESHOLD_PERCENT = parseInt(process.env.AI_QUALITY_THRESHOLD_PERCENT || '30', 10);

export class QualityMetricsService {
  /**
   * Record metrics for a document draft
   */
  async recordDraftMetrics(
    input: QualityMetricsInput & {
      firmId: string;
      userId: string;
      documentType: DocumentType;
      generationTimeMs?: number;
      tokensUsed?: number;
      modelUsed?: string;
      templateId?: string;
      precedentIds?: string[];
    }
  ): Promise<DocumentDraftMetrics> {
    const startTime = Date.now();

    try {
      // Calculate metrics
      const metrics = this.calculateMetrics(input.initialContent, input.finalContent);

      // Calculate time to finalize
      const timeToFinalizeMinutes =
        input.endTime && input.startTime
          ? Math.round((input.endTime.getTime() - input.startTime.getTime()) / 60000)
          : null;

      // Create metrics record
      const record = await prisma.documentDraftMetrics.create({
        data: {
          documentId: input.documentId,
          firmId: input.firmId,
          userId: input.userId,
          documentType: input.documentType,
          initialWordCount: metrics.initialWordCount,
          finalWordCount: metrics.finalWordCount,
          charactersAdded: metrics.charactersAdded,
          charactersRemoved: metrics.charactersRemoved,
          editPercentage: new Prisma.Decimal(metrics.editPercentage),
          timeToFinalizeMinutes,
          userRating: input.userRating,
          generationTimeMs: input.generationTimeMs,
          tokensUsed: input.tokensUsed,
          modelUsed: input.modelUsed,
          templateId: input.templateId,
          precedentIds: input.precedentIds || [],
          finalizedAt: input.endTime || new Date(),
        },
      });

      // Check if quality threshold exceeded
      if (metrics.editPercentage > QUALITY_THRESHOLD_PERCENT) {
        logger.warn('Document edit percentage exceeds threshold', {
          documentId: input.documentId,
          editPercentage: metrics.editPercentage,
          threshold: QUALITY_THRESHOLD_PERCENT,
          documentType: input.documentType,
        });

        // Emit alert event (could be used by monitoring system)
        this.emitQualityAlert({
          documentId: input.documentId,
          editPercentage: metrics.editPercentage,
          threshold: QUALITY_THRESHOLD_PERCENT,
          documentType: input.documentType,
          firmId: input.firmId,
        });
      }

      logger.info('Document draft metrics recorded', {
        documentId: input.documentId,
        editPercentage: metrics.editPercentage,
        timeToFinalize: timeToFinalizeMinutes,
        durationMs: Date.now() - startTime,
      });

      return this.mapToMetrics(record);
    } catch (error) {
      logger.error('Failed to record draft metrics', {
        documentId: input.documentId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Calculate edit metrics from initial and final content
   */
  private calculateMetrics(
    initialContent: string,
    finalContent: string
  ): {
    initialWordCount: number;
    finalWordCount: number;
    charactersAdded: number;
    charactersRemoved: number;
    editPercentage: number;
  } {
    const initialWordCount = this.countWords(initialContent);
    const finalWordCount = this.countWords(finalContent);

    // Calculate character changes using simple diff
    const { added, removed } = this.calculateCharacterChanges(initialContent, finalContent);

    // Calculate edit percentage
    const totalChanges = added + removed;
    const editPercentage =
      initialContent.length > 0 ? (totalChanges / initialContent.length) * 100 : 0;

    return {
      initialWordCount,
      finalWordCount,
      charactersAdded: added,
      charactersRemoved: removed,
      editPercentage: Math.round(editPercentage * 100) / 100,
    };
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }

  /**
   * Calculate character additions and removals
   */
  private calculateCharacterChanges(
    original: string,
    final: string
  ): { added: number; removed: number } {
    // Simple length-based calculation
    // In production, consider using a proper diff algorithm
    const originalLength = original.length;
    const finalLength = final.length;

    if (finalLength >= originalLength) {
      return {
        added: finalLength - originalLength,
        removed: 0,
      };
    } else {
      return {
        added: 0,
        removed: originalLength - finalLength,
      };
    }
  }

  /**
   * Get quality metrics summary for a period
   */
  async getMetricsSummary(
    firmId: string,
    startDate: Date,
    endDate: Date,
    documentType?: DocumentType
  ): Promise<QualityMetricsSummary> {
    try {
      // Build where clause
      const whereClause: Prisma.DocumentDraftMetricsWhereInput = {
        firmId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      };

      if (documentType) {
        whereClause.documentType = documentType;
      }

      // Get all metrics for the period
      const metrics = await prisma.documentDraftMetrics.findMany({
        where: whereClause,
      });

      if (metrics.length === 0) {
        return {
          averageEditPercentage: 0,
          averageTimeToFinalize: 0,
          averageUserRating: 0,
          totalDocuments: 0,
          byDocumentType: [],
        };
      }

      // Calculate aggregates
      const totalEditPercentage = metrics.reduce((sum, m) => sum + Number(m.editPercentage), 0);
      const averageEditPercentage = totalEditPercentage / metrics.length;

      const metricsWithTime = metrics.filter((m) => m.timeToFinalizeMinutes !== null);
      const averageTimeToFinalize =
        metricsWithTime.length > 0
          ? metricsWithTime.reduce((sum, m) => sum + (m.timeToFinalizeMinutes || 0), 0) /
            metricsWithTime.length
          : 0;

      const metricsWithRating = metrics.filter((m) => m.userRating !== null);
      const averageUserRating =
        metricsWithRating.length > 0
          ? metricsWithRating.reduce((sum, m) => sum + (m.userRating || 0), 0) /
            metricsWithRating.length
          : 0;

      // Group by document type
      const byDocumentType = this.groupByDocumentType(metrics);

      return {
        averageEditPercentage: Math.round(averageEditPercentage * 100) / 100,
        averageTimeToFinalize: Math.round(averageTimeToFinalize * 100) / 100,
        averageUserRating: Math.round(averageUserRating * 100) / 100,
        totalDocuments: metrics.length,
        byDocumentType,
      };
    } catch (error) {
      logger.error('Failed to get metrics summary', {
        firmId,
        startDate,
        endDate,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Group metrics by document type
   */
  private groupByDocumentType(
    metrics: Array<{
      documentType: string;
      editPercentage: Prisma.Decimal;
    }>
  ): DocumentTypeMetrics[] {
    const groups = new Map<string, { total: number; count: number }>();

    for (const metric of metrics) {
      const existing = groups.get(metric.documentType) || { total: 0, count: 0 };
      existing.total += Number(metric.editPercentage);
      existing.count += 1;
      groups.set(metric.documentType, existing);
    }

    return Array.from(groups.entries()).map(([documentType, data]) => ({
      documentType: documentType as DocumentType,
      averageEditPercentage: Math.round((data.total / data.count) * 100) / 100,
      documentCount: data.count,
    }));
  }

  /**
   * Get metrics for a specific document
   */
  async getDocumentMetrics(documentId: string): Promise<DocumentDraftMetrics | null> {
    try {
      const record = await prisma.documentDraftMetrics.findUnique({
        where: { documentId },
      });

      return record ? this.mapToMetrics(record) : null;
    } catch (error) {
      logger.error('Failed to get document metrics', {
        documentId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Update metrics with user rating
   */
  async addUserRating(
    documentId: string,
    rating: 1 | 2 | 3 | 4 | 5
  ): Promise<DocumentDraftMetrics> {
    try {
      const record = await prisma.documentDraftMetrics.update({
        where: { documentId },
        data: { userRating: rating },
      });

      logger.info('User rating added to draft metrics', {
        documentId,
        rating,
      });

      return this.mapToMetrics(record);
    } catch (error) {
      logger.error('Failed to add user rating', {
        documentId,
        rating,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get documents that exceed quality threshold
   */
  async getDocumentsExceedingThreshold(
    firmId: string,
    startDate: Date,
    endDate: Date
  ): Promise<DocumentDraftMetrics[]> {
    try {
      const records = await prisma.documentDraftMetrics.findMany({
        where: {
          firmId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
          editPercentage: {
            gt: QUALITY_THRESHOLD_PERCENT,
          },
        },
        orderBy: { editPercentage: 'desc' },
      });

      return records.map(this.mapToMetrics);
    } catch (error) {
      logger.error('Failed to get documents exceeding threshold', {
        firmId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Map database record to metrics type
   */
  private mapToMetrics(record: {
    id: string;
    documentId: string;
    initialWordCount: number;
    finalWordCount: number | null;
    charactersAdded: number;
    charactersRemoved: number;
    editPercentage: Prisma.Decimal;
    timeToFinalizeMinutes: number | null;
    userRating: number | null;
    createdAt: Date;
    updatedAt: Date;
  }): DocumentDraftMetrics {
    return {
      id: record.id,
      documentId: record.documentId,
      initialWordCount: record.initialWordCount,
      finalWordCount: record.finalWordCount || undefined,
      charactersAdded: record.charactersAdded,
      charactersRemoved: record.charactersRemoved,
      editPercentage: Number(record.editPercentage),
      timeToFinalizeMinutes: record.timeToFinalizeMinutes || undefined,
      userRating: record.userRating as 1 | 2 | 3 | 4 | 5 | undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  /**
   * Emit quality alert (can be connected to monitoring/alerting system)
   */
  private emitQualityAlert(alert: {
    documentId: string;
    editPercentage: number;
    threshold: number;
    documentType: string;
    firmId: string;
  }): void {
    // Log alert - in production, this could emit to a monitoring system
    logger.warn('QUALITY_ALERT', {
      type: 'document_quality_threshold_exceeded',
      ...alert,
      timestamp: new Date().toISOString(),
    });

    // TODO: Could emit to Redis pub/sub, webhook, or notification service
  }

  /**
   * Get trending metrics over time
   */
  async getTrendingMetrics(
    firmId: string,
    days: number = 30
  ): Promise<Array<{ date: string; averageEditPercentage: number; documentCount: number }>> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const records = await prisma.documentDraftMetrics.findMany({
        where: {
          firmId,
          createdAt: { gte: startDate },
        },
        orderBy: { createdAt: 'asc' },
      });

      // Group by date
      const byDate = new Map<string, { total: number; count: number }>();

      for (const record of records) {
        const date = record.createdAt.toISOString().split('T')[0];
        const existing = byDate.get(date) || { total: 0, count: 0 };
        existing.total += Number(record.editPercentage);
        existing.count += 1;
        byDate.set(date, existing);
      }

      return Array.from(byDate.entries()).map(([date, data]) => ({
        date,
        averageEditPercentage: Math.round((data.total / data.count) * 100) / 100,
        documentCount: data.count,
      }));
    } catch (error) {
      logger.error('Failed to get trending metrics', {
        firmId,
        days,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

// Singleton instance
export const qualityMetricsService = new QualityMetricsService();
