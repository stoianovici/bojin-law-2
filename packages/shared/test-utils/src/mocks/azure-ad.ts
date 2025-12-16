import { faker } from '@faker-js/faker';

/**
 * Azure AD token payload interface
 */
export interface AzureAdTokenPayload {
  aud: string;
  iss: string;
  iat: number;
  exp: number;
  sub: string;
  oid: string;
  email: string;
  name: string;
  roles?: string[];
  tid: string;
}

/**
 * Mock Azure AD configuration
 */
export interface MockAzureAdConfig {
  clientId?: string;
  tenantId?: string;
  authority?: string;
}

/**
 * Create a mock Azure AD token payload
 */
export function createMockAzureAdToken(
  overrides?: Partial<AzureAdTokenPayload>
): AzureAdTokenPayload {
  const now = Math.floor(Date.now() / 1000);
  const tenantId = faker.string.uuid();

  return {
    aud: 'api://legal-platform',
    iss: `https://login.microsoftonline.com/${tenantId}/v2.0`,
    iat: now,
    exp: now + 3600, // 1 hour from now
    sub: faker.string.uuid(),
    oid: faker.string.uuid(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    roles: ['User'],
    tid: tenantId,
    ...overrides,
  };
}

/**
 * Create a mock JWT token string (not cryptographically signed)
 * For testing purposes only
 */
export function createMockJwt(payload?: Partial<AzureAdTokenPayload>): string {
  const tokenPayload = createMockAzureAdToken(payload);

  // Create a fake JWT (header.payload.signature)
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(tokenPayload));
  const signature = btoa('mock-signature');

  return `${header}.${body}.${signature}`;
}

/**
 * Create mock Azure AD configuration
 */
export function createMockAzureAdConfig(overrides?: Partial<MockAzureAdConfig>): MockAzureAdConfig {
  return {
    clientId: faker.string.uuid(),
    tenantId: faker.string.uuid(),
    authority: 'https://login.microsoftonline.com/common',
    ...overrides,
  };
}

/**
 * Mock Azure AD account object
 */
export interface MockAzureAdAccount {
  homeAccountId: string;
  environment: string;
  tenantId: string;
  username: string;
  localAccountId: string;
  name: string;
}

/**
 * Create a mock Azure AD account
 */
export function createMockAzureAdAccount(
  overrides?: Partial<MockAzureAdAccount>
): MockAzureAdAccount {
  const tenantId = faker.string.uuid();
  const localAccountId = faker.string.uuid();

  return {
    homeAccountId: `${localAccountId}.${tenantId}`,
    environment: 'login.windows.net',
    tenantId,
    username: faker.internet.email(),
    localAccountId,
    name: faker.person.fullName(),
    ...overrides,
  };
}
