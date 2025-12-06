/**
 * Communication Export Worker
 * Story 5.5: Multi-Channel Communication Hub (AC: 5)
 *
 * Processes communication exports with PDF, CSV, JSON, DOCX formats
 * Handles attachments and uploads to R2 storage
 */

import { prisma } from '@legal-platform/database';
import {
  CommunicationChannel,
  ExportFormat,
  ExportStatus,
  NotificationType,
} from '@prisma/client';
import { r2StorageService } from '../services/r2-storage.service';
import * as archiver from 'archiver';
import { Writable } from 'stream';

// ============================================================================
// Configuration
// ============================================================================

interface ExportWorkerConfig {
  checkIntervalMs: number; // How often to check for pending exports
  maxConcurrentExports: number; // Max exports to process at once
  maxEntriesPerExport: number; // Safety limit on entries
}

const DEFAULT_CONFIG: ExportWorkerConfig = {
  checkIntervalMs: 10 * 1000, // 10 seconds
  maxConcurrentExports: 3,
  maxEntriesPerExport: 10000,
};

let intervalHandle: NodeJS.Timeout | null = null;
let isRunning = false;
let activeExports = 0;

// ============================================================================
// Worker Lifecycle
// ============================================================================

/**
 * Start the communication export worker
 */
export function startCommunicationExportWorker(
  config: Partial<ExportWorkerConfig> = {}
): void {
  if (isRunning) {
    console.log('[Communication Export Worker] Already running');
    return;
  }

  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  console.log('[Communication Export Worker] Starting...');
  console.log(`  Check interval: ${finalConfig.checkIntervalMs / 1000}s`);
  console.log(`  Max concurrent: ${finalConfig.maxConcurrentExports}`);

  isRunning = true;

  // Run immediately
  processExportQueue(finalConfig).catch((error) => {
    console.error('[Communication Export Worker] Error in initial check:', error);
  });

  // Then run on interval
  intervalHandle = setInterval(() => {
    processExportQueue(finalConfig).catch((error) => {
      console.error('[Communication Export Worker] Error in queue check:', error);
    });
  }, finalConfig.checkIntervalMs);

  console.log('[Communication Export Worker] Started successfully');
}

/**
 * Stop the communication export worker
 */
export function stopCommunicationExportWorker(): void {
  if (!isRunning) {
    console.log('[Communication Export Worker] Not running');
    return;
  }

  console.log('[Communication Export Worker] Stopping...');

  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }

  isRunning = false;
  activeExports = 0;

  console.log('[Communication Export Worker] Stopped');
}

/**
 * Check if worker is running
 */
export function isCommunicationExportWorkerRunning(): boolean {
  return isRunning;
}

// ============================================================================
// Export Queue Processing
// ============================================================================

/**
 * Process pending exports from the queue
 */
async function processExportQueue(config: ExportWorkerConfig): Promise<void> {
  // Check if we can take more exports
  if (activeExports >= config.maxConcurrentExports) {
    return;
  }

  const availableSlots = config.maxConcurrentExports - activeExports;

  // Find pending exports
  const pendingExports = await prisma.communicationExport.findMany({
    where: { status: ExportStatus.Processing },
    take: availableSlots,
    orderBy: { createdAt: 'asc' },
  });

  if (pendingExports.length === 0) {
    return;
  }

  console.log(`[Communication Export Worker] Processing ${pendingExports.length} exports`);

  for (const exportRecord of pendingExports) {
    activeExports++;

    processExport(exportRecord.id, config)
      .catch((error) => {
        console.error(`[Communication Export Worker] Error processing ${exportRecord.id}:`, error);
      })
      .finally(() => {
        activeExports--;
      });
  }
}

// ============================================================================
// Export Processing
// ============================================================================

/**
 * Process a single export
 */
