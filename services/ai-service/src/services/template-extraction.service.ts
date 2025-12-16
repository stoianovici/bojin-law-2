/**
 * Template Extraction Service
 * Story 3.2.6: AI Training Pipeline for Legacy Document Processing
 *
 * Extracts document templates from high-similarity documents
 */

import { prisma } from '@legal-platform/database';
import type {
  ExtractTemplatesInput,
  ExtractTemplatesOutput,
  DocumentTemplate,
  TemplateStructure,
} from '@legal-platform/types';
import { embeddingGenerationService } from './embedding-generation.service';
import logger from '../lib/logger';

/**
 * Template Extraction Service Class
 * Identifies and extracts templates from similar documents
 */
export class TemplateExtractionService {
  /**
   * Extract templates from documents in a category
   * @param input - Template extraction input
   * @returns Extracted templates
   */
  async extractTemplates(input: ExtractTemplatesInput): Promise<ExtractTemplatesOutput> {
    const startTime = Date.now();
    const similarityThreshold = input.similarityThreshold || 0.85;

    try {
      // Get all documents in category with their embeddings
      const documents = await prisma.trainingDocument.findMany({
        where: { category: input.category },
        include: {
          embeddings: {
            orderBy: { chunkIndex: 'asc' },
            take: 1, // First chunk for comparison
          },
        },
      });

      if (documents.length < 3) {
        logger.warn('Not enough documents for template extraction', {
          category: input.category,
          documentCount: documents.length,
        });
        return {
          templates: [],
          totalTemplatesCreated: 0,
        };
      }

      // Find similar document clusters
      const clusters = this.findSimilarDocumentClusters(documents, similarityThreshold);

      // Extract template from each cluster
      const templates: Omit<DocumentTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [];

      for (const cluster of clusters) {
        if (cluster.length < 3) continue; // Need at least 3 similar docs

        const template = await this.extractTemplateFromCluster(cluster, input.category);

        if (template) {
          templates.push(template);
        }
      }

      // Store templates in database
      for (const template of templates) {
        await this.storeTemplate(template);
      }

      const duration = Date.now() - startTime;

      logger.info('Template extraction completed', {
        category: input.category,
        documentsAnalyzed: documents.length,
        templatesCreated: templates.length,
        durationMs: duration,
      });

      return {
        templates: templates as DocumentTemplate[],
        totalTemplatesCreated: templates.length,
      };
    } catch (error) {
      logger.error('Template extraction failed', {
        category: input.category,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Find clusters of similar documents
   * @param documents - Documents with embeddings
   * @param threshold - Similarity threshold
   * @returns Clusters of similar document IDs
   */
  private findSimilarDocumentClusters(documents: any[], threshold: number): string[][] {
    const clusters: string[][] = [];
    const assigned = new Set<string>();

    for (let i = 0; i < documents.length; i++) {
      if (assigned.has(documents[i].id)) continue;

      const cluster = [documents[i].id];
      assigned.add(documents[i].id);

      const embedding1 = this.parseEmbedding(documents[i].embeddings[0]?.embedding);
      if (!embedding1) continue;

      for (let j = i + 1; j < documents.length; j++) {
        if (assigned.has(documents[j].id)) continue;

        const embedding2 = this.parseEmbedding(documents[j].embeddings[0]?.embedding);
        if (!embedding2) continue;

        const similarity = embeddingGenerationService.calculateSimilarity(embedding1, embedding2);

        if (similarity >= threshold) {
          cluster.push(documents[j].id);
          assigned.add(documents[j].id);
        }
      }

      if (cluster.length >= 3) {
        clusters.push(cluster);
      }
    }

    return clusters;
  }

  /**
   * Extract template structure from a cluster of similar documents
   * @param documentIds - IDs of similar documents
   * @param category - Document category
   * @returns Template or null
   */
  private async extractTemplateFromCluster(
    documentIds: string[],
    category: string
  ): Promise<Omit<DocumentTemplate, 'id' | 'createdAt' | 'updatedAt'> | null> {
    // Get document texts
    const documents = await prisma.trainingDocument.findMany({
      where: { id: { in: documentIds } },
      select: { id: true, textContent: true, originalFilename: true },
    });

    if (documents.length === 0) return null;

    // Extract structure from documents
    const structures = documents.map((doc) => this.extractStructure(doc.textContent));

    // Find common structure
    const commonStructure = this.findCommonStructure(structures);

    // Calculate quality score based on structure consistency
    const qualityScore = this.calculateQualityScore(structures);

    return {
      category,
      name: `Template from ${documents[0].originalFilename}`,
      baseDocumentId: documents[0].id,
      structure: commonStructure,
      similarDocumentIds: documentIds,
      usageCount: 0,
      qualityScore,
    };
  }

  /**
   * Extract structure from document text
   * @param text - Document text
   * @returns Document structure
   */
  private extractStructure(text: string): TemplateStructure {
    const lines = text.split('\n').map((l) => l.trim());
    const sections: Array<{ heading: string; order: number; commonPhrases: string[] }> = [];
    let order = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect potential headings (short lines, capitalized)
      if (line.length > 0 && line.length < 100 && line[0] === line[0].toUpperCase()) {
        // Get phrases from next few lines
        const phrases: string[] = [];
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          if (lines[j].length > 20) {
            phrases.push(lines[j].substring(0, 100));
          }
        }

        sections.push({
          heading: line,
          order: order++,
          commonPhrases: phrases,
        });
      }
    }

    return {
      sections,
      totalSections: sections.length,
      avgSectionLength: text.length / Math.max(sections.length, 1),
    };
  }

  /**
   * Find common structure across multiple structures
   * @param structures - Array of document structures
   * @returns Common structure
   */
  private findCommonStructure(structures: TemplateStructure[]): TemplateStructure {
    if (structures.length === 0) {
      return { sections: [], totalSections: 0, avgSectionLength: 0 };
    }

    // Use first structure as base, find matching headings in others
    const baseStructure = structures[0];
    const commonSections = baseStructure.sections.filter((section) => {
      const matchCount = structures.filter((s) =>
        s.sections.some(
          (sec) => this.normalizeHeading(sec.heading) === this.normalizeHeading(section.heading)
        )
      ).length;

      return matchCount >= structures.length * 0.7; // 70% of documents
    });

    const avgSectionLength =
      structures.reduce((sum, s) => sum + s.avgSectionLength, 0) / structures.length;

    return {
      sections: commonSections,
      totalSections: commonSections.length,
      avgSectionLength,
    };
  }

  /**
   * Normalize heading for comparison
   * @param heading - Heading text
   * @returns Normalized heading
   */
  private normalizeHeading(heading: string): string {
    return heading
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim();
  }

  /**
   * Calculate quality score based on structure consistency
   * @param structures - Array of structures
   * @returns Quality score (0-1)
   */
  private calculateQualityScore(structures: TemplateStructure[]): number {
    if (structures.length === 0) return 0;

    // Calculate consistency score based on section count variance
    const sectionCounts = structures.map((s) => s.totalSections);
    const avgSections = sectionCounts.reduce((sum, c) => sum + c, 0) / sectionCounts.length;
    const variance =
      sectionCounts.reduce((sum, c) => sum + Math.pow(c - avgSections, 2), 0) /
      sectionCounts.length;

    const consistencyScore = 1 - Math.min(variance / (avgSections || 1), 1);

    return Math.max(0, Math.min(1, consistencyScore));
  }

  /**
   * Parse embedding from database vector format
   * @param embedding - Embedding from database
   * @returns Parsed embedding array
   */
  private parseEmbedding(embedding: any): number[] | null {
    if (!embedding) return null;
    if (Array.isArray(embedding)) return embedding;

    // Handle pgvector format if needed
    if (typeof embedding === 'string') {
      try {
        return JSON.parse(embedding);
      } catch {
        return null;
      }
    }

    return null;
  }

  /**
   * Store template in database
   * @param template - Template to store
   */
  private async storeTemplate(
    template: Omit<DocumentTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<void> {
    try {
      await prisma.templateLibrary.create({
        data: {
          category: template.category,
          name: template.name,
          baseDocumentId: template.baseDocumentId,
          structure: template.structure as any,
          similarDocumentIds: template.similarDocumentIds,
          usageCount: template.usageCount,
          qualityScore: template.qualityScore || 0,
        },
      });
    } catch (error) {
      logger.error('Failed to store template', {
        name: template.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const templateExtractionService = new TemplateExtractionService();
