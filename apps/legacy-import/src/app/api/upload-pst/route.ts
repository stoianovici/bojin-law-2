/**
 * Upload PST File API Route
 * Handles direct file upload (fallback) and session management
 * Part of Story 3.2.5 - Legacy Document Import
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/lib/prisma';
import { uploadPSTFile } from '@/lib/r2-storage';
import { requirePartner, AuthError } from '@/lib/auth';
import { checkUploadRateLimit, recordUploadAttempt, getRateLimitHeaders } from '@/lib/rate-limiter';

// Max file size for direct upload: 100MB (larger files should use TUS)
const MAX_DIRECT_UPLOAD_SIZE = 100 * 1024 * 1024;

/**
 * GET - Get upload session status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    const session = await prisma.legacyImportSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        pstFileName: true,
        pstFileSize: true,
        status: true,
        totalDocuments: true,
        categorizedCount: true,
        skippedCount: true,
        analyzedCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({
      session: {
        ...session,
        pstFileSize: session.pstFileSize.toString(), // BigInt to string
      },
    });
  } catch (error) {
    console.error('GET upload-pst error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST - Direct file upload (for smaller files < 100MB)
 * For larger files, use the TUS endpoint
 */
export async function POST(request: NextRequest) {
  try {
    // Require Partner role for PST upload
    const user = await requirePartner(request);

    // Check rate limit (1 upload per user per hour)
    const rateLimitStatus = checkUploadRateLimit(user.id);
    if (!rateLimitStatus.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'You can only upload 1 PST file per hour',
          retryAfterSeconds: rateLimitStatus.retryAfterSeconds,
          resetAt: rateLimitStatus.resetAt?.toISOString(),
        },
        {
          status: 429,
          headers: getRateLimitHeaders(user.id),
        }
      );
    }

    // Get content type
    const contentType = request.headers.get('content-type') || '';

    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Content-Type must be multipart/form-data' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.pst')) {
      return NextResponse.json({ error: 'Only PST files are allowed' }, { status: 400 });
    }

    // Check file size
    if (file.size > MAX_DIRECT_UPLOAD_SIZE) {
      return NextResponse.json(
        {
          error: 'File too large for direct upload',
          message: 'Use the resumable upload endpoint for files larger than 100MB',
          maxSize: MAX_DIRECT_UPLOAD_SIZE,
          fileSize: file.size,
        },
        { status: 413 }
      );
    }

    // Create session ID
    const sessionId = uuidv4();

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to R2
    const uploadResult = await uploadPSTFile(sessionId, file.name, buffer);

    // Create database session record with auth context
    await prisma.legacyImportSession.create({
      data: {
        id: sessionId,
        firmId: user.firmId,
        pstFileName: file.name,
        pstFileSize: BigInt(file.size),
        pstStoragePath: uploadResult.key,
        uploadedBy: user.id,
        status: 'Extracting',
      },
    });

    // Create audit log with auth context
    await prisma.legacyImportAuditLog.create({
      data: {
        sessionId,
        userId: user.id,
        action: 'PST_UPLOADED',
        details: {
          fileName: file.name,
          fileSize: file.size,
          storagePath: uploadResult.key,
          uploadMethod: 'direct',
          uploadedByEmail: user.email,
        },
      },
    });

    // Record successful upload for rate limiting
    recordUploadAttempt(user.id);

    return NextResponse.json(
      {
        success: true,
        sessionId,
        fileName: file.name,
        fileSize: file.size,
        status: 'Extracting',
        message: 'File uploaded successfully. Starting document extraction...',
      },
      {
        headers: getRateLimitHeaders(user.id),
      }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      const { message, statusCode } = error;
      return NextResponse.json({ error: message }, { status: statusCode });
    }
    console.error('POST upload-pst error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE - Cancel/delete upload session
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    // Check session exists
    const session = await prisma.legacyImportSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Only allow deletion of non-exported sessions
    if (session.status === 'Exported') {
      return NextResponse.json({ error: 'Cannot delete exported sessions' }, { status: 400 });
    }

    // Delete R2 files
    const { deleteSessionFiles } = await import('@/lib/r2-storage');
    await deleteSessionFiles(sessionId);

    // Delete session and related records (cascade)
    await prisma.legacyImportSession.delete({
      where: { id: sessionId },
    });

    return NextResponse.json({
      success: true,
      message: 'Session deleted successfully',
    });
  } catch (error) {
    console.error('DELETE upload-pst error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
