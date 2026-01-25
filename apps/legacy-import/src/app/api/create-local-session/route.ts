/**
 * Create Local Session API Route
 * Creates a session for local PST extraction
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, AuthError } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Require authenticated user
    const user = await requireAuth(request);

    const body = await request.json();
    const { fileName, fileSize } = body;

    if (!fileName) {
      return NextResponse.json({ error: 'fileName required' }, { status: 400 });
    }

    const session = await prisma.legacyImportSession.create({
      data: {
        firmId: user.firmId,
        pstFileName: fileName,
        pstFileSize: BigInt(fileSize || 0),
        uploadedBy: user.id,
        status: 'InProgress',
      },
    });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      fileName: session.pstFileName,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
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
