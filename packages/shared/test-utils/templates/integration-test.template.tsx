/**
 * INTEGRATION TEST TEMPLATE
 *
 * This template demonstrates best practices for writing integration tests
 * that verify multiple components, services, or systems work together correctly.
 * Integration tests sit between unit tests and E2E tests in the testing pyramid.
 *
 * WHEN TO USE INTEGRATION TESTS:
 * - Testing API endpoints with real database connections
 * - Testing GraphQL resolvers with data loaders
 * - Testing component integration with backend services
 * - Testing database operations and queries
 * - Testing multiple services working together
 * - Testing authentication and authorization flows
 *
 * TARGET: 20% of your test suite should be integration tests (Testing Pyramid)
 */

import request from 'supertest';
import { createUser, createCase, createDocument } from '@legal-platform/test-utils/factories';
import { cleanupDatabase, seedDatabase, closeDatabase } from '@legal-platform/test-utils/database';

// ============================================================================
// EXAMPLE 1: API Endpoint Integration Test with Supertest
// ============================================================================

/**
 * API integration tests should:
 * 1. Use real database connections (test database)
 * 2. Test complete request/response cycles
 * 3. Verify HTTP status codes and response formats
 * 4. Test authentication and authorization
 * 5. Clean up database after each test
 * 6. Use Supertest for HTTP request testing
 */

// Mock Express app (in real tests, import from your app)
import express, { Express } from 'express';

