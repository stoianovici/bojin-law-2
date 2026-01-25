/**
 * Invoice Resolvers
 *
 * GraphQL resolvers for invoice and billing operations.
 * Integrates with Oblio.eu for Romanian invoicing.
 */

import { GraphQLError } from 'graphql';
import { prisma } from '@legal-platform/database';
import { InvoiceStatus } from '@prisma/client';
import {
  InvoiceService,
  CreatePreparedInvoiceInput,
  LineItemInput,
} from '../../services/invoice.service';
import { OblioService } from '../../services/oblio.service';
import { encrypt, decrypt } from '../../utils/encryption.util';
import { Decimal } from '@prisma/client/runtime/library';

// ============================================================================
// Types
// ============================================================================

interface Context {
  user: {
    id: string;
    role: string;
    firmId: string;
  };
}

interface OblioConfigInput {
  email: string;
  secret: string;
  companyCif: string;
  defaultSeries: string;
  workStation?: string;
  isVatPayer?: boolean;
  defaultVatRate?: number;
  defaultDueDays?: number;
  exchangeRateSource?: string;
  autoSubmitEFactura?: boolean;
}

interface InvoiceFilters {
  clientId?: string;
  caseId?: string;
  status?: InvoiceStatus;
  dateFrom?: string;
  dateTo?: string;
}

// ============================================================================
// Services
// ============================================================================

const invoiceService = new InvoiceService();

// ============================================================================
// Helpers
// ============================================================================

