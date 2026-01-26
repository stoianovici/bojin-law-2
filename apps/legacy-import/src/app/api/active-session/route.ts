/**
 * Active Session API Route
 * GET /api/active-session
 * Returns authenticated user's most recent incomplete import session for auto-resume
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, AuthError } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Require authenticated user
    const user = await requireAuth(request);
    const userId = user.id;

    // Find user's most recent incomplete session
    // Status order of priority: InProgress > Extracting > Uploading
    const activeSession = await prisma.legacyImportSession.findFirst({
      where: {
        uploadedBy: userId,
        status: {
          in: ['Uploading', 'Extracting', 'Extracted', 'InProgress'],
        },
      },
      orderBy: [{ updatedAt: 'desc' }],
      select: {
        id: true,
        pstFileName: true,
        status: true,
        totalDocuments: true,
        categorizedCount: true,
        skippedCount: true,
        analyzedCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!activeSession) {
      return NextResponse.json({
        hasActiveSession: false,
        session: null,
      });
    }

    // Map session status to UI step
    let currentStep: 'upload' | 'extract' | 'categorize' | 'dashboard';
    switch (activeSession.status) {
      case 'Uploading':
        currentStep = 'upload';
        break;
      case 'Extracting':
        currentStep = 'extract';
        break;
      case 'Extracted':
      case 'InProgress':
        currentStep = 'categorize';
        break;
      default:
        currentStep = 'upload';
    }

    return NextResponse.json({
      hasActiveSession: true,
      session: {
        sessionId: activeSession.id,
        fileName: activeSession.pstFileName,
        status: activeSession.status,
        currentStep,
        progress: {
          totalDocuments: activeSession.totalDocuments,
          categorizedCount: activeSession.categorizedCount,
          skippedCount: activeSession.skippedCount,
          analyzedCount: activeSession.analyzedCount,
        },
        createdAt: activeSession.createdAt,
        updatedAt: activeSession.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Active session check error:', error);
    return NextResponse.json({ error: 'Failed to check active session' }, { status: 500 });
  }
}
