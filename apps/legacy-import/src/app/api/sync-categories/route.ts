import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId parameter' },
        { status: 400 }
      );
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
      orderBy: [
        { documentCount: 'desc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Failed to sync categories:', error);
    return NextResponse.json(
      { error: 'Failed to sync categories' },
      { status: 500 }
    );
  }
}
