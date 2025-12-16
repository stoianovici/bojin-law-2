/**
 * Decision Engine Service
 * Implements automated decision-making for document type mapping and template creation
 * Story 2.12.1 - Task 4: Decision Engine
 */

import { prisma } from '@/lib/prisma';
import type { DocumentTypeRegistryEntry } from '@legal-platform/types';

// Decision thresholds (from story requirements)
const DECISION_THRESHOLDS = {
  // Auto-map to existing skills when confidence >80%
  AUTO_MAP_CONFIDENCE: 0.8,

  // Queue for review when 20-49 occurrences
  QUEUE_REVIEW_MIN: 20,
  QUEUE_REVIEW_MAX: 49,

  // Trigger template creation when 50+ occurrences
  TEMPLATE_CREATION_MIN: 50,

  // Minimum scores for auto-actions
  MIN_FREQUENCY_SCORE: 0.5,
  MIN_BUSINESS_VALUE: 0.5,
};

// Confidence scoring weights
const CONFIDENCE_WEIGHTS = {
  categoryMatch: 0.3, // How well category matches skill
  patternConsistency: 0.25, // How consistent the document patterns are
  occurrenceReliability: 0.2, // Higher occurrences = higher confidence
  structureClarity: 0.15, // How well-structured documents are
  businessValue: 0.1, // Higher business value = higher confidence
};

export interface DecisionResult {
  action: 'auto_map' | 'queue_review' | 'create_template' | 'no_action';
  confidence: number;
  skillId?: string;
  reason: string;
  auditInfo: {
    decidedBy: string;
    decidedAt: Date;
    decisionBasis: string;
  };
}

export interface MappingConfidenceFactors {
  categoryMatch: number;
  patternConsistency: number;
  occurrenceReliability: number;
  structureClarity: number;
  businessValue: number;
}

export class DecisionEngineService {
  /**
   * Main decision entry point - determine action for a registry entry
   */
  async makeDecision(
    entry: DocumentTypeRegistryEntry,
    manualOverride?: {
      action: string;
      skillId?: string;
      userId?: string;
    }
  ): Promise<DecisionResult> {
    // Handle manual override
    if (manualOverride) {
      return this.applyManualOverride(entry, manualOverride);
    }

    // Calculate mapping confidence
    const confidence = await this.calculateMappingConfidence(entry);

    // Determine action based on thresholds
    const decision = this.determineAction(entry, confidence);

    // Execute the decision
    await this.executeDecision(entry, decision);

    return decision;
  }

  /**
   * Calculate mapping confidence score
   * Returns confidence (0-1) that the current mapping is correct
   */
  async calculateMappingConfidence(entry: DocumentTypeRegistryEntry): Promise<number> {
    const factors = await this.getMappingConfidenceFactors(entry);

    const confidence =
      factors.categoryMatch * CONFIDENCE_WEIGHTS.categoryMatch +
      factors.patternConsistency * CONFIDENCE_WEIGHTS.patternConsistency +
      factors.occurrenceReliability * CONFIDENCE_WEIGHTS.occurrenceReliability +
      factors.structureClarity * CONFIDENCE_WEIGHTS.structureClarity +
      factors.businessValue * CONFIDENCE_WEIGHTS.businessValue;

    return Math.min(Math.max(confidence, 0), 1);
  }

  /**
   * Get individual confidence factors
   */
  private async getMappingConfidenceFactors(
    entry: DocumentTypeRegistryEntry
  ): Promise<MappingConfidenceFactors> {
    // Category Match: How well does the category align with the mapped skill?
    const categoryMatch = this.calculateCategoryMatchScore(
      entry.documentCategory,
      entry.mappedSkillId
    );

    // Pattern Consistency: How consistent are the documents of this type?
    const patternConsistency = await this.calculatePatternConsistency(entry.id);

    // Occurrence Reliability: More occurrences = higher confidence
    const occurrenceReliability = this.calculateOccurrenceReliability(entry.totalOccurrences);

    // Structure Clarity: How well-structured are these documents?
    const structureClarity = this.calculateStructureClarity(entry);

    // Business Value: Higher value documents warrant higher confidence
    const businessValue = entry.businessValueScore || 0.5;

    return {
      categoryMatch,
      patternConsistency,
      occurrenceReliability,
      structureClarity,
      businessValue,
    };
  }

