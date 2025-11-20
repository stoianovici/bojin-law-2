/**
 * Templates Listing API Endpoint
 * Story 2.12.1 - Task 6: Template Integration
 *
 * GET /api/documents/templates
 * Lists all available Romanian legal templates
 *
 * GET /api/documents/templates?category=legal_correspondence
 * Filters templates by category
 */

import { NextRequest, NextResponse } from 'next/server';
import { romanianDocumentGenerator } from '@/lib/services/romanian-document-generator.service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const complexity = searchParams.get('complexity');
    const language = searchParams.get('language');

    // If filters provided, use search
    if (category || complexity || language) {
      const templates = romanianDocumentGenerator.searchTemplates({
        category: category || undefined,
        complexity: complexity || undefined,
        language: language || undefined,
      });

      return NextResponse.json({
        templates,
        count: templates.length,
        filters: { category, complexity, language },
      });
    }

    // Otherwise return all templates
    const templates = romanianDocumentGenerator.getAvailableTemplates();

    return NextResponse.json({
      templates,
      count: templates.length,
    });
  } catch (error) {
    console.error('Templates listing error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
