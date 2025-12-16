import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface CreateCategoryRequest {
  sessionId: string;
  name: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateCategoryRequest = await request.json();
    const { sessionId, name } = body;

    if (!sessionId || !name) {
      return NextResponse.json({ error: 'Missing sessionId or name' }, { status: 400 });
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      return NextResponse.json({ error: 'Category name cannot be empty' }, { status: 400 });
    }

    // TODO: Get actual user ID from auth context
    const userId = 'current-user-id';

    // Check for existing category with same name (case-insensitive)
    const existingCategory = await prisma.importCategory.findFirst({
      where: {
        sessionId,
        name: {
          equals: trimmedName,
          mode: 'insensitive',
        },
        mergedInto: null,
      },
    });

    if (existingCategory) {
      return NextResponse.json(
        { error: 'Category already exists', existingCategory },
        { status: 409 }
      );
    }

    // Create new category
    const newCategory = await prisma.importCategory.create({
      data: {
        sessionId,
        name: trimmedName,
        documentCount: 0,
        createdBy: userId,
      },
      select: {
        id: true,
        sessionId: true,
        name: true,
        documentCount: true,
        createdBy: true,
        createdAt: true,
      },
    });

    return NextResponse.json(newCategory, { status: 201 });
  } catch (error) {
    console.error('Failed to create category:', error);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}
