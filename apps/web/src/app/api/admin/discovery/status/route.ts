/**
 * Discovery Status API Endpoint
 * Story 2.12.1 - Task 7: Admin Dashboard
 *
 * GET /api/admin/discovery/status
 * Returns discovery statistics and document type information
 */

import { NextRequest, NextResponse } from 'next/server';
import { discoveryStatusService } from '@/lib/services/discovery-status.service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const detailed = searchParams.get('detailed') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const sortBy = (searchParams.get('sortBy') as 'priority' | 'occurrences' | 'recent') || 'priority';

    // Get summary status
    const status = await discoveryStatusService.getStatus();

    // If detailed view requested, include document types
    if (detailed) {
      const documentTypes = await discoveryStatusService.getDocumentTypes(limit, offset, sortBy);
      const pendingReview = await discoveryStatusService.getPendingReview();
      const trends = await discoveryStatusService.getDiscoveryTrends(30);

      return NextResponse.json({
        ...status,
        documentTypes,
        pendingReview,
        trends,
      });
    }

    return NextResponse.json(status);
  } catch (error) {
    console.error('Discovery status error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch discovery status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
