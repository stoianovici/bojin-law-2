/**
 * User Management Integration Tests
 * Story 2.4.1: Partner User Management
 *
 * Tests all user management API endpoints with authentication and authorization
 * Target: 80%+ code coverage
 */

// Set environment variables before imports
process.env.SESSION_SECRET =
  'test-session-secret-at-least-32-characters-long-for-integration-tests';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
process.env.AZURE_AD_CLIENT_ID = 'test-client-id';
process.env.AZURE_AD_CLIENT_SECRET = 'test-client-secret-at-least-16-chars';
process.env.AZURE_AD_TENANT_ID = 'test-tenant-id';
process.env.AZURE_AD_REDIRECT_URI = 'http://localhost:3001/auth/callback';

// Mock dependencies
jest.mock('@legal-platform/database');
jest.mock('@azure/msal-node');
jest.mock('@microsoft/microsoft-graph-client');

// Mock rate limiting middleware (to avoid hitting rate limits during tests)
jest.mock('../../src/middleware/rate-limit.middleware', () => ({
  userManagementReadLimiter: (req: any, res: any, next: any) => next(),
  userManagementWriteLimiter: (req: any, res: any, next: any) => next(),
  authLimiter: (req: any, res: any, next: any) => next(),
}));

// Mock UserManagementService
const mockUserManagementService = {
  getPendingUsers: jest.fn(),
  getActiveUsers: jest.fn(),
  activateUser: jest.fn(),
  deactivateUser: jest.fn(),
  updateUserRole: jest.fn(),
};

jest.mock('../../src/services/user-management.service', () => ({
  UserManagementService: jest.fn().mockImplementation(() => mockUserManagementService),
}));

import request from 'supertest';
import { app } from '../../src/index';
import { JWTService } from '../../src/services/jwt.service';
import { UserRole, UserStatus } from '@prisma/client';

const jwtService = new JWTService();

