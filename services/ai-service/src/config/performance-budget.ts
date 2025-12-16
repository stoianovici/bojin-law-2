/**
 * Performance Budget Configuration
 * Story 2.14 - AC#4, AC#6
 *
 * Defines performance targets and error thresholds for skills execution.
 */

export interface PerformanceBudget {
  skills: {
    execution: number; // AC#4: <5s execution time
    routing: number; // From Story 2.13: <100ms routing overhead
    cacheHit: number; // <10ms cache lookup
    totalRequest: number; // Sum of above
  };

  error_thresholds: {
    errorRate: number; // AC#6: <2% error rate
    timeoutRate: number; // <1% timeout rate
    fallbackRate: number; // <5% fallback to non-skills
  };

  cost_targets: {
    savingsPercent: number; // AC#5: >35% cost savings
    maxCostPerRequest: number; // <$0.02 per request
  };
}

export const PERFORMANCE_BUDGET: PerformanceBudget = {
  skills: {
    execution: 5000, // 5 seconds
    routing: 100, // 100 milliseconds
    cacheHit: 10, // 10 milliseconds
    totalRequest: 5100, // 5.1 seconds total
  },

  error_thresholds: {
    errorRate: 0.02, // 2%
    timeoutRate: 0.01, // 1%
    fallbackRate: 0.05, // 5%
  },

  cost_targets: {
    savingsPercent: 35, // 35% minimum savings
    maxCostPerRequest: 0.02, // $0.02 per request
  },
};

/**
 * Validates if performance metrics meet budget requirements
 */
export function validatePerformanceBudget(metrics: {
  executionTime: number;
  routingTime: number;
  errorRate: number;
  timeoutRate: number;
  fallbackRate: number;
  costPerRequest: number;
  savingsPercent: number;
}): {
  passed: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  // Check execution time
  if (metrics.executionTime > PERFORMANCE_BUDGET.skills.execution) {
    violations.push(
      `Execution time ${metrics.executionTime}ms exceeds budget ${PERFORMANCE_BUDGET.skills.execution}ms`
    );
  }

  // Check routing overhead
  if (metrics.routingTime > PERFORMANCE_BUDGET.skills.routing) {
    violations.push(
      `Routing time ${metrics.routingTime}ms exceeds budget ${PERFORMANCE_BUDGET.skills.routing}ms`
    );
  }

  // Check error rate
  if (metrics.errorRate > PERFORMANCE_BUDGET.error_thresholds.errorRate) {
    violations.push(
      `Error rate ${(metrics.errorRate * 100).toFixed(2)}% exceeds threshold ${
        PERFORMANCE_BUDGET.error_thresholds.errorRate * 100
      }%`
    );
  }

  // Check timeout rate
  if (metrics.timeoutRate > PERFORMANCE_BUDGET.error_thresholds.timeoutRate) {
    violations.push(
      `Timeout rate ${(metrics.timeoutRate * 100).toFixed(2)}% exceeds threshold ${
        PERFORMANCE_BUDGET.error_thresholds.timeoutRate * 100
      }%`
    );
  }

  // Check fallback rate
  if (metrics.fallbackRate > PERFORMANCE_BUDGET.error_thresholds.fallbackRate) {
    violations.push(
      `Fallback rate ${(metrics.fallbackRate * 100).toFixed(2)}% exceeds threshold ${
        PERFORMANCE_BUDGET.error_thresholds.fallbackRate * 100
      }%`
    );
  }

  // Check cost per request
  if (metrics.costPerRequest > PERFORMANCE_BUDGET.cost_targets.maxCostPerRequest) {
    violations.push(
      `Cost per request $${metrics.costPerRequest.toFixed(4)} exceeds budget $${
        PERFORMANCE_BUDGET.cost_targets.maxCostPerRequest
      }`
    );
  }

  // Check cost savings
  if (metrics.savingsPercent < PERFORMANCE_BUDGET.cost_targets.savingsPercent) {
    violations.push(
      `Savings ${metrics.savingsPercent.toFixed(2)}% below target ${
        PERFORMANCE_BUDGET.cost_targets.savingsPercent
      }%`
    );
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}
