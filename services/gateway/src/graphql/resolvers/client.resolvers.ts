/**
 * Client GraphQL Resolvers
 * OPS-226: Client Query + Resolver for Client Portfolio View
 *
 * Implements the client(id) query to fetch a client with their case portfolio
 */

import { prisma, Prisma } from '@legal-platform/database';
import { EmailClassificationState } from '@prisma/client';
import { GraphQLError } from 'graphql';
import { requireAuth, type Context } from '../utils/auth';
import { caseContextService } from '../../services/case-context.service';
import {
  classificationScoringService,
  type EmailForClassification,
} from '../../services/classification-scoring';

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
}

// ============================================================================
// Resolvers
// ============================================================================

export const clientResolvers = {
  Query: {
    /**
     * Get a client by ID with their case portfolio
     * Authorization: Authenticated users in the same firm
     */
    client: async (_: unknown, args: { id: string }, context: Context) => {
      const user = requireAuth(context);

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
              openedDate: true,
            },
            orderBy: { openedDate: 'desc' },
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
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
      };
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
        },
      });

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
            },
            orderBy: { openedDate: 'desc' },
          },
        },
      });

      // Invalidate AI context cache for all cases of this client
      caseContextService.invalidateClientContext(args.id).catch(() => {});

      // Re-classify emails if email address changed
      const oldEmail = existingContactInfo.email?.toLowerCase();
      const newEmail = newContactInfo.email?.toLowerCase();
      const emailChanged = oldEmail !== newEmail && newEmail;

      if (emailChanged) {
        // Find client's active cases
        const activeCases = updatedClient.cases.filter(
          (c: { status: string }) => c.status === 'Active' || c.status === 'PendingApproval'
        );

        // Build email conditions to match by sender email OR recipient email (sent emails)
        const emailConditions: Prisma.EmailWhereInput[] = [
          // Match received emails by sender
          { from: { path: ['address'], string_contains: newEmail } },
          // Match sent emails by recipient
          { toRecipients: { array_contains: [{ address: newEmail }] } },
          { ccRecipients: { array_contains: [{ address: newEmail }] } },
        ];

        if (activeCases.length === 1) {
          // Single case - auto-assign matching Pending/Uncertain/ClientInbox emails
          const assignResult = await prisma.email.updateMany({
            where: {
              firmId: user.firmId,
              caseId: null, // Only unassigned emails
              AND: [
                { OR: emailConditions }, // Must match contact's email
                {
                  OR: [
                    // Pending or Uncertain emails
                    {
                      classificationState: {
                        in: [
                          EmailClassificationState.Pending,
                          EmailClassificationState.Uncertain,
                        ],
                      },
                    },
                    // Or ClientInbox emails belonging to this client
                    {
                      classificationState: EmailClassificationState.ClientInbox,
                      clientId: args.id,
                    },
                  ],
                },
              ],
            },
            data: {
              caseId: activeCases[0].id,
              clientId: null, // Clear clientId since email is now assigned to case
              classificationState: EmailClassificationState.Classified,
              classificationConfidence: 0.95,
              classifiedAt: new Date(),
              classifiedBy: 'client_contact_match',
            },
          });

          if (assignResult.count > 0) {
            console.log(
              `[updateClient] Auto-assigned ${assignResult.count} emails to case ${activeCases[0].id} based on client email ${newEmail}`
            );
          }
        } else if (activeCases.length > 1) {
          // Multi-case client - apply scoring algorithm to determine assignment
          // Also re-classify existing ClientInbox emails for this client
          // Only route to ClientInbox if algorithm cannot confidently assign
          const matchingEmails = await prisma.email.findMany({
            where: {
              firmId: user.firmId,
              caseId: null, // Only unassigned emails
              AND: [
                { OR: emailConditions }, // Must match contact's email
                {
                  OR: [
                    // Pending or Uncertain emails
                    {
                      classificationState: {
                        in: [
                          EmailClassificationState.Pending,
                          EmailClassificationState.Uncertain,
                        ],
                      },
                    },
                    // Or ClientInbox emails belonging to this client
                    {
                      classificationState: EmailClassificationState.ClientInbox,
                      clientId: args.id,
                    },
                  ],
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
            let classifiedCount = 0;
            let clientInboxCount = 0;

            for (const email of matchingEmails) {
              try {
                // Build email object for classification
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

                // Run the scoring algorithm
                const result = await classificationScoringService.classifyEmail(
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
                      clientId: null, // Clear clientId since email is now assigned to case
                      classificationState: EmailClassificationState.Classified,
                      classificationConfidence: result.confidence,
                      classifiedAt: new Date(),
                      classifiedBy: 'auto',
                    },
                  });
                  classifiedCount++;
                } else {
                  // Uncertain - route to ClientInbox for manual triage
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
        }
        // If 0 active cases, leave emails in their current state
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
        createdAt: updatedClient.createdAt,
        updatedAt: updatedClient.updatedAt,
      };
    },
  },
};

export default clientResolvers;
