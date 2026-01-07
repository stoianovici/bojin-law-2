import { NextResponse } from 'next/server';

/**
 * Health Check Endpoint
 * Used by Render (and other platforms) to verify the application is running
 * This endpoint is excluded from Basic Auth middleware
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'legal-platform-web',
    },
    { status: 200 }
  );
}
