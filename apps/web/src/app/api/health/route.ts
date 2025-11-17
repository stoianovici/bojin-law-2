/**
 * Health Check API Route
 * Used by Docker health checks and monitoring services
 */

import { NextResponse } from 'next/server';

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