  /**
   * Calculate how well category matches skill
   */
  private calculateCategoryMatchScore(
    category: string | null | undefined,
    skillId: string | null | undefined
  ): number {
    if (!category || !skillId) return 0.5; // Neutral if missing

    // Perfect matches
    const perfectMatches: Record<string, string[]> = {
      'contract-analysis': ['contract', 'agreement', 'protocol'],
      'document-drafting': [
        'notice',
        'correspondence',
        'court_filing',
        'template',
        'draft',
        'form',
      ],
      'legal-research': ['opinion', 'memorandum', 'analysis'],
      'compliance-check': ['gdpr', 'audit', 'regulatory', 'compliance'],
    };

    for (const [skill, categories] of Object.entries(perfectMatches)) {
      if (skill === skillId && categories.includes(category)) {
        return 1.0; // Perfect match
      }
    }

    // Partial matches (close but not perfect)
    const partialMatches: Record<string, string[]> = {
      'contract-analysis': ['authorization'],
      'document-drafting': ['unknown'],
    };

    for (const [skill, categories] of Object.entries(partialMatches)) {
      if (skill === skillId && categories.includes(category)) {
        return 0.7; // Partial match
      }
    }

    return 0.4; // Poor match
  }

  /**
   * Calculate pattern consistency from document instances
   */
  private async calculatePatternConsistency(registryId: string): Promise<number> {
    // Get all instances for this registry entry
    // TODO: Add documentTypeInstances model to Prisma schema (Story 2.12.1)
    const instances = await (prisma as any).documentTypeInstances.findMany({
      where: { registry_id: registryId },
      select: { confidence_score: true },
    });

    if (instances.length === 0) return 0.5;

    // Calculate variance in confidence scores
    const scores = instances.map(
      (i: { confidence_score: number | null }) => i.confidence_score || 0.5
    );
    const avg = scores.reduce((sum: number, s: number) => sum + s, 0) / scores.length;
    const variance =
      scores.reduce((sum: number, s: number) => sum + Math.pow(s - avg, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    // Low variance = high consistency
    // Convert std dev (0-0.5 range) to consistency score (1-0)
    return Math.max(0, 1 - stdDev * 2);
  }

  /**
   * Calculate reliability based on occurrence count
   */
  private calculateOccurrenceReliability(occurrences: number): number {
    if (occurrences >= 100) return 1.0;
    if (occurrences >= 50) return 0.9;
    if (occurrences >= 30) return 0.8;
    if (occurrences >= 20) return 0.7;
    if (occurrences >= 10) return 0.6;
    if (occurrences >= 5) return 0.5;
    return 0.3;
  }

  /**
   * Calculate structure clarity from typical structure
   */
  private calculateStructureClarity(entry: DocumentTypeRegistryEntry): number {
    const structure = entry.typicalStructure as any;

    if (!structure) return 0.5;

    // Well-structured documents have clear structure type
    if (structure.structure_type === 'structured') return 0.9;
    if (structure.structure_type === 'semi-structured') return 0.7;
    if (structure.structure_type === 'unstructured') return 0.4;

    return 0.5;
  }

  /**
   * Determine action based on entry metrics and confidence
   */
  private determineAction(entry: DocumentTypeRegistryEntry, confidence: number): DecisionResult {
    const occurrences = entry.totalOccurrences;
    const frequencyScore = entry.frequencyScore || 0;
    const businessValue = entry.businessValueScore || 0;

    // Template Creation: 50+ occurrences with good metrics
    if (
      occurrences >= DECISION_THRESHOLDS.TEMPLATE_CREATION_MIN &&
      frequencyScore >= DECISION_THRESHOLDS.MIN_FREQUENCY_SCORE &&
      businessValue >= DECISION_THRESHOLDS.MIN_BUSINESS_VALUE
    ) {
      return {
        action: 'create_template',
        confidence,
        reason: `${occurrences} occurrences meets template creation threshold (≥50) with sufficient frequency (${frequencyScore.toFixed(2)}) and business value (${businessValue.toFixed(2)})`,
        auditInfo: {
          decidedBy: 'system',
          decidedAt: new Date(),
          decisionBasis: 'threshold_rules',
        },
      };
    }

    // Auto-map: High confidence (>80%) with some occurrences
    if (
      confidence > DECISION_THRESHOLDS.AUTO_MAP_CONFIDENCE &&
      occurrences >= 5 &&
      entry.mappedSkillId
    ) {
      return {
        action: 'auto_map',
        confidence,
        skillId: entry.mappedSkillId,
        reason: `High mapping confidence (${(confidence * 100).toFixed(1)}% > 80%) with ${occurrences} occurrences`,
        auditInfo: {
          decidedBy: 'system',
          decidedAt: new Date(),
          decisionBasis: 'confidence_threshold',
        },
      };
    }

    // Queue for Review: 20-49 occurrences (per story requirements)
    if (
      occurrences >= DECISION_THRESHOLDS.QUEUE_REVIEW_MIN &&
      occurrences <= DECISION_THRESHOLDS.QUEUE_REVIEW_MAX
    ) {
      return {
        action: 'queue_review',
        confidence,
        reason: `${occurrences} occurrences in review range (20-49), requires manual review`,
        auditInfo: {
          decidedBy: 'system',
          decidedAt: new Date(),
          decisionBasis: 'occurrence_threshold',
        },
      };
    }

    // No action: Insufficient data or confidence
    return {
      action: 'no_action',
      confidence,
      reason: `Insufficient data: ${occurrences} occurrences, ${(confidence * 100).toFixed(1)}% confidence`,
      auditInfo: {
        decidedBy: 'system',
        decidedAt: new Date(),
        decisionBasis: 'below_thresholds',
      },
    };
  }

  /**
   * Execute the decision by updating database
   */
  private async executeDecision(
    entry: DocumentTypeRegistryEntry,
    decision: DecisionResult
  ): Promise<void> {
    const updateData: any = {
      mapping_confidence: decision.confidence,
      reviewed_at: decision.auditInfo.decidedAt,
      reviewed_by: decision.auditInfo.decidedBy,
    };

    switch (decision.action) {
      case 'auto_map':
        updateData.mapping_status = 'auto_mapped';
        updateData.mapped_skill_id = decision.skillId;
        break;

      case 'queue_review':
        updateData.mapping_status = 'queue_review';
        break;

      case 'create_template':
        updateData.mapping_status = 'template_pending';
        break;

      case 'no_action':
        // Keep existing status
        break;
    }

    // TODO: Add documentTypeRegistry model to Prisma schema (Story 2.12.1)
    await (prisma as any).documentTypeRegistry.update({
      where: { id: entry.id },
      data: updateData,
    });
  }

  /**
   * Apply manual override by admin user
   */
  private async applyManualOverride(
    entry: DocumentTypeRegistryEntry,
    override: {
      action: string;
      skillId?: string;
      userId?: string;
    }
  ): Promise<DecisionResult> {
    const confidence = await this.calculateMappingConfidence(entry);

    const decision: DecisionResult = {
      action: override.action as any,
      confidence,
      skillId: override.skillId,
      reason: 'Manual override by administrator',
      auditInfo: {
        decidedBy: override.userId || 'admin',
        decidedAt: new Date(),
        decisionBasis: 'manual_override',
      },
    };

    await this.executeDecision(entry, decision);

    return decision;
  }

  /**
   * Batch process all pending registry entries
   */
  async processPendingEntries(): Promise<{
    processed: number;
    autoMapped: number;
    queuedForReview: number;
    templatesQueued: number;
  }> {
    // TODO: Add documentTypeRegistry model to Prisma schema (Story 2.12.1)
    const pendingEntries = await (prisma as any).documentTypeRegistry.findMany({
      where: {
        mapping_status: 'pending',
      },
    });

    let autoMapped = 0;
    let queuedForReview = 0;
    let templatesQueued = 0;

    for (const entry of pendingEntries) {
      const mappedEntry = this.mapToRegistryEntry(entry);
      const decision = await this.makeDecision(mappedEntry);

      if (decision.action === 'auto_map') autoMapped++;
      if (decision.action === 'queue_review') queuedForReview++;
      if (decision.action === 'create_template') templatesQueued++;
    }

    return {
      processed: pendingEntries.length,
      autoMapped,
      queuedForReview,
      templatesQueued,
    };
  }

  /**
   * Get entries ready for template creation
   */
  async getTemplateCreationQueue(): Promise<DocumentTypeRegistryEntry[]> {
    // TODO: Add documentTypeRegistry model to Prisma schema (Story 2.12.1)
    const entries = await (prisma as any).documentTypeRegistry.findMany({
      where: {
        mapping_status: 'template_pending',
        total_occurrences: { gte: DECISION_THRESHOLDS.TEMPLATE_CREATION_MIN },
      },
      orderBy: [{ priority_score: 'desc' }, { total_occurrences: 'desc' }],
    });

    return entries.map((e: Record<string, unknown>) => this.mapToRegistryEntry(e));
  }

  /**
   * Map Prisma result to DocumentTypeRegistryEntry
   */
  private mapToRegistryEntry(data: any): DocumentTypeRegistryEntry {
    return {
      id: data.id,
      discoveredTypeOriginal: data.discovered_type_original,
      discoveredTypeNormalized: data.discovered_type_normalized,
      discoveredTypeEnglish: data.discovered_type_english,
      primaryLanguage: data.primary_language,
      documentCategory: data.document_category,
      mappedSkillId: data.mapped_skill_id,
      mappedTemplateId: data.mapped_template_id,
      mappingConfidence: data.mapping_confidence,
      mappingStatus: data.mapping_status,
      firstSeenDate: data.first_seen_date,
      lastSeenDate: data.last_seen_date,
      totalOccurrences: data.total_occurrences,
      uniqueVariations: data.unique_variations,
      avgDocumentLength: data.avg_document_length,
      frequencyScore: data.frequency_score,
      complexityScore: data.complexity_score,
      businessValueScore: data.business_value_score,
      priorityScore: data.priority_score,
      sampleDocumentIds: data.sample_document_ids,
      commonClauses: data.common_clauses,
      typicalStructure: data.typical_structure,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      reviewedBy: data.reviewed_by,
      reviewedAt: data.reviewed_at,
    };
  }
}

// Export singleton instance
export const decisionEngine = new DecisionEngineService();
