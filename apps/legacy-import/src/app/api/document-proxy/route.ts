import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { downloadFromR2 } from '@/lib/r2-storage';

const CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ppt: 'application/vnd.ms-powerpoint',
  txt: 'text/plain',
  html: 'text/html',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
};

export async function GET(request: NextRequest) {
  try {
    const documentId = request.nextUrl.searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json({ error: 'Missing documentId parameter' }, { status: 400 });
    }

    // Fetch the document to get its storage path
    const document = await prisma.extractedDocument.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        storagePath: true,
        fileName: true,
        fileExtension: true,
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (!document.storagePath) {
      return NextResponse.json({ error: 'Document has no storage path' }, { status: 404 });
    }

    // Download file from R2
    const fileBuffer = await downloadFromR2(document.storagePath);

    const contentType =
      CONTENT_TYPES[document.fileExtension.toLowerCase()] || 'application/octet-stream';

    // Sanitize filename for Content-Disposition header
    // RFC 5987 encoding for non-ASCII characters
    const sanitizedFilename = document.fileName.replace(/[^\x20-\x7E]/g, '_');
    const encodedFilename = encodeURIComponent(document.fileName);

    // Return file as response (convert Buffer to Uint8Array for NextResponse)
    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': contentType,
        // Use both filename (ASCII fallback) and filename* (UTF-8) for broad compatibility
        'Content-Disposition': `inline; filename="${sanitizedFilename}"; filename*=UTF-8''${encodedFilename}`,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Failed to proxy document:', error);
    return NextResponse.json({ error: 'Failed to load document' }, { status: 500 });
  }
}
