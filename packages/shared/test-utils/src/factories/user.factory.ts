/**
 * User Factory
 * Creates test User entities with support for all role variations
 * Includes Romanian names for localization testing
 */

import { faker } from '@faker-js/faker';
import type { User, UserRole, UserOverrides } from '@legal-platform/types';

// Romanian first names with diacritics
const ROMANIAN_FIRST_NAMES_MALE = [
  'Ion',
  'Gheorghe',
  'Nicolae',
  'Vasile',
  'Constantin',
  'Ștefan',
  'Mihai',
  'Alexandru',
  'Andrei',
  'Cristian',
  'Adrian',
  'Marian',
  'Florin',
  'Gabriel',
  'Ionuț',
  'Vlad',
  'Răzvan',
  'Bogdan',
  'Cosmin',
  'Daniel',
];

const ROMANIAN_FIRST_NAMES_FEMALE = [
  'Maria',
  'Elena',
  'Ana',
  'Ioana',
  'Andreea',
  'Gabriela',
  'Mihaela',
  'Cristina',
  'Alexandra',
  'Raluca',
  'Daniela',
  'Simona',
  'Monica',
  'Claudia',
  'Alina',
];

// Romanian last names with diacritics
const ROMANIAN_LAST_NAMES = [
  'Popescu',
  'Ionescu',
  'Popa',
  'Gheorghiu',
  'Dumitrescu',
  'Constantinescu',
  'Ștefănescu',
  'Munteanu',
  'Stoica',
  'Stanciu',
  'Moldoveanu',
  'Văduva',
  'Țurcanu',
  'Rădulescu',
  'Cristescu',
  'Marinescu',
  'Nicolescu',
  'Iliescu',
  'Petrescu',
  'Barbu',
];

/**
 * Create a User entity with realistic test data
 * @param overrides - Partial User object to override default values
 * @returns User entity
 */
export function createUser(overrides: UserOverrides = {}): User {
  const role =
    overrides.role || faker.helpers.arrayElement<UserRole>(['Partner', 'Associate', 'Paralegal']);
  const useRomanianName = faker.datatype.boolean();

  let firstName: string;
  let lastName: string;

  if (useRomanianName) {
    // Use Romanian names 50% of the time
    const isMale = faker.datatype.boolean();
    firstName = isMale
      ? faker.helpers.arrayElement(ROMANIAN_FIRST_NAMES_MALE)
      : faker.helpers.arrayElement(ROMANIAN_FIRST_NAMES_FEMALE);
    lastName = faker.helpers.arrayElement(ROMANIAN_LAST_NAMES);
  } else {
    // Use faker's default names
    firstName = faker.person.firstName();
    lastName = faker.person.lastName();
  }

  return {
    id: faker.string.uuid(),
    email: faker.internet.email({ firstName, lastName }).toLowerCase(),
    firstName,
    lastName,
    role,
    status: 'Active',
    firmId: faker.string.uuid(),
    azureAdId: faker.string.uuid(),
    preferences: {
      theme: faker.helpers.arrayElement(['light', 'dark', 'auto']),
      language: faker.helpers.arrayElement(['en', 'ro']),
      notifications: faker.datatype.boolean(),
    },
    createdAt: faker.date.past({ years: 2 }),
    lastActive: faker.date.recent({ days: 7 }),
    ...overrides,
  };
}

/**
 * Create a Partner user
 * @param overrides - Partial User object to override default values
 * @returns User entity with Partner role
 */
export function createPartner(overrides: UserOverrides = {}): User {
  return createUser({ role: 'Partner', ...overrides });
}

/**
 * Create an Associate user
 * @param overrides - Partial User object to override default values
 * @returns User entity with Associate role
 */
export function createAssociate(overrides: UserOverrides = {}): User {
  return createUser({ role: 'Associate', ...overrides });
}

/**
 * Create a Paralegal user
 * @param overrides - Partial User object to override default values
 * @returns User entity with Paralegal role
 */
export function createParalegal(overrides: UserOverrides = {}): User {
  return createUser({ role: 'Paralegal', ...overrides });
}

/**
 * Create multiple User entities
 * @param count - Number of users to create
 * @param overrides - Partial User object to override default values
 * @returns Array of User entities
 */
export function createUsers(count: number, overrides: UserOverrides = {}): User[] {
  return Array.from({ length: count }, () => createUser(overrides));
}
