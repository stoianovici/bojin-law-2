/**
 * One-time API endpoint to recover the lost PST import session
 * DELETE this file after successful recovery
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const SESSION_ID = '95666859-4bd0-4fc6-b4fb-9428fc7442c1';
const PST_FILE_NAME = 'backup email valentin.pst';
const PST_FILE_SIZE = BigInt(Math.round(47.3 * 1024 * 1024 * 1024)); // 47.30 GB in bytes
const PST_STORAGE_PATH = `pst/${SESSION_ID}/${PST_FILE_NAME}`;

export async function POST() {
  try {
    console.log('[RecoverSession] Starting recovery...');

    // Get firm
    const firm = await prisma.firm.findFirst();
    if (!firm) {
      return NextResponse.json({ error: 'No firm found' }, { status: 400 });
    }
    console.log(`[RecoverSession] Found firm: ${firm.name}`);

    // Get Partner user
    const user = await prisma.user.findFirst({ where: { role: 'Partner' } });
    if (!user) {
      return NextResponse.json({ error: 'No Partner user found' }, { status: 400 });
    }
    console.log(`[RecoverSession] Found Partner: ${user.email}`);

    // Check if session already exists
    const existingSession = await prisma.legacyImportSession.findUnique({
      where: { id: SESSION_ID },
    });

    if (existingSession) {
      return NextResponse.json({
        message: 'Session already exists',
        session: {
          id: existingSession.id,
          status: existingSession.status,
          totalDocuments: existingSession.totalDocuments,
          categorizedCount: existingSession.categorizedCount,
        },
      });
    }

    // Create the session
    const session = await prisma.legacyImportSession.create({
      data: {
        id: SESSION_ID,
        firmId: firm.id,
        pstFileName: PST_FILE_NAME,
        pstFileSize: PST_FILE_SIZE,
        pstStoragePath: PST_STORAGE_PATH,
        uploadedBy: user.id,
        status: 'Uploading',
        totalDocuments: 0,
        categorizedCount: 0,
        skippedCount: 0,
        analyzedCount: 0,
      },
    });

    console.log(`[RecoverSession] Session created: ${session.id}`);

    return NextResponse.json({
      message: 'Session recovered successfully',
      session: {
        id: session.id,
        pstFileName: session.pstFileName,
        pstFileSize: Number(session.pstFileSize),
        status: session.status,
        pstStoragePath: session.pstStoragePath,
      },
      nextSteps: [
        'Go to the legacy import UI',
        'The session should appear in the list',
        'Start the extraction process',
      ],
    });
  } catch (error) {
    console.error('[RecoverSession] Error:', error);
    return NextResponse.json(
      { error: 'Failed to recover session', details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Check status
  const session = await prisma.legacyImportSession.findUnique({
    where: { id: SESSION_ID },
  });

  if (session) {
    return NextResponse.json({
      exists: true,
      session: {
        id: session.id,
        pstFileName: session.pstFileName,
        status: session.status,
        totalDocuments: session.totalDocuments,
        categorizedCount: session.categorizedCount,
      },
    });
  }

  return NextResponse.json({
    exists: false,
    message: 'Session not found. POST to this endpoint to recover it.',
    sessionId: SESSION_ID,
    pstFileName: PST_FILE_NAME,
  });
}

// PUT to update session status (e.g., move from Uploading to Extracting)
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 });
    }

    const validStatuses = ['Uploading', 'Extracting', 'InProgress', 'Completed', 'Exported'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const session = await prisma.legacyImportSession.update({
      where: { id: SESSION_ID },
      data: { status },
    });

    return NextResponse.json({
      message: 'Session status updated',
      session: {
        id: session.id,
        pstFileName: session.pstFileName,
        status: session.status,
      },
    });
  } catch (error) {
    console.error('[RecoverSession] PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update session', details: String(error) },
      { status: 500 }
    );
  }
}
