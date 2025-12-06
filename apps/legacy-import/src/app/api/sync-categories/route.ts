import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_CATEGORIES } from '@/lib/default-categories';

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId parameter' }, { status: 400 });
    }

    // Check if session has any categories
    const existingCount = await prisma.importCategory.count({
      where: { sessionId },
    });

    // Seed default categories if none exist
    if (existingCount === 0) {
      // Get session to find uploadedBy for createdBy field
      const session = await prisma.legacyImportSession.findUnique({
        where: { id: sessionId },
        select: { uploadedBy: true },
      });

      if (session) {
        await prisma.importCategory.createMany({
          data: DEFAULT_CATEGORIES.map((name: string) => ({
            sessionId,
            name,
            documentCount: 0,
            createdBy: session.uploadedBy,
          })),
          skipDuplicates: true,
        });
      }
    }

    // Fetch all categories for the session with document counts
    const categories = await prisma.importCategory.findMany({
      where: {
        sessionId,
        mergedInto: null, // Exclude merged categories
      },
      select: {
        id: true,
        sessionId: true,
        name: true,
        documentCount: true,
        createdBy: true,
        createdAt: true,
      },
      orderBy: [{ documentCount: 'desc' }, { name: 'asc' }],
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Failed to sync categories:', error);
    return NextResponse.json({ error: 'Failed to sync categories' }, { status: 500 });
  }
}
