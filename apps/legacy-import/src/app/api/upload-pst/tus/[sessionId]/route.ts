/**
 * TUS Upload Handler for PST files - Session-specific routes
 * Handles HEAD (resume), PATCH (upload chunk), DELETE (cancel)
 * Part of Story 3.2.5 - Legacy Document Import
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  startMultipartUpload,
  uploadPart,
  completeMultipartUpload,
  abortMultipartUpload,
} from '@/lib/r2-storage';
import { uploadStore, MIN_PART_SIZE } from '../store';

// TUS protocol headers
const TUS_RESUMABLE = '1.0.0';

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

// HEAD - Get upload offset (for resume)
export async function HEAD(_request: NextRequest, { params }: RouteParams) {
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

// PATCH - Upload chunk (streams directly to R2, no memory buffering)
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

    // Initialize R2 multipart upload on first chunk
    const key = `pst/${sessionId}/${upload.metadata.filename || 'upload.pst'}`;
    if (!upload.r2UploadId) {
      const { uploadId } = await startMultipartUpload(key, 'application/vnd.ms-outlook', {
        sessionId,
        filename: upload.metadata.filename || 'upload.pst',
        userId: upload.metadata.userId || 'unknown',
      });
      upload.r2UploadId = uploadId;
      upload.r2Key = key;
    }

    // Add chunk to pending buffer
    upload.pendingBuffer = Buffer.concat([upload.pendingBuffer, chunk]);
    upload.offset += chunk.length;

    // Upload parts when buffer reaches minimum size (5MB) or upload is complete
    const isComplete = upload.offset >= upload.length;

    while (
      upload.pendingBuffer.length >= MIN_PART_SIZE ||
      (isComplete && upload.pendingBuffer.length > 0)
    ) {
      // Take either MIN_PART_SIZE or whatever is left
      const partSize = Math.min(upload.pendingBuffer.length, MIN_PART_SIZE);
      const partBuffer = upload.pendingBuffer.subarray(0, partSize);
      upload.pendingBuffer = upload.pendingBuffer.subarray(partSize);

      // Upload this part to R2
      const completedPart = await uploadPart(
        upload.r2Key!,
        upload.r2UploadId!,
        upload.currentPartNumber,
        Buffer.from(partBuffer) // Create new buffer to avoid subarray issues
      );

      upload.completedParts.push(completedPart);
      upload.currentPartNumber++;

      // If we've uploaded everything and buffer is empty, break
      if (upload.pendingBuffer.length === 0) break;
    }

    // Complete upload when all data is received
    if (isComplete && upload.pendingBuffer.length === 0) {
      // Complete multipart upload
      await completeMultipartUpload(upload.r2Key!, upload.r2UploadId!, upload.completedParts);

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
            partsUploaded: upload.completedParts.length,
          },
        },
      });

      // Clean up memory (only ~5MB max was ever in memory at once)
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
    // Try to abort the multipart upload on error
    const upload = uploadStore.get((await params).sessionId);
    if (upload?.r2UploadId && upload?.r2Key) {
      try {
        await abortMultipartUpload(upload.r2Key, upload.r2UploadId);
      } catch (abortError) {
        console.error('Failed to abort multipart upload:', abortError);
      }
    }
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// DELETE - Cancel upload
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params;

    if (!sessionId) {
      return new NextResponse('Session ID required', { status: 400 });
    }

    // Abort multipart upload if in progress
    const upload = uploadStore.get(sessionId);
    if (upload?.r2UploadId && upload?.r2Key) {
      try {
        await abortMultipartUpload(upload.r2Key, upload.r2UploadId);
      } catch (abortError) {
        console.error('Failed to abort multipart upload:', abortError);
      }
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
