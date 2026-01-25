/**
 * TUS Upload Handler for PST files
 * Implements resumable uploads using TUS protocol
 * Part of Story 3.2.5 - Legacy Document Import
 *
 * This route handles OPTIONS (capabilities) and POST (create upload)
 * Session-specific routes (HEAD, PATCH, DELETE) are in [sessionId]/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/lib/prisma';
import { uploadStore } from './store';
import { requireAuth, AuthError } from '@/lib/auth';

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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    // Require authenticated user
    const user = await requireAuth(request);
    const userId = user.id;
    const firmId = user.firmId;

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

    // Store upload metadata (no chunks stored in memory - will stream to R2)
    uploadStore.set(sessionId, {
      offset: 0,
      length,
      metadata,
      sessionId,
      r2UploadId: null,
      r2Key: null,
      completedParts: [],
      currentPartNumber: 1,
      pendingBuffer: Buffer.alloc(0),
    });

    // Create database session record with actual user info
    await prisma.legacyImportSession.create({
      data: {
        id: sessionId,
        firmId,
        pstFileName: filename,
        pstFileSize: BigInt(length),
        uploadedBy: userId,
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
    if (error instanceof AuthError) {
      return new NextResponse(error.message, { status: error.statusCode });
    }
    console.error('TUS POST error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
