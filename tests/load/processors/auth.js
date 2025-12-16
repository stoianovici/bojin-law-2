/**
 * Artillery Auth Processor
 * Story 3.8: Document System Testing and Performance
 *
 * Handles authentication for load tests by setting up auth headers
 * and tracking request metrics.
 */

const crypto = require('crypto');

// Test user pool for simulating concurrent users
const testUsers = [];
for (let i = 0; i < 100; i++) {
  testUsers.push({
    id: `test-user-${i}`,
    email: `loadtest${i}@test.local`,
    firmId: `test-firm-${i % 10}`, // 10 different firms
    role: i % 5 === 0 ? 'Partner' : i % 3 === 0 ? 'Attorney' : 'Paralegal',
  });
}

// Metrics tracking
const metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  byEndpoint: {},
  byUser: {},
  latencies: [],
};

/**
 * Set authentication header for requests
 * Called before each scenario
 */
function setAuthHeader(requestParams, context, ee, next) {
  // Assign a random test user
  const userIndex = Math.floor(Math.random() * testUsers.length);
  const user = testUsers[userIndex];

  context.vars.userId = user.id;
  context.vars.firmId = user.firmId;
  context.vars.userRole = user.role;
  context.vars.requestId = crypto.randomUUID();

  // Set auth headers (simulated JWT for load testing)
  if (!requestParams.headers) {
    requestParams.headers = {};
  }

  // In production, this would be a real JWT
  // For load testing, we use a test token that the server recognizes
  requestParams.headers['Authorization'] = `Bearer load-test-token-${user.id}`;
  requestParams.headers['X-Request-ID'] = context.vars.requestId;
  requestParams.headers['X-Firm-ID'] = user.firmId;
  requestParams.headers['X-User-Role'] = user.role;

  return next();
}

/**
 * Generate a unique document ID for test scenarios
 */
function generateDocumentId(requestParams, context, ee, next) {
  context.vars.documentId = `doc-${crypto.randomUUID()}`;
  context.vars.versionId = `ver-${crypto.randomUUID()}`;
  return next();
}

/**
 * Generate test document content of varying sizes
 */
function generateDocumentContent(requestParams, context, ee, next) {
  const sizes = ['small', 'medium', 'large'];
  const sizeIndex = Math.floor(Math.random() * sizes.length);
  const size = sizes[sizeIndex];

  let content = '';
  const paragraph =
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. ';

  switch (size) {
    case 'small':
      content = paragraph.repeat(10); // ~2KB
      break;
    case 'medium':
      content = paragraph.repeat(100); // ~20KB
      break;
    case 'large':
      content = paragraph.repeat(500); // ~100KB
      break;
  }

  context.vars.documentContent = content;
  context.vars.documentSize = size;

  return next();
}

/**
 * Generate GraphQL query for document operations
 */
function generateGraphQLQuery(requestParams, context, ee, next) {
  const queries = {
    listDocuments: `
      query ListDocuments($caseId: String, $limit: Int, $offset: Int) {
        documents(caseId: $caseId, limit: $limit, offset: $offset) {
          id
          title
          status
          createdAt
          updatedAt
        }
      }
    `,
    getDocument: `
      query GetDocument($id: String!) {
        document(id: $id) {
          id
          title
          content
          status
          versions {
            id
            version
            createdAt
          }
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
  };

  const queryType = context.vars.queryType || 'listDocuments';
  context.vars.graphqlQuery = queries[queryType];

  return next();
}

/**
 * Track response metrics
 * Called after each request
 */
function trackResponse(requestParams, response, context, ee, next) {
  metrics.totalRequests++;

  const endpoint = requestParams.url || 'unknown';
  const userId = context.vars.userId;

  // Initialize endpoint metrics
  if (!metrics.byEndpoint[endpoint]) {
    metrics.byEndpoint[endpoint] = {
      total: 0,
      success: 0,
      failed: 0,
      latencies: [],
    };
  }

  // Initialize user metrics
  if (!metrics.byUser[userId]) {
    metrics.byUser[userId] = {
      total: 0,
      success: 0,
      failed: 0,
    };
  }

  const endpointMetrics = metrics.byEndpoint[endpoint];
  const userMetrics = metrics.byUser[userId];

  endpointMetrics.total++;
  userMetrics.total++;

  if (response.statusCode >= 200 && response.statusCode < 300) {
    metrics.successfulRequests++;
    endpointMetrics.success++;
    userMetrics.success++;

    // Track latency from response if available
    try {
      const body = JSON.parse(response.body);
      if (body.latencyMs) {
        endpointMetrics.latencies.push(body.latencyMs);
        metrics.latencies.push(body.latencyMs);
      }
    } catch (e) {
      // Body not JSON or missing latency
    }
  } else {
    metrics.failedRequests++;
    endpointMetrics.failed++;
    userMetrics.failed++;

    // Log errors for debugging
    console.warn(`Request failed: ${endpoint} - ${response.statusCode}`);
  }

  return next();
}

/**
 * Export metrics summary after test completion
 */
function exportMetrics(context, ee, next) {
  const summary = {
    timestamp: new Date().toISOString(),
    totalRequests: metrics.totalRequests,
    successRate: ((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2),
    errorRate: ((metrics.failedRequests / metrics.totalRequests) * 100).toFixed(2),
    byEndpoint: Object.entries(metrics.byEndpoint).map(([endpoint, data]) => ({
      endpoint,
      total: data.total,
      successRate: ((data.success / data.total) * 100).toFixed(2),
      avgLatency:
        data.latencies.length > 0
          ? (data.latencies.reduce((a, b) => a + b, 0) / data.latencies.length).toFixed(2)
          : 'N/A',
    })),
    uniqueUsers: Object.keys(metrics.byUser).length,
  };

  console.log('\n=== Load Test Metrics Summary ===');
  console.log(JSON.stringify(summary, null, 2));

  return next();
}

module.exports = {
  setAuthHeader,
  generateDocumentId,
  generateDocumentContent,
  generateGraphQLQuery,
  trackResponse,
  exportMetrics,
};
