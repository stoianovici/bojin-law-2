import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check if DATABASE_URL is set
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return NextResponse.json({
        error: 'DATABASE_URL not set',
        env: Object.keys(process.env).filter((k) => k.includes('DATABASE') || k.includes('PRISMA')),
      });
    }

    // Try to import and use prisma
    const { prisma } = await import('@legal-platform/database');

    // Test a simple query
    const userCount = await prisma.user.count();
    const users = await prisma.user.findMany({
      select: { id: true, email: true, role: true, status: true },
      take: 5,
    });

    return NextResponse.json({
      status: 'ok',
      dbUrl: dbUrl.replace(/:[^:@]+@/, ':***@'), // Hide password
      userCount,
      users,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message,
        stack: error.stack,
        name: error.name,
      },
      { status: 500 }
    );
  }
}
