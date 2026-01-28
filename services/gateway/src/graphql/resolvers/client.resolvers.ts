/**
 * Client GraphQL Resolvers
 * OPS-226: Client Query + Resolver for Client Portfolio View
 *
 * Implements the client(id) query to fetch a client with their case portfolio
 */

import { prisma, Prisma } from '@legal-platform/database';
import {
  EmailClassificationState,
  ClassificationMatchType as PrismaMatchType,
} from '@prisma/client';
import { GraphQLError } from 'graphql';
import { requireAuth, type Context } from '../utils/auth';
import {
  isFullAccessRole,
  getAccessibleClientIds,
  canUserAccessClient,
} from '../utils/access-control';
import { caseContextService } from '../../services/case-context.service';
import {
  emailClassifierService,
  type EmailForClassification,
  type ClassificationMatchType as ClassifierMatchType,
} from '../../services/email-classifier';
import { emailReclassifierService } from '../../services/email-reclassifier';
import { queueClientAttachmentSyncBatch } from '../../workers/client-attachment-sync.worker';

/**
 * Map email-classifier match types to Prisma enum values
 */
function mapMatchTypeToPrisma(matchType: ClassifierMatchType): PrismaMatchType {
  switch (matchType) {
    case 'THREAD':
      return PrismaMatchType.ThreadContinuity;
    case 'REFERENCE':
      return PrismaMatchType.ReferenceNumber;
    case 'CONTACT':
      return PrismaMatchType.Actor;
    case 'DOMAIN':
      return PrismaMatchType.Actor; // Domain match is a form of contact matching
    case 'FILTERED':
    case 'UNKNOWN':
    default:
      return PrismaMatchType.Manual; // Fallback for edge cases
  }
}

// ============================================================================
// Types
// ============================================================================

interface ContactInfo {
  email?: string;
  phone?: string;
  [key: string]: unknown;
}

interface ClientPerson {
  id: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
}

interface ClientPersonInput {
  id?: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
}

/**
 * Extract email from contactInfo JSON field
 */
function extractEmail(contactInfo: unknown): string | null {
  if (!contactInfo || typeof contactInfo !== 'object') return null;
  const info = contactInfo as ContactInfo;
  return info.email || null;
}

/**
 * Extract phone from contactInfo JSON field
 */
function extractPhone(contactInfo: unknown): string | null {
  if (!contactInfo || typeof contactInfo !== 'object') return null;
  const info = contactInfo as ContactInfo;
  return info.phone || null;
}

/**
 * Parse JSON array field safely
 */
function parseJsonArray(data: unknown): ClientPerson[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as ClientPerson[];
  return [];
}

/**
 * Prepare persons array for storage - ensure each has an id
 */
function preparePersonsForStorage(persons: ClientPersonInput[] | undefined): ClientPerson[] {
  if (!persons || persons.length === 0) return [];
  return persons.map((p) => ({
    id: p.id || crypto.randomUUID(),
    name: p.name,
    role: p.role,
    email: p.email || undefined,
    phone: p.phone || undefined,
  }));
}

// ============================================================================
// Input Types
// ============================================================================

interface CustomRatesInput {
  partnerRate?: number;
  associateRate?: number;
  paralegalRate?: number;
}

interface CreateClientInput {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  clientType?: string;
  companyType?: string;
  cui?: string;
  registrationNumber?: string;
  administrators?: ClientPersonInput[];
  contacts?: ClientPersonInput[];
  // Billing defaults for new cases
  billingType?: 'Hourly' | 'Fixed' | 'Retainer';
  fixedAmount?: number;
  customRates?: CustomRatesInput;
  retainerAmount?: number;
  retainerPeriod?: 'Monthly' | 'Quarterly' | 'Annually';
  retainerAutoRenew?: boolean;
  retainerRollover?: boolean;
}

interface UpdateClientInput {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  clientType?: string;
  companyType?: string;
  cui?: string;
  registrationNumber?: string;
  administrators?: ClientPersonInput[];
  contacts?: ClientPersonInput[];
  // Billing defaults for new cases
  billingType?: 'Hourly' | 'Fixed' | 'Retainer';
  fixedAmount?: number;
  customRates?: CustomRatesInput;
  retainerAmount?: number;
  retainerPeriod?: 'Monthly' | 'Quarterly' | 'Annually';
  retainerAutoRenew?: boolean;
  retainerRollover?: boolean;
}

/**
 * Validate client billing input
 */
