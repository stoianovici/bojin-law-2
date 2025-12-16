/**
 * Pattern Extraction API
 * Story 2.12.1 - AC4
 *
 * POST /api/patterns/extract
 * Extracts patterns from a set of documents
 */

import { NextRequest, NextResponse } from 'next/server';
import { PatternExtractionService } from '@/lib/services/pattern-extraction.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { documents, typeId } = body;

    if (!documents || !Array.isArray(documents)) {
      return NextResponse.json({ error: 'Documents array is required' }, { status: 400 });
    }

    const service = new PatternExtractionService();

    // Extract common phrases
    const phrases = await service.extractCommonPhrases(documents);

    // Identify clause structures
    const structures = await service.identifyClauseStructures(documents);

    // Build clause library
    const patterns = await service.buildClauseLibrary(phrases, structures);

    // Calculate quality score
    const qualityScore = await service.calculateTemplateQuality(
      typeId || 'unknown',
      documents,
      patterns
    );

    // Generate template structure
    const templateStructure = await service.generateTemplateStructure(
      typeId || 'unknown',
      documents,
      patterns
    );

    return NextResponse.json({
      success: true,
      data: {
        phrases: phrases.slice(0, 20), // Top 20
        structures,
        patterns: patterns.slice(0, 30), // Top 30
        qualityScore,
        templateStructure,
      },
    });
  } catch (error) {
    console.error('Pattern extraction error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
