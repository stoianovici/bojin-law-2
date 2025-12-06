import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { deleteSessionFiles } from '@/lib/r2-storage';
import { requirePartner, AuthError } from '@/lib/auth';

// POST /api/cleanup - Manually trigger cleanup of R2 files for a session
// This is typically called automatically after export, but can be triggered manually
export async function POST(request: NextRequest) {
  try {
    // Require Partner role for manual cleanup operations
    const user = await requirePartner(request);

    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    // Verify session exists
    const session = await prisma.legacyImportSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Check if already cleaned up
    if (session.cleanedUpAt) {
      return NextResponse.json({
        success: true,
        message: 'Session already cleaned up',
        cleanedUpAt: session.cleanedUpAt.toISOString(),
        deletedCount: 0,
      });
    }

    // Perform cleanup
    const cleanupResult = await deleteSessionFiles(sessionId);

    // Update session
    await prisma.legacyImportSession.update({
      where: { id: sessionId },
      data: {
        cleanedUpAt: new Date(),
        pstStoragePath: null, // Clear storage path reference
      },
    });

    // Create audit log with auth context
    await prisma.legacyImportAuditLog.create({
      data: {
        sessionId,
        userId: user.id,
        action: 'R2_CLEANUP_COMPLETED',
        details: {
          deletedCount: cleanupResult.deletedCount,
          deletedKeys: cleanupResult.deletedKeys,
          triggeredManually: true,
          triggeredByEmail: user.email,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Cleanup completed',
      cleanedUpAt: new Date().toISOString(),
      deletedCount: cleanupResult.deletedCount,
      deletedKeys: cleanupResult.deletedKeys,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const { message, statusCode } = error;
      return NextResponse.json(
        { error: message },
        { status: statusCode }
      );
    }
    console.error('Error during cleanup:', error);
    return NextResponse.json(
      { error: 'Cleanup failed' },
      { status: 500 }
    );
  }
}

// GET /api/cleanup - Check cleanup status for a session
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
        cleanedUpAt: true,
        pstStoragePath: true,
        exportedAt: true,
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Get audit log for cleanup info
    const cleanupLog = await prisma.legacyImportAuditLog.findFirst({
      where: {
        sessionId,
        action: { in: ['R2_CLEANUP_COMPLETED', 'EXPORT_COMPLETED'] },
      },
      orderBy: { timestamp: 'desc' },
    });

    return NextResponse.json({
      sessionId: session.id,
      status: session.status,
      isCleanedUp: session.cleanedUpAt !== null,
      cleanedUpAt: session.cleanedUpAt?.toISOString() || null,
      hasStoragePath: session.pstStoragePath !== null,
      isExported: session.exportedAt !== null,
      exportedAt: session.exportedAt?.toISOString() || null,
      cleanupDetails: cleanupLog?.details || null,
    });
  } catch (error) {
    console.error('Error checking cleanup status:', error);
    return NextResponse.json(
      { error: 'Failed to get cleanup status' },
      { status: 500 }
    );
  }
}
