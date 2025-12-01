/**
 * Active Session API Route
 * GET /api/active-session?userId=xxx
 * GET /api/active-session (without userId - returns most recent session with documents)
 * Returns user's most recent incomplete import session for auto-resume
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    let activeSession;

    if (userId) {
      // Find user's most recent incomplete session
      // Status order of priority: InProgress > Extracting > Uploading
      activeSession = await prisma.legacyImportSession.findFirst({
        where: {
          uploadedBy: userId,
          status: {
            in: ['Uploading', 'Extracting', 'InProgress'],
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
    } else {
      // No userId - return most recent session with documents (for public access)
      activeSession = await prisma.legacyImportSession.findFirst({
        where: {
          status: {
            in: ['Extracted', 'InProgress'],
          },
          totalDocuments: {
            gt: 0,
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
    }

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
    console.error('Active session check error:', error);
    return NextResponse.json({ error: 'Failed to check active session' }, { status: 500 });
  }
}
