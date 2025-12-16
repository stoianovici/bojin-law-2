/**
 * Discovery Status Service
 * Provides admin dashboard data for document type discovery
 * Story 2.12.1 - Task 7: Admin Dashboard
 * Story 2.15: Refactored with Dependency Injection
 */

import { getDefaultDatabaseClient } from '@/lib/database/client';
import type { DatabaseClient } from '@legal-platform/types';

export interface DiscoveryStatusSummary {
  typesDiscovered: number;
  pendingReview: number;
  templatesCreated: number;
  estimatedROI: string;
  totalDocuments: number;
  mappedToSkills: number;
  averageConfidence: number;
}

export interface DocumentTypeStats {
  id: string;
  discoveredTypeOriginal: string;
  discoveredTypeNormalized: string;
  discoveredTypeEnglish: string | null;
  primaryLanguage: string;
  mappedSkillId: string | null;
  totalOccurrences: number;
  priorityScore: number;
  mappingStatus: string;
  confidence: number | null;
  lastDiscovered: Date;
  estimatedTimeSavings: number;
  estimatedMonthlySavings: string;
}

export interface MappingRequest {
  typeId: string;
  targetSkill: string;
  confidence: number;
  reviewedBy: string;
  decisionBasis: string;
}

export interface TemplateGenerationRequest {
  typeId: string;
  language: string;
  includeEnglish: boolean;
}

export class DiscoveryStatusService {
  private db: DatabaseClient;

  /**
   * Constructor with dependency injection support
   * @param db Database client (defaults to production PostgreSQL client)
   */
  constructor(db?: DatabaseClient) {
    this.db = db || getDefaultDatabaseClient();
  }

  /**
   * Get overall discovery status summary
   */
  async getStatus(): Promise<DiscoveryStatusSummary> {
    const result = await this.db.query<DiscoveryStatusSummary>(`
      SELECT
        COUNT(DISTINCT id) as "typesDiscovered",
        COUNT(DISTINCT id) FILTER (WHERE mapping_status = 'pending_review') as "pendingReview",
        COUNT(DISTINCT id) FILTER (WHERE template_created = true) as "templatesCreated",
        COUNT(DISTINCT sample_document_ids[1]) as "totalDocuments",
        COUNT(DISTINCT id) FILTER (WHERE mapped_skill_id IS NOT NULL) as "mappedToSkills",
        COALESCE(AVG(confidence_score), 0) as "averageConfidence"
      FROM document_type_registry
    `);

    const stats = result.rows[0];

    // Calculate estimated ROI based on template usage and time savings
    const roiResult = await this.db.query<{ totalSavings: number }>(`
      SELECT
        SUM(
          CASE
            WHEN template_created = true
            THEN total_occurrences * 0.5 * 100  -- 0.5 hours saved per doc * $100/hour
            ELSE 0
          END
        ) as "totalSavings"
      FROM document_type_registry
    `);

    const monthlySavings = roiResult.rows[0]?.totalSavings || 0;

    return {
      typesDiscovered: Number(stats.typesDiscovered),
      pendingReview: Number(stats.pendingReview),
      templatesCreated: Number(stats.templatesCreated),
      estimatedROI: `€${Math.round(monthlySavings)}/month`,
      totalDocuments: Number(stats.totalDocuments),
      mappedToSkills: Number(stats.mappedToSkills),
      averageConfidence: Number(stats.averageConfidence),
    };
  }

  /**
   * Get detailed document type statistics sorted by priority
   */
  async getDocumentTypes(
    limit: number = 50,
    offset: number = 0,
    sortBy: 'priority' | 'occurrences' | 'recent' = 'priority'
  ): Promise<DocumentTypeStats[]> {
    const orderByClause =
      sortBy === 'priority'
        ? 'priority_score DESC NULLS LAST'
        : sortBy === 'occurrences'
          ? 'total_occurrences DESC'
          : 'last_discovered_at DESC';

    const result = await this.db.query<DocumentTypeStats>(
      `
      SELECT
        id,
        discovered_type_original as "discoveredTypeOriginal",
        discovered_type_normalized as "discoveredTypeNormalized",
        discovered_type_english as "discoveredTypeEnglish",
        primary_language as "primaryLanguage",
        mapped_skill_id as "mappedSkillId",
        total_occurrences as "totalOccurrences",
        priority_score as "priorityScore",
        mapping_status as "mappingStatus",
        confidence_score as "confidence",
        last_discovered_at as "lastDiscovered",
        estimated_time_savings_hours as "estimatedTimeSavings",
        CONCAT('€', ROUND(estimated_time_savings_hours * total_occurrences * 100 / 12), '/month') as "estimatedMonthlySavings"
      FROM document_type_registry
      ORDER BY ${orderByClause}
      LIMIT $1 OFFSET $2
    `,
      [limit, offset]
    );

    return result.rows;
  }

