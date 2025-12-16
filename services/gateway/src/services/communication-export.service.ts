/**
 * Communication Export Service
 * Story 5.5: Multi-Channel Communication Hub (AC: 5)
 *
 * Manages export of communication history for case documentation
 */

import { prisma } from '@legal-platform/database';
import { CommunicationChannel, ExportFormat, ExportStatus } from '@prisma/client';
import { r2StorageService } from './r2-storage.service';
// Note: R2 storage service wrapper for communication exports

// ============================================================================
// Types
// ============================================================================

interface CreateExportInput {
  caseId: string;
  format: ExportFormat;
  dateRangeFrom?: Date;
  dateRangeTo?: Date;
  channelTypes?: CommunicationChannel[];
  includeAttachments?: boolean;
}

interface CommunicationExport {
  id: string;
  firmId: string;
  caseId: string;
  exportedBy: string;
  format: ExportFormat;
  dateRangeFrom?: Date;
  dateRangeTo?: Date;
  channelTypes: CommunicationChannel[];
  includeAttachments: boolean;
  totalEntries: number;
  fileUrl?: string;
  status: ExportStatus;
  errorMessage?: string;
  expiresAt: Date;
  createdAt: Date;
  completedAt?: Date;
}

interface UserContext {
  userId: string;
  firmId: string;
}

// ============================================================================
// Service
// ============================================================================

export class CommunicationExportService {
  // Export files expire after 24 hours
  private readonly EXPORT_EXPIRY_HOURS = 24;

  /**
   * Create and start a new export
   */
  async createExport(
    input: CreateExportInput,
    userContext: UserContext
  ): Promise<CommunicationExport> {
    // Verify case belongs to firm
    const caseRecord = await prisma.case.findFirst({
      where: { id: input.caseId, firmId: userContext.firmId },
    });

    if (!caseRecord) {
      throw new Error('Case not found');
    }

    // Count matching entries
    const where = this.buildWhereClause(input, userContext.firmId);
    const totalEntries = await prisma.communicationEntry.count({ where });

    if (totalEntries === 0) {
      throw new Error('No communication entries match the filter criteria');
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.EXPORT_EXPIRY_HOURS);

    // Create export record
    const exportRecord = await prisma.communicationExport.create({
      data: {
        firmId: userContext.firmId,
        caseId: input.caseId,
        exportedBy: userContext.userId,
        format: input.format,
        dateRangeFrom: input.dateRangeFrom,
        dateRangeTo: input.dateRangeTo,
        channelTypes: input.channelTypes || [],
        includeAttachments: input.includeAttachments || false,
        totalEntries,
        status: ExportStatus.Processing,
        expiresAt,
      },
    });

    // Start async export process
    this.processExport(exportRecord.id).catch((error) => {
      console.error(`Export failed for ${exportRecord.id}:`, error);
    });

    return this.mapToExport(exportRecord);
  }

  /**
   * Get export by ID
   */
  async getExport(exportId: string, userContext: UserContext): Promise<CommunicationExport | null> {
    const exportRecord = await prisma.communicationExport.findFirst({
      where: { id: exportId, firmId: userContext.firmId },
    });

    return exportRecord ? this.mapToExport(exportRecord) : null;
  }

  /**
   * Get download URL for a completed export
   */
  async getDownloadUrl(exportId: string, userContext: UserContext): Promise<string | null> {
    const exportRecord = await prisma.communicationExport.findFirst({
      where: { id: exportId, firmId: userContext.firmId },
    });

    if (!exportRecord) {
      return null;
    }

    if (exportRecord.status !== ExportStatus.Completed) {
      throw new Error('Export is not ready for download');
    }

    if (new Date() > exportRecord.expiresAt) {
      throw new Error('Export has expired');
    }

    // Return the file URL directly (presigned URL would require additional R2 setup)
    // TODO: Implement presigned URL generation in r2StorageService
    return exportRecord.fileUrl || null;
  }

