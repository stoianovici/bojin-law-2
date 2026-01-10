/**
 * User Preferences GraphQL Resolvers
 * Global Settings: User Preferences
 *
 * Implements queries and mutations for user-specific preferences
 * stored in the User.preferences JSON field
 */

import { prisma } from '@legal-platform/database';
import { GraphQLError } from 'graphql';
import { requireAuth, type Context } from '../utils/auth';

// User preferences interface
interface UserPreferences {
  theme: 'DARK' | 'LIGHT';
  emailSignature: string | null;
}

// Default preferences when none are set
const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'DARK',
  emailSignature: null,
};

export const userPreferencesResolvers = {
  Query: {
    /**
     * Get current user's preferences
     * Authorization: Authenticated users only
     */
    userPreferences: async (_: any, __: any, context: Context) => {
      const user = requireAuth(context);

      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { preferences: true },
      });

      if (!dbUser) {
        throw new GraphQLError('User not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Merge stored preferences with defaults
      const storedPrefs = (dbUser.preferences as unknown as Partial<UserPreferences>) || {};
      return {
        theme: storedPrefs.theme || DEFAULT_PREFERENCES.theme,
        emailSignature: storedPrefs.emailSignature ?? DEFAULT_PREFERENCES.emailSignature,
      };
    },
  },

  Mutation: {
    /**
     * Update current user's preferences
     * Authorization: Authenticated users only
     */
    updateUserPreferences: async (
      _: any,
      args: { input: { theme?: 'DARK' | 'LIGHT'; emailSignature?: string } },
      context: Context
    ) => {
      const user = requireAuth(context);

      // Validate theme enum if provided
      if (args.input.theme && !['DARK', 'LIGHT'].includes(args.input.theme)) {
        throw new GraphQLError('Invalid theme value. Must be DARK or LIGHT', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Get current preferences
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { preferences: true },
      });

      if (!dbUser) {
        throw new GraphQLError('User not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Merge with existing preferences
      const currentPrefs = (dbUser.preferences as unknown as Partial<UserPreferences>) || {};
      const newPrefs: UserPreferences = {
        theme: args.input.theme ?? currentPrefs.theme ?? DEFAULT_PREFERENCES.theme,
        emailSignature:
          args.input.emailSignature !== undefined
            ? args.input.emailSignature
            : (currentPrefs.emailSignature ?? DEFAULT_PREFERENCES.emailSignature),
      };

      // Update user preferences
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          preferences: newPrefs as any,
        },
        select: { preferences: true },
      });

      const updatedPrefs = updatedUser.preferences as unknown as UserPreferences;
      return {
        theme: updatedPrefs.theme || DEFAULT_PREFERENCES.theme,
        emailSignature: updatedPrefs.emailSignature ?? DEFAULT_PREFERENCES.emailSignature,
      };
    },
  },
};

// Export for tests and GraphQL server
export const resolvers = userPreferencesResolvers;
export default userPreferencesResolvers;
