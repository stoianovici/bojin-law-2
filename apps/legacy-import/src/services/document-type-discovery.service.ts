/**
 * Document Type Discovery Service
 * Discovers, normalizes, and registers document types for adaptive skills creation
 * Story 2.12.1 - Adaptive Skills & Romanian Legal Templates from Discovery
 */

import { prisma } from '@/lib/prisma';
import type {
  ExtractedDocument,
  AIAnalysisResult,
  DocumentTypeRegistryEntry,
  DiscoveryResult,
} from '@legal-platform/types';
import { decisionEngine } from './decision-engine.service';

// Threshold configuration
const THRESHOLDS = {
  AUTO_CREATE: {
    minOccurrences: 50,
    minFrequencyScore: 0.75,
    minBusinessValue: 0.7,
    minConfidence: 0.85,
  },
  QUEUE_FOR_REVIEW: {
    minOccurrences: 20,
    minFrequencyScore: 0.5,
    minBusinessValue: 0.5,
    minConfidence: 0.7,
  },
  MAP_TO_EXISTING: {
    maxOccurrences: 19,
    similarityThreshold: 0.8,
  },
};

// Priority calculation weights
const PRIORITY_WEIGHTS = {
  frequency: 0.35,
  complexity: 0.2,
  businessValue: 0.3,
  recency: 0.15,
};

// Category to skill mapping
const CATEGORY_SKILL_MAP: Record<string, string> = {
  contract: 'contract-analysis',
  agreement: 'contract-analysis',
  protocol: 'contract-analysis',
  template: 'document-drafting',
  draft: 'document-drafting',
  form: 'document-drafting',
  notice: 'document-drafting',
  intampinare: 'document-drafting',
  contestatie: 'document-drafting',
  cerere: 'document-drafting',
  correspondence: 'document-drafting',
  court_filing: 'document-drafting',
  opinion: 'legal-research',
  memorandum: 'legal-research',
  analysis: 'legal-research',
  gdpr: 'compliance-check',
  audit: 'compliance-check',
  regulatory: 'compliance-check',
};

export class DocumentTypeDiscoveryService {
  /**
   * Main entry point - discover and register document type
   */
  async discoverAndRegister(
    document: ExtractedDocument,
    aiAnalysis: AIAnalysisResult
  ): Promise<DiscoveryResult> {
    // Normalize the document type name
    const normalizedType = this.normalizeTypeName(aiAnalysis.documentType);

    // Check if type already exists in registry
    const existing = await this.findInRegistry(normalizedType, aiAnalysis.primaryLanguage);

    let result: DiscoveryResult;

    if (existing) {
      // Update existing entry
      result = await this.updateRegistryEntry(existing, document, aiAnalysis);
    } else {
      // Create new registry entry
      result = await this.createRegistryEntry(document, aiAnalysis, normalizedType);
    }

    // Run decision engine on the updated/created entry
    const decision = await decisionEngine.makeDecision(result.registryEntry);

    // Add decision info to result
    result.decision = {
      action: decision.action,
      confidence: decision.confidence,
      reason: decision.reason,
    };

    return result;
  }

  /**
   * Normalize document type name to consistent format
   * Examples:
   * - "Contract de Vanzare-Cumparare" → "contract_vanzare_cumparare"
   * - "NOTIFICARE AVOCATEASCA" → "notificare_avocateasca"
   * - "Statement of Defense" → "statement_of_defense"
   */
  normalizeTypeName(typeName: string): string {
    return typeName
      .toLowerCase()
      .trim()
      .replace(/[àáâãäå]/g, 'a')
      .replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/[ăâ]/g, 'a')
      .replace(/[îâ]/g, 'i')
      .replace(/ș/g, 's')
      .replace(/ț/g, 't')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  /**
   * Find existing registry entry by normalized type and language
   */
  private async findInRegistry(
    normalizedType: string,
    language: string
  ): Promise<DocumentTypeRegistryEntry | null> {
    // TODO: Add documentTypeRegistry model to Prisma schema (Story 2.12.1)
    const result = await (prisma as any).documentTypeRegistry.findUnique({
      where: {
        discovered_type_normalized_primary_language: {
          discovered_type_normalized: normalizedType,
          primary_language: language,
        },
      },
    });

    if (!result) return null;

    return this.mapToRegistryEntry(result);
  }