function requireAuth(context: Context) {
  if (!context.user) {
    throw new GraphQLError('Autentificare necesară', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return context.user;
}

function requirePartnerAccess(context: Context) {
  const user = requireAuth(context);
  if (user.role !== 'Partner' && user.role !== 'BusinessOwner') {
    throw new GraphQLError('Acces permis doar pentru Partner sau BusinessOwner', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
  return user;
}

function decimalToNumber(value: Decimal | null | undefined): number | null {
  if (value == null) return null;
  return parseFloat(value.toString());
}

function formatDate(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toISOString().split('T')[0];
}

// ============================================================================
// Resolvers
// ============================================================================

export const invoiceResolvers = {
  Query: {
    /**
     * Get Oblio configuration for the current firm.
     */
    oblioConfig: async (_: unknown, _args: unknown, context: Context) => {
      const user = requireAuth(context);

      const config = await prisma.oblioConfig.findUnique({
        where: { firmId: user.firmId },
      });

      if (!config) {
        return null;
      }

      return {
        email: config.email,
        companyCif: config.companyCif,
        defaultSeries: config.defaultSeries,
        workStation: config.workStation,
        isVatPayer: config.isVatPayer,
        defaultVatRate: decimalToNumber(config.defaultVatRate),
        defaultDueDays: config.defaultDueDays,
        exchangeRateSource: config.exchangeRateSource,
        autoSubmitEFactura: config.autoSubmitEFactura,
        isConfigured: true,
        lastTestedAt: config.lastTestedAt,
      };
    },

    /**
     * Get a single invoice by ID.
     */
    invoice: async (_: unknown, args: { id: string }, context: Context) => {
      const user = requireAuth(context);

      return invoiceService.getInvoice(args.id, user.firmId);
    },

    /**
     * Get invoices with optional filters.
     */
    invoices: async (
      _: unknown,
      args: { filters?: InvoiceFilters; limit?: number; offset?: number },
      context: Context
    ) => {
      const user = requireAuth(context);

      const filters = args.filters
        ? {
            clientId: args.filters.clientId,
            caseId: args.filters.caseId,
            status: args.filters.status,
            dateFrom: args.filters.dateFrom ? new Date(args.filters.dateFrom) : undefined,
            dateTo: args.filters.dateTo ? new Date(args.filters.dateTo) : undefined,
          }
        : undefined;

      return invoiceService.getInvoices(user.firmId, filters, args.limit || 50, args.offset || 0);
    },
  },

  Mutation: {
    /**
     * Save Oblio configuration.
     */
    saveOblioConfig: async (_: unknown, args: { input: OblioConfigInput }, context: Context) => {
      const user = requirePartnerAccess(context);

      const { input } = args;

      // Encrypt the API secret
      const secretEncrypted = encrypt(input.secret);

      // Upsert the configuration
      const config = await prisma.oblioConfig.upsert({
        where: { firmId: user.firmId },
        create: {
          firmId: user.firmId,
          email: input.email,
          secretEncrypted,
          companyCif: input.companyCif,
          defaultSeries: input.defaultSeries,
          workStation: input.workStation,
          isVatPayer: input.isVatPayer ?? true,
          defaultVatRate: input.defaultVatRate ?? 19,
          defaultDueDays: input.defaultDueDays ?? 30,
          exchangeRateSource: input.exchangeRateSource ?? 'BNR',
          autoSubmitEFactura: input.autoSubmitEFactura ?? false,
        },
        update: {
          email: input.email,
          secretEncrypted,
          companyCif: input.companyCif,
          defaultSeries: input.defaultSeries,
          workStation: input.workStation,
          isVatPayer: input.isVatPayer,
          defaultVatRate: input.defaultVatRate,
          defaultDueDays: input.defaultDueDays,
          exchangeRateSource: input.exchangeRateSource,
          autoSubmitEFactura: input.autoSubmitEFactura,
        },
      });

      return {
        email: config.email,
        companyCif: config.companyCif,
        defaultSeries: config.defaultSeries,
        workStation: config.workStation,
        isVatPayer: config.isVatPayer,
        defaultVatRate: decimalToNumber(config.defaultVatRate),
        defaultDueDays: config.defaultDueDays,
        exchangeRateSource: config.exchangeRateSource,
        autoSubmitEFactura: config.autoSubmitEFactura,
        isConfigured: true,
        lastTestedAt: config.lastTestedAt,
      };
    },

    /**
     * Test Oblio API connection.
     */
    testOblioConnection: async (_: unknown, _args: unknown, context: Context) => {
      const user = requirePartnerAccess(context);

      const oblioService = new OblioService(user.firmId);
      const result = await oblioService.testConnection();

      // Update lastTestedAt if successful
      if (result.success) {
        await prisma.oblioConfig.update({
          where: { firmId: user.firmId },
          data: { lastTestedAt: new Date() },
        });
      }

      return result;
    },

    /**
     * Create a prepared invoice (draft).
     */
    createPreparedInvoice: async (
      _: unknown,
      args: { input: CreatePreparedInvoiceInput },
      context: Context
    ) => {
      const user = requireAuth(context);

      // Transform line items to ensure proper types
      const input: CreatePreparedInvoiceInput = {
        ...args.input,
        lineItems: args.input.lineItems.map((item: LineItemInput) => ({
          ...item,
          lineType: item.lineType as 'TimeEntry' | 'Fixed' | 'Expense' | 'Discount' | 'Manual',
        })),
      };

      return invoiceService.createPreparedInvoice(input, user.id, user.firmId);
    },

    /**
     * Issue invoice to Oblio (get official number).
     */
    issueInvoice: async (_: unknown, args: { id: string }, context: Context) => {
      const user = requireAuth(context);

      return invoiceService.issueInvoice(args.id, user.firmId);
    },

    /**
     * Mark invoice as paid.
     */
    markInvoicePaid: async (
      _: unknown,
      args: { id: string; paidAt?: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      const paidAt = args.paidAt ? new Date(args.paidAt) : undefined;

      return invoiceService.markInvoicePaid(args.id, user.firmId, paidAt);
    },

    /**
     * Cancel an issued invoice.
     */
    cancelInvoice: async (_: unknown, args: { id: string; reason?: string }, context: Context) => {
      const user = requireAuth(context);

      return invoiceService.cancelInvoice(args.id, user.firmId, args.reason);
    },

    /**
     * Delete a draft invoice.
     */
    deleteInvoice: async (_: unknown, args: { id: string }, context: Context) => {
      const user = requireAuth(context);

      return invoiceService.deleteInvoice(args.id, user.firmId);
    },

    /**
     * Submit invoice to e-Factura (ANAF).
     */
    submitInvoiceToEFactura: async (_: unknown, args: { id: string }, context: Context) => {
      const user = requireAuth(context);

      return invoiceService.submitToEFactura(args.id, user.firmId);
    },

    // ========================================================================
    // Proforma Mutations (for testing without real invoices)
    // ========================================================================

    /**
     * Issue a draft as a proforma in Oblio.
     * Proformas can be deleted and don't affect invoice numbering.
     */
    issueAsProforma: async (_: unknown, args: { id: string }, context: Context) => {
      const user = requireAuth(context);

      return invoiceService.issueAsProforma(args.id, user.firmId);
    },

    /**
     * Delete a proforma from Oblio.
     */
    deleteProforma: async (_: unknown, args: { id: string }, context: Context) => {
      const user = requireAuth(context);

      return invoiceService.deleteProforma(args.id, user.firmId);
    },

    /**
     * Convert a proforma to a real invoice.
     */
    convertProformaToInvoice: async (_: unknown, args: { id: string }, context: Context) => {
      const user = requireAuth(context);

      return invoiceService.convertProformaToInvoice(args.id, user.firmId);
    },
  },

  // ============================================================================
  // Field Resolvers
  // ============================================================================

  Invoice: {
    issueDate: (parent: any) => formatDate(parent.issueDate),
    dueDate: (parent: any) => formatDate(parent.dueDate),
    exchangeRateDate: (parent: any) => formatDate(parent.exchangeRateDate),
    exchangeRate: (parent: any) => decimalToNumber(parent.exchangeRate),
    subtotalEur: (parent: any) => decimalToNumber(parent.subtotalEur),
    subtotalRon: (parent: any) => decimalToNumber(parent.subtotalRon),
    vatAmount: (parent: any) => decimalToNumber(parent.vatAmount),
    total: (parent: any) => decimalToNumber(parent.total),
    totalRon: (parent: any) => decimalToNumber(parent.total), // total is in RON

    client: async (parent: any) => {
      if (parent.client) return parent.client;
      return prisma.client.findUnique({ where: { id: parent.clientId } });
    },

    case: async (parent: any) => {
      if (parent.case) return parent.case;
      if (!parent.caseId) return null;
      return prisma.case.findUnique({ where: { id: parent.caseId } });
    },

    createdBy: async (parent: any) => {
      if (parent.createdBy) return parent.createdBy;
      return prisma.user.findUnique({ where: { id: parent.createdById } });
    },

    lineItems: async (parent: any) => {
      if (parent.lineItems) return parent.lineItems;
      return prisma.invoiceLineItem.findMany({
        where: { invoiceId: parent.id },
        orderBy: { sortOrder: 'asc' },
      });
    },

    clientName: async (parent: any) => {
      if (parent.client?.name) return parent.client.name;
      const client = await prisma.client.findUnique({
        where: { id: parent.clientId },
        select: { name: true },
      });
      return client?.name;
    },

    oblioId: (parent: any) => parent.oblioDocumentId,
  },

  InvoiceLineItem: {
    quantity: (parent: any) => decimalToNumber(parent.quantity),
    unitPriceEur: (parent: any) => decimalToNumber(parent.unitPriceEur),
    unitPriceRon: (parent: any) => decimalToNumber(parent.unitPriceRon),
    amountEur: (parent: any) => decimalToNumber(parent.amountEur),
    amountRon: (parent: any) => decimalToNumber(parent.amountRon),
    vatRate: (parent: any) => decimalToNumber(parent.vatRate),
    vatAmount: (parent: any) => decimalToNumber(parent.vatAmount),
    total: (parent: any) => decimalToNumber(parent.total),
    originalHours: (parent: any) => decimalToNumber(parent.originalHours),
    originalRateEur: (parent: any) => decimalToNumber(parent.originalRateEur),
    productType: () => 'Serviciu',
    itemType: (parent: any) => parent.lineType,
  },
};
