/**
 * Template Generation API Endpoint
 * Story 2.12.1 - Task 7: Admin Dashboard
 *
 * POST /api/admin/templates/generate
 * Trigger template generation for a document type
 */

import { NextRequest, NextResponse } from 'next/server';
import { discoveryStatusService } from '@/lib/services/discovery-status.service';
import type { TemplateGenerationRequest } from '@/lib/services/discovery-status.service';

export async function POST(request: NextRequest) {
  try {
    const body: TemplateGenerationRequest = await request.json();

    // Validate request
    if (!body.typeId) {
      return NextResponse.json({ error: 'Type ID is required' }, { status: 400 });
    }

    if (!body.language) {
      return NextResponse.json({ error: 'Language is required' }, { status: 400 });
    }

    if (typeof body.includeEnglish !== 'boolean') {
      return NextResponse.json({ error: 'includeEnglish must be a boolean' }, { status: 400 });
    }

    // Trigger template generation
    await discoveryStatusService.triggerTemplateGeneration(body);

    return NextResponse.json({
      success: true,
      message: 'Template generation triggered successfully',
      template: {
        typeId: body.typeId,
        language: body.language,
        includeEnglish: body.includeEnglish,
      },
    });
  } catch (error) {
    console.error('Template generation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to trigger template generation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
