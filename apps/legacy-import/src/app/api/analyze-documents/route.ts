/**
 * API Route: Document AI Analysis
 * POST /api/analyze-documents
 * Triggers AI analysis for extracted documents
 * Part of Story 3.2.5 - Legacy Document Import
 */

import { NextRequest, NextResponse } from 'next/server';
import { documentAnalyzer } from '@/services/ai-document-analyzer';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    // TODO: Add authentication check when auth is implemented
    // For now, allow all requests during development

    const { sessionId, documentIds } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      );
    }

    // Validate session exists
    const importSession = await prisma.legacyImportSession.findUnique({
      where: { id: sessionId },
    });

    if (!importSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // If no document IDs provided, get all unanalyzed documents
    let docsToAnalyze = documentIds;
    if (!documentIds || documentIds.length === 0) {
      const unanalyzedDocs = await prisma.extractedDocument.findMany({
        where: {
          sessionId,
          primaryLanguage: null,
        },
        select: { id: true },
        take: 100, // Process in batches of 100
      });
      docsToAnalyze = unanalyzedDocs.map((d: { id: string }) => d.id);
    }

    if (docsToAnalyze.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No documents to analyze',
        analyzed: 0,
      });
    }

    // Start analysis job
    const result = await documentAnalyzer.analyzeDocuments(sessionId, docsToAnalyze);

    return NextResponse.json({
      success: true,
      jobId: result.jobId,
      estimatedCostEUR: result.estimatedCost,
      documentCount: docsToAnalyze.length,
      message: `Analysis started for ${docsToAnalyze.length} documents`,
    });
  } catch (error) {
    console.error('Document analysis error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('cost limit')) {
      return NextResponse.json(
        { error: 'Session has reached the €10 cost limit' },
        { status: 402 } // Payment Required
      );
    }

    return NextResponse.json(
      { error: 'Failed to start document analysis', details: errorMessage },
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
    // TODO: Add authentication check when auth is implemented

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

    // Get template potential distribution
    const templateStats = await prisma.extractedDocument.groupBy({
      by: ['templatePotential'],
      where: {
        sessionId,
        templatePotential: { not: null }
      },
      _count: true,
    });

    return NextResponse.json({
      ...status,
      languageDistribution: languageStats.reduce((acc: Record<string, number>, stat: { primaryLanguage: string | null; _count: number }) => {
        acc[stat.primaryLanguage || 'Unknown'] = stat._count;
        return acc;
      }, {}),
      documentTypes: typeStats.reduce((acc: Record<string, number>, stat: { documentType: string | null; _count: number }) => {
        acc[stat.documentType || 'Unknown'] = stat._count;
        return acc;
      }, {}),
      templatePotential: templateStats.reduce((acc: Record<string, number>, stat: { templatePotential: string | null; _count: number }) => {
        acc[stat.templatePotential || 'Unknown'] = stat._count;
        return acc;
      }, {}),
    });
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { error: 'Failed to get analysis status' },
      { status: 500 }
    );
  }
}