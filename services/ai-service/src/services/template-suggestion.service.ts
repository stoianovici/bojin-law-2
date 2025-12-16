/**
 * Template Suggestion Service
 * Story 3.3: Intelligent Document Drafting
 *
 * Suggests templates based on document type and case context
 */

import { prisma } from '@legal-platform/database';
import {
  TemplateSuggestion,
  DraftTemplateStructure,
  DraftTemplateSection,
  DocumentType,
} from '@legal-platform/types';
import logger from '../lib/logger';

// Map document types to template categories
const DOCUMENT_TYPE_TO_CATEGORY: Record<DocumentType, string[]> = {
  Contract: ['Contract', 'Agreement', 'Acord'],
  Motion: ['Motion', 'Cerere'],
  Letter: ['Letter', 'Scrisoare', 'Notificare'],
  Memo: ['Memo', 'Memorandum'],
  Pleading: ['Pleading', 'Cerere de chemare'],
  Other: [],
};

export class TemplateSuggestionService {
  /**
   * Suggest templates based on document type and case context
   */
  async suggestTemplates(
    caseId: string,
    documentType: DocumentType,
    limit: number = 5
  ): Promise<TemplateSuggestion[]> {
    const startTime = Date.now();

    logger.info('Suggesting templates', {
      caseId,
      documentType,
      limit,
    });

    try {
      // Get relevant categories
      const categories = DOCUMENT_TYPE_TO_CATEGORY[documentType];

      // Query template_library table from Story 3.2.6
      const whereClause = categories.length > 0 ? { category: { in: categories } } : {};

      const templates = await prisma.templateLibrary.findMany({
        where: whereClause,
        orderBy: [{ qualityScore: 'desc' }, { usageCount: 'desc' }],
        take: limit,
        select: {
          id: true,
          category: true,
          name: true,
          structure: true,
          usageCount: true,
          qualityScore: true,
        },
      });

      const suggestions: TemplateSuggestion[] = templates.map((template) => ({
        id: template.id,
        name: template.name || `${template.category} Template`,
        category: template.category,
        structure: this.parseStructure(template.structure),
        usageCount: template.usageCount,
        qualityScore: template.qualityScore ? Number(template.qualityScore) : 0,
      }));

      const duration = Date.now() - startTime;
      logger.info('Template suggestion completed', {
        caseId,
        documentType,
        suggestionsFound: suggestions.length,
        durationMs: duration,
      });

      return suggestions;
    } catch (error) {
      logger.error('Template suggestion failed', {
        caseId,
        documentType,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get a specific template by ID
   */
  async getTemplateById(templateId: string): Promise<TemplateSuggestion | null> {
    try {
      const template = await prisma.templateLibrary.findUnique({
        where: { id: templateId },
        select: {
          id: true,
          category: true,
          name: true,
          structure: true,
          usageCount: true,
          qualityScore: true,
        },
      });

      if (!template) {
        return null;
      }

      return {
        id: template.id,
        name: template.name || `${template.category} Template`,
        category: template.category,
        structure: this.parseStructure(template.structure),
        usageCount: template.usageCount,
        qualityScore: template.qualityScore ? Number(template.qualityScore) : 0,
      };
    } catch (error) {
      logger.error('Get template by ID failed', {
        templateId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Increment usage count when a template is used
   */
  async incrementUsage(templateId: string): Promise<void> {
    try {
      await prisma.templateLibrary.update({
        where: { id: templateId },
        data: { usageCount: { increment: 1 } },
      });
    } catch (error) {
      logger.warn('Failed to increment template usage', {
        templateId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Parse structure JSON into DraftTemplateStructure
   */
  private parseStructure(structure: unknown): DraftTemplateStructure {
    if (!structure || typeof structure !== 'object') {
      return { sections: [] };
    }

    const structureObj = structure as Record<string, unknown>;

    // Handle different structure formats
    if (Array.isArray(structureObj.sections)) {
      return {
        sections: structureObj.sections.map((section: unknown): DraftTemplateSection => {
          if (typeof section === 'string') {
            return {
              name: section,
              type: 'paragraph' as const,
              required: false,
            };
          }
          const sectionObj = section as Record<string, unknown>;
          return {
            name: String(sectionObj.name || 'Section'),
            type: this.mapSectionType(sectionObj.type),
            required: Boolean(sectionObj.required),
            placeholder: sectionObj.placeholder ? String(sectionObj.placeholder) : undefined,
          };
        }),
        metadata: structureObj.metadata as Record<string, unknown>,
      };
    }

    // Handle flat structure with headings/sections as keys
    const sections: DraftTemplateSection[] = Object.entries(structureObj)
      .filter(([key]) => !['metadata', 'version'].includes(key))
      .map(
        ([name, value]): DraftTemplateSection => ({
          name,
          type: this.inferSectionType(name, value),
          required: false,
          placeholder: typeof value === 'string' ? value : undefined,
        })
      );

    return { sections };
  }

  /**
   * Map section type string to valid type
   */
  private mapSectionType(type: unknown): 'heading' | 'paragraph' | 'clause' | 'signature' | 'list' {
    const validTypes = ['heading', 'paragraph', 'clause', 'signature', 'list'];
    if (typeof type === 'string' && validTypes.includes(type)) {
      return type as 'heading' | 'paragraph' | 'clause' | 'signature' | 'list';
    }
    return 'paragraph';
  }

  /**
   * Infer section type from name and value
   */
  private inferSectionType(
    name: string,
    _value: unknown
  ): 'heading' | 'paragraph' | 'clause' | 'signature' | 'list' {
    const nameLower = name.toLowerCase();

    if (nameLower.includes('title') || nameLower.includes('heading')) {
      return 'heading';
    }
    if (nameLower.includes('signature') || nameLower.includes('semnatura')) {
      return 'signature';
    }
    if (nameLower.includes('clause') || nameLower.includes('clauza')) {
      return 'clause';
    }
    if (nameLower.includes('list') || nameLower.includes('items')) {
      return 'list';
    }

    return 'paragraph';
  }

  /**
   * Get templates by category
   */
  async getTemplatesByCategory(
    category: string,
    limit: number = 10
  ): Promise<TemplateSuggestion[]> {
    try {
      const templates = await prisma.templateLibrary.findMany({
        where: { category },
        orderBy: [{ qualityScore: 'desc' }, { usageCount: 'desc' }],
        take: limit,
        select: {
          id: true,
          category: true,
          name: true,
          structure: true,
          usageCount: true,
          qualityScore: true,
        },
      });

      return templates.map((template) => ({
        id: template.id,
        name: template.name || `${template.category} Template`,
        category: template.category,
        structure: this.parseStructure(template.structure),
        usageCount: template.usageCount,
        qualityScore: template.qualityScore ? Number(template.qualityScore) : 0,
      }));
    } catch (error) {
      logger.error('Get templates by category failed', {
        category,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Search templates by name or category
   */
  async searchTemplates(query: string, limit: number = 10): Promise<TemplateSuggestion[]> {
    try {
      const templates = await prisma.templateLibrary.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { category: { contains: query, mode: 'insensitive' } },
          ],
        },
        orderBy: [{ qualityScore: 'desc' }, { usageCount: 'desc' }],
        take: limit,
        select: {
          id: true,
          category: true,
          name: true,
          structure: true,
          usageCount: true,
          qualityScore: true,
        },
      });

      return templates.map((template) => ({
        id: template.id,
        name: template.name || `${template.category} Template`,
        category: template.category,
        structure: this.parseStructure(template.structure),
        usageCount: template.usageCount,
        qualityScore: template.qualityScore ? Number(template.qualityScore) : 0,
      }));
    } catch (error) {
      logger.error('Search templates failed', {
        query,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

// Singleton instance
export const templateSuggestionService = new TemplateSuggestionService();
