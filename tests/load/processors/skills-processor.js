/**
 * Skills Load Test Processor
 * Story 2.14 - Task 1: Load Testing
 *
 * Custom processor for Artillery load tests to track:
 * - Execution times
 * - Token usage
 * - Cost metrics
 * - Error rates
 * - Memory usage
 */

const fs = require('fs');
const path = require('path');

// Metrics tracking
let metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  timeouts: 0,
  executionTimes: [],
  tokensUsed: [],
  costs: [],
  errors: [],
  memoryUsage: [],
};

/**
 * Called before the test run starts
 */
function beforeScenario(requestParams, context, ee, next) {
  // Set up user context
  context.vars.userId = `user_${Math.floor(Math.random() * 10000)}`;
  context.vars.timestamp = new Date().toISOString();

  return next();
}

/**
 * Called after each request
 */
function afterResponse(requestParams, response, context, ee, next) {
  metrics.totalRequests++;

  // Track response status
  if (response.statusCode >= 200 && response.statusCode < 300) {
    metrics.successfulRequests++;

    // Track execution metrics if available
    try {
      const body = JSON.parse(response.body);

      if (body.executionTime) {
        metrics.executionTimes.push(body.executionTime);
      }

      if (body.tokenUsage?.total) {
        metrics.tokensUsed.push(body.tokenUsage.total);
      }

      if (body.cost) {
        metrics.costs.push(body.cost);
      }

      // Check for skill timeout
      if (body.metadata?.timedOut) {
        metrics.timeouts++;
      }

      // Track memory usage if provided
      if (body.metadata?.memoryUsage) {
        metrics.memoryUsage.push(body.metadata.memoryUsage);
      }
    } catch (err) {
      // Response body not JSON or missing expected fields
      console.warn('Could not parse response metrics:', err.message);
    }
  } else {
    metrics.failedRequests++;
    metrics.errors.push({
      statusCode: response.statusCode,
      timestamp: new Date().toISOString(),
      url: requestParams.url,
    });
  }

  return next();
}

/**
 * Called after the test run completes
 */
function afterTest(context, ee, next) {
  // Calculate summary metrics
  const summary = calculateSummaryMetrics();

  // Write metrics to file
  const outputPath = path.join(__dirname, '../results/load-test-metrics.json');
  const outputDir = path.dirname(outputPath);

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));

  // Log summary to console
  console.log('\n=== Load Test Summary ===');
  console.log(`Total Requests: ${summary.totalRequests}`);
  console.log(`Success Rate: ${summary.successRate.toFixed(2)}%`);
  console.log(`Error Rate: ${summary.errorRate.toFixed(2)}%`);
  console.log(`Timeout Rate: ${summary.timeoutRate.toFixed(2)}%`);
  console.log(`\nPerformance Metrics:`);
  console.log(`  P50 Response Time: ${summary.performance.p50.toFixed(2)}ms`);
  console.log(`  P95 Response Time: ${summary.performance.p95.toFixed(2)}ms`);
  console.log(`  P99 Response Time: ${summary.performance.p99.toFixed(2)}ms`);
  console.log(`  Average Response Time: ${summary.performance.average.toFixed(2)}ms`);
  console.log(`\nCost Metrics:`);
  console.log(`  Average Cost: $${summary.cost.average.toFixed(4)}`);
  console.log(`  Total Cost: $${summary.cost.total.toFixed(2)}`);
  console.log(`\nToken Usage:`);
  console.log(`  Average Tokens: ${summary.tokens.average.toFixed(0)}`);
  console.log(`  Total Tokens: ${summary.tokens.total}`);

  if (summary.memoryUsage.average > 0) {
    console.log(`\nMemory Usage:`);
    console.log(`  Average: ${summary.memoryUsage.average.toFixed(2)}MB`);
    console.log(`  Peak: ${summary.memoryUsage.peak.toFixed(2)}MB`);
  }

  // Check if performance budget is met (AC#4, AC#6)
  console.log('\n=== Performance Budget Validation ===');
  const budgetValidation = validatePerformanceBudget(summary);
  if (budgetValidation.passed) {
    console.log('✅ All performance budgets met');
  } else {
    console.log('❌ Performance budget violations:');
    budgetValidation.violations.forEach((violation) => {
      console.log(`  - ${violation}`);
    });
  }

  return next();
}

/**
 * Calculate summary metrics from collected data
 */
function calculateSummaryMetrics() {
  const successRate = (metrics.successfulRequests / metrics.totalRequests) * 100;
  const errorRate = (metrics.failedRequests / metrics.totalRequests) * 100;
  const timeoutRate = (metrics.timeouts / metrics.totalRequests) * 100;

  return {
    totalRequests: metrics.totalRequests,
    successfulRequests: metrics.successfulRequests,
    failedRequests: metrics.failedRequests,
    timeouts: metrics.timeouts,
    successRate,
    errorRate,
    timeoutRate,
    performance: calculatePercentiles(metrics.executionTimes),
    cost: {
      average: calculateAverage(metrics.costs),
      total: metrics.costs.reduce((sum, cost) => sum + cost, 0),
      min: Math.min(...metrics.costs),
      max: Math.max(...metrics.costs),
    },
    tokens: {
      average: calculateAverage(metrics.tokensUsed),
      total: metrics.tokensUsed.reduce((sum, tokens) => sum + tokens, 0),
      min: Math.min(...metrics.tokensUsed),
      max: Math.max(...metrics.tokensUsed),
    },
    memoryUsage: {
      average: calculateAverage(metrics.memoryUsage),
      peak: metrics.memoryUsage.length > 0 ? Math.max(...metrics.memoryUsage) : 0,
    },
    errors: metrics.errors,
  };
}

/**
 * Calculate percentiles for response times
 */
function calculatePercentiles(values) {
  if (values.length === 0) {
    return { p50: 0, p95: 0, p99: 0, average: 0 };
  }

  const sorted = values.slice().sort((a, b) => a - b);
  const len = sorted.length;

  return {
    p50: sorted[Math.floor(len * 0.5)],
    p95: sorted[Math.floor(len * 0.95)],
    p99: sorted[Math.floor(len * 0.99)],
    average: sorted.reduce((sum, val) => sum + val, 0) / len,
  };
}

/**
 * Calculate average of an array
 */
function calculateAverage(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Validate performance budget (AC#4, AC#6)
 */
function validatePerformanceBudget(summary) {
  const violations = [];

  // AC#4: <5s response time at p95
  if (summary.performance.p95 > 5000) {
    violations.push(
      `P95 response time ${summary.performance.p95.toFixed(0)}ms exceeds 5000ms budget`
    );
  }

  // AC#6: <2% error rate
  if (summary.errorRate > 2) {
    violations.push(`Error rate ${summary.errorRate.toFixed(2)}% exceeds 2% threshold`);
  }

  // Additional checks
  if (summary.timeoutRate > 1) {
    violations.push(`Timeout rate ${summary.timeoutRate.toFixed(2)}% exceeds 1% threshold`);
  }

  if (summary.performance.p99 > 10000) {
    violations.push(
      `P99 response time ${summary.performance.p99.toFixed(0)}ms exceeds 10000ms threshold`
    );
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}

// Export processor functions
module.exports = {
  beforeScenario,
  afterResponse,
  afterTest,
};
