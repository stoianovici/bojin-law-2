/**
 * Activate User API Endpoint
 * Activates a pending user by assigning them to a firm with a role
 * Story 2.4.1: Partner User Management
 */

import { NextResponse } from 'next/server';
import type { User } from '@legal-platform/types';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const body = await request.json();
  const { firmId, role } = body;

  // Mock: Simulate user activation
  const activatedUser: User = {
    id: userId,
    email: 'activated.user@example.com',
    firstName: 'Activated',
    lastName: 'User',
    role: role,
    status: 'Active',
    firmId: firmId,
    azureAdId: '00000000-0000-0000-0001-activated',
    preferences: {},
    createdAt: new Date('2024-11-15'),
    lastActive: new Date(),
  };

  // Simulate a small delay
  await new Promise(resolve => setTimeout(resolve, 500));

  return NextResponse.json(activatedUser);
}
