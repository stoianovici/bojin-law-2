import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { OneDriveExportService } from '@/services/onedrive-export.service';
import type { DocumentToExport } from '@/services/onedrive-export.service';
import { requirePartner, AuthError, authErrorResponse } from '@/lib/auth';

// R2 cleanup delay: 7 days after successful export
const CLEANUP_DELAY_DAYS = 7;

interface ExportRequest {
  sessionId: string;
  accessToken: string; // Microsoft Graph access token from client
  skipSnapshotCheck?: boolean; // Allow bypassing snapshot check (not recommended)
}

// POST /api/export-onedrive - Export categorized documents to OneDrive
export async function POST(request: NextRequest) {
  try {
    // Require Partner/BusinessOwner role
    await requirePartner(request);
  } catch (error) {
    if (error instanceof AuthError) {
      return authErrorResponse(error);
    }
    throw error;
  }

  try {
    const body: ExportRequest = await request.json();
    const { sessionId, accessToken, skipSnapshotCheck } = body;

    // Validate request
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    if (!accessToken) {
      return NextResponse.json(
        { error: 'accessToken is required for OneDrive access' },
        { status: 400 }
      );
    }

    // Get session and verify it's ready for export
    const session = await prisma.legacyImportSession.findUnique({
      where: { id: sessionId },
      include: {
        categories: {
          where: { mergedInto: null }, // Only non-merged categories
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Check if already exported
    if (session.status === 'Exported') {
      return NextResponse.json({ error: 'Session has already been exported' }, { status: 400 });
    }

    // SAFETY CHECK: Require recent categorization snapshot before export
    // Check audit log for recent snapshot since new field may not be in Prisma client yet
    if (!skipSnapshotCheck) {
      const lastSnapshot = await prisma.legacyImportAuditLog.findFirst({
        where: {
          sessionId,
          action: 'CATEGORIZATION_SNAPSHOT',
        },
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true },
      });

      const lastSnapshotAt = lastSnapshot?.timestamp;
      const snapshotAge = lastSnapshotAt ? Date.now() - lastSnapshotAt.getTime() : null;
      const maxSnapshotAge = 60 * 60 * 1000; // 1 hour

      if (!lastSnapshotAt) {
        return NextResponse.json(
          {
            error: 'Snapshot required before export',
            message:
              'Please create a categorization snapshot before exporting. This backup protects your work in case of export issues.',
            code: 'SNAPSHOT_REQUIRED',
          },
          { status: 400 }
        );
      }

      if (snapshotAge && snapshotAge > maxSnapshotAge) {
        return NextResponse.json(
          {
            error: 'Snapshot is too old',
            message: `Your last snapshot is ${Math.round(snapshotAge / 60000)} minutes old. Please create a fresh snapshot before exporting.`,
            code: 'SNAPSHOT_STALE',
            lastSnapshotAt: lastSnapshotAt.toISOString(),
          },
          { status: 400 }
        );
      }
    }

    // Get all categorized documents (not skipped)
    const documents = await prisma.extractedDocument.findMany({
      where: {
        sessionId,
        status: 'Categorized',
        categoryId: { not: null },
      },
      include: {
        category: true,
      },
    });

    if (documents.length === 0) {
      return NextResponse.json({ error: 'No categorized documents to export' }, { status: 400 });
    }

    // Transform documents for export
    const docsToExport: DocumentToExport[] = documents.map((doc: (typeof documents)[number]) => ({
      id: doc.id,
      fileName: doc.fileName,
      fileExtension: doc.fileExtension,
      storagePath: doc.storagePath,
      categoryName: doc.category?.name || 'Uncategorized',
      originalFileName: doc.fileName,
      folderPath: doc.folderPath,
      isSent: doc.isSent,
      emailSubject: doc.emailSubject,
      emailSender: doc.emailSender,
      emailDate: doc.emailDate?.toISOString() || null,
      primaryLanguage: doc.primaryLanguage,
      documentType: doc.documentType,
      templatePotential: doc.templatePotential,
    }));

    // Create export service and perform export
    const exportService = new OneDriveExportService(accessToken);

    const result = await exportService.exportToOneDrive(docsToExport, sessionId);

    if (result.success) {
      // Calculate scheduled cleanup date (7 days from now)
      const cleanupScheduledAt = new Date();
      cleanupScheduledAt.setDate(cleanupScheduledAt.getDate() + CLEANUP_DELAY_DAYS);

      // Get last snapshot timestamp for audit
      const lastSnapshot = await prisma.legacyImportAuditLog.findFirst({
        where: {
          sessionId,
          action: 'CATEGORIZATION_SNAPSHOT',
        },
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true },
      });

      // Update session status to Exported and schedule R2 cleanup
      // NOTE: We no longer delete R2 files immediately - they are kept for 7 days as backup
      await prisma.legacyImportSession.update({
        where: { id: sessionId },
        data: {
          status: 'Exported',
          exportedAt: new Date(),
          // @ts-expect-error - Field added in schema, will work after prisma generate
          cleanupScheduledAt, // R2 files will be deleted after this date
        },
      });

      // Create audit log entry
      await prisma.legacyImportAuditLog.create({
        data: {
          sessionId,
          userId: session.uploadedBy,
          action: 'EXPORT_COMPLETED',
          details: {
            categoriesExported: result.categoriesExported,
            documentsExported: result.documentsExported,
            oneDrivePath: result.oneDrivePath,
            cleanupScheduledAt: cleanupScheduledAt.toISOString(),
            snapshotAt: lastSnapshot?.timestamp?.toISOString() || null,
          },
        },
      });

      return NextResponse.json({
        success: true,
        categoriesExported: result.categoriesExported,
        documentsExported: result.documentsExported,
        oneDrivePath: result.oneDrivePath,
        backup: {
          snapshotAt: lastSnapshot?.timestamp?.toISOString() || null,
          r2CleanupScheduledAt: cleanupScheduledAt.toISOString(),
          r2RetentionDays: CLEANUP_DELAY_DAYS,
          message: `R2 files retained for ${CLEANUP_DELAY_DAYS} days. Use /api/cleanup-session to delete earlier if needed.`,
        },
      });
    } else {
      // Partial or failed export
      return NextResponse.json(
        {
          success: false,
          categoriesExported: result.categoriesExported,
          documentsExported: result.documentsExported,
          errors: result.errors,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error exporting to OneDrive:', error);
    return NextResponse.json({ error: 'Failed to export to OneDrive' }, { status: 500 });
  }
}

// GET /api/export-onedrive - Get export status for a session
export async function GET(request: NextRequest) {
  try {
    // Require Partner/BusinessOwner role
    await requirePartner(request);
  } catch (error) {
    if (error instanceof AuthError) {
      return authErrorResponse(error);
    }
    throw error;
  }

  const sessionId = request.nextUrl.searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }

  try {
    const session = await prisma.legacyImportSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        status: true,
        exportedAt: true,
        cleanedUpAt: true,
        totalDocuments: true,
        categorizedCount: true,
        skippedCount: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const isReadyForExport =
      session.categorizedCount + session.skippedCount >= session.totalDocuments &&
      session.status !== 'Exported';

    return NextResponse.json({
      sessionId: session.id,
      status: session.status,
      isExported: session.status === 'Exported',
      exportedAt: session.exportedAt?.toISOString() || null,
      cleanedUpAt: session.cleanedUpAt?.toISOString() || null,
      isReadyForExport,
      stats: {
        totalDocuments: session.totalDocuments,
        categorizedCount: session.categorizedCount,
        skippedCount: session.skippedCount,
        remainingCount: session.totalDocuments - session.categorizedCount - session.skippedCount,
      },
    });
  } catch (error) {
    console.error('Error getting export status:', error);
    return NextResponse.json({ error: 'Failed to get export status' }, { status: 500 });
  }
}
