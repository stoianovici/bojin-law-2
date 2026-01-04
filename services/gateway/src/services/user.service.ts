/**
 * User Service
 * Story 2.4: Authentication with Azure AD
 *
 * Handles user provisioning and management with Azure AD integration.
 * Automatically creates users on first login with 'Pending' status.
 *
 * Ref: Microsoft Graph API - https://learn.microsoft.com/en-us/graph/api/user-get
 */

import type { User } from '@prisma/client';
import { PrismaClient as PrismaClientType, UserRole, UserStatus } from '@prisma/client';
import axios from 'axios';
import { GraphUserProfile } from '../types/auth.types';

/**
 * User Service
 * Handles user provisioning and profile management
 */
export class UserService {
  private prisma: PrismaClientType;

  /**
   * Create UserService instance
   *
   * @param prismaClient - Optional Prisma client (for testing)
   */
  constructor(prismaClient?: PrismaClientType) {
    this.prisma = prismaClient || new PrismaClientType();
  }
  /**
   * Fetch user profile from Microsoft Graph API
   *
   * @param accessToken - Azure AD access token
   * @returns User profile from Microsoft Graph
   * @throws Error if Graph API call fails
   */
  async fetchUserProfileFromGraph(accessToken: string): Promise<GraphUserProfile> {
    try {
      const response = await axios.get<GraphUserProfile>('https://graph.microsoft.com/v1.0/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        timeout: 5000, // 5 second timeout
      });

      return response.data;
    } catch (error: any) {
      if (error.response) {
        // Graph API returned an error response
        throw new Error(
          `Microsoft Graph API error: ${error.response.status} - ${
            error.response.data?.error?.message || 'Unknown error'
          }`
        );
      } else if (error.request) {
        // Request was made but no response received
        throw new Error('Microsoft Graph API request failed: No response received');
      } else {
        // Error setting up the request
        throw new Error(`Failed to call Microsoft Graph API: ${error.message}`);
      }
    }
  }

  /**
   * Find or create user in database based on Azure AD profile
   *
   * New users are created with:
   * - status: 'Pending' (awaiting partner activation)
   * - role: 'Paralegal' (default role)
   * - firmId: null (will be assigned during activation)
   *
   * Existing users have their lastActive timestamp updated.
   *
   * @param azureAdId - Azure AD user ID (oid claim)
   * @param email - User email
   * @param firstName - User first name
   * @param lastName - User last name
   * @returns User record from database
   */
  async findOrCreateUser(
    azureAdId: string,
    email: string,
    firstName: string,
    lastName: string
  ): Promise<User> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: {
        azureAdId: azureAdId,
      },
    });

    if (existingUser) {
      // User exists - update lastActive timestamp
      const updatedUser = await this.prisma.user.update({
        where: {
          id: existingUser.id,
        },
        data: {
          lastActive: new Date(),
        },
      });

      return updatedUser;
    }

    // User does not exist - create new user with Pending status
    const newUser = await this.prisma.user.create({
      data: {
        azureAdId: azureAdId,
        email: email,
        firstName: firstName,
        lastName: lastName,
        role: UserRole.AssociateJr, // Default role
        status: UserStatus.Pending, // Awaiting partner activation
        firmId: null, // Will be assigned during activation (Story 2.4.1)
        preferences: {
          language: 'ro',
          aiSuggestionLevel: 'moderate',
        },
      },
    });

    return newUser;
  }

  /**
   * Find user by Azure AD ID
   *
   * @param azureAdId - Azure AD user ID
   * @returns User record or null if not found
   */
  async findUserByAzureAdId(azureAdId: string): Promise<User | null> {
    return await this.prisma.user.findUnique({
      where: {
        azureAdId: azureAdId,
      },
    });
  }

  /**
   * Find user by email
   *
   * @param email - User email
   * @returns User record or null if not found
   */
  async findUserByEmail(email: string): Promise<User | null> {
    return await this.prisma.user.findUnique({
      where: {
        email: email,
      },
    });
  }

  /**
   * Find user by ID
   *
   * @param userId - User ID
   * @returns User record or null if not found
   */
  async findUserById(userId: string): Promise<User | null> {
    return await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });
  }

  /**
   * Update user's lastActive timestamp
   *
   * @param userId - User ID
   */
  async updateLastActive(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        lastActive: new Date(),
      },
    });
  }

  /**
   * Extract user info from Azure AD ID token claims
   *
   * @param idTokenClaims - ID token claims from Azure AD
   * @returns User information extracted from claims
   */
  extractUserInfoFromIdToken(idTokenClaims: any): {
    azureAdId: string;
    email: string;
    firstName: string;
    lastName: string;
  } {
    // Extract Azure AD user ID (oid claim)
    const azureAdId = idTokenClaims.oid || idTokenClaims.sub;
    if (!azureAdId) {
      throw new Error('Azure AD user ID (oid) not found in ID token');
    }

    // Extract email (preferred_username or email claim)
    const email = idTokenClaims.preferred_username || idTokenClaims.email || idTokenClaims.upn;
    if (!email) {
      throw new Error('Email not found in ID token claims');
    }

    // Extract first name (given_name claim)
    const firstName = idTokenClaims.given_name || idTokenClaims.name?.split(' ')[0] || 'Unknown';

    // Extract last name (family_name claim)
    const lastName =
      idTokenClaims.family_name || idTokenClaims.name?.split(' ').slice(1).join(' ') || 'User';

    return {
      azureAdId,
      email,
      firstName,
      lastName,
    };
  }

  /**
   * Provision user from Azure AD access token and ID token
   *
   * This is the main entry point for user provisioning during OAuth callback.
   * It extracts user info from ID token, optionally fetches extended profile
   * from Graph API, and creates or updates the user in the database.
   *
   * @param accessToken - Azure AD access token (for Graph API calls)
   * @param idTokenClaims - ID token claims (contains basic user info)
   * @returns User record from database
   */
  async provisionUserFromAzureAD(accessToken: string, idTokenClaims: any): Promise<User> {
    // Extract user info from ID token claims
    const { azureAdId, email, firstName, lastName } =
      this.extractUserInfoFromIdToken(idTokenClaims);

    // Optionally fetch extended profile from Microsoft Graph API
    // This provides additional information like job title, office location, etc.
    // If Graph API call fails, we fall back to ID token claims
    let graphProfile: GraphUserProfile | null = null;
    try {
      graphProfile = await this.fetchUserProfileFromGraph(accessToken);
    } catch (error: any) {
      console.warn(`Failed to fetch user profile from Microsoft Graph API: ${error.message}`);
      // Continue with ID token claims only
    }

    // Use Graph profile if available, otherwise use ID token claims
    const finalEmail = graphProfile?.mail || email;
    const finalFirstName = graphProfile?.givenName || firstName;
    const finalLastName = graphProfile?.surname || lastName;

    // Find or create user in database
    const user = await this.findOrCreateUser(azureAdId, finalEmail, finalFirstName, finalLastName);

    return user;
  }

  /**
   * Close Prisma connection
   * Should be called on application shutdown
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
