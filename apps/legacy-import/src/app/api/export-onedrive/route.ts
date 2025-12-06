import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { deleteSessionFiles } from '@/lib/r2-storage';
import { OneDriveExportService } from '@/services/onedrive-export.service';
import type { DocumentToExport } from '@/services/onedrive-export.service';

interface ExportRequest {
  sessionId: string;
  accessToken: string; // Microsoft Graph access token from client
}

// POST /api/export-onedrive - Export categorized documents to OneDrive
export async function POST(request: NextRequest) {
  try {
    const body: ExportRequest = await request.json();
    const { sessionId, accessToken } = body;

    // Validate request
    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Check if already exported
    if (session.status === 'Exported') {
      return NextResponse.json(
        { error: 'Session has already been exported' },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: 'No categorized documents to export' },
        { status: 400 }
      );
    }

    // Transform documents for export
    const docsToExport: DocumentToExport[] = documents.map((doc: typeof documents[number]) => ({
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
      // Update session status to Exported
      await prisma.legacyImportSession.update({
        where: { id: sessionId },
        data: {
          status: 'Exported',
          exportedAt: new Date(),
        },
      });

      // Perform R2 cleanup (delete PST and extracted documents)
      const cleanupResult = await deleteSessionFiles(sessionId);

      // Update session with cleanup timestamp
      await prisma.legacyImportSession.update({
        where: { id: sessionId },
        data: {
          cleanedUpAt: new Date(),
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
            r2FilesDeleted: cleanupResult.deletedCount,
          },
        },
      });

      return NextResponse.json({
        success: true,
        categoriesExported: result.categoriesExported,
        documentsExported: result.documentsExported,
        oneDrivePath: result.oneDrivePath,
        cleanup: {
          r2FilesDeleted: cleanupResult.deletedCount,
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
    return NextResponse.json(
      { error: 'Failed to export to OneDrive' },
      { status: 500 }
    );
  }
}

// GET /api/export-onedrive - Get export status for a session
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json(
      { error: 'sessionId is required' },
      { status: 400 }
    );
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
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
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
        remainingCount:
          session.totalDocuments -
          session.categorizedCount -
          session.skippedCount,
      },
    });
  } catch (error) {
    console.error('Error getting export status:', error);
    return NextResponse.json(
      { error: 'Failed to get export status' },
      { status: 500 }
    );
  }
}
