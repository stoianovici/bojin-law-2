/**
 * Template ROI API
 * Story 2.12.1 - AC6
 *
 * GET /api/templates/roi/[templateId]?period=30
 * Calculates ROI for a specific template
 */

import { NextRequest, NextResponse } from 'next/server';
import { TemplateUsageTrackingService } from '@/lib/services/template-usage-tracking.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const { templateId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const period = parseInt(searchParams.get('period') || '30');

    const service = new TemplateUsageTrackingService();

    const roi = await service.calculateROI(templateId, period);

    return NextResponse.json({
      success: true,
      data: roi,
    });
  } catch (error) {
    console.error('ROI calculation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