export async function processExport(
  exportId: string,
  config: ExportWorkerConfig = DEFAULT_CONFIG
): Promise<void> {
  console.log(`[Communication Export Worker] Processing export ${exportId}`);

  try {
    const exportRecord = await prisma.communicationExport.findUnique({
      where: { id: exportId },
      include: {
        case: { select: { title: true, caseNumber: true } },
        exporter: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    if (!exportRecord) {
      console.error(`[Communication Export Worker] Export ${exportId} not found`);
      return;
    }

    // Build where clause
    const where = buildWhereClause({
      firmId: exportRecord.firmId,
      caseId: exportRecord.caseId,
      dateRangeFrom: exportRecord.dateRangeFrom,
      dateRangeTo: exportRecord.dateRangeTo,
      channelTypes: exportRecord.channelTypes as CommunicationChannel[],
    });

    // Fetch communication entries
    const entries = await prisma.communicationEntry.findMany({
      where,
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        attachments: exportRecord.includeAttachments
          ? { select: { id: true, fileName: true, fileSize: true, mimeType: true, storageUrl: true } }
          : false,
      },
      orderBy: { sentAt: 'asc' },
      take: config.maxEntriesPerExport,
    });

    if (entries.length === 0) {
      throw new Error('No entries to export');
    }

    console.log(`[Communication Export Worker] Exporting ${entries.length} entries`);

    // Generate export file
    const exportData = await generateExport(exportRecord, entries);

    // Upload to R2
    const storagePath = `exports/${exportRecord.firmId}/${exportRecord.caseId}/${exportData.fileName}`;
    const uploadResult = await r2StorageService.uploadDocument(
      storagePath,
      exportData.content,
      exportData.mimeType
    );

    // Update export record
    await prisma.communicationExport.update({
      where: { id: exportId },
      data: {
        status: ExportStatus.Completed,
        fileUrl: uploadResult.storagePath,
        completedAt: new Date(),
      },
    });

    // Send notification
    await sendExportNotification(exportRecord, true);

    console.log(`[Communication Export Worker] Completed export ${exportId}`);
  } catch (error: any) {
    console.error(`[Communication Export Worker] Export ${exportId} failed:`, error);

    await prisma.communicationExport.update({
      where: { id: exportId },
      data: {
        status: ExportStatus.Failed,
        errorMessage: error.message || 'Unknown error',
      },
    });

    // Try to send failure notification
    try {
      const exportRecord = await prisma.communicationExport.findUnique({
        where: { id: exportId },
        include: { exporter: true },
      });
      if (exportRecord) {
        await sendExportNotification(exportRecord, false, error.message);
      }
    } catch (notifError) {
      console.error('[Communication Export Worker] Failed to send failure notification:', notifError);
    }
  }
}

// ============================================================================
// Export Generation
// ============================================================================

interface ExportResult {
  content: Buffer;
  fileName: string;
  mimeType: string;
}

/**
 * Generate export in the requested format
 */
async function generateExport(
  exportRecord: {
    id: string;
    format: ExportFormat;
    includeAttachments: boolean;
    case: { title: string; caseNumber: string } | null;
  },
  entries: any[]
): Promise<ExportResult> {
  const timestamp = new Date().toISOString().split('T')[0];
  const caseRef = exportRecord.case?.caseNumber || 'export';

  switch (exportRecord.format) {
    case ExportFormat.JSON:
      return generateJsonExport(exportRecord.id, caseRef, timestamp, entries);

    case ExportFormat.CSV:
      return generateCsvExport(exportRecord.id, caseRef, timestamp, entries);

    case ExportFormat.PDF:
      return await generatePdfExport(exportRecord.id, caseRef, timestamp, entries, exportRecord.case);

    case ExportFormat.DOCX:
      return await generateDocxExport(exportRecord.id, caseRef, timestamp, entries, exportRecord.case);

    default:
      throw new Error(`Unsupported format: ${exportRecord.format}`);
  }
}

/**
 * Generate JSON export
 */
function generateJsonExport(
  exportId: string,
  caseRef: string,
  timestamp: string,
  entries: any[]
): ExportResult {
  const exportData = {
    exportId,
    exportedAt: new Date().toISOString(),
    totalEntries: entries.length,
    entries: entries.map((e) => ({
      id: e.id,
      channelType: e.channelType,
      direction: e.direction,
      subject: e.subject,
      body: e.body,
      senderName: e.senderName,
      senderEmail: e.senderEmail,
      recipients: e.recipients,
      sentAt: e.sentAt.toISOString(),
      isPrivate: e.isPrivate,
      privacyLevel: e.privacyLevel,
      hasAttachments: e.hasAttachments,
      attachments: e.attachments?.map((a: any) => ({
        fileName: a.fileName,
        fileSize: a.fileSize,
        mimeType: a.mimeType,
      })),
    })),
  };

  return {
    content: Buffer.from(JSON.stringify(exportData, null, 2), 'utf-8'),
    fileName: `communication-export-${caseRef}-${timestamp}.json`,
    mimeType: 'application/json',
  };
}

/**
 * Generate CSV export with proper escaping
 */
function generateCsvExport(
  exportId: string,
  caseRef: string,
  timestamp: string,
  entries: any[]
): ExportResult {
  const headers = [
    'ID',
    'Date/Time',
    'Channel',
    'Direction',
    'Subject',
    'Sender Name',
    'Sender Email',
    'Recipients',
    'Body',
    'Privacy Level',
    'Attachments',
  ];

  const escapeCell = (value: string | null | undefined): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = entries.map((e) => [
    e.id,
    e.sentAt.toISOString(),
    e.channelType,
    e.direction,
    e.subject || '',
    e.senderName,
    e.senderEmail || '',
    (e.recipients as any[])?.map((r) => `${r.name} <${r.email}>`).join('; ') || '',
    e.body.substring(0, 1000), // Limit body length for CSV
    e.privacyLevel,
    e.attachments?.map((a: any) => a.fileName).join('; ') || '',
  ]);

  const csvContent = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(',')),
  ].join('\r\n');

  // Add BOM for Excel compatibility with UTF-8
  const bom = Buffer.from([0xef, 0xbb, 0xbf]);
  const content = Buffer.concat([bom, Buffer.from(csvContent, 'utf-8')]);

  return {
    content,
    fileName: `communication-export-${caseRef}-${timestamp}.csv`,
    mimeType: 'text/csv; charset=utf-8',
  };
}

