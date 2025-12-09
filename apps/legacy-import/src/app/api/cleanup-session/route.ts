import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { deleteSessionFiles } from '@/lib/r2-storage';
import { requirePartner, AuthError, authErrorResponse } from '@/lib/auth';

interface CleanupRequest {
  sessionId: string;
  confirmDelete: boolean; // Must be true to actually delete
}

// POST /api/cleanup-session - Manually trigger R2 cleanup for an exported session
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
    const body: CleanupRequest = await request.json();
    const { sessionId, confirmDelete } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    // Get session
    const session = await prisma.legacyImportSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Type assertion for new fields
    const sessionData = session as typeof session & {
      cleanupScheduledAt?: Date | null;
      lastSnapshotAt?: Date | null;
    };

    // Only allow cleanup of exported sessions
    if (session.status !== 'Exported') {
      return NextResponse.json(
        {
          error: 'Session not exported',
          message: 'R2 cleanup is only allowed for sessions that have been exported to OneDrive.',
          currentStatus: session.status,
        },
        { status: 400 }
      );
    }

    // Check if already cleaned up
    if (session.cleanedUpAt) {
      return NextResponse.json(
        {
          error: 'Already cleaned up',
          message: 'R2 files have already been deleted for this session.',
          cleanedUpAt: session.cleanedUpAt.toISOString(),
        },
        { status: 400 }
      );
    }

    // If confirmDelete is not true, return preview of what would be deleted
    if (!confirmDelete) {
      // Get last snapshot timestamp from audit log
      const lastSnapshot = await prisma.legacyImportAuditLog.findFirst({
        where: {
          sessionId,
          action: 'CATEGORIZATION_SNAPSHOT',
        },
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true },
      });

      return NextResponse.json({
        success: false,
        preview: true,
        message:
          'This will permanently delete all R2 files (PST and extracted documents) for this session. Set confirmDelete: true to proceed.',
        session: {
          id: session.id,
          status: session.status,
          exportedAt: session.exportedAt?.toISOString() || null,
          cleanupScheduledAt: sessionData.cleanupScheduledAt?.toISOString() || null,
          lastSnapshotAt:
            lastSnapshot?.timestamp?.toISOString() ||
            sessionData.lastSnapshotAt?.toISOString() ||
            null,
          totalDocuments: session.totalDocuments,
        },
        warning:
          lastSnapshot || sessionData.lastSnapshotAt
            ? 'A categorization snapshot exists and will be preserved in R2.'
            : 'WARNING: No categorization snapshot found. Consider creating one before cleanup.',
      });
    }

    // Perform the actual cleanup
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
        action: 'R2_CLEANUP_COMPLETED',
        details: {
          deletedCount: cleanupResult.deletedCount,
          deletedKeys: cleanupResult.deletedKeys.slice(0, 10), // Log first 10 keys only
          triggeredManually: true,
          scheduledCleanupAt: sessionData.cleanupScheduledAt?.toISOString() || null,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${cleanupResult.deletedCount} files from R2 storage.`,
      deletedCount: cleanupResult.deletedCount,
      cleanedUpAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error cleaning up session:', error);
    return NextResponse.json({ error: 'Failed to clean up session' }, { status: 500 });
  }
}

// GET /api/cleanup-session - Get cleanup status and list sessions pending cleanup
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

  try {
    if (sessionId) {
      // Get specific session cleanup status
      const session = await prisma.legacyImportSession.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      // Type assertion for new fields
      const sessionData = session as typeof session & {
        cleanupScheduledAt?: Date | null;
        lastSnapshotAt?: Date | null;
      };

      // Get last snapshot timestamp from audit log
      const lastSnapshot = await prisma.legacyImportAuditLog.findFirst({
        where: {
          sessionId,
          action: 'CATEGORIZATION_SNAPSHOT',
        },
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true },
      });

      const cleanupScheduledAt = sessionData.cleanupScheduledAt;
      const isCleanupDue =
        cleanupScheduledAt && cleanupScheduledAt <= new Date() && !session.cleanedUpAt;

      return NextResponse.json({
        sessionId: session.id,
        status: session.status,
        exportedAt: session.exportedAt?.toISOString() || null,
        cleanupScheduledAt: cleanupScheduledAt?.toISOString() || null,
        cleanedUpAt: session.cleanedUpAt?.toISOString() || null,
        lastSnapshotAt:
          lastSnapshot?.timestamp?.toISOString() ||
          sessionData.lastSnapshotAt?.toISOString() ||
          null,
        isCleanupDue,
        canCleanup: session.status === 'Exported' && !session.cleanedUpAt,
      });
    }

    // List all sessions pending cleanup
    const pendingCleanup = await prisma.legacyImportSession.findMany({
      where: {
        status: 'Exported',
        cleanedUpAt: null,
      },
      orderBy: { exportedAt: 'asc' },
    });

    const now = new Date();
    const sessionsWithStatus = await Promise.all(
      pendingCleanup.map(async (session) => {
        // Type assertion for new fields
        const sessionData = session as typeof session & {
          cleanupScheduledAt?: Date | null;
          lastSnapshotAt?: Date | null;
        };

        // Get last snapshot timestamp from audit log
        const lastSnapshot = await prisma.legacyImportAuditLog.findFirst({
          where: {
            sessionId: session.id,
            action: 'CATEGORIZATION_SNAPSHOT',
          },
          orderBy: { timestamp: 'desc' },
          select: { timestamp: true },
        });

        const cleanupScheduledAt = sessionData.cleanupScheduledAt;

        return {
          id: session.id,
          pstFileName: session.pstFileName,
          totalDocuments: session.totalDocuments,
          exportedAt: session.exportedAt?.toISOString() || null,
          cleanupScheduledAt: cleanupScheduledAt?.toISOString() || null,
          lastSnapshotAt:
            lastSnapshot?.timestamp?.toISOString() ||
            sessionData.lastSnapshotAt?.toISOString() ||
            null,
          isCleanupDue: cleanupScheduledAt ? cleanupScheduledAt <= now : false,
          daysUntilCleanup: cleanupScheduledAt
            ? Math.ceil((cleanupScheduledAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            : null,
        };
      })
    );

    return NextResponse.json({
      pendingCleanupCount: pendingCleanup.length,
      sessions: sessionsWithStatus,
    });
  } catch (error) {
    console.error('Error getting cleanup status:', error);
    return NextResponse.json({ error: 'Failed to get cleanup status' }, { status: 500 });
  }
}
