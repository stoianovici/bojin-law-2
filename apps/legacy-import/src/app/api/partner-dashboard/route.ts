import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePartner, AuthError, authErrorResponse } from '@/lib/auth';

interface BatchWithProgress {
  id: string;
  monthYear: string;
  assignedTo: string | null;
  assignedToName?: string;
  documentCount: number;
  categorizedCount: number;
  skippedCount: number;
  assignedAt: string | null;
  completedAt: string | null;
  progressPercent: number;
}

interface AssistantProgress {
  userId: string;
  userName?: string;
  totalBatches: number;
  completedBatches: number;
  totalDocuments: number;
  categorizedDocuments: number;
  skippedDocuments: number;
  progressPercent: number;
}

interface PartnerDashboardResponse {
  session: {
    id: string;
    pstFileName: string;
    status: string;
    totalDocuments: number;
    categorizedCount: number;
    skippedCount: number;
    uploadedBy: string;
    createdAt: string;
    exportedAt: string | null;
  };
  batches: BatchWithProgress[];
  assistantProgress: AssistantProgress[];
  categoryStats: {
    totalCategories: number;
    categoriesWithDocs: number;
    potentialDuplicates: string[][];
  };
}

// GET /api/partner-dashboard - Get all batches and assistant progress for a session
export async function GET(request: NextRequest) {
  try {
    // Require Partner/BusinessOwner role
    await requirePartner(request);
  } catch (error) {
    if (error instanceof AuthError) {
      return authErrorResponse(error);
    }
    throw error;
  }

  const sessionId = request.nextUrl.searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }

  try {
    // Get session with all batches
    const session = await prisma.legacyImportSession.findUnique({
      where: { id: sessionId },
      include: {
        batches: {
          orderBy: { monthYear: 'asc' },
        },
        categories: {
          where: { mergedInto: null }, // Only non-merged categories
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Get all unique user IDs from batches
    const userIds = [
      ...new Set(
        session.batches.map((b) => b.assignedTo).filter((id): id is string => id !== null)
      ),
    ];

    // Fetch user names
    const users =
      userIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, firstName: true, lastName: true, email: true },
          })
        : [];

    const userNameMap = new Map(
      users.map((u) => [
        u.id,
        u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.email || 'Unknown',
      ])
    );

    // Calculate batch progress
    const batches: BatchWithProgress[] = session.batches.map(
      (batch: (typeof session.batches)[number]) => ({
        id: batch.id,
        monthYear: batch.monthYear,
        assignedTo: batch.assignedTo,
        assignedToName: batch.assignedTo ? userNameMap.get(batch.assignedTo) : undefined,
        documentCount: batch.documentCount,
        categorizedCount: batch.categorizedCount,
        skippedCount: batch.skippedCount,
        assignedAt: batch.assignedAt?.toISOString() ?? null,
        completedAt: batch.completedAt?.toISOString() ?? null,
        progressPercent:
          batch.documentCount > 0
            ? Math.round(
                ((batch.categorizedCount + batch.skippedCount) / batch.documentCount) * 100
              )
            : 0,
      })
    );

    // Group batches by assistant to calculate per-assistant progress
    const assistantMap = new Map<string, AssistantProgress>();

    for (const batch of session.batches) {
      if (batch.assignedTo) {
        const existing = assistantMap.get(batch.assignedTo);
        const isComplete = batch.categorizedCount + batch.skippedCount >= batch.documentCount;

        if (existing) {
          existing.totalBatches += 1;
          existing.completedBatches += isComplete ? 1 : 0;
          existing.totalDocuments += batch.documentCount;
          existing.categorizedDocuments += batch.categorizedCount;
          existing.skippedDocuments += batch.skippedCount;
        } else {
          assistantMap.set(batch.assignedTo, {
            userId: batch.assignedTo,
            userName: userNameMap.get(batch.assignedTo),
            totalBatches: 1,
            completedBatches: isComplete ? 1 : 0,
            totalDocuments: batch.documentCount,
            categorizedDocuments: batch.categorizedCount,
            skippedDocuments: batch.skippedCount,
            progressPercent: 0,
          });
        }
      }
    }

    // Calculate progress percentages for each assistant
    const assistantProgress: AssistantProgress[] = Array.from(assistantMap.values()).map(
      (assistant) => ({
        ...assistant,
        progressPercent:
          assistant.totalDocuments > 0
            ? Math.round(
                ((assistant.categorizedDocuments + assistant.skippedDocuments) /
                  assistant.totalDocuments) *
                  100
              )
            : 0,
      })
    );

    // Find potential duplicate categories (similar names)
    const categories = session.categories;
    const potentialDuplicates: string[][] = [];

    for (let i = 0; i < categories.length; i++) {
      for (let j = i + 1; j < categories.length; j++) {
        const name1 = categories[i].name.toLowerCase().trim();
        const name2 = categories[j].name.toLowerCase().trim();

        // Check for similar names (same after normalization, or one contains the other)
        if (
          name1 === name2 ||
          name1.includes(name2) ||
          name2.includes(name1) ||
          areSimilar(name1, name2)
        ) {
          // Find existing group or create new one
          let found = false;
          for (const group of potentialDuplicates) {
            if (group.includes(categories[i].id) || group.includes(categories[j].id)) {
              if (!group.includes(categories[i].id)) group.push(categories[i].id);
              if (!group.includes(categories[j].id)) group.push(categories[j].id);
              found = true;
              break;
            }
          }
          if (!found) {
            potentialDuplicates.push([categories[i].id, categories[j].id]);
          }
        }
      }
    }

    const response: PartnerDashboardResponse = {
      session: {
        id: session.id,
        pstFileName: session.pstFileName,
        status: session.status,
        totalDocuments: session.totalDocuments,
        categorizedCount: session.categorizedCount,
        skippedCount: session.skippedCount,
        uploadedBy: session.uploadedBy,
        createdAt: session.createdAt.toISOString(),
        exportedAt: session.exportedAt?.toISOString() ?? null,
      },
      batches,
      assistantProgress,
      categoryStats: {
        totalCategories: categories.length,
        categoriesWithDocs: categories.filter((c: { documentCount: number }) => c.documentCount > 0)
          .length,
        potentialDuplicates,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching partner dashboard:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch dashboard data',
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

// Helper function to detect similar strings (Levenshtein distance based)
function areSimilar(str1: string, str2: string): boolean {
  // If strings are very different in length, they're not similar
  if (Math.abs(str1.length - str2.length) > 3) return false;

  // Calculate Levenshtein distance
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);

  // Consider similar if distance is less than 20% of max length
  return distance <= Math.ceil(maxLength * 0.2);
}

function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  // Create a matrix
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Initialize base cases
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // Fill in the rest
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}