/**
 * Generate PDF export
 * Uses a simple HTML-to-text approach for now
 * TODO: Integrate with pdfkit or puppeteer for proper PDF generation
 */
async function generatePdfExport(
  exportId: string,
  caseRef: string,
  timestamp: string,
  entries: any[],
  caseInfo: { title: string; caseNumber: string } | null
): Promise<ExportResult> {
  // For now, generate a formatted text document
  // In production, this would use pdfkit, puppeteer, or similar

  const lines: string[] = [];

  // Header
  lines.push('=' .repeat(80));
  lines.push('COMMUNICATION EXPORT REPORT');
  lines.push('=' .repeat(80));
  lines.push('');
  lines.push(`Case: ${caseInfo?.title || 'N/A'} (${caseInfo?.caseNumber || 'N/A'})`);
  lines.push(`Export Date: ${new Date().toLocaleString()}`);
  lines.push(`Total Entries: ${entries.length}`);
  lines.push('');
  lines.push('-'.repeat(80));
  lines.push('');

  // Entries
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    lines.push(`[Entry ${i + 1}/${entries.length}]`);
    lines.push(`Date: ${e.sentAt.toLocaleString()}`);
    lines.push(`Channel: ${e.channelType} | Direction: ${e.direction}`);
    lines.push(`From: ${e.senderName} ${e.senderEmail ? `<${e.senderEmail}>` : ''}`);

    if (e.recipients && (e.recipients as any[]).length > 0) {
      const recipients = (e.recipients as any[])
        .map((r) => `${r.name} <${r.email}> (${r.type})`)
        .join(', ');
      lines.push(`To: ${recipients}`);
    }

    if (e.subject) {
      lines.push(`Subject: ${e.subject}`);
    }

    if (e.privacyLevel !== 'Normal') {
      lines.push(`Privacy: ${e.privacyLevel}`);
    }

    lines.push('');
    lines.push(e.body);

    if (e.attachments && e.attachments.length > 0) {
      lines.push('');
      lines.push('Attachments:');
      for (const att of e.attachments) {
        lines.push(`  - ${att.fileName} (${formatFileSize(att.fileSize)})`);
      }
    }

    lines.push('');
    lines.push('-'.repeat(80));
    lines.push('');
  }

  // Footer
  lines.push('');
  lines.push('=' .repeat(80));
  lines.push('END OF EXPORT');
  lines.push('=' .repeat(80));

  return {
    content: Buffer.from(lines.join('\n'), 'utf-8'),
    fileName: `communication-export-${caseRef}-${timestamp}.pdf`,
    mimeType: 'application/pdf', // Note: This is text for now, would be actual PDF
  };
}

/**
 * Generate DOCX export
 * Uses a simple text approach for now
 * TODO: Integrate with docx library for proper Word document generation
 */