describe('User Management Integration Tests', () => {
  let partnerToken: string;
  let associateToken: string;

  beforeAll(() => {
    // Generate test JWT tokens
    partnerToken = jwtService.generateAccessToken({
      userId: 'partner-123',
      email: 'partner@lawfirm.ro',
      role: UserRole.Partner,
      status: UserStatus.Active,
      firmId: 'firm-123',
      azureAdId: 'azure-partner-123',
    });

    associateToken = jwtService.generateAccessToken({
      userId: 'associate-456',
      email: 'associate@lawfirm.ro',
      role: UserRole.Associate,
      status: UserStatus.Active,
      firmId: 'firm-123',
      azureAdId: 'azure-associate-456',
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/users/pending', () => {
    it('should return pending users for authenticated partner', async () => {
      const mockPendingUsers = [
        {
          id: 'user-1',
          email: 'user1@lawfirm.ro',
          firstName: 'John',
          lastName: 'Doe',
          role: UserRole.Paralegal,
          status: UserStatus.Pending,
          azureAdId: 'azure-123',
          firmId: null,
          preferences: {},
          createdAt: new Date('2025-11-20T10:00:00Z'),
          lastActive: new Date('2025-11-20T10:00:00Z'),
        },
      ];

      mockUserManagementService.getPendingUsers.mockResolvedValue(mockPendingUsers);

      const response = await request(app)
        .get('/api/users/pending')
        .set('Authorization', `Bearer ${partnerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(1);
      expect(response.body.users).toHaveLength(1);
      expect(response.body.users[0].email).toBe('user1@lawfirm.ro');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app).get('/api/users/pending');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('unauthorized');
    });

    it('should return 403 for non-partner users', async () => {
      const response = await request(app)
        .get('/api/users/pending')
        .set('Authorization', `Bearer ${associateToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('forbidden');
    });

    it('should handle service errors gracefully', async () => {
      mockUserManagementService.getPendingUsers.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .get('/api/users/pending')
        .set('Authorization', `Bearer ${partnerToken}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('retrieval_failed');
    });
  });

  describe('GET /api/users/active', () => {
    it('should return active users for partner firm', async () => {
      const mockActiveUsers = [
        {
          id: 'user-1',
          email: 'user1@lawfirm.ro',
          firstName: 'Alice',
          lastName: 'Anderson',
          role: UserRole.Associate,
          status: UserStatus.Active,
          azureAdId: 'azure-123',
          firmId: 'firm-123',
          preferences: {},
          createdAt: new Date('2025-11-20T10:00:00Z'),
          lastActive: new Date('2025-11-20T12:00:00Z'),
        },
      ];

      mockUserManagementService.getActiveUsers.mockResolvedValue(mockActiveUsers);

      const response = await request(app)
        .get('/api/users/active')
        .set('Authorization', `Bearer ${partnerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.firmId).toBe('firm-123');
      expect(response.body.count).toBe(1);
      expect(mockUserManagementService.getActiveUsers).toHaveBeenCalledWith('firm-123');
    });

    it('should return 400 if partner has no firm', async () => {
      // Generate token for partner without firm
      const noFirmToken = jwtService.generateAccessToken({
        userId: 'partner-no-firm',
        email: 'partner@lawfirm.ro',
        role: UserRole.Partner,
        status: UserStatus.Active,
        firmId: null,
        azureAdId: 'azure-partner-no-firm',
      });

      const response = await request(app)
        .get('/api/users/active')
        .set('Authorization', `Bearer ${noFirmToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('missing_firm');
    });

    it('should return 403 for non-partner users', async () => {
      const response = await request(app)
        .get('/api/users/active')
        .set('Authorization', `Bearer ${associateToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('forbidden');
    });
  });

  describe('POST /api/users/:id/activate', () => {
    it('should activate a pending user successfully', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const firmId = '123e4567-e89b-12d3-a456-426614174001';

      const mockActivatedUser = {
        id: userId,
        email: 'user@lawfirm.ro',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.Associate,
        status: UserStatus.Active,
        azureAdId: 'azure-123',
        firmId: firmId,
        preferences: {},
        createdAt: new Date('2025-11-20T10:00:00Z'),
        lastActive: new Date('2025-11-20T12:00:00Z'),
      };

      mockUserManagementService.activateUser.mockResolvedValue(mockActivatedUser);

      const response = await request(app)
        .post(`/api/users/${userId}/activate`)
        .set('Authorization', `Bearer ${partnerToken}`)
        .send({
          firmId: firmId,
          role: 'Associate',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.status).toBe(UserStatus.Active);
      expect(mockUserManagementService.activateUser).toHaveBeenCalledWith(
        userId,
        firmId,
        UserRole.Associate,
        'partner-123'
      );
    });

    it('should return 400 for invalid user ID format', async () => {
      const response = await request(app)
        .post('/api/users/invalid-id/activate')
        .set('Authorization', `Bearer ${partnerToken}`)
        .send({
          firmId: 'firm-123',
          role: 'Associate',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('validation_error');
    });

    it('should return 400 for missing firmId', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';

      const response = await request(app)
        .post(`/api/users/${userId}/activate`)
        .set('Authorization', `Bearer ${partnerToken}`)
        .send({
          role: 'Associate',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('validation_error');
    });

    it('should return 400 for invalid role', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const firmId = '123e4567-e89b-12d3-a456-426614174001';

      const response = await request(app)
        .post(`/api/users/${userId}/activate`)
        .set('Authorization', `Bearer ${partnerToken}`)
        .send({
          firmId: firmId,
          role: 'InvalidRole',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('validation_error');
    });

    it('should return 400 if user not found', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174999';
      const firmId = '123e4567-e89b-12d3-a456-426614174001';

      mockUserManagementService.activateUser.mockRejectedValue(
        new Error(`User not found: ${userId}`)
      );

      const response = await request(app)
        .post(`/api/users/${userId}/activate`)
        .set('Authorization', `Bearer ${partnerToken}`)
        .send({
          firmId: firmId,
          role: 'Associate',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('activation_failed');
    });

    it('should return 403 for non-partner users', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const firmId = '123e4567-e89b-12d3-a456-426614174001';

      const response = await request(app)
        .post(`/api/users/${userId}/activate`)
        .set('Authorization', `Bearer ${associateToken}`)
        .send({
          firmId: firmId,
          role: 'Associate',
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('forbidden');
    });
  });

  describe('POST /api/users/:id/deactivate', () => {
    it('should deactivate an active user successfully', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';

      const mockDeactivatedUser = {
        id: userId,
        email: 'user@lawfirm.ro',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.Associate,
        status: UserStatus.Inactive,
        azureAdId: 'azure-123',
        firmId: 'firm-123',
        preferences: {},
        createdAt: new Date('2025-11-20T10:00:00Z'),
        lastActive: new Date('2025-11-20T12:00:00Z'),
      };

      mockUserManagementService.deactivateUser.mockResolvedValue(mockDeactivatedUser);

      const response = await request(app)
        .post(`/api/users/${userId}/deactivate`)
        .set('Authorization', `Bearer ${partnerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.status).toBe(UserStatus.Inactive);
      expect(mockUserManagementService.deactivateUser).toHaveBeenCalledWith(userId, 'partner-123');
    });

    it('should return 400 for invalid user ID format', async () => {
      const response = await request(app)
        .post('/api/users/invalid-id/deactivate')
        .set('Authorization', `Bearer ${partnerToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('validation_error');
    });

    it('should return 400 if user not active', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';

      mockUserManagementService.deactivateUser.mockRejectedValue(
        new Error('User cannot be deactivated. Current status: Inactive. Expected: Active')
      );

      const response = await request(app)
        .post(`/api/users/${userId}/deactivate`)
        .set('Authorization', `Bearer ${partnerToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('deactivation_failed');
    });
  });

  describe('PATCH /api/users/:id/role', () => {
    it('should update user role successfully', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';

      const mockUpdatedUser = {
        id: userId,
        email: 'user@lawfirm.ro',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.Partner,
        status: UserStatus.Active,
        azureAdId: 'azure-123',
        firmId: 'firm-123',
        preferences: {},
        createdAt: new Date('2025-11-20T10:00:00Z'),
        lastActive: new Date('2025-11-20T12:00:00Z'),
      };

      mockUserManagementService.updateUserRole.mockResolvedValue(mockUpdatedUser);

      const response = await request(app)
        .patch(`/api/users/${userId}/role`)
        .set('Authorization', `Bearer ${partnerToken}`)
        .send({
          role: 'Partner',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.role).toBe(UserRole.Partner);
      expect(mockUserManagementService.updateUserRole).toHaveBeenCalledWith(
        userId,
        UserRole.Partner,
        'partner-123'
      );
    });

    it('should return 400 for invalid role', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';

      const response = await request(app)
        .patch(`/api/users/${userId}/role`)
        .set('Authorization', `Bearer ${partnerToken}`)
        .send({
          role: 'InvalidRole',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('validation_error');
    });

    it('should return 400 if role is same as current', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';

      mockUserManagementService.updateUserRole.mockRejectedValue(
        new Error('User already has role: Associate. No change needed.')
      );

      const response = await request(app)
        .patch(`/api/users/${userId}/role`)
        .set('Authorization', `Bearer ${partnerToken}`)
        .send({
          role: 'Associate',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('role_update_failed');
    });

    it('should return 403 for non-partner users', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';

      const response = await request(app)
        .patch(`/api/users/${userId}/role`)
        .set('Authorization', `Bearer ${associateToken}`)
        .send({
          role: 'Partner',
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('forbidden');
    });
  });
});
