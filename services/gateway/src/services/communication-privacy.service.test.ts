/**
 * Communication Privacy Service Unit Tests
 * Story 5.5: Multi-Channel Communication Hub - Task 37 (AC: 6)
 *
 * Tests for privacy level enforcement, access checks, and privacy updates
 */

import {
  communicationPrivacyService,
  CommunicationPrivacyService,
} from './communication-privacy.service';

// Mock Prisma client
jest.mock('@legal-platform/database', () => ({
  prisma: {
    communicationEntry: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    caseTeam: {
      findMany: jest.fn(),
    },
  },
  PrivacyLevel: {
    Normal: 'Normal',
    Confidential: 'Confidential',
    AttorneyOnly: 'AttorneyOnly',
    PartnerOnly: 'PartnerOnly',
  },
}));

const { prisma } = jest.requireMock('@legal-platform/database');

describe('CommunicationPrivacyService', () => {
  const mockFirmId = 'firm-123';
  const mockUserId = 'user-123';
  const mockSenderId = 'sender-456';
  const mockCommunicationId = 'comm-789';

  const mockCommunicationEntry = {
    id: mockCommunicationId,
    firmId: mockFirmId,
    senderId: mockSenderId,
    privacyLevel: 'Normal',
    isPrivate: false,
    allowedViewers: [],
  };

  const mockUser = {
    id: mockUserId,
    firmId: mockFirmId,
    firstName: 'John',
    lastName: 'Doe',
    role: 'Paralegal',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // checkAccess Tests
  // ============================================================================

  describe('checkAccess', () => {
    it('should deny access when communication not found', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue(null);

      const result = await communicationPrivacyService.checkAccess({
        userId: mockUserId,
        userRole: 'Paralegal' as any,
        communicationId: mockCommunicationId,
      });

      expect(result.canView).toBe(false);
      expect(result.canEdit).toBe(false);
      expect(result.reason).toBe('Communication not found');
    });

    it('should deny access when user is not in firm', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue(mockCommunicationEntry);
      prisma.user.findUnique.mockResolvedValue({ firmId: 'other-firm' });

      const result = await communicationPrivacyService.checkAccess({
        userId: mockUserId,
        userRole: 'Paralegal' as any,
        communicationId: mockCommunicationId,
      });

      expect(result.canView).toBe(false);
      expect(result.canEdit).toBe(false);
      expect(result.reason).toBe('Not a member of the firm');
    });

    it('should grant full access when user is the sender', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue({
        ...mockCommunicationEntry,
        senderId: mockUserId,
      });
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await communicationPrivacyService.checkAccess({
        userId: mockUserId,
        userRole: 'Paralegal' as any,
        communicationId: mockCommunicationId,
      });

      expect(result.canView).toBe(true);
      expect(result.canEdit).toBe(true);
      expect(result.reason).toBe('Author of communication');
    });

    it('should grant view access for Normal privacy level', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue({
        ...mockCommunicationEntry,
        privacyLevel: 'Normal',
      });
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await communicationPrivacyService.checkAccess({
        userId: mockUserId,
        userRole: 'Paralegal' as any,
        communicationId: mockCommunicationId,
      });

      expect(result.canView).toBe(true);
      expect(result.canEdit).toBe(false);
      expect(result.reason).toBe('Normal privacy level');
    });

    it('should grant view access for Confidential when user is in allowedViewers', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue({
        ...mockCommunicationEntry,
        privacyLevel: 'Confidential',
        allowedViewers: [mockUserId],
      });
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await communicationPrivacyService.checkAccess({
        userId: mockUserId,
        userRole: 'Paralegal' as any,
        communicationId: mockCommunicationId,
      });

      expect(result.canView).toBe(true);
      expect(result.canEdit).toBe(false);
      expect(result.reason).toBe('In allowed viewers list');
    });

    it('should deny view access for Confidential when user is not in allowedViewers', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue({
        ...mockCommunicationEntry,
        privacyLevel: 'Confidential',
        allowedViewers: ['other-user'],
      });
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await communicationPrivacyService.checkAccess({
        userId: mockUserId,
        userRole: 'Paralegal' as any,
        communicationId: mockCommunicationId,
      });

      expect(result.canView).toBe(false);
      expect(result.canEdit).toBe(false);
      expect(result.reason).toBe('Not in allowed viewers list');
    });

    it('should grant view access for AttorneyOnly to Partners', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue({
        ...mockCommunicationEntry,
        privacyLevel: 'AttorneyOnly',
      });
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, role: 'Partner' });

      const result = await communicationPrivacyService.checkAccess({
        userId: mockUserId,
        userRole: 'Partner' as any,
        communicationId: mockCommunicationId,
      });

      expect(result.canView).toBe(true);
      expect(result.canEdit).toBe(false);
      expect(result.reason).toBe('Attorney access granted');
    });

    it('should grant view access for AttorneyOnly to Associates', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue({
        ...mockCommunicationEntry,
        privacyLevel: 'AttorneyOnly',
      });
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, role: 'Associate' });

      const result = await communicationPrivacyService.checkAccess({
        userId: mockUserId,
        userRole: 'Associate' as any,
        communicationId: mockCommunicationId,
      });

      expect(result.canView).toBe(true);
      expect(result.canEdit).toBe(false);
      expect(result.reason).toBe('Attorney access granted');
    });

    it('should deny view access for AttorneyOnly to Paralegals', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue({
        ...mockCommunicationEntry,
        privacyLevel: 'AttorneyOnly',
      });
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await communicationPrivacyService.checkAccess({
        userId: mockUserId,
        userRole: 'Paralegal' as any,
        communicationId: mockCommunicationId,
      });

      expect(result.canView).toBe(false);
      expect(result.canEdit).toBe(false);
      expect(result.reason).toBe('Attorney-only communication');
    });

    it('should grant view access for PartnerOnly to Partners', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue({
        ...mockCommunicationEntry,
        privacyLevel: 'PartnerOnly',
      });
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, role: 'Partner' });

      const result = await communicationPrivacyService.checkAccess({
        userId: mockUserId,
        userRole: 'Partner' as any,
        communicationId: mockCommunicationId,
      });

      expect(result.canView).toBe(true);
      expect(result.canEdit).toBe(false);
      expect(result.reason).toBe('Partner access granted');
    });

    it('should deny view access for PartnerOnly to Associates', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue({
        ...mockCommunicationEntry,
        privacyLevel: 'PartnerOnly',
      });
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, role: 'Associate' });

      const result = await communicationPrivacyService.checkAccess({
        userId: mockUserId,
        userRole: 'Associate' as any,
        communicationId: mockCommunicationId,
      });

      expect(result.canView).toBe(false);
      expect(result.canEdit).toBe(false);
      expect(result.reason).toBe('Partner-only communication');
    });
  });

  // ============================================================================
  // updatePrivacy Tests
  // ============================================================================

  describe('updatePrivacy', () => {
    it('should throw error when communication not found', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue(null);

      await expect(
        communicationPrivacyService.updatePrivacy(
          {
            communicationId: mockCommunicationId,
            privacyLevel: 'Confidential' as any,
          },
          { userId: mockUserId, role: 'Partner' as any, firmId: mockFirmId }
        )
      ).rejects.toThrow('Communication not found');
    });

    it('should throw error when user is from different firm', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue(mockCommunicationEntry);

      await expect(
        communicationPrivacyService.updatePrivacy(
          {
            communicationId: mockCommunicationId,
            privacyLevel: 'Confidential' as any,
          },
          { userId: mockUserId, role: 'Partner' as any, firmId: 'other-firm' }
        )
      ).rejects.toThrow('Access denied');
    });

    it('should allow author to update privacy', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue({
        ...mockCommunicationEntry,
        senderId: mockUserId,
      });
      prisma.communicationEntry.update.mockResolvedValue({});

      const result = await communicationPrivacyService.updatePrivacy(
        {
          communicationId: mockCommunicationId,
          privacyLevel: 'Confidential' as any,
          allowedViewers: ['viewer-1'],
        },
        { userId: mockUserId, role: 'Paralegal' as any, firmId: mockFirmId }
      );

      expect(result).toBe(true);
      expect(prisma.communicationEntry.update).toHaveBeenCalledWith({
        where: { id: mockCommunicationId },
        data: {
          privacyLevel: 'Confidential',
          isPrivate: true,
          allowedViewers: ['viewer-1'],
        },
      });
    });

    it('should allow Partner to update any communication privacy', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue(mockCommunicationEntry);
      prisma.communicationEntry.update.mockResolvedValue({});

      const result = await communicationPrivacyService.updatePrivacy(
        {
          communicationId: mockCommunicationId,
          privacyLevel: 'AttorneyOnly' as any,
        },
        { userId: mockUserId, role: 'Partner' as any, firmId: mockFirmId }
      );

      expect(result).toBe(true);
    });

    it('should deny non-author, non-partner from updating privacy', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue(mockCommunicationEntry);

      await expect(
        communicationPrivacyService.updatePrivacy(
          {
            communicationId: mockCommunicationId,
            privacyLevel: 'Confidential' as any,
          },
          { userId: mockUserId, role: 'Paralegal' as any, firmId: mockFirmId }
        )
      ).rejects.toThrow('Insufficient permissions to modify privacy');
    });

    it('should deny non-partner from setting PartnerOnly', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue({
        ...mockCommunicationEntry,
        senderId: mockUserId, // User is author
      });

      await expect(
        communicationPrivacyService.updatePrivacy(
          {
            communicationId: mockCommunicationId,
            privacyLevel: 'PartnerOnly' as any,
          },
          { userId: mockUserId, role: 'Associate' as any, firmId: mockFirmId }
        )
      ).rejects.toThrow('Only partners can create partner-only communications');
    });

    it('should deny non-attorney from setting AttorneyOnly', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue({
        ...mockCommunicationEntry,
        senderId: mockUserId, // User is author
      });

      await expect(
        communicationPrivacyService.updatePrivacy(
          {
            communicationId: mockCommunicationId,
            privacyLevel: 'AttorneyOnly' as any,
          },
          { userId: mockUserId, role: 'Paralegal' as any, firmId: mockFirmId }
        )
      ).rejects.toThrow('Only attorneys can create attorney-only communications');
    });
  });

  // ============================================================================
  // getAvailableViewers Tests
  // ============================================================================

  describe('getAvailableViewers', () => {
    it('should return case team members as available viewers', async () => {
      const mockCaseTeam = [
        {
          user: {
            id: 'user-1',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@test.com',
            role: 'Partner',
          },
        },
        {
          user: {
            id: 'user-2',
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane@test.com',
            role: 'Associate',
          },
        },
      ];

      prisma.caseTeam.findMany.mockResolvedValue(mockCaseTeam);

      const result = await communicationPrivacyService.getAvailableViewers('case-123', {
        userId: mockUserId,
        role: 'Partner' as any,
        firmId: mockFirmId,
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'user-1',
        name: 'John Doe',
        role: 'Partner',
      });
      expect(result[1]).toEqual({
        id: 'user-2',
        name: 'Jane Smith',
        role: 'Associate',
      });
    });

    it('should use email as name when firstName/lastName are empty', async () => {
      const mockCaseTeam = [
        {
          user: {
            id: 'user-1',
            firstName: '',
            lastName: '',
            email: 'john@test.com',
            role: 'Partner',
          },
        },
      ];

      prisma.caseTeam.findMany.mockResolvedValue(mockCaseTeam);

      const result = await communicationPrivacyService.getAvailableViewers('case-123', {
        userId: mockUserId,
        role: 'Partner' as any,
        firmId: mockFirmId,
      });

      expect(result[0].name).toBe('john@test.com');
    });
  });

  // ============================================================================
  // buildPrivacyWhereClause Tests
  // ============================================================================

  describe('buildPrivacyWhereClause', () => {
    it('should return empty clause for Partners (see everything)', () => {
      const result = communicationPrivacyService.buildPrivacyWhereClause(
        mockUserId,
        'Partner' as any
      );

      expect(result).toEqual({});
    });

    it('should return appropriate filter for Associates', () => {
      const result = communicationPrivacyService.buildPrivacyWhereClause(
        mockUserId,
        'Associate' as any
      );

      expect(result).toHaveProperty('OR');
      expect(result.OR).toContainEqual({ privacyLevel: 'Normal' });
      expect(result.OR).toContainEqual({ privacyLevel: 'AttorneyOnly' });
      expect(result.OR).toContainEqual({ senderId: mockUserId });
      expect(result.OR).toContainEqual({ allowedViewers: { has: mockUserId } });
    });

    it('should return appropriate filter for Paralegals', () => {
      const result = communicationPrivacyService.buildPrivacyWhereClause(
        mockUserId,
        'Paralegal' as any
      );

      expect(result).toHaveProperty('OR');
      expect(result.OR).toContainEqual({ privacyLevel: 'Normal' });
      expect(result.OR).toContainEqual({ senderId: mockUserId });
      expect(result.OR).toContainEqual({ allowedViewers: { has: mockUserId } });
      // Should NOT include AttorneyOnly
      expect(result.OR).not.toContainEqual({ privacyLevel: 'AttorneyOnly' });
    });
  });
});
