/**
 * Document Validation API Endpoint
 * Story 2.12.1 - Task 6: Template Integration
 *
 * POST /api/documents/validate
 * Validates template variables without generating document
 */

import { NextRequest, NextResponse } from 'next/server';
import { romanianDocumentGenerator } from '@/lib/services/romanian-document-generator.service';
import type { RomanianTemplateSlug } from '@/lib/services/romanian-document-generator.service';

export interface ValidateDocumentRequest {
  templateSlug: RomanianTemplateSlug;
  variables: Record<string, string>;
}

export async function POST(request: NextRequest) {
  try {
    const body: ValidateDocumentRequest = await request.json();

    // Validate request
    if (!body.templateSlug) {
      return NextResponse.json({ error: 'Template slug is required' }, { status: 400 });
    }

    if (!body.variables || typeof body.variables !== 'object') {
      return NextResponse.json({ error: 'Variables object is required' }, { status: 400 });
    }

    // Validate variables
    const result = romanianDocumentGenerator.validateVariables(body.templateSlug, body.variables);

    return NextResponse.json({
      valid: result.valid,
      missing: result.missing,
      warnings: result.warnings,
    });
  } catch (error) {
    console.error('Document validation error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
