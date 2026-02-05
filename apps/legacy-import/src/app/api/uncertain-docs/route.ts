/**
 * Uncertain Documents API Route
 * Lists and handles documents that AI couldn't confidently classify.
 * Part of AI Categorization Pipeline - Phase 3
 *
 * Actions:
 * - DELETE: Mark document as deleted (validationStatus = 'Deleted')
 * - RECLASSIFY: Mark document for re-clustering with annotation (validationStatus = 'Reclassified')
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ValidationStatus } from '@/generated/prisma';
import { getAuthUser } from '@/lib/auth';

// Valid actions for uncertain documents
type UncertainDocAction = 'delete' | 'reclassify';

// ============================================================================
// GET - List uncertain documents (excluding already processed ones)
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const includeProcessed = searchParams.get('includeProcessed') === 'true';

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    // Build filter: uncertain docs that haven't been processed yet
    const where: any = {
      sessionId,
      triageStatus: 'Uncertain',
    };

    // By default, exclude documents that have already been processed (Deleted or Reclassified)
    if (!includeProcessed) {
      where.OR = [
        { validationStatus: null },
        { validationStatus: { notIn: ['Deleted', 'Reclassified'] as ValidationStatus[] } },
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
        triageStatus: true,
        triageConfidence: true,
        triageReason: true,
        suggestedDocType: true,
        storagePath: true,
        validationStatus: true,
        validatedBy: true,
        validatedAt: true,
        reclassificationNote: true,
      },
      orderBy: [
        { triageConfidence: 'asc' }, // Lowest confidence first (most uncertain)
        { createdAt: 'asc' },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // Get validator names for documents that have been validated
    const validatorIds = [
      ...new Set(documents.filter((d) => d.validatedBy).map((d) => d.validatedBy!)),
    ];
    const validators =
      validatorIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: validatorIds } },
            select: { id: true, firstName: true, lastName: true },
          })
        : [];
    const validatorMap = new Map(validators.map((v) => [v.id, `${v.firstName} ${v.lastName}`]));

    // Format response
    const formattedDocs = documents.map((doc) => ({
      id: doc.id,
      fileName: doc.fileName,
      fileExtension: doc.fileExtension,
      textPreview: doc.extractedText?.substring(0, 1000) || null,
      emailSubject: doc.emailSubject,
      emailSender: doc.emailSender,
      emailDate: doc.emailDate,
      triageStatus: doc.triageStatus,
      triageConfidence: doc.triageConfidence,
      triageReason: doc.triageReason,
      suggestedDocType: doc.suggestedDocType,
      hasFile: !!doc.storagePath,
      validationStatus: doc.validationStatus,
      validatedBy: doc.validatedBy,
      validatedAt: doc.validatedAt,
      validatorName: doc.validatedBy ? validatorMap.get(doc.validatedBy) : null,
      reclassificationNote: doc.reclassificationNote,
    }));

    return NextResponse.json({
      documents: formattedDocs,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        hasMore: page * pageSize < totalCount,
      },
    });
  } catch (error) {
    console.error('Uncertain docs list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// POST - Delete or reclassify a single uncertain document
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Get current user for attribution
    const { user } = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { documentId, action, reclassificationNote } = body as {
      documentId: string;
      action: UncertainDocAction;
      reclassificationNote?: string;
    };

    if (!documentId || !action) {
      return NextResponse.json({ error: 'documentId and action required' }, { status: 400 });
    }

    // Validate action
    const validActions: UncertainDocAction[] = ['delete', 'reclassify'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `action must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    // Reclassify requires a note
    if (action === 'reclassify' && !reclassificationNote?.trim()) {
      return NextResponse.json(
        { error: 'reclassificationNote required for reclassify action' },
        { status: 400 }
      );
    }

    // Get document
    const document = await prisma.extractedDocument.findUnique({
      where: { id: documentId },
      select: { id: true, triageStatus: true, sessionId: true, validationStatus: true },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Verify document is uncertain
    if (document.triageStatus !== 'Uncertain') {
      return NextResponse.json({ error: 'Document is not in Uncertain status' }, { status: 400 });
    }

    // Check if already processed
    if (document.validationStatus === 'Deleted' || document.validationStatus === 'Reclassified') {
      return NextResponse.json({ error: 'Document has already been processed' }, { status: 400 });
    }

    // Determine validation status based on action
    const validationStatus: ValidationStatus = action === 'delete' ? 'Deleted' : 'Reclassified';
    const now = new Date();

    // Update document
    await prisma.extractedDocument.update({
      where: { id: documentId },
      data: {
        validationStatus,
        validatedBy: user.id,
        validatedAt: now,
        ...(action === 'reclassify' && { reclassificationNote: reclassificationNote?.trim() }),
      },
    });

    return NextResponse.json({
      success: true,
      documentId,
      action,
      validationStatus,
      validatedBy: user.id,
      validatorName: `${user.firstName} ${user.lastName}`,
      validatedAt: now.toISOString(),
      ...(action === 'reclassify' && { reclassificationNote: reclassificationNote?.trim() }),
    });
  } catch (error) {
    console.error('Uncertain doc action error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// PUT - Bulk delete or reclassify uncertain documents
// ============================================================================

export async function PUT(request: NextRequest) {
  try {
    // Get current user for attribution
    const { user } = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { documentIds, action, reclassificationNote } = body as {
      documentIds: string[];
      action: UncertainDocAction;
      reclassificationNote?: string;
    };

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json({ error: 'documentIds array required' }, { status: 400 });
    }

    if (!action) {
      return NextResponse.json({ error: 'action required' }, { status: 400 });
    }

    // Validate action
    const validActions: UncertainDocAction[] = ['delete', 'reclassify'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `action must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    // Reclassify requires a note
    if (action === 'reclassify' && !reclassificationNote?.trim()) {
      return NextResponse.json(
        { error: 'reclassificationNote required for reclassify action' },
        { status: 400 }
      );
    }

    // Determine validation status based on action
    const validationStatus: ValidationStatus = action === 'delete' ? 'Deleted' : 'Reclassified';
    const now = new Date();

    // Update all documents with attribution
    // Only update uncertain docs that haven't been processed yet
    const result = await prisma.extractedDocument.updateMany({
      where: {
        id: { in: documentIds },
        triageStatus: 'Uncertain',
        OR: [
          { validationStatus: null },
          { validationStatus: { notIn: ['Deleted', 'Reclassified'] as ValidationStatus[] } },
        ],
      },
      data: {
        validationStatus,
        validatedBy: user.id,
        validatedAt: now,
        ...(action === 'reclassify' && { reclassificationNote: reclassificationNote?.trim() }),
      },
    });

    return NextResponse.json({
      success: true,
      updatedCount: result.count,
      action,
      validationStatus,
      validatedBy: user.id,
      validatorName: `${user.firstName} ${user.lastName}`,
      validatedAt: now.toISOString(),
      ...(action === 'reclassify' && { reclassificationNote: reclassificationNote?.trim() }),
    });
  } catch (error) {
    console.error('Uncertain docs bulk action error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
