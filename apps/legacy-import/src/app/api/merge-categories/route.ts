import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma';
import { requirePartner, AuthError } from '@/lib/auth';

interface MergeCategoriesRequest {
  sessionId: string;
  targetCategoryId: string; // The category to keep (primary)
  sourceCategoryIds: string[]; // Categories to merge into target
}

// POST /api/merge-categories - Merge multiple categories into one (Partner-only)
export async function POST(request: NextRequest) {
  try {
    // Require Partner role for category merge operations
    const user = await requirePartner(request);

    const body: MergeCategoriesRequest = await request.json();
    const { sessionId, targetCategoryId, sourceCategoryIds } = body;

    // Validate request
    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    if (!targetCategoryId) {
      return NextResponse.json(
        { error: 'targetCategoryId is required' },
        { status: 400 }
      );
    }

    if (!sourceCategoryIds || sourceCategoryIds.length === 0) {
      return NextResponse.json(
        { error: 'sourceCategoryIds must contain at least one category' },
        { status: 400 }
      );
    }

    // Verify session exists
    const session = await prisma.legacyImportSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Verify target category exists and belongs to this session
    const targetCategory = await prisma.importCategory.findFirst({
      where: {
        id: targetCategoryId,
        sessionId,
        mergedInto: null, // Not already merged
      },
    });

    if (!targetCategory) {
      return NextResponse.json(
        { error: 'Target category not found or already merged' },
        { status: 404 }
      );
    }

    // Verify all source categories exist and belong to this session
    const sourceCategories = await prisma.importCategory.findMany({
      where: {
        id: { in: sourceCategoryIds },
        sessionId,
        mergedInto: null,
      },
    });

    if (sourceCategories.length !== sourceCategoryIds.length) {
      return NextResponse.json(
        { error: 'One or more source categories not found or already merged' },
        { status: 400 }
      );
    }

    // Perform the merge in a transaction
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Update all documents from source categories to target category
      const updateResult = await tx.extractedDocument.updateMany({
        where: {
          sessionId,
          categoryId: { in: sourceCategoryIds },
        },
        data: {
          categoryId: targetCategoryId,
        },
      });

      // 2. Calculate new document count for target
      const newDocCount = await tx.extractedDocument.count({
        where: {
          sessionId,
          categoryId: targetCategoryId,
        },
      });

      // 3. Update target category document count
      await tx.importCategory.update({
        where: { id: targetCategoryId },
        data: { documentCount: newDocCount },
      });

      // 4. Mark source categories as merged
      await tx.importCategory.updateMany({
        where: { id: { in: sourceCategoryIds } },
        data: {
          mergedInto: targetCategoryId,
          documentCount: 0,
        },
      });

      // 5. Create audit log entry with auth context
      await tx.legacyImportAuditLog.create({
        data: {
          sessionId,
          userId: user.id,
          action: 'CATEGORIES_MERGED',
          details: {
            targetCategoryId,
            targetCategoryName: targetCategory.name,
            sourceCategoryIds,
            sourceCategoryNames: sourceCategories.map((c: { name: string }) => c.name),
            documentsUpdated: updateResult.count,
            mergedByEmail: user.email,
          },
        },
      });

      return {
        mergedCount: sourceCategoryIds.length,
        documentsUpdated: updateResult.count,
        targetCategory: {
          id: targetCategoryId,
          name: targetCategory.name,
          documentCount: newDocCount,
        },
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      const { message, statusCode } = error;
      return NextResponse.json(
        { error: message },
        { status: statusCode }
      );
    }
    console.error('Error merging categories:', error);
    return NextResponse.json(
      { error: 'Failed to merge categories' },
      { status: 500 }
    );
  }
}
