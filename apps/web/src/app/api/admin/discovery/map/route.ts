/**
 * Manual Mapping API Endpoint
 * Story 2.12.1 - Task 7: Admin Dashboard
 *
 * POST /api/admin/discovery/map
 * Manually map a document type to a skill
 */

import { NextRequest, NextResponse } from 'next/server';
import { discoveryStatusService } from '@/lib/services/discovery-status.service';
import type { MappingRequest } from '@/lib/services/discovery-status.service';

export async function POST(request: NextRequest) {
  try {
    const body: MappingRequest = await request.json();

    // Validate request
    if (!body.typeId) {
      return NextResponse.json(
        { error: 'Type ID is required' },
        { status: 400 }
      );
    }

    if (!body.targetSkill) {
      return NextResponse.json(
        { error: 'Target skill is required' },
        { status: 400 }
      );
    }

    if (typeof body.confidence !== 'number' || body.confidence < 0 || body.confidence > 1) {
      return NextResponse.json(
        { error: 'Confidence must be a number between 0 and 1' },
        { status: 400 }
      );
    }

    if (!body.reviewedBy) {
      return NextResponse.json(
        { error: 'Reviewed by is required' },
        { status: 400 }
      );
    }

    // Perform mapping
    await discoveryStatusService.mapTypeToSkill(body);

    return NextResponse.json({
      success: true,
      message: 'Document type mapped successfully',
      mapping: {
        typeId: body.typeId,
        skillId: body.targetSkill,
        confidence: body.confidence,
      },
    });
  } catch (error) {
    console.error('Document type mapping error:', error);
    return NextResponse.json(
      {
        error: 'Failed to map document type',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
