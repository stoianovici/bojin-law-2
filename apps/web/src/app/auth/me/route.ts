/**
 * Auth Me Endpoint
 * Returns current user session data
 * Story 2.4: Authentication with Azure AD
 */

import { NextResponse } from 'next/server';

export async function GET() {
  // For local development, return mock user data
  // In production, this would validate the session and return real user data

  const mockUser = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'alexandru.popescu@example.com',
    firstName: 'Alexandru',
    lastName: 'Popescu',
    role: 'Partner',
    status: 'Active',
    firmId: '550e8400-e29b-41d4-a716-446655440001',
    azureAdId: 'azure-ad-id-12345',
    preferences: {},
    createdAt: new Date('2024-01-01').toISOString(),
    lastActive: new Date().toISOString(),
  };

  return NextResponse.json(mockUser);
}