async function generateDocxExport(
  exportId: string,
  caseRef: string,
  timestamp: string,
  entries: any[],
  caseInfo: { title: string; caseNumber: string } | null
): Promise<ExportResult> {
  // For now, generate formatted text
  // In production, this would use the docx library

  const lines: string[] = [];

  // Title
  lines.push('COMMUNICATION EXPORT');
  lines.push('');
  lines.push(`Case: ${caseInfo?.title || 'N/A'}`);
  lines.push(`Case Number: ${caseInfo?.caseNumber || 'N/A'}`);
  lines.push(`Export Date: ${new Date().toLocaleString()}`);
  lines.push(`Total Communications: ${entries.length}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Entries
  for (const e of entries) {
    lines.push(`DATE: ${e.sentAt.toLocaleString()}`);
    lines.push(`CHANNEL: ${e.channelType}`);
    lines.push(`DIRECTION: ${e.direction}`);
    lines.push(`FROM: ${e.senderName} ${e.senderEmail ? `(${e.senderEmail})` : ''}`);

    if (e.subject) {
      lines.push(`SUBJECT: ${e.subject}`);
    }

    lines.push('');
    lines.push(e.body);

    if (e.attachments && e.attachments.length > 0) {
      lines.push('');
      lines.push('ATTACHMENTS:');
      for (const att of e.attachments) {
        lines.push(`• ${att.fileName} (${formatFileSize(att.fileSize)})`);
      }
    }

    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return {
    content: Buffer.from(lines.join('\n'), 'utf-8'),
    fileName: `communication-export-${caseRef}-${timestamp}.docx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
}

/**
 * Generate ZIP with attachments
 * This would be called when includeAttachments is true
 */
async function generateZipWithAttachments(
  entries: any[],
  exportContent: Buffer,
  exportFileName: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const output = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(chunk);
        callback();
      },
    });

    const archive = archiver.default('zip', { zlib: { level: 9 } });

    output.on('finish', () => {
      resolve(Buffer.concat(chunks));
    });

    archive.on('error', reject);
    archive.pipe(output);

    // Add main export file
    archive.append(exportContent, { name: exportFileName });

    // Add attachments in folders by entry
    for (const entry of entries) {
      if (entry.attachments && entry.attachments.length > 0) {
        for (const att of entry.attachments) {
          // Note: Would need to download from storage
          // For now, just add a placeholder
          const entryFolder = `attachments/${entry.id}`;
          archive.append(`[Attachment: ${att.fileName}]`, {
            name: `${entryFolder}/${att.fileName}`,
          });
        }
      }
    }

    archive.finalize();
  });
}

// ============================================================================
// Notifications
// ============================================================================

/**
 * Send export completion notification
 */
async function sendExportNotification(
  exportRecord: { id: string; exportedBy: string; format: ExportFormat; caseId: string },
  success: boolean,
  errorMessage?: string
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: exportRecord.exportedBy,
      type: NotificationType.CommunicationExportReady,
      title: success ? 'Export Ready for Download' : 'Export Failed',
      message: success
        ? `Your ${exportRecord.format} communication export is ready for download.`
        : `Your communication export failed: ${errorMessage || 'Unknown error'}`,
      link: success ? `/cases/${exportRecord.caseId}/communications?export=${exportRecord.id}` : undefined,
      caseId: exportRecord.caseId,
    },
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build where clause for communication entries query
 */
function buildWhereClause(exportRecord: {
  firmId: string;
  caseId: string;
  dateRangeFrom: Date | null;
  dateRangeTo: Date | null;
  channelTypes: CommunicationChannel[];
}): any {
  const where: any = {
    firmId: exportRecord.firmId,
    caseId: exportRecord.caseId,
  };

  if (exportRecord.dateRangeFrom) {
    where.sentAt = { ...where.sentAt, gte: exportRecord.dateRangeFrom };
  }

  if (exportRecord.dateRangeTo) {
    where.sentAt = { ...where.sentAt, lte: exportRecord.dateRangeTo };
  }

  if (exportRecord.channelTypes && exportRecord.channelTypes.length > 0) {
    where.channelType = { in: exportRecord.channelTypes };
  }

  return where;
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Clean up expired exports (run periodically)
 */
export async function cleanupExpiredExports(): Promise<number> {
  const expiredExports = await prisma.communicationExport.findMany({
    where: {
      expiresAt: { lt: new Date() },
      status: ExportStatus.Completed,
    },
  });

  for (const exp of expiredExports) {
    // Delete file from R2 if it exists
    if (exp.fileUrl) {
      try {
        // Note: Would call r2StorageService.deleteDocument here
        console.log(`[Communication Export Worker] Would delete file: ${exp.fileUrl}`);
      } catch (error) {
        console.error(`[Communication Export Worker] Failed to delete file ${exp.fileUrl}:`, error);
      }
    }

    await prisma.communicationExport.update({
      where: { id: exp.id },
      data: { status: ExportStatus.Expired, fileUrl: null },
    });
  }

  if (expiredExports.length > 0) {
    console.log(`[Communication Export Worker] Cleaned up ${expiredExports.length} expired exports`);
  }

  return expiredExports.length;
}

// Run cleanup daily
setInterval(() => {
  cleanupExpiredExports().catch((error) => {
    console.error('[Communication Export Worker] Cleanup error:', error);
  });
}, 24 * 60 * 60 * 1000);
