/**
 * Document Text API Route
 * Returns the full extracted text for a document.
 * Used by the document preview modal.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const documentId = request.nextUrl.searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json({ error: 'Missing documentId parameter' }, { status: 400 });
    }

    const document = await prisma.extractedDocument.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        fileName: true,
        fileExtension: true,
        extractedText: true,
        emailSubject: true,
        storagePath: true,
        // Classification fields
        triageStatus: true,
        triageConfidence: true,
        triageReason: true,
        suggestedDocType: true,
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: document.id,
      fileName: document.fileName,
      fileExtension: document.fileExtension,
      extractedText: document.extractedText,
      emailSubject: document.emailSubject,
      hasFile: !!document.storagePath,
      // Classification fields
      triageStatus: document.triageStatus,
      triageConfidence: document.triageConfidence,
      triageReason: document.triageReason,
      suggestedDocType: document.suggestedDocType,
    });
  } catch (error) {
    console.error('Failed to fetch document text:', error);
    return NextResponse.json({ error: 'Failed to load document' }, { status: 500 });
  }
}
