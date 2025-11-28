/**
 * TUS Upload Handler for PST files
 * Implements resumable uploads using TUS protocol
 * Part of Story 3.2.5 - Legacy Document Import
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/lib/prisma';
import { uploadToR2 } from '@/lib/r2-storage';

// In-memory storage for upload metadata (in production, use Redis)
const uploadStore = new Map<
  string,
  {
    offset: number;
    length: number;
    metadata: Record<string, string>;
    sessionId: string;
    chunks: Buffer[];
  }
>();

// TUS protocol headers
const TUS_RESUMABLE = '1.0.0';
const TUS_VERSION = '1.0.0';
const TUS_EXTENSION = 'creation,termination,checksum';
const TUS_MAX_SIZE = 64424509440; // 60GB

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Tus-Resumable': TUS_RESUMABLE,
      'Tus-Version': TUS_VERSION,
      'Tus-Extension': TUS_EXTENSION,
      'Tus-Max-Size': TUS_MAX_SIZE.toString(),
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, HEAD, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Upload-Length, Upload-Offset, Upload-Metadata, Tus-Resumable',
      'Access-Control-Expose-Headers':
        'Upload-Offset, Location, Upload-Length, Tus-Version, Tus-Resumable, Tus-Max-Size, Tus-Extension',
    },
  });
}

// POST - Create new upload
export async function POST(request: NextRequest) {
  try {
    const uploadLength = request.headers.get('Upload-Length');
    const uploadMetadata = request.headers.get('Upload-Metadata');

    if (!uploadLength) {
      return new NextResponse('Upload-Length header required', { status: 400 });
    }

    const length = parseInt(uploadLength, 10);
    if (length > TUS_MAX_SIZE) {
      return new NextResponse('File too large', { status: 413 });
    }

    // Parse metadata
    const metadata: Record<string, string> = {};
    if (uploadMetadata) {
      uploadMetadata.split(',').forEach((item) => {
        const [key, value] = item.trim().split(' ');
        if (key && value) {
          metadata[key] = Buffer.from(value, 'base64').toString('utf-8');
        }
      });
    }

    // Validate file type
    const filename = metadata.filename || 'unknown.pst';
    if (!filename.toLowerCase().endsWith('.pst')) {
      return new NextResponse('Only PST files are allowed', { status: 400 });
    }

    // Create session ID
    const sessionId = uuidv4();

    // Store upload metadata
    uploadStore.set(sessionId, {
      offset: 0,
      length,
      metadata,
      sessionId,
      chunks: [],
    });

    // Create database session record
    // Note: In production, we'd get firmId and uploadedBy from auth
    await prisma.legacyImportSession.create({
      data: {
        id: sessionId,
        firmId: 'demo-firm', // TODO: Get from auth context
        pstFileName: filename,
        pstFileSize: BigInt(length),
        uploadedBy: 'demo-user', // TODO: Get from auth context
        status: 'Uploading',
      },
    });

    const location = `/api/upload-pst/tus/${sessionId}`;

    return new NextResponse(null, {
      status: 201,
      headers: {
        'Tus-Resumable': TUS_RESUMABLE,
        Location: location,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'Location, Tus-Resumable',
      },
    });
  } catch (error) {
    console.error('TUS POST error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// HEAD - Get upload offset (for resume)
export async function HEAD(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const sessionId = url.pathname.split('/').pop();

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
export async function PATCH(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const sessionId = url.pathname.split('/').pop();

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
      return new NextResponse('Conflict: Upload-Offset mismatch', { status: 409 });
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

      // Create audit log
      await prisma.legacyImportAuditLog.create({
        data: {
          sessionId,
          userId: 'demo-user', // TODO: Get from auth context
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
export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const sessionId = url.pathname.split('/').pop();

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