  /**
   * List exports for a case
   */
  async listExports(
    caseId: string,
    userContext: UserContext,
    options?: { limit?: number; offset?: number }
  ): Promise<{ exports: CommunicationExport[]; total: number }> {
    const where = { caseId, firmId: userContext.firmId };

    const [exports, total] = await Promise.all([
      prisma.communicationExport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 20,
        skip: options?.offset || 0,
      }),
      prisma.communicationExport.count({ where }),
    ]);

    return {
      exports: exports.map((e) => this.mapToExport(e)),
      total,
    };
  }

  /**
   * Delete an export (and its file)
   */
  async deleteExport(exportId: string, userContext: UserContext): Promise<boolean> {
    const exportRecord = await prisma.communicationExport.findFirst({
      where: { id: exportId, firmId: userContext.firmId },
    });

    if (!exportRecord) {
      throw new Error('Export not found');
    }

    // Note: File deletion from R2 storage would be implemented when R2 service supports it
    // TODO: Implement delete method in r2StorageService
    // For now, files will be cleaned up by expiration policy

    await prisma.communicationExport.delete({
      where: { id: exportId },
    });

    return true;
  }

  /**
   * Clean up expired exports (run periodically)
   */
  async cleanupExpiredExports(): Promise<number> {
    const expiredExports = await prisma.communicationExport.findMany({
      where: {
        expiresAt: { lt: new Date() },
        status: ExportStatus.Completed,
      },
    });

    for (const exp of expiredExports) {
      // Note: File deletion would be implemented when R2 service supports it
      // Files will be cleaned up by storage lifecycle policies

      await prisma.communicationExport.update({
        where: { id: exp.id },
        data: { status: ExportStatus.Expired, fileUrl: null },
      });
    }

    return expiredExports.length;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Process export asynchronously
   */
  private async processExport(exportId: string): Promise<void> {
    try {
      const exportRecord = await prisma.communicationExport.findUnique({
        where: { id: exportId },
      });

      if (!exportRecord) {
        throw new Error('Export not found');
      }

      // Fetch communication entries
      const where = this.buildWhereClause(
        {
          caseId: exportRecord.caseId,
          dateRangeFrom: exportRecord.dateRangeFrom || undefined,
          dateRangeTo: exportRecord.dateRangeTo || undefined,
          channelTypes: exportRecord.channelTypes as CommunicationChannel[],
        },
        exportRecord.firmId
      );

      const entries = await prisma.communicationEntry.findMany({
        where,
        include: {
          sender: {
            select: { firstName: true, lastName: true, email: true },
          },
          attachments: exportRecord.includeAttachments
            ? { select: { fileName: true, fileSize: true, mimeType: true } }
            : false,
        },
        orderBy: { sentAt: 'asc' },
      });

      // Generate export file based on format
      let fileContent: Buffer;
      let fileName: string;
      let mimeType: string;

      switch (exportRecord.format) {
        case ExportFormat.JSON:
          fileContent = Buffer.from(JSON.stringify(entries, null, 2));
          fileName = `communication-export-${exportId}.json`;
          mimeType = 'application/json';
          break;

        case ExportFormat.CSV:
          fileContent = this.generateCsv(entries);
          fileName = `communication-export-${exportId}.csv`;
          mimeType = 'text/csv';
          break;

        case ExportFormat.PDF:
          fileContent = await this.generatePdf(entries, exportRecord);
          fileName = `communication-export-${exportId}.pdf`;
          mimeType = 'application/pdf';
          break;

        case ExportFormat.DOCX:
          fileContent = await this.generateDocx(entries, exportRecord);
          fileName = `communication-export-${exportId}.docx`;
          mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          break;

        default:
          throw new Error(`Unsupported format: ${exportRecord.format}`);
      }

      // Upload to R2
      const storagePath = `exports/${exportRecord.firmId}/${exportRecord.caseId}/${fileName}`;
      const uploadResult = await r2StorageService.uploadDocument(
        storagePath,
        fileContent,
        mimeType
      );
      const fileUrl = uploadResult.storagePath;

      // Update export record
      await prisma.communicationExport.update({
        where: { id: exportId },
        data: {
          status: ExportStatus.Completed,
          fileUrl,
          completedAt: new Date(),
        },
      });
    } catch (error: any) {
      console.error(`Export processing failed for ${exportId}:`, error);

      await prisma.communicationExport.update({
        where: { id: exportId },
        data: {
          status: ExportStatus.Failed,
          errorMessage: error.message,
        },
      });
    }
  }

  /**
   * Build where clause for querying entries
   */
  private buildWhereClause(
    input: {
      caseId: string;
      dateRangeFrom?: Date;
      dateRangeTo?: Date;
      channelTypes?: CommunicationChannel[];
    },
    firmId: string
  ): any {
    const where: any = {
      caseId: input.caseId,
      firmId,
    };

    if (input.dateRangeFrom) {
      where.sentAt = { ...where.sentAt, gte: input.dateRangeFrom };
    }
    if (input.dateRangeTo) {
      where.sentAt = { ...where.sentAt, lte: input.dateRangeTo };
    }
    if (input.channelTypes && input.channelTypes.length > 0) {
      where.channelType = { in: input.channelTypes };
    }

    return where;
  }

  /**
   * Generate CSV export
   */
  private generateCsv(entries: any[]): Buffer {
    const headers = [
      'Date',
      'Channel',
      'Direction',
      'Subject',
      'Sender',
      'Recipients',
      'Body Preview',
    ];

    const rows = entries.map((e) => [
      e.sentAt.toISOString(),
      e.channelType,
      e.direction,
      e.subject || '',
      e.senderName,
      (e.recipients as any[])?.map((r: any) => r.email).join('; ') || '',
      e.body.substring(0, 200).replace(/[\n\r,]/g, ' '),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return Buffer.from(csvContent, 'utf-8');
  }

  /**
   * Generate PDF export (placeholder - implement with PDF library)
   */
  private async generatePdf(entries: any[], exportRecord: any): Promise<Buffer> {
    // TODO: Implement with a PDF generation library like pdfkit or puppeteer
    // For now, return a simple text-based placeholder
    const content = entries
      .map(
        (e) =>
          `Date: ${e.sentAt.toISOString()}\n` +
          `From: ${e.senderName}\n` +
          `Subject: ${e.subject || '(no subject)'}\n` +
          `---\n${e.body}\n\n`
      )
      .join('\n---PAGE BREAK---\n\n');

    return Buffer.from(content, 'utf-8');
  }

  /**
   * Generate DOCX export (placeholder - implement with docx library)
   */
  private async generateDocx(entries: any[], exportRecord: any): Promise<Buffer> {
    // TODO: Implement with a DOCX generation library like docx
    // For now, return a simple text-based placeholder
    const content = entries
      .map(
        (e) =>
          `Date: ${e.sentAt.toISOString()}\n` +
          `From: ${e.senderName}\n` +
          `Subject: ${e.subject || '(no subject)'}\n` +
          `---\n${e.body}\n\n`
      )
      .join('\n---\n\n');

    return Buffer.from(content, 'utf-8');
  }

  /**
   * Map Prisma result to CommunicationExport type
   */
  private mapToExport(exportRecord: any): CommunicationExport {
    return {
      id: exportRecord.id,
      firmId: exportRecord.firmId,
      caseId: exportRecord.caseId,
      exportedBy: exportRecord.exportedBy,
      format: exportRecord.format,
      dateRangeFrom: exportRecord.dateRangeFrom || undefined,
      dateRangeTo: exportRecord.dateRangeTo || undefined,
      channelTypes: exportRecord.channelTypes as CommunicationChannel[],
      includeAttachments: exportRecord.includeAttachments,
      totalEntries: exportRecord.totalEntries,
      fileUrl: exportRecord.fileUrl || undefined,
      status: exportRecord.status,
      errorMessage: exportRecord.errorMessage || undefined,
      expiresAt: exportRecord.expiresAt,
      createdAt: exportRecord.createdAt,
      completedAt: exportRecord.completedAt || undefined,
    };
  }
}

// Export singleton instance
export const communicationExportService = new CommunicationExportService();