function validateClientBillingInput(input: CreateClientInput | UpdateClientInput) {
  if (input.billingType === 'Fixed') {
    if (!input.fixedAmount || input.fixedAmount <= 0) {
      throw new GraphQLError('Suma fixă este obligatorie pentru facturare cu sumă fixă', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }
  }
  if (input.billingType === 'Retainer') {
    if (!input.retainerAmount || input.retainerAmount <= 0) {
      throw new GraphQLError('Suma abonament este obligatorie', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }
    if (!input.retainerPeriod) {
      throw new GraphQLError('Perioada abonament este obligatorie', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }
  }
}

// ============================================================================
// Resolvers
// ============================================================================

export const clientResolvers = {
  Query: {
    /**
     * Get a client by ID with their case portfolio
     * Authorization: Full-access roles see all clients; assignment-based roles need assignment
     */
    client: async (_: unknown, args: { id: string }, context: Context) => {
      const user = requireAuth(context);

      // Check access based on role
      const hasAccess = await canUserAccessClient(user.id, user.role, args.id, user.firmId);
      if (!hasAccess) {
        return null;
      }

      // Fetch client with cases, ensuring firm isolation
      const client = await prisma.client.findFirst({
        where: {
          id: args.id,
          firmId: user.firmId,
        },
        include: {
          cases: {
            select: {
              id: true,
              caseNumber: true,
              title: true,
              status: true,
              type: true,
              billingType: true,
              fixedAmount: true,
              openedDate: true,
              referenceNumbers: true,
            },
            orderBy: { openedDate: 'desc' },
          },
          teamMembers: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  role: true,
                },
              },
              assigner: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      });

      if (!client) {
        return null;
      }

      // Calculate case counts
      const caseCount = client.cases.length;
      const activeCaseCount = client.cases.filter((c) => c.status === 'Active').length;

      // Extract contact details from JSON
      const email = extractEmail(client.contactInfo);
      const phone = extractPhone(client.contactInfo);

      return {
        id: client.id,
        name: client.name,
        email,
        phone,
        address: client.address,
        clientType: client.clientType,
        companyType: client.companyType,
        cui: client.cui,
        registrationNumber: client.registrationNumber,
        administrators: parseJsonArray(client.administrators),
        contacts: parseJsonArray(client.contacts),
        cases: client.cases,
        caseCount,
        activeCaseCount,
        teamMembers: client.teamMembers.map((tm) => ({
          id: tm.id,
          role: tm.role,
          assignedAt: tm.assignedAt,
          user: tm.user,
          assigner: tm.assigner,
        })),
        // Billing defaults
        billingType: client.billingType,
        fixedAmount: client.fixedAmount ? Number(client.fixedAmount) : null,
        customRates: client.customRates,
        retainerAmount: client.retainerAmount ? Number(client.retainerAmount) : null,
        retainerPeriod: client.retainerPeriod,
        retainerAutoRenew: client.retainerAutoRenew,
        retainerRollover: client.retainerRollover,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
      };
    },

    /**
     * Get all clients for the firm with case counts
     * Authorization: Full-access roles see all; assignment-based roles see assigned only
     */
    clients: async (_: unknown, _args: Record<string, never>, context: Context) => {
      const user = requireAuth(context);

      // Get accessible client IDs based on role
      const accessibleClientIds = await getAccessibleClientIds(user.id, user.firmId, user.role);

      // Build where clause based on role
      const whereClause: Prisma.ClientWhereInput = {
        firmId: user.firmId,
      };

      // Assignment-based roles only see assigned clients
      if (accessibleClientIds !== 'all') {
        whereClause.id = { in: accessibleClientIds };
      }

      const clients = await prisma.client.findMany({
        where: whereClause,
        include: {
          cases: {
            select: {
              id: true,
              caseNumber: true,
              title: true,
              status: true,
              type: true,
              billingType: true,
              fixedAmount: true,
              openedDate: true,
              referenceNumbers: true,
            },
          },
          teamMembers: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  role: true,
                },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      return clients.map((client) => {
        const activeCases = client.cases.filter(
          (c) => c.status === 'Active' || c.status === 'PendingApproval'
        );

        // Extract email/phone from contactInfo JSON
        const email = extractEmail(client.contactInfo);
        const phone = extractPhone(client.contactInfo);

        return {
          id: client.id,
          name: client.name,
          email,
          phone,
          address: client.address,
          clientType: client.clientType,
          companyType: client.companyType,
          cui: client.cui,
          registrationNumber: client.registrationNumber,
          administrators: parseJsonArray(client.administrators),
          contacts: parseJsonArray(client.contacts),
          cases: client.cases,
          caseCount: client.cases.length,
          activeCaseCount: activeCases.length,
          teamMembers: client.teamMembers.map((tm) => ({
            id: tm.id,
            role: tm.role,
            assignedAt: tm.assignedAt,
            user: tm.user,
          })),
          // Billing defaults
          billingType: client.billingType,
          fixedAmount: client.fixedAmount ? Number(client.fixedAmount) : null,
          customRates: client.customRates,
          retainerAmount: client.retainerAmount ? Number(client.retainerAmount) : null,
          retainerPeriod: client.retainerPeriod,
          retainerAutoRenew: client.retainerAutoRenew,
          retainerRollover: client.retainerRollover,
          createdAt: client.createdAt,
          updatedAt: client.updatedAt,
        };
      });
    },
  },

  Mutation: {
    /**
     * Create a new client
     * Authorization: Authenticated users in the same firm (Partner/Associate only)
     */
    createClient: async (_: unknown, args: { input: CreateClientInput }, context: Context) => {
      const user = requireAuth(context);

      // Only Partners and Associates can create clients
      if (user.role !== 'Partner' && user.role !== 'Associate') {
        throw new GraphQLError('Insufficient permissions to create client', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Only Partners can set billing fields
      const hasBillingFields =
        args.input.billingType ||
        args.input.fixedAmount !== undefined ||
        args.input.customRates ||
        args.input.retainerAmount !== undefined ||
        args.input.retainerPeriod ||
        args.input.retainerAutoRenew !== undefined ||
        args.input.retainerRollover !== undefined;

      if (hasBillingFields && user.role !== 'Partner') {
        throw new GraphQLError('Doar partenerii pot modifica setările de facturare', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Validate billing input
      if (hasBillingFields) {
        validateClientBillingInput(args.input);
      }

      // Check if client with same name already exists
      const existingClient = await prisma.client.findFirst({
        where: {
          firmId: user.firmId,
          name: args.input.name,
        },
      });

      if (existingClient) {
        throw new GraphQLError('A client with this name already exists', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Build contactInfo JSON object
      const contactInfo: ContactInfo = {};
      if (args.input.email?.trim()) {
        contactInfo.email = args.input.email.trim();
      }
      if (args.input.phone?.trim()) {
        contactInfo.phone = args.input.phone.trim();
      }

      // Prepare administrators and contacts arrays
      const administrators = preparePersonsForStorage(args.input.administrators);
      const contacts = preparePersonsForStorage(args.input.contacts);

      // Create the client
      const newClient = await prisma.client.create({
        data: {
          firmId: user.firmId,
          name: args.input.name,
          contactInfo: (Object.keys(contactInfo).length > 0
            ? contactInfo
            : {}) as Prisma.InputJsonValue,
          address: args.input.address?.trim() || null,
          clientType: args.input.clientType || 'company',
          companyType: args.input.companyType || null,
          cui: args.input.cui?.trim() || null,
          registrationNumber: args.input.registrationNumber?.trim() || null,
          administrators: administrators as unknown as Prisma.InputJsonValue,
          contacts: contacts as unknown as Prisma.InputJsonValue,
          // Billing defaults for new cases
          billingType: args.input.billingType || 'Hourly',
          fixedAmount: args.input.fixedAmount,
          customRates: args.input.customRates as Prisma.InputJsonValue,
          retainerAmount: args.input.retainerAmount,
          retainerPeriod: args.input.retainerPeriod,
          retainerAutoRenew: args.input.retainerAutoRenew ?? false,
          retainerRollover: args.input.retainerRollover ?? false,
        },
      });

      // Auto-create default folders for the new client
      try {
        await prisma.documentFolder.createMany({
          data: [
            {
              name: 'Documente',
              clientId: newClient.id,
              caseId: null,
              firmId: user.firmId,
              parentId: null,
              order: 0,
            },
            {
              name: 'Email-uri',
              clientId: newClient.id,
              caseId: null,
              firmId: user.firmId,
              parentId: null,
              order: 1,
            },
          ],
        });
      } catch (folderError) {
        // Log error but don't fail client creation
        console.error(
          `[createClient] Failed to create default folders for client ${newClient.id}:`,
          folderError
        );
      }

      // Reclassify emails for the new client's contact emails
      // Collect all email addresses from the new client
      const clientEmails: string[] = [];
      if (contactInfo.email) {
        clientEmails.push(contactInfo.email.toLowerCase());
      }
      for (const contact of contacts) {
        if (contact.email) {
          clientEmails.push(contact.email.toLowerCase());
        }
      }
      for (const admin of administrators) {
        if (admin.email) {
          clientEmails.push(admin.email.toLowerCase());
        }
      }

      // Find and reclassify Pending/Uncertain emails from these addresses
      if (clientEmails.length > 0) {
        try {
          // Build email conditions to match by sender OR recipient
          const emailConditions: Prisma.EmailWhereInput[] = clientEmails.flatMap((email) => [
            { from: { path: ['address'], string_contains: email } },
            { toRecipients: { array_contains: [{ address: email }] } },
            { ccRecipients: { array_contains: [{ address: email }] } },
          ]);

          const matchingEmails = await prisma.email.findMany({
            where: {
              firmId: user.firmId,
              caseId: null, // Only unassigned emails
              classificationState: {
                in: [EmailClassificationState.Pending, EmailClassificationState.Uncertain],
              },
              OR: emailConditions,
            },
            select: { id: true, hasAttachments: true },
          });

          if (matchingEmails.length > 0) {
            // Route to ClientInbox since there are no cases yet
            await prisma.email.updateMany({
              where: {
                id: { in: matchingEmails.map((e) => e.id) },
              },
              data: {
                clientId: newClient.id,
                classificationState: EmailClassificationState.ClientInbox,
                classifiedAt: new Date(),
                classifiedBy: 'client_contact_match',
              },
            });

            console.log(
              `[createClient] Routed ${matchingEmails.length} emails to ClientInbox for new client ${newClient.id}`
            );

            // Queue attachment sync for emails with attachments
            const emailsWithAttachments = matchingEmails.filter((e) => e.hasAttachments);
            if (emailsWithAttachments.length > 0) {
              try {
                await queueClientAttachmentSyncBatch(
                  emailsWithAttachments.map((e) => ({
                    emailId: e.id,
                    userId: user.id,
                    clientId: newClient.id,
                  }))
                );
                console.log(
                  `[createClient] Queued attachment sync for ${emailsWithAttachments.length} emails`
                );
              } catch (queueError) {
                // Log error but don't fail client creation
                console.error(`[createClient] Failed to queue attachment sync:`, queueError);
              }
            }
          }
        } catch (reclassifyError) {
          // Log error but don't fail client creation
          console.error(
            `[createClient] Failed to reclassify emails for client ${newClient.id}:`,
            reclassifyError
          );
        }
      }

      // Extract contact details from JSON
      const email = extractEmail(newClient.contactInfo);
      const phone = extractPhone(newClient.contactInfo);

      return {
        id: newClient.id,
        name: newClient.name,
        email,
        phone,
        address: newClient.address,
        clientType: newClient.clientType,
        companyType: newClient.companyType,
        cui: newClient.cui,
        registrationNumber: newClient.registrationNumber,
        administrators: parseJsonArray(newClient.administrators),
        contacts: parseJsonArray(newClient.contacts),
        cases: [], // New client has no cases yet
        caseCount: 0,
        activeCaseCount: 0,
        teamMembers: [],
        // Billing defaults
        billingType: newClient.billingType,
        fixedAmount: newClient.fixedAmount ? Number(newClient.fixedAmount) : null,
        customRates: newClient.customRates,
        retainerAmount: newClient.retainerAmount ? Number(newClient.retainerAmount) : null,
        retainerPeriod: newClient.retainerPeriod,
        retainerAutoRenew: newClient.retainerAutoRenew,
        retainerRollover: newClient.retainerRollover,
        createdAt: newClient.createdAt,
        updatedAt: newClient.updatedAt,
      };
    },

    /**
     * Update an existing client
     * Authorization: Authenticated users in the same firm (Partner/Associate only)
     */
    updateClient: async (
      _: unknown,
      args: { id: string; input: UpdateClientInput },
      context: Context
    ) => {
      const user = requireAuth(context);

      // Only Partners and Associates can update clients
      if (user.role !== 'Partner' && user.role !== 'Associate') {
        throw new GraphQLError('Insufficient permissions to update client', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Check if client exists and belongs to user's firm
      const existingClient = await prisma.client.findFirst({
        where: {
          id: args.id,
          firmId: user.firmId,
        },
      });

      if (!existingClient) {
        throw new GraphQLError('Client not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Only Partners can modify billing fields
      const hasBillingFields =
        args.input.billingType !== undefined ||
        args.input.fixedAmount !== undefined ||
        args.input.customRates !== undefined ||
        args.input.retainerAmount !== undefined ||
        args.input.retainerPeriod !== undefined ||
        args.input.retainerAutoRenew !== undefined ||
        args.input.retainerRollover !== undefined;

      if (hasBillingFields && user.role !== 'Partner') {
        throw new GraphQLError('Doar partenerii pot modifica setările de facturare', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Validate billing input
      if (hasBillingFields) {
        // Merge with existing values for validation
        const billingForValidation = {
          billingType: args.input.billingType ?? existingClient.billingType,
          fixedAmount:
            args.input.fixedAmount ??
            (existingClient.fixedAmount ? Number(existingClient.fixedAmount) : undefined),
          retainerAmount:
            args.input.retainerAmount ??
            (existingClient.retainerAmount ? Number(existingClient.retainerAmount) : undefined),
          retainerPeriod: args.input.retainerPeriod ?? existingClient.retainerPeriod,
        };
        validateClientBillingInput(billingForValidation as CreateClientInput);
      }

      // Build contactInfo update
      const existingContactInfo = (existingClient.contactInfo as ContactInfo) || {};
      const newContactInfo: ContactInfo = { ...existingContactInfo };

      if (args.input.email !== undefined) {
        newContactInfo.email = args.input.email || undefined;
      }
      if (args.input.phone !== undefined) {
        newContactInfo.phone = args.input.phone || undefined;
      }

      // Build update data object
      const updateData: Prisma.ClientUpdateInput = {
        contactInfo: newContactInfo as Prisma.InputJsonValue,
      };

      if (args.input.name !== undefined) {
        updateData.name = args.input.name;
      }
      if (args.input.address !== undefined) {
        updateData.address = args.input.address || null;
      }
      if (args.input.clientType !== undefined) {
        updateData.clientType = args.input.clientType;
      }
      if (args.input.companyType !== undefined) {
        updateData.companyType = args.input.companyType || null;
      }
      if (args.input.cui !== undefined) {
        updateData.cui = args.input.cui?.trim() || null;
      }
      if (args.input.registrationNumber !== undefined) {
        updateData.registrationNumber = args.input.registrationNumber?.trim() || null;
      }
      if (args.input.administrators !== undefined) {
        updateData.administrators = preparePersonsForStorage(
          args.input.administrators
        ) as unknown as Prisma.InputJsonValue;
      }
      if (args.input.contacts !== undefined) {
        updateData.contacts = preparePersonsForStorage(
          args.input.contacts
        ) as unknown as Prisma.InputJsonValue;
      }

      // Billing fields
      if (args.input.billingType !== undefined) {
        updateData.billingType = args.input.billingType;
      }
      if (args.input.fixedAmount !== undefined) {
        updateData.fixedAmount = args.input.fixedAmount;
      }
      if (args.input.customRates !== undefined) {
        updateData.customRates = args.input.customRates as Prisma.InputJsonValue;
      }
      if (args.input.retainerAmount !== undefined) {
        updateData.retainerAmount = args.input.retainerAmount;
      }
      if (args.input.retainerPeriod !== undefined) {
        updateData.retainerPeriod = args.input.retainerPeriod;
      }
      if (args.input.retainerAutoRenew !== undefined) {
        updateData.retainerAutoRenew = args.input.retainerAutoRenew;
      }
      if (args.input.retainerRollover !== undefined) {
        updateData.retainerRollover = args.input.retainerRollover;
      }

      // Update the client
      const updatedClient = await prisma.client.update({
        where: { id: args.id },
        data: updateData,
        include: {
          cases: {
            select: {
              id: true,
              caseNumber: true,
              title: true,
              status: true,
              type: true,
              openedDate: true,
              referenceNumbers: true,
            },
            orderBy: { openedDate: 'desc' },
          },
        },
      });

      // Invalidate AI context cache for all cases of this client
      caseContextService.invalidateClientContext(args.id).catch(() => {});

      // Always reclassify emails on save - collect ALL client email addresses
      const clientEmails: string[] = [];
      if (newContactInfo.email) {
        clientEmails.push(newContactInfo.email.toLowerCase());
      }
      const currentContacts = parseJsonArray(updatedClient.contacts);
      const currentAdmins = parseJsonArray(updatedClient.administrators);
      for (const contact of currentContacts) {
        if (contact.email) {
          clientEmails.push(contact.email.toLowerCase());
        }
      }
      for (const admin of currentAdmins) {
        if (admin.email) {
          clientEmails.push(admin.email.toLowerCase());
        }
      }

      // Find and reclassify Pending/Uncertain emails matching client's contacts
      if (clientEmails.length > 0) {
        try {
          // Build email conditions to match by sender OR recipient
          const emailConditions: Prisma.EmailWhereInput[] = clientEmails.flatMap((email) => [
            { from: { path: ['address'], string_contains: email } },
            { toRecipients: { array_contains: [{ address: email }] } },
            { ccRecipients: { array_contains: [{ address: email }] } },
          ]);

          const matchingEmails = await prisma.email.findMany({
            where: {
              firmId: user.firmId,
              caseId: null, // Only unassigned emails
              OR: [
                // Pending or Uncertain emails
                {
                  classificationState: {
                    in: [EmailClassificationState.Pending, EmailClassificationState.Uncertain],
                  },
                  OR: emailConditions,
                },
                // Or ClientInbox emails belonging to this client (re-run classification)
                {
                  classificationState: EmailClassificationState.ClientInbox,
                  clientId: args.id,
                },
              ],
            },
            select: {
              id: true,
              conversationId: true,
              subject: true,
              bodyPreview: true,
              from: true,
              toRecipients: true,
              ccRecipients: true,
              receivedDateTime: true,
            },
          });

          if (matchingEmails.length > 0) {
            const activeCases = updatedClient.cases.filter(
              (c: { status: string }) => c.status === 'Active' || c.status === 'PendingApproval'
            );

            let classifiedCount = 0;
            let clientInboxCount = 0;

            for (const email of matchingEmails) {
              try {
                if (activeCases.length >= 1) {
                  // Client has cases - run classification algorithm
                  const emailForClassify: EmailForClassification = {
                    id: email.id,
                    conversationId: email.conversationId,
                    subject: email.subject || '',
                    bodyPreview: email.bodyPreview || '',
                    from: email.from as { name?: string; address: string },
                    toRecipients:
                      (email.toRecipients as Array<{ name?: string; address: string }>) || [],
                    ccRecipients:
                      (email.ccRecipients as Array<{ name?: string; address: string }>) || [],
                    receivedDateTime: email.receivedDateTime,
                  };

                  const result = await emailClassifierService.classifyEmail(
                    emailForClassify,
                    user.firmId,
                    user.id
                  );

                  if (result.state === EmailClassificationState.Classified && result.caseId) {
                    // Confident assignment - assign to the recommended case
                    await prisma.email.update({
                      where: { id: email.id },
                      data: {
                        caseId: result.caseId,
                        clientId: null,
                        classificationState: EmailClassificationState.Classified,
                        classificationConfidence: result.confidence,
                        classifiedAt: new Date(),
                        classifiedBy: 'auto',
                      },
                    });

                    // Create EmailCaseLink
                    try {
                      const prismaMatchType = mapMatchTypeToPrisma(result.matchType);
                      await prisma.emailCaseLink.upsert({
                        where: {
                          emailId_caseId: { emailId: email.id, caseId: result.caseId },
                        },
                        update: {
                          confidence: result.confidence,
                          matchType: prismaMatchType,
                          isPrimary: true,
                        },
                        create: {
                          emailId: email.id,
                          caseId: result.caseId,
                          confidence: result.confidence,
                          matchType: prismaMatchType,
                          isPrimary: true,
                          linkedBy: user.id,
                        },
                      });
                    } catch (linkErr) {
                      console.error(
                        `[updateClient] Failed to create EmailCaseLink for email ${email.id}:`,
                        linkErr
                      );
                    }
                    classifiedCount++;
                  } else {
                    // Uncertain - route to ClientInbox
                    await prisma.email.update({
                      where: { id: email.id },
                      data: {
                        clientId: args.id,
                        classificationState: EmailClassificationState.ClientInbox,
                        classifiedAt: new Date(),
                        classifiedBy: 'client_contact_match',
                      },
                    });
                    clientInboxCount++;
                  }
                } else {
                  // No active cases - route to ClientInbox
                  await prisma.email.update({
                    where: { id: email.id },
                    data: {
                      clientId: args.id,
                      classificationState: EmailClassificationState.ClientInbox,
                      classifiedAt: new Date(),
                      classifiedBy: 'client_contact_match',
                    },
                  });
                  clientInboxCount++;
                }
              } catch (classifyErr) {
                console.error(`[updateClient] Error classifying email ${email.id}:`, classifyErr);
                // On error, route to ClientInbox for safety
                await prisma.email.update({
                  where: { id: email.id },
                  data: {
                    clientId: args.id,
                    classificationState: EmailClassificationState.ClientInbox,
                    classifiedAt: new Date(),
                    classifiedBy: 'client_contact_match',
                  },
                });
                clientInboxCount++;
              }
            }

            if (classifiedCount > 0 || clientInboxCount > 0) {
              console.log(
                `[updateClient] Processed ${matchingEmails.length} emails for client ${args.id}: ${classifiedCount} auto-classified, ${clientInboxCount} to ClientInbox`
              );
            }
          }
        } catch (reclassifyError) {
          console.error(
            `[updateClient] Failed to reclassify emails for client ${args.id}:`,
            reclassifyError
          );
        }
      }

      // Calculate case counts
      const caseCount = updatedClient.cases.length;
      const activeCaseCount = updatedClient.cases.filter(
        (c: { status: string }) => c.status === 'Active'
      ).length;

      // Extract contact details from JSON
      const email = extractEmail(updatedClient.contactInfo);
      const phone = extractPhone(updatedClient.contactInfo);

      return {
        id: updatedClient.id,
        name: updatedClient.name,
        email,
        phone,
        address: updatedClient.address,
        clientType: updatedClient.clientType,
        companyType: updatedClient.companyType,
        cui: updatedClient.cui,
        registrationNumber: updatedClient.registrationNumber,
        administrators: parseJsonArray(updatedClient.administrators),
        contacts: parseJsonArray(updatedClient.contacts),
        cases: updatedClient.cases,
        caseCount,
        activeCaseCount,
        teamMembers: [],
        // Billing defaults
        billingType: updatedClient.billingType,
        fixedAmount: updatedClient.fixedAmount ? Number(updatedClient.fixedAmount) : null,
        customRates: updatedClient.customRates,
        retainerAmount: updatedClient.retainerAmount ? Number(updatedClient.retainerAmount) : null,
        retainerPeriod: updatedClient.retainerPeriod,
        retainerAutoRenew: updatedClient.retainerAutoRenew,
        retainerRollover: updatedClient.retainerRollover,
        createdAt: updatedClient.createdAt,
        updatedAt: updatedClient.updatedAt,
      };
    },

    /**
     * Delete a client and all associated data
     * Authorization: Partners only
     */
    deleteClient: async (_: unknown, args: { id: string }, context: Context) => {
      const user = requireAuth(context);

      // Only Partners can delete clients
      if (user.role !== 'Partner') {
        throw new GraphQLError('Only Partners can delete clients', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Fetch client with cases to return before deletion
      const existingClient = await prisma.client.findFirst({
        where: {
          id: args.id,
          firmId: user.firmId,
        },
        include: {
          cases: {
            select: {
              id: true,
              caseNumber: true,
              title: true,
              status: true,
              type: true,
              openedDate: true,
              referenceNumbers: true,
            },
            orderBy: { openedDate: 'desc' },
          },
        },
      });

      if (!existingClient) {
        throw new GraphQLError('Client not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Perform deletion in transaction
      await prisma.$transaction(async (tx) => {
        const clientId = args.id;

        // ====================================================================
        // 1. Delete all cases belonging to this client
        // For each case, we need to clean up the same data as deleteCase
        // ====================================================================
        const caseIds = existingClient.cases.map((c) => c.id);

        if (caseIds.length > 0) {
          // Move tasks from cases to nowhere (they'll be deleted with client)
          // Actually, since client is being deleted, just delete case tasks
          await tx.task.deleteMany({
            where: { caseId: { in: caseIds } },
          });

          // Unlink emails from cases and reset to Pending for reclassification
          await tx.email.updateMany({
            where: { caseId: { in: caseIds } },
            data: {
              caseId: null,
              clientId: null,
              classificationState: 'Pending',
              classificationConfidence: null,
              classifiedAt: null,
              classifiedBy: null,
            },
          });

          // Delete extracted entities for all cases
          await tx.extractedDeadline.deleteMany({ where: { caseId: { in: caseIds } } });
          await tx.extractedCommitment.deleteMany({ where: { caseId: { in: caseIds } } });
          await tx.extractedActionItem.deleteMany({ where: { caseId: { in: caseIds } } });
          await tx.extractedQuestion.deleteMany({ where: { caseId: { in: caseIds } } });

          // Delete AI-related data for all cases
          await tx.aISuggestion.deleteMany({ where: { caseId: { in: caseIds } } });
          await tx.aIConversation.deleteMany({ where: { caseId: { in: caseIds } } });
          await tx.emailDraft.deleteMany({ where: { caseId: { in: caseIds } } });
          await tx.sentEmailDraft.deleteMany({ where: { caseId: { in: caseIds } } });

          // Delete thread summaries and risk indicators
          await tx.threadSummary.deleteMany({ where: { caseId: { in: caseIds } } });
          await tx.riskIndicator.deleteMany({ where: { caseId: { in: caseIds } } });

          // Delete communication entries and exports
          await tx.communicationAttachment.deleteMany({
            where: { communicationEntry: { caseId: { in: caseIds } } },
          });
          await tx.communicationEntry.deleteMany({ where: { caseId: { in: caseIds } } });
          await tx.communicationExport.deleteMany({ where: { caseId: { in: caseIds } } });
          await tx.bulkCommunication.deleteMany({ where: { caseId: { in: caseIds } } });

          // Clear case from notifications
          await tx.notification.updateMany({
            where: { caseId: { in: caseIds } },
            data: { caseId: null },
          });

          // Delete in-app documents for all cases
          const caseDocuments = await tx.caseDocument.findMany({
            where: { caseId: { in: caseIds } },
            include: {
              document: {
                select: { id: true, sourceType: true },
              },
            },
          });

          const inAppDocumentIds = caseDocuments
            .filter(
              (cd) =>
                cd.document.sourceType === 'UPLOAD' || cd.document.sourceType === 'EMAIL_ATTACHMENT'
            )
            .map((cd) => cd.document.id);

          if (inAppDocumentIds.length > 0) {
            // Unlink email attachments first (no cascade on documentId)
            await tx.emailAttachment.updateMany({
              where: { documentId: { in: inAppDocumentIds } },
              data: { documentId: null },
            });
            // Delete audit logs (no cascade on documentId)
            await tx.documentAuditLog.deleteMany({
              where: { documentId: { in: inAppDocumentIds } },
            });
            await tx.document.deleteMany({
              where: { id: { in: inAppDocumentIds } },
            });
          }

          // Delete all cases (cascades remaining relations via Prisma)
          await tx.case.deleteMany({
            where: { id: { in: caseIds } },
          });
        }

        // ====================================================================
        // 2. Handle client-level data
        // ====================================================================

        // Unlink client inbox emails (emails stay in system)
        await tx.email.updateMany({
          where: { clientId },
          data: { clientId: null },
        });

        // Delete client inbox tasks
        await tx.task.deleteMany({
          where: { clientId },
        });

        // Delete client-level documents (inbox documents)
        const clientInboxDocs = await tx.caseDocument.findMany({
          where: { clientId },
          include: {
            document: {
              select: { id: true, sourceType: true },
            },
          },
        });

        const clientInAppDocIds = clientInboxDocs
          .filter(
            (cd) =>
              cd.document.sourceType === 'UPLOAD' || cd.document.sourceType === 'EMAIL_ATTACHMENT'
          )
          .map((cd) => cd.document.id);

        if (clientInAppDocIds.length > 0) {
          await tx.document.deleteMany({
            where: { id: { in: clientInAppDocIds } },
          });
        }

        // Delete client inbox document links
        await tx.caseDocument.deleteMany({
          where: { clientId },
        });

        // Delete client-level document folders
        await tx.documentFolder.deleteMany({
          where: { clientId },
        });

        // Delete client-level mape
        await tx.mapa.deleteMany({
          where: { clientId },
        });

        // Delete client documents that reference this client
        // Unlink email attachments first (no cascade on documentId)
        await tx.emailAttachment.updateMany({
          where: { document: { clientId } },
          data: { documentId: null },
        });
        // Delete audit logs (no cascade on documentId)
        await tx.documentAuditLog.deleteMany({
          where: { document: { clientId } },
        });
        await tx.document.deleteMany({
          where: { clientId },
        });

        // ====================================================================
        // 3. Delete the client
        // ====================================================================
        await tx.client.delete({
          where: { id: clientId },
        });
      });

      // Invalidate AI context cache for this client
      caseContextService.invalidateClientContext(args.id).catch(() => {});

      // Calculate case counts for return value
      const caseCount = existingClient.cases.length;
      const activeCaseCount = existingClient.cases.filter((c) => c.status === 'Active').length;

      // Extract contact details from JSON
      const email = extractEmail(existingClient.contactInfo);
      const phone = extractPhone(existingClient.contactInfo);

      // Return the client data as it was before deletion
      return {
        id: existingClient.id,
        name: existingClient.name,
        email,
        phone,
        address: existingClient.address,
        clientType: existingClient.clientType,
        companyType: existingClient.companyType,
        cui: existingClient.cui,
        registrationNumber: existingClient.registrationNumber,
        administrators: parseJsonArray(existingClient.administrators),
        contacts: parseJsonArray(existingClient.contacts),
        cases: existingClient.cases,
        caseCount,
        activeCaseCount,
        createdAt: existingClient.createdAt,
        updatedAt: existingClient.updatedAt,
      };
    },

    /**
     * Sync attachments for all emails in the client's inbox
     * Queues background jobs to download attachments from Graph API and upload to SharePoint.
     * Authorization: Authenticated users in the same firm
     */
    syncClientAttachments: async (
      _: unknown,
      args: { clientId: string },
      context: Context
    ): Promise<number> => {
      const user = requireAuth(context);

      // Check if client exists and belongs to user's firm
      const client = await prisma.client.findFirst({
        where: {
          id: args.clientId,
          firmId: user.firmId,
        },
        select: { id: true, name: true },
      });

      if (!client) {
        throw new GraphQLError('Client not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Find all emails in client inbox with attachments that don't have EmailAttachment records
      const emailsWithAttachments = await prisma.email.findMany({
        where: {
          clientId: args.clientId,
          hasAttachments: true,
          // Only emails that don't have fully synced attachments
          OR: [
            // No attachment records at all
            { attachments: { none: {} } },
            // Has attachment records but some are missing storage
            {
              attachments: {
                some: {
                  storageUrl: null,
                  filterStatus: { not: 'dismissed' },
                },
              },
            },
          ],
        },
        select: { id: true },
      });

      if (emailsWithAttachments.length === 0) {
        console.log(
          `[syncClientAttachments] No emails with pending attachments for client ${client.name}`
        );
        return 0;
      }

      // Queue attachment sync jobs
      await queueClientAttachmentSyncBatch(
        emailsWithAttachments.map((e) => ({
          emailId: e.id,
          userId: user.id,
          clientId: args.clientId,
        }))
      );

      console.log(
        `[syncClientAttachments] Queued ${emailsWithAttachments.length} emails for attachment sync for client ${client.name}`
      );

      return emailsWithAttachments.length;
    },

    /**
     * Assign a user to a client's team
     * Authorization: Partners only (can assign anyone) or full-access roles (for AssociateJr/Paralegal assignment)
     */
    assignClientTeam: async (
      _: unknown,
      args: { clientId: string; userId: string; role: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      // Only Partners and full-access roles can assign team members
      if (!isFullAccessRole(user.role)) {
        throw new GraphQLError('Nu aveți permisiunea de a atribui membri echipei', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Check if client exists and belongs to user's firm
      const client = await prisma.client.findFirst({
        where: {
          id: args.clientId,
          firmId: user.firmId,
        },
      });

      if (!client) {
        throw new GraphQLError('Clientul nu a fost găsit', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Check if target user exists and belongs to same firm
      const targetUser = await prisma.user.findFirst({
        where: {
          id: args.userId,
          firmId: user.firmId,
        },
      });

      if (!targetUser) {
        throw new GraphQLError('Utilizatorul nu a fost găsit', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Create or update client team assignment
      const assignment = await prisma.clientTeam.upsert({
        where: {
          clientId_userId: {
            clientId: args.clientId,
            userId: args.userId,
          },
        },
        update: {
          role: args.role,
          assignedBy: user.id,
          assignedAt: new Date(),
        },
        create: {
          clientId: args.clientId,
          userId: args.userId,
          role: args.role,
          assignedBy: user.id,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
          assigner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      return {
        id: assignment.id,
        role: assignment.role,
        assignedAt: assignment.assignedAt,
        user: assignment.user,
        assigner: assignment.assigner,
      };
    },

    /**
     * Remove a user from a client's team
     * Authorization: Partners only or full-access roles
     */
    removeClientTeam: async (
      _: unknown,
      args: { clientId: string; userId: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      // Only Partners and full-access roles can remove team members
      if (!isFullAccessRole(user.role)) {
        throw new GraphQLError('Nu aveți permisiunea de a elimina membri echipei', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Check if client exists and belongs to user's firm
      const client = await prisma.client.findFirst({
        where: {
          id: args.clientId,
          firmId: user.firmId,
        },
      });

      if (!client) {
        throw new GraphQLError('Clientul nu a fost găsit', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Check if assignment exists
      const existingAssignment = await prisma.clientTeam.findUnique({
        where: {
          clientId_userId: {
            clientId: args.clientId,
            userId: args.userId,
          },
        },
      });

      if (!existingAssignment) {
        throw new GraphQLError('Atribuirea nu a fost găsită', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Delete the assignment
      await prisma.clientTeam.delete({
        where: {
          clientId_userId: {
            clientId: args.clientId,
            userId: args.userId,
          },
        },
      });

      return true;
    },
  },
};

export default clientResolvers;
