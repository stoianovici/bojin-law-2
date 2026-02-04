import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const documentId = request.nextUrl.searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json({ error: 'Missing documentId parameter' }, { status: 400 });
    }

    // Fetch the document to get its storage path and extracted text
    const document = await prisma.extractedDocument.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        storagePath: true,
        fileName: true,
        fileExtension: true,
        extractedText: true,
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (!document.storagePath) {
      return NextResponse.json({ error: 'Document has no storage path' }, { status: 404 });
    }

    // Use proxy endpoint instead of presigned URL (R2 presigned URLs have permission issues)
    const url = `/api/document-proxy?documentId=${documentId}`;

    return NextResponse.json({
      url,
      fileName: document.fileName,
      fileExtension: document.fileExtension,
      extractedText: document.extractedText,
      expiresIn: 3600,
    });
  } catch (error) {
    console.error('Failed to get document URL:', error);
    return NextResponse.json({ error: 'Failed to get document URL' }, { status: 500 });
  }
}
