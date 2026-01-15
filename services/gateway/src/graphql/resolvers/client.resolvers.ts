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
import { caseContextService } from '../../services/case-context.service';
import {
  emailClassifierService,
  type EmailForClassification,
  type ClassificationMatchType as ClassifierMatchType,
} from '../../services/email-classifier';
import { emailReclassifierService } from '../../services/email-reclassifier';

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
              referenceNumbers: true,
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
              referenceNumbers: true,
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
          const targetCaseId = activeCases[0].id;

          // First find the emails to assign (need IDs for EmailCaseLink creation)
          const emailsToAssign = await prisma.email.findMany({
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
                        in: [EmailClassificationState.Pending, EmailClassificationState.Uncertain],
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
            select: { id: true },
          });

          if (emailsToAssign.length > 0) {
            // Update all emails in batch
            await prisma.email.updateMany({
              where: { id: { in: emailsToAssign.map((e) => e.id) } },
              data: {
                caseId: targetCaseId,
                clientId: null, // Clear clientId since email is now assigned to case
                classificationState: EmailClassificationState.Classified,
                classificationConfidence: 0.95,
                classifiedAt: new Date(),
                classifiedBy: 'client_contact_match',
              },
            });

            // Create EmailCaseLink records for each email
            for (const email of emailsToAssign) {
              try {
                await prisma.emailCaseLink.upsert({
                  where: {
                    emailId_caseId: {
                      emailId: email.id,
                      caseId: targetCaseId,
                    },
                  },
                  update: {
                    confidence: 0.95,
                    matchType: 'Actor',
                    isPrimary: true,
                  },
                  create: {
                    emailId: email.id,
                    caseId: targetCaseId,
                    confidence: 0.95,
                    matchType: 'Actor',
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
            }

            console.log(
              `[updateClient] Auto-assigned ${emailsToAssign.length} emails to case ${targetCaseId} based on client email ${newEmail}`
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
                        in: [EmailClassificationState.Pending, EmailClassificationState.Uncertain],
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

                // Run the classification algorithm
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
                      clientId: null, // Clear clientId since email is now assigned to case
                      classificationState: EmailClassificationState.Classified,
                      classificationConfidence: result.confidence,
                      classifiedAt: new Date(),
                      classifiedBy: 'auto',
                    },
                  });

                  // Create EmailCaseLink for the assigned case
                  try {
                    const prismaMatchType = mapMatchTypeToPrisma(result.matchType);
                    await prisma.emailCaseLink.upsert({
                      where: {
                        emailId_caseId: {
                          emailId: email.id,
                          caseId: result.caseId,
                        },
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
                      `[updateClient] Failed to create EmailCaseLink for email ${email.id} → case ${result.caseId}:`,
                      linkErr
                    );
                  }

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

      // Trigger reclassification via emailReclassifierService for main contact email change
      if (oldEmail && newEmail && oldEmail !== newEmail) {
        emailReclassifierService
          .onContactEmailChanged(oldEmail, newEmail, user.firmId)
          .then((count) => {
            if (count > 0) {
              console.log(
                `[ClientResolver] Reclassified ${count} emails after contact email change: ${oldEmail} -> ${newEmail}`
              );
            }
          })
          .catch((err) =>
            console.error('[ClientResolver] Reclassification failed for main email change:', err)
          );
      }

      // Check for email changes in contacts array
      if (args.input.contacts !== undefined) {
        const oldContacts = parseJsonArray(existingClient.contacts);
        const newContacts = preparePersonsForStorage(args.input.contacts);

        for (const newContact of newContacts) {
          const oldContact = oldContacts.find((c) => c.id === newContact.id);

          if (!oldContact && newContact.email) {
            // NEW contact added - trigger reclassification for this email
            const activeCases = updatedClient.cases.filter(
              (c: { id: string; status: string }) =>
                c.status === 'Active' || c.status === 'PendingApproval'
            );

            // For each active case, trigger reclassification
            for (const activeCase of activeCases) {
              emailReclassifierService
                .onContactAddedToCase(newContact.email, activeCase.id, user.firmId)
                .then((count) => {
                  if (count > 0) {
                    console.log(
                      `[ClientResolver] Reclassified ${count} emails for new contact ${newContact.email} on case ${activeCase.id}`
                    );
                  }
                })
                .catch((err) =>
                  console.error(
                    '[ClientResolver] Reclassification failed for new contact:',
                    err
                  )
                );
            }
          } else if (oldContact && oldContact.email && newContact.email) {
            // Existing contact - check if email changed
            const oldContactEmail = oldContact.email.toLowerCase();
            const newContactEmail = newContact.email.toLowerCase();
            if (oldContactEmail !== newContactEmail) {
              emailReclassifierService
                .onContactEmailChanged(oldContactEmail, newContactEmail, user.firmId)
                .then((count) => {
                  if (count > 0) {
                    console.log(
                      `[ClientResolver] Reclassified ${count} emails after contact person email change: ${oldContactEmail} -> ${newContactEmail}`
                    );
                  }
                })
                .catch((err) =>
                  console.error(
                    '[ClientResolver] Reclassification failed for contact person email change:',
                    err
                  )
                );
            }
          }
        }
      }

      // Check for email changes in administrators array
      if (args.input.administrators !== undefined) {
        const oldAdmins = parseJsonArray(existingClient.administrators);
        const newAdmins = preparePersonsForStorage(args.input.administrators);

        for (const newAdmin of newAdmins) {
          const oldAdmin = oldAdmins.find((a) => a.id === newAdmin.id);

          if (!oldAdmin && newAdmin.email) {
            // NEW administrator added - trigger reclassification for this email
            const activeCases = updatedClient.cases.filter(
              (c: { id: string; status: string }) =>
                c.status === 'Active' || c.status === 'PendingApproval'
            );

            // For each active case, trigger reclassification
            for (const activeCase of activeCases) {
              emailReclassifierService
                .onContactAddedToCase(newAdmin.email, activeCase.id, user.firmId)
                .then((count) => {
                  if (count > 0) {
                    console.log(
                      `[ClientResolver] Reclassified ${count} emails for new administrator ${newAdmin.email} on case ${activeCase.id}`
                    );
                  }
                })
                .catch((err) =>
                  console.error(
                    '[ClientResolver] Reclassification failed for new administrator:',
                    err
                  )
                );
            }
          } else if (oldAdmin && oldAdmin.email && newAdmin.email) {
            // Existing administrator - check if email changed
            const oldAdminEmail = oldAdmin.email.toLowerCase();
            const newAdminEmail = newAdmin.email.toLowerCase();
            if (oldAdminEmail !== newAdminEmail) {
              emailReclassifierService
                .onContactEmailChanged(oldAdminEmail, newAdminEmail, user.firmId)
                .then((count) => {
                  if (count > 0) {
                    console.log(
                      `[ClientResolver] Reclassified ${count} emails after administrator email change: ${oldAdminEmail} -> ${newAdminEmail}`
                    );
                  }
                })
                .catch((err) =>
                  console.error(
                    '[ClientResolver] Reclassification failed for administrator email change:',
                    err
                  )
                );
            }
          }
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

          // Unlink emails from cases (emails stay in system)
          await tx.email.updateMany({
            where: { caseId: { in: caseIds } },
            data: { caseId: null, clientId: null },
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
  },
};

export default clientResolvers;
