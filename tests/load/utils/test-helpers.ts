/**
 * Load Test Helper Utilities
 * Story 3.8: Document System Testing and Performance
 *
 * Provides utility functions for load test scenarios.
 */

import * as crypto from 'crypto';

/**
 * Performance thresholds for different operation types
 */
export const PERFORMANCE_THRESHOLDS = {
  documentUpload: {
    p95: 3000, // 3 seconds
    p99: 5000,
  },
  documentDownload: {
    p95: 1000, // 1 second
    p99: 2000,
  },
  documentSearch: {
    p95: 500, // 500ms
    p99: 1000,
  },
  documentGeneration: {
    haiku: { p95: 5000, p99: 8000 },
    sonnet: { p95: 15000, p99: 25000 },
    opus: { p95: 30000, p99: 45000 },
  },
  semanticDiff: {
    p95: 8000, // 8 seconds
    p99: 15000,
  },
  clauseSuggestion: {
    p95: 2000, // 2 seconds
    p99: 4000,
  },
};

/**
 * Load test phases configuration
 */
export const LOAD_PHASES = {
  smoke: {
    duration: 60,
    arrivalRate: 1,
    description: 'Verify basic functionality',
  },
  warmup: {
    duration: 120,
    arrivalRate: 5,
    description: 'Warm up caches and connections',
  },
  rampUp: {
    duration: 120,
    arrivalRate: 5,
    rampTo: 50,
    description: 'Gradually increase load',
  },
  sustained: {
    duration: 300,
    arrivalRate: 50,
    description: 'Main test phase',
  },
  spike: {
    duration: 60,
    arrivalRate: 100,
    description: 'Test system under sudden load',
  },
  rampDown: {
    duration: 120,
    arrivalRate: 50,
    rampTo: 0,
    description: 'Graceful decrease',
  },
};

/**
 * Generate test user credentials
 */
export function generateTestUser(index: number): TestUser {
  const firms = ['firm-1', 'firm-2', 'firm-3', 'firm-4', 'firm-5'];
  const roles = ['Partner', 'Attorney', 'Paralegal', 'BusinessOwner'] as const;

  return {
    id: `test-user-${index}`,
    email: `loadtest${index}@test.local`,
    firmId: firms[index % firms.length],
    role: roles[index % roles.length],
  };
}

export interface TestUser {
  id: string;
  email: string;
  firmId: string;
  role: 'Partner' | 'Attorney' | 'Paralegal' | 'BusinessOwner';
}

/**
 * Generate document content of specified size (in pages)
 */
export function generateDocumentContent(pages: number): string {
  // Approximately 3000 characters per page
  const charsPerPage = 3000;
  const paragraph =
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. ';

  const totalChars = pages * charsPerPage;
  let content = '';

  while (content.length < totalChars) {
    content += paragraph;
  }

  return content.substring(0, totalChars);
}

/**
 * Generate GraphQL document operations
 */
export const GRAPHQL_OPERATIONS = {
  listDocuments: `
    query ListDocuments($caseId: String, $limit: Int, $offset: Int) {
      documents(caseId: $caseId, limit: $limit, offset: $offset) {
        id
        title
        status
        createdAt
      }
    }
  `,

  getDocument: `
    query GetDocument($id: ID!) {
      document(id: $id) {
        id
        title
        content
        status
        versions {
          id
          version
        }
      }
    }
  `,

  createDocument: `
    mutation CreateDocument($input: CreateDocumentInput!) {
      createDocument(input: $input) {
        id
        title
        status
      }
    }
  `,

  updateDocument: `
    mutation UpdateDocument($id: ID!, $input: UpdateDocumentInput!) {
      updateDocument(id: $id, input: $input) {
        id
        title
        content
      }
    }
  `,

  searchDocuments: `
    query SearchDocuments($query: String!, $limit: Int) {
      searchDocuments(query: $query, limit: $limit) {
        results {
          id
          title
          score
        }
        totalCount
      }
    }
  `,

  generateDocument: `
    mutation GenerateDocument($input: GenerateDocumentInput!) {
      generateDocument(input: $input) {
        id
        content
        tokenUsage {
          inputTokens
          outputTokens
          totalTokens
        }
        latencyMs
      }
    }
  `,

  semanticDiff: `
    query SemanticDiff($baseVersionId: ID!, $compareVersionId: ID!) {
      semanticDiff(baseVersionId: $baseVersionId, compareVersionId: $compareVersionId) {
        changes {
          type
          description
          severity
        }
        riskLevel
        latencyMs
      }
    }
  `,
};

/**
 * Calculate percentile from sorted array
 */
export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Generate random case ID for test scenarios
 */
export function generateCaseId(): string {
  return `case-${crypto.randomUUID()}`;
}

/**
 * Generate random document ID for test scenarios
 */
export function generateDocumentId(): string {
  return `doc-${crypto.randomUUID()}`;
}

/**
 * Validate performance against thresholds
 */
export function validatePerformance(
  operationType: keyof typeof PERFORMANCE_THRESHOLDS,
  p95: number,
  p99: number
): ValidationResult {
  const thresholds = PERFORMANCE_THRESHOLDS[operationType];
  const violations: string[] = [];

  if ('p95' in thresholds && p95 > thresholds.p95) {
    violations.push(`P95 ${p95}ms exceeds threshold ${thresholds.p95}ms`);
  }

  if ('p99' in thresholds && p99 > thresholds.p99) {
    violations.push(`P99 ${p99}ms exceeds threshold ${thresholds.p99}ms`);
  }

  return {
    passed: violations.length === 0,
    violations,
    operationType,
    actualP95: p95,
    actualP99: p99,
  };
}

export interface ValidationResult {
  passed: boolean;
  violations: string[];
  operationType: string;
  actualP95: number;
  actualP99: number;
}

/**
 * Format duration in human readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * Generate test search queries
 */
export function generateSearchQuery(): string {
  const queries = [
    'contract amendment',
    'service agreement',
    'confidentiality clause',
    'termination provision',
    'intellectual property',
    'liability limitation',
    'force majeure',
    'governing law',
    'dispute resolution',
    'payment terms',
  ];

  return queries[Math.floor(Math.random() * queries.length)];
}
