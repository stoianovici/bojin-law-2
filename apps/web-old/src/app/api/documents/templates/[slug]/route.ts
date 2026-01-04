/**
 * Template Details API Endpoint
 * Story 2.12.1 - Task 6: Template Integration
 *
 * GET /api/documents/templates/[slug]
 * Gets detailed information about a specific template
 */

import { NextRequest, NextResponse } from 'next/server';
import { romanianDocumentGenerator } from '@/lib/services/romanian-document-generator.service';
import type { RomanianTemplateSlug } from '@/lib/services/romanian-document-generator.service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug: slugValue } = await params;
    const slug = slugValue as RomanianTemplateSlug;

    // Get template info
    try {
      const metadata = romanianDocumentGenerator.getTemplateInfo(slug);
      const timeSavings = romanianDocumentGenerator.estimateTimeSavings(slug);

      return NextResponse.json({
        slug,
        metadata,
        timeSavings,
      });
    } catch (error) {
      return NextResponse.json({ error: `Template not found: ${slug}` }, { status: 404 });
    }
  } catch (error) {
    console.error('Template details error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
