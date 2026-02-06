/**
 * Smart Merge API
 *
 * GET: Analyze clusters and get merge suggestions
 * POST: Execute approved merges
 */

import { NextRequest, NextResponse } from 'next/server';
import { smartMergeService } from '@/services/smart-merge.service';
import type { MergeGroup } from '@/services/smart-merge.service';

// ============================================================================
// GET - Analyze and preview merge suggestions
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    console.log(`[API] Analyzing clusters for smart merge: ${sessionId}`);

    // Get merge analysis
    const analysis = await smartMergeService.analyzeClusters(sessionId);

    // Generate preview
    const preview = await smartMergeService.previewMerges(analysis);

    return NextResponse.json({
      success: true,
      analysis,
      preview,
    });
  } catch (error) {
    console.error('[API] Smart merge analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Execute approved merges
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, mergeGroups, mode } = body as {
      sessionId: string;
      mergeGroups?: MergeGroup[];
      mode?: 'quick' | 'custom';
    };

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    // Quick merge mode - uses pattern detection, no manual merge groups needed
    if (mode === 'quick') {
      console.log(`[API] Executing quick merge for session: ${sessionId}`);
      const result = await smartMergeService.quickMerge(sessionId);

      return NextResponse.json({
        success: result.success,
        mergedCount: result.mergedCount,
        newClusterCount: result.newClusterCount,
        errors: result.errors,
      });
    }

    // Custom merge mode - requires merge groups
    if (!mergeGroups || !Array.isArray(mergeGroups) || mergeGroups.length === 0) {
      return NextResponse.json(
        { error: 'mergeGroups array is required (or use mode: "quick")' },
        { status: 400 }
      );
    }

    console.log(`[API] Executing ${mergeGroups.length} merge groups for session: ${sessionId}`);

    // Execute merges
    const result = await smartMergeService.executeMerges(sessionId, mergeGroups);

    return NextResponse.json({
      success: result.success,
      mergedCount: result.mergedCount,
      newClusterCount: result.newClusterCount,
      errors: result.errors,
    });
  } catch (error) {
    console.error('[API] Smart merge execution error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Merge execution failed' },
      { status: 500 }
    );
  }
}
