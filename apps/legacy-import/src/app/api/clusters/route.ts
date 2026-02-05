/**
 * Clusters API Route
 * Lists and manages document clusters for validation.
 * Part of AI Categorization Pipeline - Phase 3
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ClusterStatus } from '@/generated/prisma';
import { getAuthUser } from '@/lib/auth';
import { templateExtractionService } from '@/services/template-extraction.service';

// Minimum documents required for template extraction
const MIN_DOCS_FOR_TEMPLATE = 5;

// ============================================================================
// GET - List clusters for a session
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const status = searchParams.get('status') as ClusterStatus | null;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    // Check if deleted clusters should be included
    const includeDeleted = searchParams.get('includeDeleted') === 'true';

    // Build filter
    const where: any = { sessionId };
    if (status) {
      where.status = status;
    }
    // By default, filter out deleted clusters
    if (!includeDeleted) {
      where.isDeleted = false;
    }

    // Get clusters
    const clusters = await prisma.documentCluster.findMany({
      where,
      orderBy: [
        { status: 'asc' }, // Pending first
        { documentCount: 'desc' }, // Largest first
      ],
    });

    // Batch fetch: collect all sample document IDs and validator IDs
    const allSampleDocIds = new Set<string>();
    const allValidatorIds = new Set<string>();

    for (const cluster of clusters) {
      for (const docId of cluster.sampleDocumentIds) {
        allSampleDocIds.add(docId);
      }
      if (cluster.validatedBy) {
        allValidatorIds.add(cluster.validatedBy);
      }
    }

    // Fetch all sample documents in one query
    const sampleDocsArray =
      allSampleDocIds.size > 0
        ? await prisma.extractedDocument.findMany({
            where: { id: { in: Array.from(allSampleDocIds) } },
            select: {
              id: true,
              fileName: true,
              fileExtension: true,
              extractedText: true,
              emailSubject: true,
              storagePath: true,
              triageStatus: true,
              triageConfidence: true,
              triageReason: true,
              suggestedDocType: true,
            },
          })
        : [];

    // Create lookup map for sample documents
    const sampleDocsMap = new Map(sampleDocsArray.map((doc) => [doc.id, doc]));

    // Fetch all validators in one query
    const validatorsArray =
      allValidatorIds.size > 0
        ? await prisma.user.findMany({
            where: { id: { in: Array.from(allValidatorIds) } },
            select: { id: true, firstName: true, lastName: true },
          })
        : [];

    // Create lookup map for validators
    const validatorsMap = new Map(
      validatorsArray.map((v) => [v.id, `${v.firstName} ${v.lastName}`])
    );

    // Fetch validation counts per cluster
    const clusterIds = clusters.map((c) => c.id);
    const validationCountsRaw =
      clusterIds.length > 0
        ? await prisma.extractedDocument.groupBy({
            by: ['clusterId', 'validationStatus'],
            where: { clusterId: { in: clusterIds } },
            _count: true,
          })
        : [];

    // Build validation counts map: clusterId -> { accepted, deleted, reclassified, pending }
    const validationCountsMap = new Map<
      string,
      { accepted: number; deleted: number; reclassified: number; pending: number }
    >();

    for (const row of validationCountsRaw) {
      if (!row.clusterId) continue;

      if (!validationCountsMap.has(row.clusterId)) {
        validationCountsMap.set(row.clusterId, {
          accepted: 0,
          deleted: 0,
          reclassified: 0,
          pending: 0,
        });
      }

      const counts = validationCountsMap.get(row.clusterId)!;
      switch (row.validationStatus) {
        case 'Accepted':
          counts.accepted = row._count;
          break;
        case 'Deleted':
          counts.deleted = row._count;
          break;
        case 'Reclassified':
          counts.reclassified = row._count;
          break;
        case 'Pending':
          counts.pending = row._count;
          break;
        case null:
          // Documents without explicit status are treated as pending
          counts.pending += row._count;
          break;
      }
    }

    // Build response with pre-fetched data
    const clustersWithSamples = clusters.map((cluster) => {
      const sampleDocs = cluster.sampleDocumentIds
        .map((id) => sampleDocsMap.get(id))
        .filter((doc): doc is NonNullable<typeof doc> => doc !== undefined);

      return {
        id: cluster.id,
        suggestedName: cluster.suggestedName,
        suggestedNameEn: cluster.suggestedNameEn,
        description: cluster.description,
        documentCount: cluster.documentCount,
        status: cluster.status,
        approvedName: cluster.approvedName,
        validatedBy: cluster.validatedBy,
        validatedAt: cluster.validatedAt,
        validatorName: cluster.validatedBy ? validatorsMap.get(cluster.validatedBy) || null : null,
        createdAt: cluster.createdAt,
        updatedAt: cluster.updatedAt,
        isDeleted: cluster.isDeleted,
        validationCounts: validationCountsMap.get(cluster.id) || {
          accepted: 0,
          deleted: 0,
          reclassified: 0,
          pending: cluster.documentCount,
        },
        sampleDocuments: sampleDocs.map((doc) => ({
          id: doc.id,
          fileName: doc.fileName,
          fileExtension: doc.fileExtension,
          textPreview: doc.extractedText?.substring(0, 500) || null,
          emailSubject: doc.emailSubject,
          hasFile: !!doc.storagePath,
          triageStatus: doc.triageStatus,
          triageConfidence: doc.triageConfidence,
          triageReason: doc.triageReason,
          suggestedDocType: doc.suggestedDocType,
        })),
      };
    });

    // Get stats
    const stats = {
      total: clusters.length,
      pending: clusters.filter((c) => c.status === 'Pending').length,
      approved: clusters.filter((c) => c.status === 'Approved').length,
      rejected: clusters.filter((c) => c.status === 'Rejected').length,
      totalDocuments: clusters.reduce((sum, c) => sum + c.documentCount, 0),
    };

    return NextResponse.json({
      clusters: clustersWithSamples,
      stats,
    });
  } catch (error) {
    console.error('Clusters list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// POST - Approve/Reject/Delete a cluster
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Get current user for attribution
    const { user } = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { clusterId, action, approvedName } = body;

    if (!clusterId || !action) {
      return NextResponse.json({ error: 'clusterId and action required' }, { status: 400 });
    }

    if (!['approve', 'reject', 'delete'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "approve", "reject", or "delete"' },
        { status: 400 }
      );
    }

    // Get cluster
    const cluster = await prisma.documentCluster.findUnique({
      where: { id: clusterId },
    });

    if (!cluster) {
      return NextResponse.json({ error: 'Cluster not found' }, { status: 404 });
    }

    // Handle delete action separately
    if (action === 'delete') {
      // Soft delete the cluster and mark all documents as Deleted
      await prisma.$transaction(async (tx) => {
        // Mark cluster as deleted
        await tx.documentCluster.update({
          where: { id: clusterId },
          data: {
            isDeleted: true,
            deletedBy: user.id,
            deletedAt: new Date(),
          },
        });

        // Mark all documents in the cluster as Deleted
        await tx.extractedDocument.updateMany({
          where: { clusterId: clusterId },
          data: {
            validationStatus: 'Deleted',
            validatedBy: user.id,
            validatedAt: new Date(),
          },
        });
      });

      return NextResponse.json({
        success: true,
        clusterId,
        action: 'delete',
        deletedBy: user.id,
        deletedByName: `${user.firstName} ${user.lastName}`,
      });
    }

    // Update cluster status with attribution (approve/reject)
    const newStatus: ClusterStatus = action === 'approve' ? 'Approved' : 'Rejected';
    const updateData: any = {
      status: newStatus,
      validatedBy: user.id,
      validatedAt: new Date(),
    };

    // If approving, optionally set a custom name
    if (action === 'approve' && approvedName) {
      updateData.approvedName = approvedName;
    }

    await prisma.documentCluster.update({
      where: { id: clusterId },
      data: updateData,
    });

    // Check if all clusters are now validated (no pending)
    const pendingCount = await prisma.documentCluster.count({
      where: {
        sessionId: cluster.sessionId,
        status: 'Pending',
      },
    });

    let extractionTriggered = false;

    if (pendingCount === 0) {
      // All clusters validated - check if we should extract templates
      const approvedWithEnoughDocs = await prisma.documentCluster.count({
        where: {
          sessionId: cluster.sessionId,
          status: 'Approved',
          documentCount: { gte: MIN_DOCS_FOR_TEMPLATE },
        },
      });

      if (approvedWithEnoughDocs > 0) {
        // Check current pipeline status - only trigger if not already extracting/completed
        const session = await prisma.legacyImportSession.findUnique({
          where: { id: cluster.sessionId },
          select: { pipelineStatus: true },
        });

        if (session && !['Extracting', 'Completed'].includes(session.pipelineStatus || '')) {
          // Update status to Extracting
          await prisma.legacyImportSession.update({
            where: { id: cluster.sessionId },
            data: { pipelineStatus: 'Extracting' },
          });

          // Trigger template extraction asynchronously (fire and forget)
          extractionTriggered = true;
          templateExtractionService.extractTemplates(cluster.sessionId).catch((err) => {
            console.error('[AutoExtraction] Template extraction failed:', err);
            // Update status to failed
            prisma.legacyImportSession
              .update({
                where: { id: cluster.sessionId },
                data: {
                  pipelineStatus: 'Failed',
                  pipelineError: `Template extraction: ${err.message}`,
                },
              })
              .catch(console.error);
          });

          console.log(`[AutoExtraction] Triggered for session ${cluster.sessionId}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      clusterId,
      status: newStatus,
      validatedBy: user.id,
      validatorName: `${user.firstName} ${user.lastName}`,
      allValidated: pendingCount === 0,
      extractionTriggered,
    });
  } catch (error) {
    console.error('Cluster action error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
