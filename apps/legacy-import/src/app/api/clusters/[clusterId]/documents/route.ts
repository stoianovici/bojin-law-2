/**
 * Cluster Documents API Route
 * Lists and manages individual documents within a cluster.
 * Enables granular document review with Accept/Delete/Reclassify actions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

// Document validation status
type ValidationStatus = 'Pending' | 'Accepted' | 'Deleted' | 'Reclassified';

// Document actions
type DocumentAction = 'accept' | 'delete' | 'reclassify';

// ============================================================================
// GET - List all documents in a cluster (paginated)
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clusterId: string }> }
) {
  try {
    const { clusterId } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const status = searchParams.get('status') as ValidationStatus | null;
    const search = searchParams.get('search') || '';

    // Verify cluster exists
    const cluster = await prisma.documentCluster.findUnique({
      where: { id: clusterId },
      select: { id: true, suggestedName: true, documentCount: true, status: true },
    });

    if (!cluster) {
      return NextResponse.json({ error: 'Cluster not found' }, { status: 404 });
    }

    // Build filter
    const where: any = { clusterId };

    // Filter by validation status
    if (status) {
      where.validationStatus = status;
    }

    // Search in filename or email subject
    if (search) {
      where.OR = [
        { fileName: { contains: search, mode: 'insensitive' } },
        { emailSubject: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get total count
    const totalCount = await prisma.extractedDocument.count({ where });

    // Get paginated documents
    const documents = await prisma.extractedDocument.findMany({
      where,
      select: {
        id: true,
        fileName: true,
        fileExtension: true,
        extractedText: true,
        emailSubject: true,
        emailSender: true,
        emailDate: true,
        storagePath: true,
        // Classification fields
        triageStatus: true,
        triageConfidence: true,
        triageReason: true,
        suggestedDocType: true,
        // Validation fields
        validationStatus: true,
        validatedBy: true,
        validatedAt: true,
        reclassificationNote: true,
      },
      orderBy: [
        { triageConfidence: 'desc' }, // High confidence first
        { fileName: 'asc' },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // Format response
    const formattedDocs = documents.map((doc) => ({
      id: doc.id,
      fileName: doc.fileName,
      fileExtension: doc.fileExtension,
      textPreview: doc.extractedText?.substring(0, 500) || null,
      emailSubject: doc.emailSubject,
      emailSender: doc.emailSender,
      emailDate: doc.emailDate,
      hasFile: !!doc.storagePath,
      // Classification
      triageStatus: doc.triageStatus,
      triageConfidence: doc.triageConfidence,
      triageReason: doc.triageReason,
      suggestedDocType: doc.suggestedDocType,
      // Validation
      validationStatus: doc.validationStatus || 'Pending',
      validatedBy: doc.validatedBy,
      validatedAt: doc.validatedAt,
      reclassificationNote: doc.reclassificationNote,
    }));

    // Get counts by validation status
    const statusCounts = await prisma.extractedDocument.groupBy({
      by: ['validationStatus'],
      where: { clusterId },
      _count: true,
    });

    const stats = {
      total: cluster.documentCount,
      pending: 0,
      accepted: 0,
      deleted: 0,
      reclassified: 0,
    };

    statusCounts.forEach((s) => {
      const status = s.validationStatus || 'Pending';
      if (status === 'Pending') stats.pending = s._count;
      else if (status === 'Accepted') stats.accepted = s._count;
      else if (status === 'Deleted') stats.deleted = s._count;
      else if (status === 'Reclassified') stats.reclassified = s._count;
    });

    // Count docs without explicit status as pending
    const explicitCount = stats.pending + stats.accepted + stats.deleted + stats.reclassified;
    if (explicitCount < cluster.documentCount) {
      stats.pending += cluster.documentCount - explicitCount;
    }

    return NextResponse.json({
      cluster: {
        id: cluster.id,
        name: cluster.suggestedName,
        status: cluster.status,
      },
      documents: formattedDocs,
      stats,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        hasMore: page * pageSize < totalCount,
      },
    });
  } catch (error) {
    console.error('Cluster documents list error:', error);
    // Return detailed error in development
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Single document action (accept/delete/reclassify)
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clusterId: string }> }
) {
  try {
    // Get current user for attribution
    const { user } = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { clusterId } = await params;
    const body = await request.json();
    const { documentId, action, reclassificationNote } = body;

    if (!documentId || !action) {
      return NextResponse.json({ error: 'documentId and action required' }, { status: 400 });
    }

    const validActions: DocumentAction[] = ['accept', 'delete', 'reclassify'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `action must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate reclassification note is provided for reclassify action
    if (action === 'reclassify' && !reclassificationNote) {
      return NextResponse.json(
        { error: 'reclassificationNote required for reclassify action' },
        { status: 400 }
      );
    }

    // Get document
    const document = await prisma.extractedDocument.findUnique({
      where: { id: documentId },
      select: { id: true, clusterId: true },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (document.clusterId !== clusterId) {
      return NextResponse.json(
        { error: 'Document does not belong to this cluster' },
        { status: 400 }
      );
    }

    const now = new Date();

    // Perform action
    if (action === 'accept') {
      await prisma.extractedDocument.update({
        where: { id: documentId },
        data: {
          validationStatus: 'Accepted',
          validatedBy: user.id,
          validatedAt: now,
          reclassificationNote: null, // Clear any previous note
        },
      });
    } else if (action === 'delete') {
      await prisma.extractedDocument.update({
        where: { id: documentId },
        data: {
          validationStatus: 'Deleted',
          validatedBy: user.id,
          validatedAt: now,
          reclassificationNote: null, // Clear any previous note
        },
      });
    } else if (action === 'reclassify') {
      await prisma.extractedDocument.update({
        where: { id: documentId },
        data: {
          validationStatus: 'Reclassified',
          validatedBy: user.id,
          validatedAt: now,
          reclassificationNote: reclassificationNote,
        },
      });
    }

    return NextResponse.json({
      success: true,
      documentId,
      action,
      validatedBy: user.id,
      validatorName: `${user.firstName} ${user.lastName}`,
    });
  } catch (error) {
    console.error('Cluster document action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT - Bulk document actions (accept/delete/reclassify)
// ============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ clusterId: string }> }
) {
  try {
    // Get current user for attribution
    const { user } = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { clusterId } = await params;
    const body = await request.json();
    const { documentIds, action, reclassificationNote } = body;

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json({ error: 'documentIds array required' }, { status: 400 });
    }

    if (!action) {
      return NextResponse.json({ error: 'action required' }, { status: 400 });
    }

    const validActions: DocumentAction[] = ['accept', 'delete', 'reclassify'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `action must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate reclassification note is provided for reclassify action
    if (action === 'reclassify' && !reclassificationNote) {
      return NextResponse.json(
        { error: 'reclassificationNote required for reclassify action' },
        { status: 400 }
      );
    }

    // Verify all documents belong to this cluster
    const docCount = await prisma.extractedDocument.count({
      where: {
        id: { in: documentIds },
        clusterId,
      },
    });

    if (docCount !== documentIds.length) {
      return NextResponse.json(
        { error: 'Some documents do not belong to this cluster' },
        { status: 400 }
      );
    }

    const now = new Date();
    let updatedCount = 0;

    if (action === 'accept') {
      const result = await prisma.extractedDocument.updateMany({
        where: {
          id: { in: documentIds },
          clusterId,
        },
        data: {
          validationStatus: 'Accepted',
          validatedBy: user.id,
          validatedAt: now,
          reclassificationNote: null, // Clear any previous note
        },
      });
      updatedCount = result.count;
    } else if (action === 'delete') {
      const result = await prisma.extractedDocument.updateMany({
        where: {
          id: { in: documentIds },
          clusterId,
        },
        data: {
          validationStatus: 'Deleted',
          validatedBy: user.id,
          validatedAt: now,
          reclassificationNote: null, // Clear any previous note
        },
      });
      updatedCount = result.count;
    } else if (action === 'reclassify') {
      const result = await prisma.extractedDocument.updateMany({
        where: {
          id: { in: documentIds },
          clusterId,
        },
        data: {
          validationStatus: 'Reclassified',
          validatedBy: user.id,
          validatedAt: now,
          reclassificationNote: reclassificationNote,
        },
      });
      updatedCount = result.count;
    }

    return NextResponse.json({
      success: true,
      updatedCount,
      action,
      validatedBy: user.id,
      validatorName: `${user.firstName} ${user.lastName}`,
    });
  } catch (error) {
    console.error('Cluster documents bulk action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}
