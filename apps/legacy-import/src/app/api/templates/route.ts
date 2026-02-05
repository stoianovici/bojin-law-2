/**
 * Templates API Route
 * Lists extracted document templates for a session.
 * Part of AI Categorization Pipeline - Phase 5
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ============================================================================
// GET - List templates for a session
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    // Get templates with cluster info
    const templates = await prisma.documentTemplate.findMany({
      where: {
        cluster: {
          sessionId,
        },
      },
      include: {
        cluster: {
          select: {
            id: true,
            sessionId: true,
            suggestedName: true,
            approvedName: true,
            documentCount: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        sections: t.sections,
        variableFields: t.variableFields,
        boilerplateClauses: t.boilerplateClauses,
        styleGuide: t.styleGuide,
        sourceDocumentCount: t.cluster?.documentCount || 0,
        createdAt: t.createdAt,
        cluster: t.cluster,
      })),
      count: templates.length,
    });
  } catch (error) {
    console.error('Templates list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
