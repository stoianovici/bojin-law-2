import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, AuthError } from '@/lib/auth';

interface CategorizeRequest {
  documentId: string;
  categoryId?: string;
  skip?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    // Require authenticated user for categorization
    const user = await requireAuth(request);

    const body: CategorizeRequest = await request.json();
    const { documentId, categoryId, skip } = body;

    if (!documentId) {
      return NextResponse.json(
        { error: 'Missing documentId' },
        { status: 400 }
      );
    }

    if (!categoryId && !skip) {
      return NextResponse.json(
        { error: 'Either categoryId or skip must be provided' },
        { status: 400 }
      );
    }

    // Use authenticated user ID
    const userId = user.id;

    // Fetch the document to get session and batch info
    const document = await prisma.extractedDocument.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        sessionId: true,
        batchId: true,
        status: true,
        categoryId: true,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    const previousCategoryId = document.categoryId;
    const wasAlreadyCategorized = document.status === 'Categorized';
    const wasSkipped = document.status === 'Skipped';

    // Update the document
    const updatedDocument = await prisma.$transaction(async (tx) => {
      // Update document status
      const updated = await tx.extractedDocument.update({
        where: { id: documentId },
        data: skip
          ? {
              status: 'Skipped',
              categoryId: null,
              categorizedBy: userId,
              categorizedAt: new Date(),
            }
          : {
              status: 'Categorized',
              categoryId,
              categorizedBy: userId,
              categorizedAt: new Date(),
            },
      });

      // Update category document counts
      if (!skip && categoryId) {
        // Increment new category count
        await tx.importCategory.update({
          where: { id: categoryId },
          data: { documentCount: { increment: 1 } },
        });

        // Decrement previous category count if re-categorizing
        if (wasAlreadyCategorized && previousCategoryId && previousCategoryId !== categoryId) {
          await tx.importCategory.update({
            where: { id: previousCategoryId },
            data: { documentCount: { decrement: 1 } },
          });
        }
      } else if (skip && wasAlreadyCategorized && previousCategoryId) {
        // Decrement category count when skipping a previously categorized document
        await tx.importCategory.update({
          where: { id: previousCategoryId },
          data: { documentCount: { decrement: 1 } },
        });
      }

      // Update batch counts
      if (document.batchId) {
        const batchUpdate: { categorizedCount?: { increment?: number; decrement?: number }; skippedCount?: { increment?: number; decrement?: number } } = {};

        if (skip) {
          if (!wasSkipped) {
            batchUpdate.skippedCount = { increment: 1 };
          }
          if (wasAlreadyCategorized) {
            batchUpdate.categorizedCount = { decrement: 1 };
          }
        } else {
          if (!wasAlreadyCategorized) {
            batchUpdate.categorizedCount = { increment: 1 };
          }
          if (wasSkipped) {
            batchUpdate.skippedCount = { decrement: 1 };
          }
        }

        if (Object.keys(batchUpdate).length > 0) {
          await tx.documentBatch.update({
            where: { id: document.batchId },
            data: batchUpdate,
          });
        }
      }

      // Update session counts
      const sessionUpdate: { categorizedCount?: { increment?: number; decrement?: number }; skippedCount?: { increment?: number; decrement?: number } } = {};

      if (skip) {
        if (!wasSkipped) {
          sessionUpdate.skippedCount = { increment: 1 };
        }
        if (wasAlreadyCategorized) {
          sessionUpdate.categorizedCount = { decrement: 1 };
        }
      } else {
        if (!wasAlreadyCategorized) {
          sessionUpdate.categorizedCount = { increment: 1 };
        }
        if (wasSkipped) {
          sessionUpdate.skippedCount = { decrement: 1 };
        }
      }

      if (Object.keys(sessionUpdate).length > 0) {
        await tx.legacyImportSession.update({
          where: { id: document.sessionId },
          data: sessionUpdate,
        });
      }

      return updated;
    });

    return NextResponse.json({
      success: true,
      document: {
        id: updatedDocument.id,
        status: updatedDocument.status,
        categoryId: updatedDocument.categoryId,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error('Failed to categorize document:', error);
    return NextResponse.json(
      { error: 'Failed to categorize document' },
      { status: 500 }
    );
  }
}
