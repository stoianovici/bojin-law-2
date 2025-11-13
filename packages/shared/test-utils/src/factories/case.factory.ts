/**
 * Case Factory
 * Creates test Case entities with support for all status variations
 * Includes Romanian case data for localization testing
 */

import { faker } from '@faker-js/faker';
import type { Case, CaseStatus, CaseType, CaseOverrides, CaseTeamMember, CaseTeamMemberOverrides } from '@legal-platform/types';

/**
 * Generate a case number in format: YYYY-XXX-NNNN
 * Example: 2024-CIV-0123
 */
function generateCaseNumber(): string {
  const year = faker.date.recent({ days: 365 }).getFullYear();
  const prefix = faker.helpers.arrayElement(['CIV', 'CRIM', 'COM', 'FAM', 'ADM', 'IP']);
  const number = faker.string.numeric({ length: 4 });
  return `${year}-${prefix}-${number}`;
}

/**
 * Create a Case entity with realistic test data
 * @param overrides - Partial Case object to override default values
 * @returns Case entity
 */
export function createCase(overrides: CaseOverrides = {}): Case {
  const status = overrides.status || faker.helpers.arrayElement<CaseStatus>(['Active', 'OnHold', 'Closed', 'Archived']);
  const type = overrides.type || faker.helpers.arrayElement<CaseType>(['Litigation', 'Contract', 'Advisory', 'Criminal', 'Other']);

  const openedDate = faker.date.past({ years: 2 });
  const isClosedOrArchived = status === 'Closed' || status === 'Archived';
  const closedDate = isClosedOrArchived
    ? faker.date.between({ from: openedDate, to: new Date() })
    : null;

  return {
    id: faker.string.uuid(),
    caseNumber: generateCaseNumber(),
    title: faker.helpers.arrayElement([
      `${faker.company.name()} vs. ${faker.company.name()}`,
      `${faker.person.fullName()} vs. ${faker.person.fullName()}`,
      `Contract Dispute - ${faker.company.name()}`,
      `Employment Matter - ${faker.person.lastName()}`,
      `Property Dispute - ${faker.location.street()}`,
    ]),
    clientId: faker.string.uuid(),
    status,
    type,
    description: faker.lorem.paragraph({ min: 2, max: 4 }),
    openedDate,
    closedDate,
    value: faker.datatype.boolean() ? faker.number.int({ min: 5000, max: 500000 }) : null,
    metadata: {
      court: faker.helpers.arrayElement([
        'Tribunalul București',
        'Curtea de Apel București',
        'Judecătoria Sector 1',
        'High Court',
        'District Court',
      ]),
      judge: faker.person.fullName(),
      urgency: faker.helpers.arrayElement(['low', 'medium', 'high']),
    },
    createdAt: openedDate,
    updatedAt: closedDate || faker.date.recent({ days: 30 }),
    ...overrides,
  };
}

/**
 * Create an Active case
 * @param overrides - Partial Case object to override default values
 * @returns Case entity with Active status
 */
export function createActiveCase(overrides: CaseOverrides = {}): Case {
  return createCase({ status: 'Active', ...overrides });
}

/**
 * Create an OnHold case
 * @param overrides - Partial Case object to override default values
 * @returns Case entity with OnHold status
 */
export function createOnHoldCase(overrides: CaseOverrides = {}): Case {
  return createCase({ status: 'OnHold', ...overrides });
}

/**
 * Create a Closed case
 * @param overrides - Partial Case object to override default values
 * @returns Case entity with Closed status
 */
export function createClosedCase(overrides: CaseOverrides = {}): Case {
  return createCase({ status: 'Closed', ...overrides });
}

/**
 * Create an Archived case
 * @param overrides - Partial Case object to override default values
 * @returns Case entity with Archived status
 */
export function createArchivedCase(overrides: CaseOverrides = {}): Case {
  return createCase({ status: 'Archived', ...overrides });
}

/**
 * Create multiple Case entities
 * @param count - Number of cases to create
 * @param overrides - Partial Case object to override default values
 * @returns Array of Case entities
 */
export function createCases(count: number, overrides: CaseOverrides = {}): Case[] {
  return Array.from({ length: count }, () => createCase(overrides));
}

/**
 * Create a CaseTeamMember with realistic test data
 * @param overrides - Partial CaseTeamMember object to override default values
 * @returns CaseTeamMember entity
 */
export function createCaseTeamMember(overrides: CaseTeamMemberOverrides = {}): CaseTeamMember {
  const roles = ['Lead Attorney', 'Associate Attorney', 'Paralegal', 'Legal Assistant', 'Expert Witness'];

  return {
    userId: faker.string.uuid(),
    role: faker.helpers.arrayElement(roles),
    assignedDate: faker.date.past({ years: 1 }),
    ...overrides,
  };
}

/**
 * Create multiple CaseTeamMember entities
 * @param count - Number of team members to create
 * @param overrides - Partial CaseTeamMember object to override default values
 * @returns Array of CaseTeamMember entities
 */
export function createCaseTeamMembers(count: number, overrides: CaseTeamMemberOverrides = {}): CaseTeamMember[] {
  return Array.from({ length: count }, () => createCaseTeamMember(overrides));
}
