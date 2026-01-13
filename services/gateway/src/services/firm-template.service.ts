/**
 * Firm Template Service
 * Handles master document template storage and management for firms.
 * Templates are stored in SharePoint and used as the basis for new documents.
 */

import { prisma } from '@legal-platform/database';
import logger from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface FirmTemplateInfo {
  url: string;
  driveItemId: string;
  fileName: string;
  updatedAt: Date | null;
}

export interface UploadTemplateResult {
  url: string;
  driveItemId: string;
  fileName: string;
}

// ============================================================================
// Service
// ============================================================================

export class FirmTemplateService {
  /**
   * Get the firm's current document template configuration
   */
  async getTemplateInfo(firmId: string): Promise<FirmTemplateInfo | null> {
    const firm = await prisma.firm.findUnique({
      where: { id: firmId },
      select: {
        documentTemplateUrl: true,
        documentTemplateDriveItemId: true,
        documentTemplateFileName: true,
        updatedAt: true,
      },
    });

    if (!firm?.documentTemplateUrl || !firm?.documentTemplateDriveItemId) {
      return null;
    }

    return {
      url: firm.documentTemplateUrl,
      driveItemId: firm.documentTemplateDriveItemId,
      fileName: firm.documentTemplateFileName || 'template.dotx',
      updatedAt: firm.updatedAt,
    };
  }

  /**
   * Update the firm's document template reference
   * Called after a template is uploaded to SharePoint via the frontend
   */
  async updateTemplate(
    firmId: string,
    input: { url: string; driveItemId: string; fileName: string }
  ): Promise<FirmTemplateInfo> {
    logger.info('Updating firm document template', {
      firmId,
      driveItemId: input.driveItemId,
      fileName: input.fileName,
    });

    const firm = await prisma.firm.update({
      where: { id: firmId },
      data: {
        documentTemplateUrl: input.url,
        documentTemplateDriveItemId: input.driveItemId,
        documentTemplateFileName: input.fileName,
      },
      select: {
        documentTemplateUrl: true,
        documentTemplateDriveItemId: true,
        documentTemplateFileName: true,
        updatedAt: true,
      },
    });

    return {
      url: firm.documentTemplateUrl!,
      driveItemId: firm.documentTemplateDriveItemId!,
      fileName: firm.documentTemplateFileName || input.fileName,
      updatedAt: firm.updatedAt,
    };
  }

  /**
   * Check if the firm has a template configured
   */
  async hasTemplate(firmId: string): Promise<boolean> {
    const firm = await prisma.firm.findUnique({
      where: { id: firmId },
      select: {
        documentTemplateUrl: true,
        documentTemplateDriveItemId: true,
      },
    });

    return !!(firm?.documentTemplateUrl && firm?.documentTemplateDriveItemId);
  }

  /**
   * Get the SharePoint drive item ID for copying
   */
  async getTemplateDriveItemId(firmId: string): Promise<string | null> {
    const firm = await prisma.firm.findUnique({
      where: { id: firmId },
      select: { documentTemplateDriveItemId: true },
    });

    return firm?.documentTemplateDriveItemId || null;
  }

  /**
   * Extract filename from SharePoint URL
   */
  private extractFileNameFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      const fileName = pathParts[pathParts.length - 1];
      return decodeURIComponent(fileName) || 'template.dotx';
    } catch {
      return 'template.dotx';
    }
  }
}

// Export singleton instance
export const firmTemplateService = new FirmTemplateService();
