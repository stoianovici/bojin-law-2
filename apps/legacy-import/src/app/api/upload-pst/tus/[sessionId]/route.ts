/**
 * TUS Upload Handler for PST files - Session-specific routes
 * Handles HEAD (resume), PATCH (upload chunk), DELETE (cancel)
 * Part of Story 3.2.5 - Legacy Document Import
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { uploadToR2 } from '@/lib/r2-storage';
import { uploadStore } from '../store';

// TUS protocol headers
const TUS_RESUMABLE = '1.0.0';

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

// HEAD - Get upload offset (for resume)
export async function HEAD(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params;

    if (!sessionId) {
      return new NextResponse('Session ID required', { status: 400 });
    }

    const upload = uploadStore.get(sessionId);
    if (!upload) {
      return new NextResponse('Upload not found', { status: 404 });
    }

    return new NextResponse(null, {
      status: 200,
      headers: {
        'Tus-Resumable': TUS_RESUMABLE,
        'Upload-Offset': upload.offset.toString(),
        'Upload-Length': upload.length.toString(),
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'Upload-Offset, Upload-Length, Tus-Resumable',
      },
    });
  } catch (error) {
    console.error('TUS HEAD error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// PATCH - Upload chunk
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params;

    if (!sessionId) {
      return new NextResponse('Session ID required', { status: 400 });
    }

    const upload = uploadStore.get(sessionId);
    if (!upload) {
      return new NextResponse('Upload not found', { status: 404 });
    }

    const uploadOffset = request.headers.get('Upload-Offset');
    if (!uploadOffset) {
      return new NextResponse('Upload-Offset header required', { status: 400 });
    }

    const offset = parseInt(uploadOffset, 10);
    if (offset !== upload.offset) {
      return new NextResponse('Conflict: Upload-Offset mismatch', {
        status: 409,
      });
    }

    // Read chunk data
    const body = await request.arrayBuffer();
    const chunk = Buffer.from(body);

    // Store chunk
    upload.chunks.push(chunk);
    upload.offset += chunk.length;

    // Check if upload is complete
    if (upload.offset >= upload.length) {
      // Concatenate all chunks
      const fullFile = Buffer.concat(upload.chunks);

      // Upload to R2
      const key = `pst/${sessionId}/${upload.metadata.filename || 'upload.pst'}`;
      await uploadToR2(key, fullFile, {
        contentType: 'application/vnd.ms-outlook',
        sessionId,
        metadata: upload.metadata,
      });

      // Update database
      await prisma.legacyImportSession.update({
        where: { id: sessionId },
        data: {
          pstStoragePath: key,
          status: 'Extracting',
        },
      });

      // Create audit log with actual user info from metadata
      await prisma.legacyImportAuditLog.create({
        data: {
          sessionId,
          userId: upload.metadata.userId || 'unknown',
          action: 'PST_UPLOADED',
          details: {
            fileName: upload.metadata.filename,
            fileSize: upload.length,
            storagePath: key,
          },
        },
      });

      // Clean up memory
      uploadStore.delete(sessionId);
    }

    return new NextResponse(null, {
      status: 204,
      headers: {
        'Tus-Resumable': TUS_RESUMABLE,
        'Upload-Offset': upload.offset.toString(),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'Upload-Offset, Tus-Resumable',
      },
    });
  } catch (error) {
    console.error('TUS PATCH error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// DELETE - Cancel upload
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params;

    if (!sessionId) {
      return new NextResponse('Session ID required', { status: 400 });
    }

    // Clean up memory
    uploadStore.delete(sessionId);

    // Update database status
    await prisma.legacyImportSession
      .update({
        where: { id: sessionId },
        data: {
          status: 'Uploading', // Reset status
        },
      })
      .catch(() => {
        // Session might not exist yet, ignore
      });

    return new NextResponse(null, {
      status: 204,
      headers: {
        'Tus-Resumable': TUS_RESUMABLE,
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('TUS DELETE error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// OPTIONS - CORS preflight for dynamic route
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Tus-Resumable': TUS_RESUMABLE,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'HEAD, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Upload-Length, Upload-Offset, Upload-Metadata, Tus-Resumable',
      'Access-Control-Expose-Headers': 'Upload-Offset, Upload-Length, Tus-Resumable',
    },
  });
}