  /**
   * Create new registry entry
   */
  private async createRegistryEntry(
    document: ExtractedDocument,
    aiAnalysis: AIAnalysisResult,
    normalizedType: string
  ): Promise<DiscoveryResult> {
    const category = this.inferCategory(aiAnalysis);
    const mappedSkillId = this.mapToSkill(category, normalizedType);

    // TODO: Add documentTypeRegistry model to Prisma schema (Story 2.12.1)
    const entry = await (prisma as any).documentTypeRegistry.create({
      data: {
        discovered_type_original: aiAnalysis.documentType,
        discovered_type_normalized: normalizedType,
        discovered_type_english: this.translateToEnglish(
          aiAnalysis.documentType,
          aiAnalysis.primaryLanguage
        ),
        primary_language: aiAnalysis.primaryLanguage,
        document_category: category,
        mapped_skill_id: mappedSkillId,
        mapping_status: 'pending',
        total_occurrences: 1,
        unique_variations: 1,
        avg_document_length: document.extractedText?.length || 0,
        frequency_score: 0.0,
        complexity_score: aiAnalysis.complexityScore,
        business_value_score: this.calculateBusinessValue(aiAnalysis),
        priority_score: 0.0,
        sample_document_ids: [document.id],
        common_clauses: { clause_categories: aiAnalysis.clauseCategories },
        typical_structure: { structure_type: aiAnalysis.structureType },
      },
    });

    // Create instance tracking
    // TODO: Add documentTypeInstances model to Prisma schema (Story 2.12.1)
    await (prisma as any).documentTypeInstances.create({
      data: {
        document_id: document.id,
        registry_id: entry.id,
        confidence_score: aiAnalysis.documentTypeConfidence,
      },
    });

    const registryEntry = this.mapToRegistryEntry(entry);

    return {
      registryEntry,
      isNew: true,
      action: 'created',
      thresholdsMet: this.checkThresholds(registryEntry),
    };
  }

  /**
   * Update existing registry entry
   */
  private async updateRegistryEntry(
    existing: DocumentTypeRegistryEntry,
    document: ExtractedDocument,
    aiAnalysis: AIAnalysisResult
  ): Promise<DiscoveryResult> {
    const newOccurrences = existing.totalOccurrences + 1;

    // Update sample documents (keep last 5)
    const sampleIds = existing.sampleDocumentIds || [];
    const updatedSamples = [document.id, ...sampleIds].slice(0, 5);

    // Calculate average document length
    const avgLength = existing.avgDocumentLength || 0;
    const newAvgLength = Math.round(
      (avgLength * existing.totalOccurrences + (document.extractedText?.length || 0)) /
        newOccurrences
    );

    // Calculate frequency score (based on occurrence rate)
    const frequencyScore = this.calculateFrequencyScore(newOccurrences);

    // Update business value score
    const businessValueScore = this.calculateBusinessValue(aiAnalysis);

    // Calculate priority score
    const priorityScore = this.calculatePriorityScore({
      frequencyScore,
      complexityScore: aiAnalysis.complexityScore,
      businessValueScore,
      firstSeenDate: existing.firstSeenDate,
    });

    // TODO: Add documentTypeRegistry model to Prisma schema (Story 2.12.1)
    const updated = await (prisma as any).documentTypeRegistry.update({
      where: { id: existing.id },
      data: {
        last_seen_date: new Date(),
        total_occurrences: newOccurrences,
        avg_document_length: newAvgLength,
        frequency_score: frequencyScore,
        complexity_score: aiAnalysis.complexityScore,
        business_value_score: businessValueScore,
        priority_score: priorityScore,
        sample_document_ids: updatedSamples,
      },
    });

    // Create instance tracking
    // TODO: Add documentTypeInstances model to Prisma schema (Story 2.12.1)
    await (prisma as any).documentTypeInstances.create({
      data: {
        document_id: document.id,
        registry_id: existing.id,
        confidence_score: aiAnalysis.documentTypeConfidence,
      },
    });

    const registryEntry = this.mapToRegistryEntry(updated);
    const thresholdsMet = this.checkThresholds(registryEntry);

    // Determine action based on threshold crossing
    let action: 'updated' | 'threshold_reached' = 'updated';
    if (
      newOccurrences === THRESHOLDS.AUTO_CREATE.minOccurrences ||
      newOccurrences === THRESHOLDS.QUEUE_FOR_REVIEW.minOccurrences
    ) {
      action = 'threshold_reached';
    }

    return {
      registryEntry,
      isNew: false,
      action,
      thresholdsMet,
    };
  }

