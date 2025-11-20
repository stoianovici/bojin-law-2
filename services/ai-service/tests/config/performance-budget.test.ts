/**
 * Performance Budget Tests
 * Story 2.14 - Task 1: Load Testing
 */

import { PERFORMANCE_BUDGET, validatePerformanceBudget } from '../../src/config/performance-budget';

describe('PerformanceBudget', () => {
  describe('PERFORMANCE_BUDGET constants', () => {
    it('should define correct skill execution budget', () => {
      expect(PERFORMANCE_BUDGET.skills.execution).toBe(5000); // 5 seconds
      expect(PERFORMANCE_BUDGET.skills.routing).toBe(100); // 100ms
      expect(PERFORMANCE_BUDGET.skills.cacheHit).toBe(10); // 10ms
      expect(PERFORMANCE_BUDGET.skills.totalRequest).toBe(5100); // Total
    });

    it('should define correct error thresholds', () => {
      expect(PERFORMANCE_BUDGET.error_thresholds.errorRate).toBe(0.02); // 2%
      expect(PERFORMANCE_BUDGET.error_thresholds.timeoutRate).toBe(0.01); // 1%
      expect(PERFORMANCE_BUDGET.error_thresholds.fallbackRate).toBe(0.05); // 5%
    });

    it('should define correct cost targets', () => {
      expect(PERFORMANCE_BUDGET.cost_targets.savingsPercent).toBe(35); // 35%
      expect(PERFORMANCE_BUDGET.cost_targets.maxCostPerRequest).toBe(0.02); // $0.02
    });
  });

  describe('validatePerformanceBudget', () => {
    it('should pass validation when all metrics meet budget', () => {
      const result = validatePerformanceBudget({
        executionTime: 4500,
        routingTime: 90,
        errorRate: 0.01,
        timeoutRate: 0.005,
        fallbackRate: 0.03,
        costPerRequest: 0.015,
        savingsPercent: 40,
      });

      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should fail validation when execution time exceeds budget', () => {
      const result = validatePerformanceBudget({
        executionTime: 6000, // Exceeds 5000ms budget
        routingTime: 90,
        errorRate: 0.01,
        timeoutRate: 0.005,
        fallbackRate: 0.03,
        costPerRequest: 0.015,
        savingsPercent: 40,
      });

      expect(result.passed).toBe(false);
      expect(result.violations).toContain(
        'Execution time 6000ms exceeds budget 5000ms'
      );
    });

    it('should fail validation when routing time exceeds budget', () => {
      const result = validatePerformanceBudget({
        executionTime: 4500,
        routingTime: 150, // Exceeds 100ms budget
        errorRate: 0.01,
        timeoutRate: 0.005,
        fallbackRate: 0.03,
        costPerRequest: 0.015,
        savingsPercent: 40,
      });

      expect(result.passed).toBe(false);
      expect(result.violations).toContain(
        'Routing time 150ms exceeds budget 100ms'
      );
    });

    it('should fail validation when error rate exceeds threshold', () => {
      const result = validatePerformanceBudget({
        executionTime: 4500,
        routingTime: 90,
        errorRate: 0.03, // Exceeds 2% threshold
        timeoutRate: 0.005,
        fallbackRate: 0.03,
        costPerRequest: 0.015,
        savingsPercent: 40,
      });

      expect(result.passed).toBe(false);
      expect(result.violations).toContain(
        'Error rate 3.00% exceeds threshold 2%'
      );
    });

    it('should fail validation when timeout rate exceeds threshold', () => {
      const result = validatePerformanceBudget({
        executionTime: 4500,
        routingTime: 90,
        errorRate: 0.01,
        timeoutRate: 0.015, // Exceeds 1% threshold
        fallbackRate: 0.03,
        costPerRequest: 0.015,
        savingsPercent: 40,
      });

      expect(result.passed).toBe(false);
      expect(result.violations).toContain(
        'Timeout rate 1.50% exceeds threshold 1%'
      );
    });

    it('should fail validation when fallback rate exceeds threshold', () => {
      const result = validatePerformanceBudget({
        executionTime: 4500,
        routingTime: 90,
        errorRate: 0.01,
        timeoutRate: 0.005,
        fallbackRate: 0.07, // Exceeds 5% threshold
        costPerRequest: 0.015,
        savingsPercent: 40,
      });

      expect(result.passed).toBe(false);
      expect(result.violations).toContain(
        'Fallback rate 7.00% exceeds threshold 5%'
      );
    });

    it('should fail validation when cost per request exceeds budget', () => {
      const result = validatePerformanceBudget({
        executionTime: 4500,
        routingTime: 90,
        errorRate: 0.01,
        timeoutRate: 0.005,
        fallbackRate: 0.03,
        costPerRequest: 0.025, // Exceeds $0.02 budget
        savingsPercent: 40,
      });

      expect(result.passed).toBe(false);
      expect(result.violations).toContain(
        'Cost per request $0.0250 exceeds budget $0.02'
      );
    });

    it('should fail validation when savings below target', () => {
      const result = validatePerformanceBudget({
        executionTime: 4500,
        routingTime: 90,
        errorRate: 0.01,
        timeoutRate: 0.005,
        fallbackRate: 0.03,
        costPerRequest: 0.015,
        savingsPercent: 30, // Below 35% target
      });

      expect(result.passed).toBe(false);
      expect(result.violations).toContain(
        'Savings 30.00% below target 35%'
      );
    });

    it('should report multiple violations', () => {
      const result = validatePerformanceBudget({
        executionTime: 6000, // Violation
        routingTime: 150, // Violation
        errorRate: 0.03, // Violation
        timeoutRate: 0.005,
        fallbackRate: 0.03,
        costPerRequest: 0.015,
        savingsPercent: 40,
      });

      expect(result.passed).toBe(false);
      expect(result.violations).toHaveLength(3);
      expect(result.violations).toContain(
        'Execution time 6000ms exceeds budget 5000ms'
      );
      expect(result.violations).toContain(
        'Routing time 150ms exceeds budget 100ms'
      );
      expect(result.violations).toContain(
        'Error rate 3.00% exceeds threshold 2%'
      );
    });

    it('should handle edge case values at exact budget limits', () => {
      const result = validatePerformanceBudget({
        executionTime: 5000, // Exactly at limit
        routingTime: 100, // Exactly at limit
        errorRate: 0.02, // Exactly at limit
        timeoutRate: 0.01, // Exactly at limit
        fallbackRate: 0.05, // Exactly at limit
        costPerRequest: 0.02, // Exactly at limit
        savingsPercent: 35, // Exactly at limit
      });

      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });
});
