/**
 * User Service Unit Tests
 * Story 2.4: Authentication with Azure AD
 *
 * Tests user provisioning and management logic
 * Target: 80%+ code coverage
 */

// Mock Prisma Client before importing
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $disconnect: jest.fn(),
};

jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn(() => mockPrisma),
    UserRole: {
      Partner: 'Partner',
      Associate: 'Associate',
      Paralegal: 'Paralegal',
    },
    UserStatus: {
      Pending: 'Pending',
      Active: 'Active',
      Inactive: 'Inactive',
    },
  };
});

// Mock axios for Microsoft Graph API calls
jest.mock('axios');

import axios from 'axios';
import { UserService } from '../../src/services/user.service';

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('UserService', () => {
  let userService: UserService;

  beforeEach(() => {
    // Create new UserService instance and inject mocked Prisma
    userService = new UserService(mockPrisma as any);
    jest.clearAllMocks();
  });

  describe('fetchUserProfileFromGraph', () => {
    it('should fetch user profile from Microsoft Graph API', async () => {
      const mockAccessToken = 'mock-access-token';
      const mockGraphProfile = {
        id: 'azure-user-123',
        userPrincipalName: 'john.doe@lawfirm.onmicrosoft.com',
        mail: 'john.doe@lawfirm.ro',
        displayName: 'John Doe',
        givenName: 'John',
        surname: 'Doe',
        jobTitle: 'Associate',
        officeLocation: 'Bucharest Office',
      };

      mockedAxios.get.mockResolvedValue({ data: mockGraphProfile });

      const profile = await userService.fetchUserProfileFromGraph(
        mockAccessToken
      );

      expect(profile).toEqual(mockGraphProfile);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://graph.microsoft.com/v1.0/me',
        {
          headers: {
            Authorization: `Bearer ${mockAccessToken}`,
          },
          timeout: 5000,
        }
      );
    });

    it('should throw error if Graph API returns error response', async () => {
      const mockAccessToken = 'mock-access-token';
      const mockError = {
        response: {
          status: 401,
          data: {
            error: {
              message: 'Invalid authentication token',
            },
          },
        },
      };

      mockedAxios.get.mockRejectedValue(mockError);

      await expect(
        userService.fetchUserProfileFromGraph(mockAccessToken)
      ).rejects.toThrow('Microsoft Graph API error: 401 - Invalid authentication token');
    });

    it('should throw error if Graph API request times out', async () => {
      const mockAccessToken = 'mock-access-token';
      const mockError = {
        request: {},
        message: 'Request timeout',
      };

      mockedAxios.get.mockRejectedValue(mockError);

      await expect(
        userService.fetchUserProfileFromGraph(mockAccessToken)
      ).rejects.toThrow('Microsoft Graph API request failed: No response received');
    });

    it('should throw error if Graph API call setup fails', async () => {
      const mockAccessToken = 'mock-access-token';
      const mockError = new Error('Network error');

      mockedAxios.get.mockRejectedValue(mockError);

      await expect(
        userService.fetchUserProfileFromGraph(mockAccessToken)
      ).rejects.toThrow('Failed to call Microsoft Graph API: Network error');
    });
  });

  describe('findOrCreateUser', () => {
    it('should return existing user and update lastActive', async () => {
      const mockExistingUser = {
        id: 'user-123',
        azureAdId: 'azure-123',
        email: 'john.doe@lawfirm.ro',
        firstName: 'John',
        lastName: 'Doe',
        role: 'Partner',
        status: 'Active',
        firmId: 'firm-456',
        preferences: {},
        createdAt: new Date('2024-01-01'),
        lastActive: new Date('2024-06-01'),
      };

      const mockUpdatedUser = {
        ...mockExistingUser,
        lastActive: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockExistingUser);
      mockPrisma.user.update.mockResolvedValue(mockUpdatedUser);

      const user = await userService.findOrCreateUser(
        'azure-123',
        'john.doe@lawfirm.ro',
        'John',
        'Doe'
      );

      expect(user).toEqual(mockUpdatedUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { azureAdId: 'azure-123' },
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { lastActive: expect.any(Date) },
      });
    });

    it('should create new user with Pending status if not exists', async () => {
      const mockNewUser = {
        id: 'user-new',
        azureAdId: 'azure-new',
        email: 'new.user@lawfirm.ro',
        firstName: 'New',
        lastName: 'User',
        role: 'Paralegal',
        status: 'Pending',
        firmId: null,
        preferences: {
          language: 'ro',
          aiSuggestionLevel: 'moderate',
        },
        createdAt: new Date(),
        lastActive: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockNewUser);

      const user = await userService.findOrCreateUser(
        'azure-new',
        'new.user@lawfirm.ro',
        'New',
        'User'
      );

      expect(user).toEqual(mockNewUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { azureAdId: 'azure-new' },
      });
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          azureAdId: 'azure-new',
          email: 'new.user@lawfirm.ro',
          firstName: 'New',
          lastName: 'User',
          role: 'Paralegal',
          status: 'Pending',
          firmId: null,
          preferences: {
            language: 'ro',
            aiSuggestionLevel: 'moderate',
          },
        },
      });
    });
  });

  describe('findUserByAzureAdId', () => {
    it('should find user by Azure AD ID', async () => {
      const mockUser = {
        id: 'user-123',
        azureAdId: 'azure-123',
        email: 'john.doe@lawfirm.ro',
        firstName: 'John',
        lastName: 'Doe',
        role: 'Partner',
        status: 'Active',
        firmId: 'firm-456',
        preferences: {},
        createdAt: new Date(),
        lastActive: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const user = await userService.findUserByAzureAdId('azure-123');

      expect(user).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { azureAdId: 'azure-123' },
      });
    });

    it('should return null if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const user = await userService.findUserByAzureAdId('non-existent');

      expect(user).toBeNull();
    });
  });

  describe('findUserByEmail', () => {
    it('should find user by email', async () => {
      const mockUser = {
        id: 'user-123',
        azureAdId: 'azure-123',
        email: 'john.doe@lawfirm.ro',
        firstName: 'John',
        lastName: 'Doe',
        role: 'Partner',
        status: 'Active',
        firmId: 'firm-456',
        preferences: {},
        createdAt: new Date(),
        lastActive: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const user = await userService.findUserByEmail('john.doe@lawfirm.ro');

      expect(user).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'john.doe@lawfirm.ro' },
      });
    });

    it('should return null if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const user = await userService.findUserByEmail('nonexistent@lawfirm.ro');

      expect(user).toBeNull();
    });
  });

  describe('findUserById', () => {
    it('should find user by ID', async () => {
      const mockUser = {
        id: 'user-123',
        azureAdId: 'azure-123',
        email: 'john.doe@lawfirm.ro',
        firstName: 'John',
        lastName: 'Doe',
        role: 'Partner',
        status: 'Active',
        firmId: 'firm-456',
        preferences: {},
        createdAt: new Date(),
        lastActive: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const user = await userService.findUserById('user-123');

      expect(user).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
    });

    it('should return null if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const user = await userService.findUserById('non-existent');

      expect(user).toBeNull();
    });
  });

  describe('updateLastActive', () => {
    it('should update lastActive timestamp', async () => {
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-123',
        lastActive: new Date(),
      });

      await userService.updateLastActive('user-123');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { lastActive: expect.any(Date) },
      });
    });
  });

  describe('extractUserInfoFromIdToken', () => {
    it('should extract user info from ID token claims', () => {
      const idTokenClaims = {
        oid: 'azure-user-123',
        preferred_username: 'john.doe@lawfirm.ro',
        given_name: 'John',
        family_name: 'Doe',
      };

      const userInfo = userService.extractUserInfoFromIdToken(idTokenClaims);

      expect(userInfo).toEqual({
        azureAdId: 'azure-user-123',
        email: 'john.doe@lawfirm.ro',
        firstName: 'John',
        lastName: 'Doe',
      });
    });

    it('should fall back to sub claim if oid not present', () => {
      const idTokenClaims = {
        sub: 'azure-user-123',
        email: 'john.doe@lawfirm.ro',
        given_name: 'John',
        family_name: 'Doe',
      };

      const userInfo = userService.extractUserInfoFromIdToken(idTokenClaims);

      expect(userInfo.azureAdId).toBe('azure-user-123');
    });

    it('should fall back to email claim if preferred_username not present', () => {
      const idTokenClaims = {
        oid: 'azure-user-123',
        email: 'john.doe@lawfirm.ro',
        given_name: 'John',
        family_name: 'Doe',
      };

      const userInfo = userService.extractUserInfoFromIdToken(idTokenClaims);

      expect(userInfo.email).toBe('john.doe@lawfirm.ro');
    });

    it('should fall back to upn claim if email not present', () => {
      const idTokenClaims = {
        oid: 'azure-user-123',
        upn: 'john.doe@lawfirm.onmicrosoft.com',
        given_name: 'John',
        family_name: 'Doe',
      };

      const userInfo = userService.extractUserInfoFromIdToken(idTokenClaims);

      expect(userInfo.email).toBe('john.doe@lawfirm.onmicrosoft.com');
    });

    it('should extract name from display name if given_name missing', () => {
      const idTokenClaims = {
        oid: 'azure-user-123',
        email: 'john.doe@lawfirm.ro',
        name: 'John Doe',
      };

      const userInfo = userService.extractUserInfoFromIdToken(idTokenClaims);

      expect(userInfo.firstName).toBe('John');
      expect(userInfo.lastName).toBe('Doe');
    });

    it('should use default values if names not present', () => {
      const idTokenClaims = {
        oid: 'azure-user-123',
        email: 'john.doe@lawfirm.ro',
      };

      const userInfo = userService.extractUserInfoFromIdToken(idTokenClaims);

      expect(userInfo.firstName).toBe('Unknown');
      expect(userInfo.lastName).toBe('User');
    });

    it('should throw error if Azure AD user ID not found', () => {
      const idTokenClaims = {
        email: 'john.doe@lawfirm.ro',
      };

      expect(() => {
        userService.extractUserInfoFromIdToken(idTokenClaims);
      }).toThrow('Azure AD user ID (oid) not found in ID token');
    });

    it('should throw error if email not found', () => {
      const idTokenClaims = {
        oid: 'azure-user-123',
      };

      expect(() => {
        userService.extractUserInfoFromIdToken(idTokenClaims);
      }).toThrow('Email not found in ID token claims');
    });
  });

  describe('provisionUserFromAzureAD', () => {
    it('should provision user using Graph API profile', async () => {
      const mockAccessToken = 'mock-access-token';
      const mockIdTokenClaims = {
        oid: 'azure-user-123',
        preferred_username: 'john.doe@lawfirm.ro',
        given_name: 'John',
        family_name: 'Doe',
      };

      const mockGraphProfile = {
        id: 'azure-user-123',
        userPrincipalName: 'john.doe@lawfirm.onmicrosoft.com',
        mail: 'john.doe@lawfirm.ro',
        displayName: 'John Doe',
        givenName: 'John',
        surname: 'Doe',
      };

      const mockUser = {
        id: 'user-new',
        azureAdId: 'azure-user-123',
        email: 'john.doe@lawfirm.ro',
        firstName: 'John',
        lastName: 'Doe',
        role: 'Paralegal',
        status: 'Pending',
        firmId: null,
        preferences: {},
        createdAt: new Date(),
        lastActive: new Date(),
      };

      mockedAxios.get.mockResolvedValue({ data: mockGraphProfile });
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);

      const user = await userService.provisionUserFromAzureAD(
        mockAccessToken,
        mockIdTokenClaims
      );

      expect(user).toEqual(mockUser);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://graph.microsoft.com/v1.0/me',
        expect.any(Object)
      );
      expect(mockPrisma.user.create).toHaveBeenCalled();
    });

    it('should fall back to ID token claims if Graph API fails', async () => {
      const mockAccessToken = 'mock-access-token';
      const mockIdTokenClaims = {
        oid: 'azure-user-123',
        preferred_username: 'john.doe@lawfirm.ro',
        given_name: 'John',
        family_name: 'Doe',
      };

      const mockUser = {
        id: 'user-new',
        azureAdId: 'azure-user-123',
        email: 'john.doe@lawfirm.ro',
        firstName: 'John',
        lastName: 'Doe',
        role: 'Paralegal',
        status: 'Pending',
        firmId: null,
        preferences: {},
        createdAt: new Date(),
        lastActive: new Date(),
      };

      // Graph API call fails
      mockedAxios.get.mockRejectedValue(new Error('Graph API error'));
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const user = await userService.provisionUserFromAzureAD(
        mockAccessToken,
        mockIdTokenClaims
      );

      expect(user).toEqual(mockUser);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch user profile from Microsoft Graph API')
      );
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          azureAdId: 'azure-user-123',
          email: 'john.doe@lawfirm.ro',
          firstName: 'John',
          lastName: 'Doe',
        }),
      });

      consoleSpy.mockRestore();
    });
  });

  describe('disconnect', () => {
    it('should disconnect Prisma client', async () => {
      await userService.disconnect();
      expect(mockPrisma.$disconnect).toHaveBeenCalled();
    });
  });
});
