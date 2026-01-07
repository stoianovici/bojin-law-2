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
    id: '86d03527-fed8-46df-8ca7-163d6b9d2c82',
    email: 'lucian.bojin@bojin-law.com',
    firstName: 'Lucian',
    lastName: 'Bojin',
    role: 'Partner',
    status: 'Active',
    firmId: 'dc5231a5-1b00-4542-87c4-0117ac876423',
    azureAdId: 'azure-ad-id-12345',
    preferences: {},
    createdAt: new Date('2024-01-01').toISOString(),
    lastActive: new Date().toISOString(),
  };

  return NextResponse.json(mockUser);
}