  /**
   * Infer document category from AI analysis
   */
  private inferCategory(aiAnalysis: AIAnalysisResult): string {
    const type = aiAnalysis.documentType.toLowerCase();

    // Romanian legal document patterns
    if (type.includes('contract')) return 'contract';
    if (type.includes('notificare') || type.includes('somatie')) return 'correspondence';
    if (type.includes('intampinare') || type.includes('cerere') || type.includes('contestatie'))
      return 'court_filing';
    if (type.includes('imputernicire') || type.includes('power of attorney'))
      return 'authorization';
    if (type.includes('opinion') || type.includes('parecer')) return 'opinion';

    // English patterns
    if (type.includes('agreement')) return 'agreement';
    if (type.includes('notice') || type.includes('letter')) return 'correspondence';
    if (type.includes('filing') || type.includes('petition')) return 'court_filing';
    if (type.includes('memorandum')) return 'memorandum';

    // Check clause categories for hints
    if (aiAnalysis.clauseCategories.includes('payment_terms')) return 'contract';
    if (aiAnalysis.clauseCategories.includes('compliance')) return 'compliance';

    return 'unknown';
  }

  /**
   * Map category to appropriate skill
   */
  private mapToSkill(category: string, normalizedType: string): string | undefined {
    // First check direct mapping
    if (CATEGORY_SKILL_MAP[category]) {
      return CATEGORY_SKILL_MAP[category];
    }

    // Check normalized type for specific keywords
    if (normalizedType.includes('contract')) return 'contract-analysis';
    if (normalizedType.includes('compliance') || normalizedType.includes('gdpr'))
      return 'compliance-check';
    if (normalizedType.includes('research') || normalizedType.includes('opinion'))
      return 'legal-research';

    // Default to document drafting for most legal documents
    return 'document-drafting';
  }

  /**
   * Translate Romanian document type to English (basic mapping)
   */
  private translateToEnglish(typeName: string, language: string): string | undefined {
    if (language === 'English') return typeName;

    const translations: Record<string, string> = {
      'contract de vanzare-cumparare': 'Sales Purchase Agreement',
      'contract de prestari servicii': 'Service Agreement',
      'contract de inchiriere': 'Lease Agreement',
      'notificare avocateasca': 'Legal Notice',
      'somatie de plata': 'Payment Notice',
      intampinare: 'Statement of Defense',
      'cerere de chemare in judecata': 'Lawsuit Petition',
      contestatie: 'Appeal',
      'imputernicire avocatiala': 'Power of Attorney for Legal Representation',
    };

    const normalized = this.normalizeTypeName(typeName);
    return translations[normalized];
  }

  /**
   * Calculate business value score based on document characteristics
   */
  private calculateBusinessValue(aiAnalysis: AIAnalysisResult): number {
    let score = 0.5; // Base score

    // High template potential = high business value
    if (aiAnalysis.templatePotential === 'High') score += 0.3;
    else if (aiAnalysis.templatePotential === 'Medium') score += 0.15;

    // More clauses = more valuable document
    if (aiAnalysis.clauseCategories.length >= 5) score += 0.1;
    else if (aiAnalysis.clauseCategories.length >= 3) score += 0.05;

    // Structured documents are more valuable
    if (aiAnalysis.structureType === 'structured') score += 0.1;
    else if (aiAnalysis.structureType === 'semi-structured') score += 0.05;

    return Math.min(score, 1.0);
  }