  /**
   * Get document types pending review
   */
  async getPendingReview(): Promise<DocumentTypeStats[]> {
    const result = await this.db.query<DocumentTypeStats>(`
      SELECT
        id,
        discovered_type_original as "discoveredTypeOriginal",
        discovered_type_normalized as "discoveredTypeNormalized",
        discovered_type_english as "discoveredTypeEnglish",
        primary_language as "primaryLanguage",
        mapped_skill_id as "mappedSkillId",
        total_occurrences as "totalOccurrences",
        priority_score as "priorityScore",
        mapping_status as "mappingStatus",
        confidence_score as "confidence",
        last_discovered_at as "lastDiscovered",
        estimated_time_savings_hours as "estimatedTimeSavings",
        CONCAT('€', ROUND(estimated_time_savings_hours * total_occurrences * 100 / 12), '/month') as "estimatedMonthlySavings"
      FROM document_type_registry
      WHERE mapping_status = 'pending_review'
      ORDER BY priority_score DESC NULLS LAST
    `);

    return result.rows;
  }

  /**
   * Get sample documents for a document type
   */
  async getSampleDocuments(typeId: string): Promise<string[]> {
    const result = await this.db.query<{ sample_document_ids: string[] }>(
      `
      SELECT sample_document_ids
      FROM document_type_registry
      WHERE id = $1
    `,
      [typeId]
    );

    return result.rows[0]?.sample_document_ids || [];
  }

  /**
   * Manually map a document type to a skill
   */
  async mapTypeToSkill(request: MappingRequest): Promise<void> {
    await this.db.query(
      `
      UPDATE document_type_registry
      SET
        mapped_skill_id = $1,
        confidence_score = $2,
        mapping_status = 'mapped',
        reviewed_by = $3,
        reviewed_at = NOW(),
        decision_basis = $4,
        updated_at = NOW()
      WHERE id = $5
    `,
      [
        request.targetSkill,
        request.confidence,
        request.reviewedBy,
        request.decisionBasis,
        request.typeId,
      ]
    );
  }

  /**
   * Trigger template generation for a document type
   */
  async triggerTemplateGeneration(request: TemplateGenerationRequest): Promise<void> {
    // Mark as template creation in progress
    await this.db.query(
      `
      UPDATE document_type_registry
      SET
        template_created = true,
        template_metadata = jsonb_build_object(
          'language', $1,
          'include_english', $2,
          'generated_at', NOW()
        ),
        updated_at = NOW()
      WHERE id = $3
    `,
      [request.language, request.includeEnglish, request.typeId]
    );
  }

  /**
   * Get ROI calculation for specific document types
   */
  async getROICalculation(typeIds: string[]): Promise<{
    timesSaved: number;
    monthlySavings: number;
    annualSavings: number;
  }> {
    const result = await this.db.query<{
      totalHoursSaved: number;
      totalDocuments: number;
    }>(
      `
      SELECT
        SUM(estimated_time_savings_hours) as "totalHoursSaved",
        SUM(total_occurrences) as "totalDocuments"
      FROM document_type_registry
      WHERE id = ANY($1)
    `,
      [typeIds]
    );

    const stats = result.rows[0];
    const hoursSaved = Number(stats.totalHoursSaved) || 0;
    const hourlyRate = 100; // €100/hour

    return {
      timesSaved: hoursSaved * Number(stats.totalDocuments),
      monthlySavings: (hoursSaved * Number(stats.totalDocuments) * hourlyRate) / 12,
      annualSavings: hoursSaved * Number(stats.totalDocuments) * hourlyRate,
    };
  }

  /**
   * Get discovery trends over time
   */
  async getDiscoveryTrends(days: number = 30): Promise<
    {
      date: string;
      typesDiscovered: number;
      documentsProcessed: number;
    }[]
  > {
    const result = await this.db.query<{
      date: string;
      typesDiscovered: number;
      documentsProcessed: number;
    }>(`
      SELECT
        DATE(created_at) as date,
        COUNT(DISTINCT id) as "typesDiscovered",
        SUM(total_occurrences) as "documentsProcessed"
      FROM document_type_registry
      WHERE created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) ASC
    `);

    return result.rows;
  }
}

// Export singleton instance for convenience (uses default database client)
export const discoveryStatusService = new DiscoveryStatusService();
