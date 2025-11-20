/**
 * Pending Users API Endpoint
 * Returns list of users awaiting activation
 * Story 2.4.1: Partner User Management
 */

import { NextResponse } from 'next/server';
import type { User } from '@legal-platform/types';

export async function GET() {
  // Mock pending users data
  const pendingUsers: User[] = [
    {
      id: '123e4567-e89b-12d3-a456-426614174001',
      email: 'maria.ionescu@example.com',
      firstName: 'Maria',
      lastName: 'Ionescu',
      role: 'Paralegal',
      status: 'Pending',
      firmId: null,
      azureAdId: '00000000-0000-0000-0001-000000000001',
      preferences: {},
      createdAt: new Date('2024-11-15'),
      lastActive: new Date('2024-11-15'),
    },
    {
      id: '123e4567-e89b-12d3-a456-426614174002',
      email: 'ion.dumitru@example.com',
      firstName: 'Ion',
      lastName: 'Dumitru',
      role: 'Associate',
      status: 'Pending',
      firmId: null,
      azureAdId: '00000000-0000-0000-0001-000000000002',
      preferences: {},
      createdAt: new Date('2024-11-18'),
      lastActive: new Date('2024-11-18'),
    },
    {
      id: '123e4567-e89b-12d3-a456-426614174003',
      email: 'elena.constantinescu@example.com',
      firstName: 'Elena',
      lastName: 'Constantinescu',
      role: 'Paralegal',
      status: 'Pending',
      firmId: null,
      azureAdId: '00000000-0000-0000-0001-000000000003',
      preferences: {},
      createdAt: new Date('2024-11-19'),
      lastActive: new Date('2024-11-19'),
    },
  ];

  return NextResponse.json(pendingUsers);
}
