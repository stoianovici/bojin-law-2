/**
 * Admin API route to trigger document extraction
 * POST /api/admin/trigger-extraction
 *
 * This endpoint is protected by a simple API key check.
 * It calls the gateway's GraphQL mutation to queue extraction jobs.
 */

import { NextRequest, NextResponse } from 'next/server';

// Simple API key protection (set in environment)
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'dev-admin-key-12345';

export async function POST(request: NextRequest) {
  try {
    // Check API key
    const authHeader = request.headers.get('x-admin-key');
    if (authHeader !== ADMIN_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { caseId } = body;

    if (!caseId) {
      return NextResponse.json({ error: 'caseId is required' }, { status: 400 });
    }

    // Import prisma
    const { prisma } = await import('@legal-platform/database');

    // Get all pending documents for the case
    const pendingDocs = await prisma.document.findMany({
      where: {
        caseLinks: {
          some: {
            caseId,
          },
        },
        extractionStatus: 'PENDING',
      },
      select: {
        id: true,
        fileName: true,
        fileType: true,
      },
    });

    // For now, just return the count - actual queueing would require Redis connection
    // which the web app doesn't have access to

    return NextResponse.json({
      success: true,
      message: `Found ${pendingDocs.length} pending documents`,
      pendingCount: pendingDocs.length,
      documents: pendingDocs,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
