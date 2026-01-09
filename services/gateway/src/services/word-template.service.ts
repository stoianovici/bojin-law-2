/**
 * Word Template Service
 * Manages document content templates stored in SharePoint
 */

import { prisma } from '@legal-platform/database';
import type { WordContentTemplate } from '@legal-platform/types';
// Re-export WordContentTemplate for external use
export type { WordContentTemplate };
import logger from '../utils/logger';

// ============================================================================
// Service
// ============================================================================

export class WordTemplateService {
  /**
   * List templates for a firm
   */
  async listTemplates(
    firmId: string,
    filters?: {
      caseType?: string;
      documentType?: string;
      category?: string;
    }
  ): Promise<WordContentTemplate[]> {
    const templates = await prisma.wordContentTemplate.findMany({
      where: {
        firmId,
        isActive: true,
        ...(filters?.caseType && { caseType: filters.caseType }),
        ...(filters?.documentType && { documentType: filters.documentType }),
        ...(filters?.category && { category: filters.category }),
      },
      orderBy: [{ usageCount: 'desc' }, { name: 'asc' }],
    });

    return templates.map((t) => ({
      id: t.id,
      firmId: t.firmId,
      name: t.name,
      description: t.description || undefined,
      caseType: t.caseType || undefined,
      documentType: t.documentType,
      category: t.category || undefined,
      tags: t.tags,
      usageCount: t.usageCount,
      isActive: t.isActive,
    }));
  }

  /**
   * Get template by ID
   */
  async getTemplate(
    templateId: string,
    firmId: string
  ): Promise<(WordContentTemplate & { contentText?: string }) | null> {
    const template = await prisma.wordContentTemplate.findFirst({
      where: {
        id: templateId,
        firmId,
        isActive: true,
      },
    });

    if (!template) return null;

    return {
      id: template.id,
      firmId: template.firmId,
      name: template.name,
      description: template.description || undefined,
      caseType: template.caseType || undefined,
      documentType: template.documentType,
      category: template.category || undefined,
      tags: template.tags,
      usageCount: template.usageCount,
      isActive: template.isActive,
      contentText: template.contentText || undefined,
    };
  }

  /**
   * Record template usage
   */
  async recordUsage(
    templateId: string,
    userId: string,
    caseId?: string,
    documentId?: string
  ): Promise<void> {
    try {
      await prisma.$transaction([
        prisma.wordTemplateUsage.create({
          data: {
            templateId,
            userId,
            caseId,
            documentId,
          },
        }),
        prisma.wordContentTemplate.update({
          where: { id: templateId },
          data: { usageCount: { increment: 1 } },
        }),
      ]);
    } catch (error) {
      logger.warn('Failed to record template usage', { templateId, userId, error });
    }
  }

  /**
   * Create a template
   */
  async createTemplate(
    firmId: string,
    userId: string,
    input: {
      name: string;
      description?: string;
      caseType?: string;
      documentType: string;
      category: string;
      sharePointItemId: string;
      sharePointPath: string;
      sharePointWebUrl?: string;
      contentText?: string;
      tags?: string[];
    }
  ): Promise<WordContentTemplate> {
    const template = await prisma.wordContentTemplate.create({
      data: {
        firmId,
        createdById: userId,
        name: input.name,
        description: input.description,
        caseType: input.caseType,
        documentType: input.documentType,
        category: input.category,
        sharePointItemId: input.sharePointItemId,
        sharePointPath: input.sharePointPath,
        sharePointWebUrl: input.sharePointWebUrl,
        contentText: input.contentText,
        tags: input.tags || [],
        lastSynced: new Date(),
      },
    });

    return {
      id: template.id,
      firmId: template.firmId,
      name: template.name,
      description: template.description || undefined,
      caseType: template.caseType || undefined,
      documentType: template.documentType,
      category: template.category || undefined,
      tags: template.tags,
      usageCount: template.usageCount,
      isActive: template.isActive,
    };
  }

  /**
   * Update template content (after SharePoint sync)
   */
  async updateTemplateContent(
    templateId: string,
    contentText: string,
    contentHash?: string
  ): Promise<void> {
    await prisma.wordContentTemplate.update({
      where: { id: templateId },
      data: {
        contentText,
        contentHash,
        lastSynced: new Date(),
      },
    });
  }

  /**
   * Deactivate a template
   */
  async deactivateTemplate(templateId: string): Promise<void> {
    await prisma.wordContentTemplate.update({
      where: { id: templateId },
      data: { isActive: false },
    });
  }
}

export const wordTemplateService = new WordTemplateService();
