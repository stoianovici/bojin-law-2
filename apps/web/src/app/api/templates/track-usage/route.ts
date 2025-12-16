/**
 * Template Usage Tracking API
 * Story 2.12.1 - AC6
 *
 * POST /api/templates/track-usage
 * Records template usage event
 */

import { NextRequest, NextResponse } from 'next/server';
import { TemplateUsageTrackingService } from '@/lib/services/template-usage-tracking.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      templateId,
      userId,
      executionTimeMs,
      timeSavedMinutes,
      variablesProvided,
      outputFormat,
      success,
      errorMessage,
    } = body;

    if (!templateId) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
    }

    const service = new TemplateUsageTrackingService();

    await service.trackUsage({
      template_id: templateId,
      user_id: userId,
      execution_time_ms: executionTimeMs,
      time_saved_minutes: timeSavedMinutes,
      variables_provided: variablesProvided || {},
      output_format: outputFormat,
      success: success !== false, // Default to true
      error_message: errorMessage,
    });

    return NextResponse.json({
      success: true,
      message: 'Usage tracked successfully',
    });
  } catch (error) {
    console.error('Usage tracking error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
