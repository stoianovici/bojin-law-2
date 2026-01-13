/**
 * Firm Settings GraphQL Resolvers
 * Story 2.8.1: Billing & Rate Management
 * Story 2.11.1: Business Owner Role
 *
 * Implements queries and mutations for firm-level billing settings
 */

import { prisma } from '@legal-platform/database';
import { GraphQLError } from 'graphql';
import { requireAuth, requirePartnerOrBusinessOwner, type Context } from '../utils/auth';
import { firmTemplateService } from '../../services/firm-template.service';
import { sharePointService } from '../../services/sharepoint.service';
import logger from '../../utils/logger';

// Default rates interface
interface DefaultRates {
  partnerRate: number;
  associateRate: number;
  paralegalRate: number;
}

// Helper function to require Partner or BusinessOwner role for billing management
function requirePartner(context: Context) {
  return requirePartnerOrBusinessOwner(context).user;
}

// Validate rate values
function validateRates(rates: DefaultRates) {
  const { partnerRate, associateRate, paralegalRate } = rates;

  // Check all rates are positive numbers
  if (partnerRate <= 0 || associateRate <= 0 || paralegalRate <= 0) {
    throw new GraphQLError('All rates must be positive numbers', {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }

  // Check for valid number types
  if (
    !Number.isFinite(partnerRate) ||
    !Number.isFinite(associateRate) ||
    !Number.isFinite(paralegalRate)
  ) {
    throw new GraphQLError('Rates must be valid numbers', {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }

  // Validate decimal precision (max 2 decimal places for cents precision)
  // Rates are in cents, so should be whole numbers
  const rateArray = [partnerRate, associateRate, paralegalRate];
  for (const rate of rateArray) {
    if (!Number.isInteger(rate)) {
      throw new GraphQLError(
        'Rates must be in cents (whole numbers). Example: 50000 cents = $500.00',
        {
          extensions: { code: 'BAD_USER_INPUT' },
        }
      );
    }
  }
}

// Audit log helper for rate changes
async function logRateChange(data: {
  firmId: string;
  userId: string;
  oldRates: DefaultRates | null;
  newRates: DefaultRates;
}) {
  // For now, we'll log to console. In production, this would go to an audit table
  console.log('[AUDIT] Default rates changed:', {
    firmId: data.firmId,
    userId: data.userId,
    oldRates: data.oldRates,
    newRates: data.newRates,
    timestamp: new Date().toISOString(),
  });

  // TODO: Once audit log table is created in future story, insert here
  // await prisma.firmAuditLog.create({
  //   data: {
  //     firmId: data.firmId,
  //     userId: data.userId,
  //     action: 'DEFAULT_RATES_UPDATED',
  //     oldValue: JSON.stringify(data.oldRates),
  //     newValue: JSON.stringify(data.newRates),
  //     timestamp: new Date(),
  //   },
  // });
}

export const firmResolvers = {
  Query: {
    /**
     * Get current firm's default billing rates
     * Authorization: Partner role required (financial data)
     */
    defaultRates: async (_: any, __: any, context: Context) => {
      const user = requirePartner(context);

      const firm = await prisma.firm.findUnique({
        where: { id: user.firmId },
        select: { defaultRates: true },
      });

      if (!firm) {
        throw new GraphQLError('Firm not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Return null if rates haven't been set yet
      if (!firm.defaultRates) {
        return null;
      }

      return firm.defaultRates as unknown as DefaultRates;
    },

    /**
     * Get current firm information
     * Authorization: Authenticated users can view their firm
     */
    firm: async (_: any, __: any, context: Context) => {
      const user = requireAuth(context);

      const firm = await prisma.firm.findUnique({
        where: { id: user.firmId },
      });

      if (!firm) {
        throw new GraphQLError('Firm not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      return firm;
    },

    /**
     * Get all users in the current firm
     * Authorization: Authenticated users can view firm members
     */
    firmUsers: async (_: any, __: any, context: Context) => {
      const user = requireAuth(context);

      const users = await prisma.user.findMany({
        where: { firmId: user.firmId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      });

      return users;
    },

    /**
     * Get the firm's document template configuration
     * Authorization: Admin role required
     */
    firmDocumentTemplate: async (_: any, __: any, context: Context) => {
      const user = requirePartner(context);

      const templateInfo = await firmTemplateService.getTemplateInfo(user.firmId);

      if (!templateInfo) {
        return null;
      }

      return templateInfo;
    },
  },

  Mutation: {
    /**
     * Update firm's default billing rates
     * Authorization: Partner role required
     * Validation: All rates must be positive numbers in cents
     */
    updateDefaultRates: async (_: any, args: { input: DefaultRates }, context: Context) => {
      const user = requirePartner(context);

      // Validate rates
      validateRates(args.input);

      // Get current rates for audit log
      const currentFirm = await prisma.firm.findUnique({
        where: { id: user.firmId },
        select: { defaultRates: true },
      });

      if (!currentFirm) {
        throw new GraphQLError('Firm not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const oldRates = currentFirm.defaultRates as unknown as DefaultRates | null;

      // Update firm with new rates
      const updatedFirm = await prisma.firm.update({
        where: { id: user.firmId },
        data: {
          defaultRates: args.input as any,
        },
        select: { defaultRates: true },
      });

      // Log the change for audit trail
      await logRateChange({
        firmId: user.firmId,
        userId: user.id,
        oldRates,
        newRates: args.input,
      });

      return updatedFirm.defaultRates as unknown as DefaultRates;
    },

    /**
     * Update the firm's master document template
     * Authorization: Admin role required
     */
    updateFirmDocumentTemplate: async (
      _: any,
      args: { input: { url: string; driveItemId: string; fileName: string } },
      context: Context
    ) => {
      const user = requirePartner(context);

      logger.info('Updating firm document template', {
        firmId: user.firmId,
        userId: user.id,
        fileName: args.input.fileName,
      });

      const templateInfo = await firmTemplateService.updateTemplate(user.firmId, args.input);

      return templateInfo;
    },

    /**
     * Upload a firm document template file to SharePoint
     * Authorization: Admin role required
     */
    uploadFirmDocumentTemplate: async (
      _: any,
      args: { input: { fileName: string; fileType: string; fileContent: string } },
      context: Context
    ) => {
      const user = requirePartner(context);

      // Get access token from context
      const accessToken = context.user?.accessToken;
      if (!accessToken) {
        throw new GraphQLError('Access token required for SharePoint upload', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Validate file type
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.template', // .dotx
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      ];
      if (!allowedTypes.includes(args.input.fileType)) {
        throw new GraphQLError('Only .dotx and .docx files are allowed for templates', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      logger.info('Uploading firm document template', {
        firmId: user.firmId,
        userId: user.id,
        fileName: args.input.fileName,
        fileType: args.input.fileType,
      });

      // Decode base64 file content
      const fileBuffer = Buffer.from(args.input.fileContent, 'base64');

      // Upload to SharePoint in Templates folder
      // Using 'Templates' as the "case number" to place in Shared Documents/Templates/
      const spItem = await sharePointService.uploadDocument(
        accessToken,
        'Templates', // This creates/uses the Templates folder
        args.input.fileName,
        fileBuffer,
        args.input.fileType
      );

      logger.info('Template uploaded to SharePoint', {
        firmId: user.firmId,
        driveItemId: spItem.id,
        webUrl: spItem.webUrl,
      });

      // Update firm's template reference
      const templateInfo = await firmTemplateService.updateTemplate(user.firmId, {
        url: spItem.webUrl,
        driveItemId: spItem.id,
        fileName: args.input.fileName,
      });

      return templateInfo;
    },
  },

  // Field resolvers for Firm type
  Firm: {
    /**
     * Resolve defaultRates field
     * Returns null if rates haven't been set
     */
    defaultRates: (parent: any) => {
      return parent.defaultRates || null;
    },

    /**
     * Resolve documentTemplateUrl field
     */
    documentTemplateUrl: (parent: any) => {
      return parent.documentTemplateUrl || null;
    },

    /**
     * Resolve documentTemplateDriveItemId field
     */
    documentTemplateDriveItemId: (parent: any) => {
      return parent.documentTemplateDriveItemId || null;
    },
  },
};

// Export for tests and GraphQL server
export const resolvers = firmResolvers;
export default firmResolvers;
