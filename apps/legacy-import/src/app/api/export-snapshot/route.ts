import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { uploadToR2 } from '@/lib/r2-storage';
import { requirePartner, AuthError, authErrorResponse } from '@/lib/auth';

interface SnapshotCategory {
  id: string;
  name: string;
  documentCount: number;
  mergedInto: string | null;
}

interface SnapshotDocument {
  id: string;
  fileName: string;
  fileExtension: string;
  storagePath: string;
  folderPath: string | null;
  categoryId: string | null;
  categoryName: string | null;
  status: string;
  emailSubject: string | null;
  emailSender: string | null;
  emailDate: string | null;
  isSent: boolean;
  batchId: string | null;
  categorizedAt: string | null;
}

interface SnapshotBatch {
  id: string;
  monthYear: string;
  assignedTo: string | null;
  assignedToName: string | null;
  documentCount: number;
  categorizedCount: number;
  skippedCount: number;
}

interface CategorizationSnapshot {
  sessionId: string;
  snapshotAt: string;
  firmId: string;
  pstFileName: string;
  stats: {
    totalDocuments: number;
    categorizedCount: number;
    skippedCount: number;
    uncategorizedCount: number;
  };
  categories: SnapshotCategory[];
  documents: SnapshotDocument[];
  batches: SnapshotBatch[];
}

// POST /api/export-snapshot - Create a categorization backup snapshot
export async function POST(request: NextRequest) {
  try {
    await requirePartner(request);
  } catch (error) {
    if (error instanceof AuthError) {
      return authErrorResponse(error);
    }
    throw error;
  }

  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    // Get session with categories and batches
    const session = await prisma.legacyImportSession.findUnique({
      where: { id: sessionId },
      include: {
        categories: true,
        batches: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Get all documents with category info
    const documents = await prisma.extractedDocument.findMany({
      where: { sessionId },
      include: {
        category: {
          select: { name: true },
        },
      },
    });

    // Get assigned user names for batches
    const assignedUserIds = session.batches
      .filter((b) => b.assignedTo)
      .map((b) => b.assignedTo as string);

    const users =
      assignedUserIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: assignedUserIds } },
            select: { id: true, firstName: true, lastName: true },
          })
        : [];

    const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

    // Build snapshot
    const snapshotAt = new Date().toISOString();
    const snapshot: CategorizationSnapshot = {
      sessionId: session.id,
      snapshotAt,
      firmId: session.firmId,
      pstFileName: session.pstFileName,
      stats: {
        totalDocuments: session.totalDocuments,
        categorizedCount: session.categorizedCount,
        skippedCount: session.skippedCount,
        uncategorizedCount:
          session.totalDocuments - session.categorizedCount - session.skippedCount,
      },
      categories: session.categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        documentCount: cat.documentCount,
        mergedInto: cat.mergedInto,
      })),
      documents: documents.map((doc) => ({
        id: doc.id,
        fileName: doc.fileName,
        fileExtension: doc.fileExtension,
        storagePath: doc.storagePath,
        folderPath: doc.folderPath,
        categoryId: doc.categoryId,
        categoryName: doc.category?.name || null,
        status: doc.status,
        emailSubject: doc.emailSubject,
        emailSender: doc.emailSender,
        emailDate: doc.emailDate?.toISOString() || null,
        isSent: doc.isSent,
        batchId: doc.batchId,
        categorizedAt: doc.updatedAt?.toISOString() || null,
      })),
      batches: session.batches.map((batch) => ({
        id: batch.id,
        monthYear: batch.monthYear,
        assignedTo: batch.assignedTo,
        assignedToName: batch.assignedTo ? userMap.get(batch.assignedTo) || null : null,
        documentCount: batch.documentCount,
        categorizedCount: batch.categorizedCount,
        skippedCount: batch.skippedCount,
      })),
    };

    // Upload snapshot to R2
    const snapshotKey = `backups/${sessionId}/categorization-${snapshotAt.replace(/[:.]/g, '-')}.json`;
    const snapshotJson = JSON.stringify(snapshot, null, 2);

    await uploadToR2(snapshotKey, Buffer.from(snapshotJson), {
      contentType: 'application/json',
      sessionId,
      metadata: {
        snapshotAt,
        documentCount: String(documents.length),
        categorizedCount: String(session.categorizedCount),
      },
    });

    // Create audit log entry
    await prisma.legacyImportAuditLog.create({
      data: {
        sessionId,
        userId: session.uploadedBy,
        action: 'CATEGORIZATION_SNAPSHOT',
        details: {
          snapshotKey,
          snapshotAt,
          documentCount: documents.length,
          categorizedCount: session.categorizedCount,
          skippedCount: session.skippedCount,
          categoryCount: session.categories.length,
        },
      },
    });

    // Update session with last snapshot timestamp
    // Note: lastSnapshotAt field added in this PR - will work after prisma generate
    await prisma.legacyImportSession.update({
      where: { id: sessionId },
      data: {
        // @ts-expect-error - Field added in schema, will work after prisma generate
        lastSnapshotAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      snapshotAt,
      snapshotKey,
      stats: snapshot.stats,
      message: `Snapshot created with ${documents.length} documents and ${session.categories.length} categories`,
    });
  } catch (error) {
    console.error('Error creating snapshot:', error);
    return NextResponse.json({ error: 'Failed to create snapshot' }, { status: 500 });
  }
}

// GET /api/export-snapshot - Get snapshot status for a session
export async function GET(request: NextRequest) {
  try {
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
        totalDocuments: true,
        categorizedCount: true,
        status: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Get recent snapshot audit logs
    const recentSnapshots = await prisma.legacyImportAuditLog.findMany({
      where: {
        sessionId,
        action: 'CATEGORIZATION_SNAPSHOT',
      },
      orderBy: { timestamp: 'desc' },
      take: 5,
      select: {
        timestamp: true,
        details: true,
      },
    });

    const lastSnapshotAt = recentSnapshots.length > 0 ? recentSnapshots[0].timestamp : null;
    const hasRecentSnapshot = lastSnapshotAt
      ? Date.now() - lastSnapshotAt.getTime() < 60 * 60 * 1000 // Less than 1 hour old
      : false;

    return NextResponse.json({
      sessionId: session.id,
      lastSnapshotAt: lastSnapshotAt?.toISOString() || null,
      hasRecentSnapshot,
      snapshotAgeMinutes: lastSnapshotAt
        ? Math.round((Date.now() - lastSnapshotAt.getTime()) / 60000)
        : null,
      isReadyForExport: session.status !== 'Exported' && hasRecentSnapshot,
      stats: {
        totalDocuments: session.totalDocuments,
        categorizedCount: session.categorizedCount,
      },
      recentSnapshots: recentSnapshots.map((s) => ({
        timestamp: s.timestamp.toISOString(),
        details: s.details,
      })),
    });
  } catch (error) {
    console.error('Error getting snapshot status:', error);
    return NextResponse.json({ error: 'Failed to get snapshot status' }, { status: 500 });
  }
}
