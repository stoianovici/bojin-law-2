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
  signaturePhone: string | null;
  signatureTitle: string | null;
  tutorialCompleted: boolean;
  tutorialStep: number;
  documentOpenMethod: 'DESKTOP' | 'ONLINE';
  receiveAllDocNotifications: boolean;
}

// Default preferences when none are set
const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'DARK',
  emailSignature: null,
  signaturePhone: null,
  signatureTitle: null,
  tutorialCompleted: false,
  tutorialStep: 0,
  documentOpenMethod: 'ONLINE',
  receiveAllDocNotifications: false,
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
        signaturePhone: storedPrefs.signaturePhone ?? DEFAULT_PREFERENCES.signaturePhone,
        signatureTitle: storedPrefs.signatureTitle ?? DEFAULT_PREFERENCES.signatureTitle,
        tutorialCompleted: storedPrefs.tutorialCompleted ?? DEFAULT_PREFERENCES.tutorialCompleted,
        tutorialStep: storedPrefs.tutorialStep ?? DEFAULT_PREFERENCES.tutorialStep,
        documentOpenMethod:
          storedPrefs.documentOpenMethod ?? DEFAULT_PREFERENCES.documentOpenMethod,
        receiveAllDocNotifications:
          storedPrefs.receiveAllDocNotifications ?? DEFAULT_PREFERENCES.receiveAllDocNotifications,
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
      args: {
        input: {
          theme?: 'DARK' | 'LIGHT';
          emailSignature?: string;
          signaturePhone?: string;
          signatureTitle?: string;
          tutorialCompleted?: boolean;
          tutorialStep?: number;
          documentOpenMethod?: 'DESKTOP' | 'ONLINE';
          receiveAllDocNotifications?: boolean;
        };
      },
      context: Context
    ) => {
      const user = requireAuth(context);

      // Validate theme enum if provided
      if (args.input.theme && !['DARK', 'LIGHT'].includes(args.input.theme)) {
        throw new GraphQLError('Invalid theme value. Must be DARK or LIGHT', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Validate documentOpenMethod enum if provided
      if (
        args.input.documentOpenMethod &&
        !['DESKTOP', 'ONLINE'].includes(args.input.documentOpenMethod)
      ) {
        throw new GraphQLError('Invalid documentOpenMethod value. Must be DESKTOP or ONLINE', {
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
        signaturePhone:
          args.input.signaturePhone !== undefined
            ? args.input.signaturePhone
            : (currentPrefs.signaturePhone ?? DEFAULT_PREFERENCES.signaturePhone),
        signatureTitle:
          args.input.signatureTitle !== undefined
            ? args.input.signatureTitle
            : (currentPrefs.signatureTitle ?? DEFAULT_PREFERENCES.signatureTitle),
        tutorialCompleted:
          args.input.tutorialCompleted !== undefined
            ? args.input.tutorialCompleted
            : (currentPrefs.tutorialCompleted ?? DEFAULT_PREFERENCES.tutorialCompleted),
        tutorialStep:
          args.input.tutorialStep !== undefined
            ? args.input.tutorialStep
            : (currentPrefs.tutorialStep ?? DEFAULT_PREFERENCES.tutorialStep),
        documentOpenMethod:
          args.input.documentOpenMethod ??
          currentPrefs.documentOpenMethod ??
          DEFAULT_PREFERENCES.documentOpenMethod,
        receiveAllDocNotifications:
          args.input.receiveAllDocNotifications ??
          currentPrefs.receiveAllDocNotifications ??
          DEFAULT_PREFERENCES.receiveAllDocNotifications,
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
        signaturePhone: updatedPrefs.signaturePhone ?? DEFAULT_PREFERENCES.signaturePhone,
        signatureTitle: updatedPrefs.signatureTitle ?? DEFAULT_PREFERENCES.signatureTitle,
        tutorialCompleted: updatedPrefs.tutorialCompleted ?? DEFAULT_PREFERENCES.tutorialCompleted,
        tutorialStep: updatedPrefs.tutorialStep ?? DEFAULT_PREFERENCES.tutorialStep,
        documentOpenMethod:
          updatedPrefs.documentOpenMethod ?? DEFAULT_PREFERENCES.documentOpenMethod,
        receiveAllDocNotifications:
          updatedPrefs.receiveAllDocNotifications ?? DEFAULT_PREFERENCES.receiveAllDocNotifications,
      };
    },
  },
};

// Export for tests and GraphQL server
export const resolvers = userPreferencesResolvers;
export default userPreferencesResolvers;
