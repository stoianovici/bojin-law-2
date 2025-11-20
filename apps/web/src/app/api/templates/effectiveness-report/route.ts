/**
 * Template Effectiveness Report API
 * Story 2.12.1 - AC6
 *
 * GET /api/templates/effectiveness-report?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Generates effectiveness report for a period
 */

import { NextRequest, NextResponse } from 'next/server';
import { TemplateUsageTrackingService } from '@/lib/services/template-usage-tracking.service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');

    // Default to last 30 days if not specified
    const endDate = endParam ? new Date(endParam) : new Date();
    const startDate = startParam
      ? new Date(startParam)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const service = new TemplateUsageTrackingService();

    const report = await service.generateEffectivenessReport(startDate, endDate);

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('Effectiveness report error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