  /**
   * Calculate frequency score based on occurrence count
   */
  private calculateFrequencyScore(occurrences: number): number {
    if (occurrences >= 100) return 1.0;
    if (occurrences >= 50) return 0.85;
    if (occurrences >= 30) return 0.7;
    if (occurrences >= 20) return 0.55;
    if (occurrences >= 10) return 0.4;
    if (occurrences >= 5) return 0.25;
    return 0.1;
  }

  /**
   * Calculate priority score (composite)
   */
  private calculatePriorityScore(params: {
    frequencyScore: number;
    complexityScore: number;
    businessValueScore: number;
    firstSeenDate: Date;
  }): number {
    const recencyScore = this.calculateRecencyScore(params.firstSeenDate);

    const priority =
      params.frequencyScore * PRIORITY_WEIGHTS.frequency +
      params.complexityScore * PRIORITY_WEIGHTS.complexity +
      params.businessValueScore * PRIORITY_WEIGHTS.businessValue +
      recencyScore * PRIORITY_WEIGHTS.recency;

    return Math.min(Math.max(priority, 0), 1);
  }

  /**
   * Calculate recency score (recently discovered = higher priority)
   */
  private calculateRecencyScore(firstSeenDate: Date): number {
    const daysSinceDiscovery = Math.floor(
      (Date.now() - firstSeenDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceDiscovery <= 7) return 1.0;
    if (daysSinceDiscovery <= 14) return 0.8;
    if (daysSinceDiscovery <= 30) return 0.6;
    if (daysSinceDiscovery <= 60) return 0.4;
    return 0.2;
  }

  /**
   * Check if registry entry meets any thresholds
   */
  private checkThresholds(entry: DocumentTypeRegistryEntry) {
    const autoCreate =
      entry.totalOccurrences >= THRESHOLDS.AUTO_CREATE.minOccurrences &&
      (entry.frequencyScore || 0) >= THRESHOLDS.AUTO_CREATE.minFrequencyScore &&
      (entry.businessValueScore || 0) >= THRESHOLDS.AUTO_CREATE.minBusinessValue;

    const queueForReview =
      entry.totalOccurrences >= THRESHOLDS.QUEUE_FOR_REVIEW.minOccurrences &&
      (entry.frequencyScore || 0) >= THRESHOLDS.QUEUE_FOR_REVIEW.minFrequencyScore &&
      (entry.businessValueScore || 0) >= THRESHOLDS.QUEUE_FOR_REVIEW.minBusinessValue;

    const mapToExisting = entry.totalOccurrences <= THRESHOLDS.MAP_TO_EXISTING.maxOccurrences;

    return {
      autoCreate,
      queueForReview,
      mapToExisting,
    };
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

  /**
   * Get discovery statistics
   */
  async getDiscoveryStats() {
    // TODO: Add documentTypeRegistry model to Prisma schema (Story 2.12.1)
    const [total, pending, autoMapped, templateCreated] = await Promise.all([
      (prisma as any).documentTypeRegistry.count(),
      (prisma as any).documentTypeRegistry.count({ where: { mapping_status: 'pending' } }),
      (prisma as any).documentTypeRegistry.count({ where: { mapping_status: 'auto_mapped' } }),
      (prisma as any).documentTypeRegistry.count({
        where: { mapping_status: 'template_created' },
      }),
    ]);

    return {
      totalTypesDiscovered: total,
      pendingReview: pending,
      autoMapped,
      templatesCreated: templateCreated,
    };
  }

  /**
   * Get top priority types for template creation
   */
  async getTemplateCreationCandidates(limit: number = 10) {
    // TODO: Add documentTypeRegistry model to Prisma schema (Story 2.12.1)
    const candidates = await (prisma as any).documentTypeRegistry.findMany({
      where: {
        mapping_status: 'pending',
        total_occurrences: { gte: THRESHOLDS.QUEUE_FOR_REVIEW.minOccurrences },
      },
      orderBy: [{ priority_score: 'desc' }, { total_occurrences: 'desc' }],
      take: limit,
    });

    return candidates.map((c: Record<string, unknown>) => this.mapToRegistryEntry(c));
  }
}

// Export singleton instance
export const documentTypeDiscovery = new DocumentTypeDiscoveryService();