const createTestApp = (): Express => {
  const app = express();
  app.use(express.json());

  // Example API routes
  app.get('/api/cases', async (req: any, res: any) => {
    // In real app, fetch from database
    const cases = [
      { id: '1', title: 'Case 1', status: 'Active' },
      { id: '2', title: 'Case 2', status: 'Closed' }
    ];
    res.json({ data: cases });
  });

  app.get('/api/cases/:id', async (req: any, res: any) => {
    const { id } = req.params;
    // In real app, fetch from database
    if (id === '999') {
      return res.status(404).json({ error: 'Case not found' });
    }
    res.json({ data: { id, title: 'Test Case', status: 'Active' } });
  });

  app.post('/api/cases', async (req: any, res: any) => {
    const { title, clientId } = req.body;

    // Validate required fields
    if (!title || !clientId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // In real app, save to database
    const newCase = {
      id: '123',
      title,
      clientId,
      status: 'Active',
      createdAt: new Date().toISOString()
    };

    res.status(201).json({ data: newCase });
  });

  app.put('/api/cases/:id', async (req: any, res: any) => {
    const { id } = req.params;
    const { title, status } = req.body;

    // In real app, update in database
    res.json({
      data: { id, title, status, updatedAt: new Date().toISOString() }
    });
  });

  app.delete('/api/cases/:id', async (req: any, res: any) => {
    const { id } = req.params;
    // In real app, delete from database
    res.status(204).send();
  });

  return app;
};

describe('Cases API Integration Tests', () => {
  let app: Express;

  // -------------------------------------------------------------------------
  // SETUP AND TEARDOWN
  // -------------------------------------------------------------------------

  beforeAll(async () => {
    // Initialize test app
    app = createTestApp();

    // Setup test database connection
    // await connectToDatabase(process.env.TEST_DATABASE_URL);
  });

  afterAll(async () => {
    // Close database connection
    // await closeDatabase();
  });

  beforeEach(async () => {
    // Clean database before each test for isolation
    // await cleanupDatabase();
  });

  // -------------------------------------------------------------------------
  // GET TESTS: List and retrieve operations
  // -------------------------------------------------------------------------

  describe('GET /api/cases', () => {
    it('should return list of cases', async () => {
      const response = await request(app)
        .get('/api/cases')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should include required case fields', async () => {
      const response = await request(app).get('/api/cases');

      const firstCase = response.body.data[0];
      expect(firstCase).toHaveProperty('id');
      expect(firstCase).toHaveProperty('title');
      expect(firstCase).toHaveProperty('status');
    });
  });

  describe('GET /api/cases/:id', () => {
    it('should return specific case by ID', async () => {
      const response = await request(app)
        .get('/api/cases/123')
        .expect(200);

      expect(response.body.data).toMatchObject({
        id: '123',
        title: 'Test Case',
        status: 'Active'
      });
    });

    it('should return 404 for non-existent case', async () => {
      const response = await request(app)
        .get('/api/cases/999')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('not found');
    });
  });

  // -------------------------------------------------------------------------
  // POST TESTS: Create operations
  // -------------------------------------------------------------------------

  describe('POST /api/cases', () => {
    it('should create new case with valid data', async () => {
      const newCase = {
        title: 'New Legal Case',
        clientId: 'client-456'
      };

      const response = await request(app)
        .post('/api/cases')
        .send(newCase)
        .expect(201)
        .expect('Content-Type', /json/);

      expect(response.body.data).toMatchObject({
        title: 'New Legal Case',
        clientId: 'client-456',
        status: 'Active'
      });
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('createdAt');
    });

    it('should return 400 for missing required fields', async () => {
      const invalidCase = {
        title: 'Missing Client ID'
        // clientId missing
      };

      const response = await request(app)
        .post('/api/cases')
        .send(invalidCase)
        .expect(400);

      expect(response.body.error).toContain('Missing required fields');
    });

    it('should validate request body format', async () => {
      const response = await request(app)
        .post('/api/cases')
        .send({ invalid: 'data' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  // -------------------------------------------------------------------------
  // PUT TESTS: Update operations
  // -------------------------------------------------------------------------

  describe('PUT /api/cases/:id', () => {
    it('should update existing case', async () => {
      const updates = {
        title: 'Updated Title',
        status: 'Closed'
      };

      const response = await request(app)
        .put('/api/cases/123')
        .send(updates)
        .expect(200);

      expect(response.body.data).toMatchObject({
        id: '123',
        title: 'Updated Title',
        status: 'Closed'
      });
      expect(response.body.data).toHaveProperty('updatedAt');
    });
  });

  // -------------------------------------------------------------------------
  // DELETE TESTS: Delete operations
  // -------------------------------------------------------------------------

  describe('DELETE /api/cases/:id', () => {
    it('should delete case and return 204', async () => {
      await request(app)
        .delete('/api/cases/123')
        .expect(204);
    });
  });
});

// ============================================================================
// EXAMPLE 2: GraphQL Resolver Integration Test
// ============================================================================

/**
 * GraphQL integration tests should:
 * 1. Test resolver logic with real data sources
 * 2. Verify field resolvers and data loaders
 * 3. Test authentication and field-level permissions
 * 4. Validate query/mutation results
 * 5. Test error handling and validation
 */

import { graphql } from 'graphql';
import { makeExecutableSchema } from '@graphql-tools/schema';

// Example GraphQL schema and resolvers
const typeDefs = `
  type User {
    id: ID!
    email: String!
    firstName: String!
    lastName: String!
    role: UserRole!
    cases: [Case!]!
  }

  type Case {
    id: ID!
    title: String!
    status: CaseStatus!
    assignedUsers: [User!]!
  }

  enum UserRole {
    Partner
    Associate
    Paralegal
  }

  enum CaseStatus {
    Active
    OnHold
    Closed
    Archived
  }

  type Query {
    user(id: ID!): User
    case(id: ID!): Case
    cases(status: CaseStatus): [Case!]!
  }

  type Mutation {
    createCase(title: String!, clientId: ID!): Case!
    updateCaseStatus(id: ID!, status: CaseStatus!): Case!
  }
`;

const resolvers = {
  Query: {
    user: async (_parent: any, { id }: { id: string }, _context: any) => {
      // In real resolver, fetch from database via context.dataSources
      return {
        id,
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'Partner'
      };
    },

    case: async (_parent: any, { id }: { id: string }, _context: any) => {
      if (id === '999') {
        throw new Error('Case not found');
      }
      return {
        id,
        title: 'Test Case',
        status: 'Active'
      };
    },

    cases: async (_parent: any, { status }: { status?: string }, _context: any) => {
      // In real resolver, filter by status
      const allCases = [
        { id: '1', title: 'Case 1', status: 'Active' },
        { id: '2', title: 'Case 2', status: 'Closed' }
      ];

      return status
        ? allCases.filter(c => c.status === status)
        : allCases;
    }
  },

  Mutation: {
    createCase: async (
      _parent: any,
      { title, clientId }: { title: string; clientId: string },
      _context: any
    ) => {
      // In real resolver, save to database
      return {
        id: '123',
        title,
        status: 'Active'
      };
    },

    updateCaseStatus: async (
      _parent: any,
      { id, status }: { id: string; status: string },
      _context: any
    ) => {
      return {
        id,
        title: 'Updated Case',
        status
      };
    }
  },

  User: {
    cases: async (parent: any, _args: any, _context: any) => {
      // In real resolver, use DataLoader to avoid N+1 queries
      return [
        { id: '1', title: 'User Case 1', status: 'Active' }
      ];
    }
  },

  Case: {
    assignedUsers: async (parent: any, _args: any, _context: any) => {
      // In real resolver, use DataLoader
      return [
        { id: '1', email: 'user@example.com', firstName: 'Test', lastName: 'User', role: 'Associate' }
      ];
    }
  }
};

describe('GraphQL Resolver Integration Tests', () => {
  let schema: any;

  // -------------------------------------------------------------------------
  // SETUP
  // -------------------------------------------------------------------------

  beforeAll(() => {
    schema = makeExecutableSchema({ typeDefs, resolvers });
  });

  beforeEach(async () => {
    // Clean database
    // await cleanupDatabase();
  });

  // -------------------------------------------------------------------------
  // QUERY TESTS: Read operations
  // -------------------------------------------------------------------------

  describe('Query: user', () => {
    it('should fetch user by ID', async () => {
      const query = `
        query GetUser($id: ID!) {
          user(id: $id) {
            id
            email
            firstName
            lastName
            role
          }
        }
      `;

      const result = await graphql({
        schema,
        source: query,
        variableValues: { id: '123' }
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.user).toMatchObject({
        id: '123',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'Partner'
      });
    });

    it('should resolve nested case relationships', async () => {
      const query = `
        query GetUserWithCases($id: ID!) {
          user(id: $id) {
            id
            firstName
            cases {
              id
              title
              status
            }
          }
        }
      `;

      const result = await graphql({
        schema,
        source: query,
        variableValues: { id: '123' }
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.user.cases).toHaveLength(1);
      expect(result.data?.user.cases[0]).toHaveProperty('title');
    });
  });

  describe('Query: cases', () => {
    it('should fetch all cases without filter', async () => {
      const query = `
        query GetCases {
          cases {
            id
            title
            status
          }
        }
      `;

      const result = await graphql({
        schema,
        source: query
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.cases).toHaveLength(2);
    });

    it('should filter cases by status', async () => {
      const query = `
        query GetActiveCases($status: CaseStatus) {
          cases(status: $status) {
            id
            status
          }
        }
      `;

      const result = await graphql({
        schema,
        source: query,
        variableValues: { status: 'Active' }
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.cases).toHaveLength(1);
      expect(result.data?.cases[0].status).toBe('Active');
    });

    it('should resolve assigned users for cases', async () => {
      const query = `
        query GetCasesWithUsers {
          cases {
            id
            title
            assignedUsers {
              id
              email
              role
            }
          }
        }
      `;

      const result = await graphql({
        schema,
        source: query
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.cases[0].assignedUsers).toHaveLength(1);
      expect(result.data?.cases[0].assignedUsers[0]).toHaveProperty('email');
    });
  });

  // -------------------------------------------------------------------------
  // MUTATION TESTS: Write operations
  // -------------------------------------------------------------------------

  describe('Mutation: createCase', () => {
    it('should create new case', async () => {
      const mutation = `
        mutation CreateCase($title: String!, $clientId: ID!) {
          createCase(title: $title, clientId: $clientId) {
            id
            title
            status
          }
        }
      `;

      const result = await graphql({
        schema,
        source: mutation,
        variableValues: {
          title: 'New Case',
          clientId: 'client-456'
        }
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.createCase).toMatchObject({
        id: '123',
        title: 'New Case',
        status: 'Active'
      });
    });
  });

  describe('Mutation: updateCaseStatus', () => {
    it('should update case status', async () => {
      const mutation = `
        mutation UpdateStatus($id: ID!, $status: CaseStatus!) {
          updateCaseStatus(id: $id, status: $status) {
            id
            status
          }
        }
      `;

      const result = await graphql({
        schema,
        source: mutation,
        variableValues: {
          id: '123',
          status: 'Closed'
        }
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.updateCaseStatus.status).toBe('Closed');
    });
  });

  // -------------------------------------------------------------------------
  // ERROR HANDLING TESTS
  // -------------------------------------------------------------------------

  describe('Error Handling', () => {
    it('should return error for non-existent case', async () => {
      const query = `
        query GetCase($id: ID!) {
          case(id: $id) {
            id
            title
          }
        }
      `;

      const result = await graphql({
        schema,
        source: query,
        variableValues: { id: '999' }
      });

      expect(result.errors).toBeDefined();
      expect(result.errors![0].message).toContain('Case not found');
    });
  });
});

// ============================================================================
// EXAMPLE 3: Database Integration Test
// ============================================================================

/**
 * Database integration tests should:
 * 1. Use real database connection (test database)
 * 2. Test CRUD operations
 * 3. Test complex queries and joins
 * 4. Test transactions and rollbacks
 * 5. Clean up data after each test
 * 6. Verify database constraints
 */

// Mock database interface (in real tests, use your ORM/query builder)
interface DatabaseClient {
  query: (sql: string, params?: any[]) => Promise<any>;
  transaction: (callback: (trx: any) => Promise<void>) => Promise<void>;
}

describe('Database Integration Tests', () => {
  let db: DatabaseClient;

  beforeAll(async () => {
    // Connect to test database
    // db = await createDatabaseConnection(process.env.TEST_DATABASE_URL);
  });

  afterAll(async () => {
    // await closeDatabase();
  });

  beforeEach(async () => {
    // Clean database tables
    // await cleanupDatabase();
  });

  describe('User Repository', () => {
    it('should create user in database', async () => {
      const userData = createUser({ role: 'Partner' });

      // In real test:
      // const userId = await db.query(
      //   'INSERT INTO users (email, first_name, last_name, role) VALUES ($1, $2, $3, $4) RETURNING id',
      //   [userData.email, userData.firstName, userData.lastName, userData.role]
      // );

      // Verify insertion
      // const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
      // expect(user).toMatchObject(userData);
    });

    it('should enforce unique email constraint', async () => {
      // In real test, attempt to insert duplicate email
      // Should throw or return error
    });

    it('should cascade delete user relationships', async () => {
      // Create user with related data
      // Delete user
      // Verify related data also deleted (or nullified based on schema)
    });
  });

  describe('Case Repository', () => {
    it('should create case with relationships', async () => {
      const user = createUser();
      const caseData = createCase();

      // In real test:
      // 1. Insert user
      // 2. Insert case
      // 3. Link user to case in junction table
      // 4. Verify relationships via JOIN query
    });

    it('should update case status', async () => {
      // Create case
      // Update status
      // Verify updated_at timestamp changed
    });

    it('should filter cases by status', async () => {
      // Create multiple cases with different statuses
      // Query with WHERE clause
      // Verify correct filtering
    });
  });

  describe('Transactions', () => {
    it('should commit transaction on success', async () => {
      // Start transaction
      // Perform multiple operations
      // Commit
      // Verify all changes persisted
    });

    it('should rollback transaction on error', async () => {
      // Start transaction
      // Perform operation
      // Throw error
      // Verify no changes persisted
    });
  });
});

// ============================================================================
// EXAMPLE 4: Component + API Integration Test
// ============================================================================

/**
 * Test React components with real API calls (mocked backend)
 */

import { render, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@legal-platform/test-utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Example component that fetches data
const CaseList: React.FC = () => {
  const [cases, setCases] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch('/api/cases')
      .then(res => res.json())
      .then(data => {
        setCases(data.data);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <ul>
      {cases.map(c => (
        <li key={c.id}>{c.title}</li>
      ))}
    </ul>
  );
};

describe('CaseList Component Integration', () => {
  beforeEach(() => {
    // Mock fetch
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should fetch and display cases', async () => {
    const mockCases = [
      { id: '1', title: 'Case Alpha' },
      { id: '2', title: 'Case Beta' }
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockCases })
    });

    render(<CaseList />);

    // Should show loading initially
    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Case Alpha')).toBeInTheDocument();
      expect(screen.getByText('Case Beta')).toBeInTheDocument();
    });

    // Verify fetch called correctly
    expect(global.fetch).toHaveBeenCalledWith('/api/cases');
  });
});

// ============================================================================
// INTEGRATION TESTING BEST PRACTICES
// ============================================================================

/**
 * ✅ DO:
 * - Use real database connections (test database)
 * - Clean database between tests for isolation
 * - Test complete workflows (request → processing → response)
 * - Verify database state after operations
 * - Test error scenarios and edge cases
 * - Use factories for test data creation
 * - Mock external services (email, storage, payment)
 * - Test authentication and authorization
 * - Verify HTTP status codes and response formats
 * - Test data validation and constraints
 *
 * ❌ DON'T:
 * - Use production database for testing
 * - Skip database cleanup (causes test pollution)
 * - Test too many integration points at once
 * - Use real external API calls
 * - Hardcode test data (use factories)
 * - Leave orphaned test data
 * - Test implementation details
 * - Skip error cases
 */

/**
 * DATABASE SETUP CHECKLIST:
 * 1. Create separate test database
 * 2. Run migrations in test database
 * 3. Seed with minimal required data
 * 4. Clean up after each test
 * 5. Close connections in afterAll()
 *
 * SUPERTEST TIPS:
 * - Chain .expect() for multiple assertions
 * - Use .send() for request body
 * - Use .set() for headers (Authorization, etc.)
 * - Use .attach() for file uploads
 * - Use .query() for URL parameters
 *
 * GRAPHQL TESTING TIPS:
 * - Test both successful queries and errors
 * - Verify field resolvers work correctly
 * - Test DataLoader to prevent N+1 queries
 * - Test authorization at field level
 * - Verify enum values and custom scalars
 *
 * COVERAGE TARGETS:
 * - API Endpoints: 90%+ coverage
 * - GraphQL Resolvers: 90%+ coverage
 * - Database Queries: 80%+ coverage
 *
 * Run: pnpm test:integration
 */
