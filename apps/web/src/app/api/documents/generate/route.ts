/**
 * Document Generation API Endpoint
 * Story 2.12.1 - Task 6: Template Integration
 *
 * POST /api/documents/generate
 * Generates Romanian legal documents from templates
 */

import { NextRequest, NextResponse } from 'next/server';
import { romanianDocumentGenerator } from '@/lib/services/romanian-document-generator.service';
import type { RomanianTemplateSlug } from '@/lib/services/romanian-document-generator.service';

export interface GenerateDocumentRequest {
  templateSlug: RomanianTemplateSlug;
  variables: Record<string, string>;
  format?: 'markdown' | 'html' | 'plain';
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateDocumentRequest = await request.json();

    // Validate request
    if (!body.templateSlug) {
      return NextResponse.json({ error: 'Template slug is required' }, { status: 400 });
    }

    if (!body.variables || typeof body.variables !== 'object') {
      return NextResponse.json({ error: 'Variables object is required' }, { status: 400 });
    }

    // Generate document
    const result = await romanianDocumentGenerator.generateDocument({
      templateSlug: body.templateSlug,
      variables: body.variables,
      format: body.format || 'markdown',
    });

    if (!result.success) {
      return NextResponse.json(
        { error: 'Document generation failed', details: result.errors },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      document: result.document,
      metadata: result.metadata,
      warnings: result.warnings,
    });
  } catch (error) {
    console.error('Document generation error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Document generation endpoint. Use POST to generate documents.',
    availableTemplates: romanianDocumentGenerator.getAvailableTemplates(),
  });
}
