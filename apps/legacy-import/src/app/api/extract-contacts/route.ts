/**
 * Extract Contacts API Route
 * Extracts all contacts from PST file and returns Excel file
 * Part of Story 3.2.5 - Legacy Document Import
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { downloadFromR2 } from '@/lib/r2-storage';
import { extractContactsToExcel } from '@/services/contact-extraction.service';

/**
 * POST - Extract contacts from PST and return Excel file
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    // Get session
    const session = await prisma.legacyImportSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (!session.pstStoragePath) {
      return NextResponse.json({ error: 'PST file not uploaded yet' }, { status: 400 });
    }

    // Download PST from R2
    const pstBuffer = await downloadFromR2(session.pstStoragePath);

    // Extract contacts and generate Excel
    const { excelBuffer, result } = await extractContactsToExcel(pstBuffer);

    // Create audit log
    await prisma.legacyImportAuditLog.create({
      data: {
        sessionId,
        userId: session.uploadedBy,
        action: 'CONTACTS_EXTRACTED',
        details: {
          totalContacts: result.contacts.length,
          totalEmailsProcessed: result.processedEmails,
          errorCount: result.errors.length,
        },
      },
    });

    // Return Excel file
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="contacts-${sessionId.slice(0, 8)}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Extract contacts error:', error);
    return NextResponse.json(
      {
        error: 'Failed to extract contacts',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Get contact extraction status/info
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    // Check if session exists and has PST
    const session = await prisma.legacyImportSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        pstStoragePath: true,
        status: true,
        pstFileName: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({
      sessionId: session.id,
      canExtractContacts: !!session.pstStoragePath,
      pstFileName: session.pstFileName,
      status: session.status,
    });
  } catch (error) {
    console.error('Get contact extraction info error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
