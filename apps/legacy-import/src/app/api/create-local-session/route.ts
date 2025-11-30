/**
 * Create Local Session API Route
 * Creates a session for local PST extraction
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileName, fileSize, firmId = 'firm-bojin-001' } = body;

    if (!fileName) {
      return NextResponse.json({ error: 'fileName required' }, { status: 400 });
    }

    const session = await prisma.legacyImportSession.create({
      data: {
        firmId,
        pstFileName: fileName,
        pstFileSize: BigInt(fileSize || 0),
        uploadedBy: 'local-extraction',
        status: 'InProgress',
      },
    });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      fileName: session.pstFileName,
    });
  } catch (error) {
    console.error('Create session error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create session',
        details: error instanceof Error ? error.message : 'Unknown',
      },
      { status: 500 }
    );
  }
}
