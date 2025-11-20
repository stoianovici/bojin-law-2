/**
 * API Route: Document AI Analysis
 * POST /api/analyze-documents
 * Triggers AI analysis for extracted documents
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { documentAnalyzer } from '@/services/ai-document-analyzer';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !['Partner', 'Assistant'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { sessionId, documentIds } = await request.json();

    // Validate session exists and user has access
    const importSession = await prisma.importSession.findUnique({
      where: { id: sessionId },
    });

    if (!importSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Start analysis job
    const result = await documentAnalyzer.analyzeDocuments(sessionId, documentIds);

    return NextResponse.json({
      success: true,
      jobId: result.jobId,
      estimatedCostEUR: result.estimatedCost,
      message: `Analysis started for ${documentIds.length} documents`,
    });
  } catch (error) {
    console.error('Document analysis error:', error);

    if (error.message?.includes('cost limit')) {
      return NextResponse.json(
        { error: 'Session has reached the €10 cost limit' },
        { status: 402 } // Payment Required
      );
    }

    return NextResponse.json(
      { error: 'Failed to start document analysis' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/analyze-documents?sessionId=xxx
 * Get analysis status for a session
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      );
    }

    const status = await documentAnalyzer.getAnalysisStatus(sessionId);

    // Get language distribution
    const languageStats = await prisma.extractedDocument.groupBy({
      by: ['primaryLanguage'],
      where: { sessionId },
      _count: true,
    });

    // Get document type distribution
    const typeStats = await prisma.extractedDocument.groupBy({
      by: ['documentType'],
      where: {
        sessionId,
        documentType: { not: null }
      },
      _count: true,
    });

    return NextResponse.json({
      ...status,
      languageDistribution: languageStats.reduce((acc, stat) => {
        acc[stat.primaryLanguage || 'Unknown'] = stat._count;
        return acc;
      }, {} as Record<string, number>),
      documentTypes: typeStats.reduce((acc, stat) => {
        acc[stat.documentType || 'Unknown'] = stat._count;
        return acc;
      }, {} as Record<string, number>),
    });
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { error: 'Failed to get analysis status' },
      { status: 500 }
    );
  }
}