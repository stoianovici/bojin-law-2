/**
 * Tests for Performance Optimizer
 */

import { LRUCache, PerformanceOptimizer } from '../../src/routing/PerformanceOptimizer';

describe('LRUCache', () => {
  describe('Basic Operations', () => {
    it('should store and retrieve values', () => {
      const cache = new LRUCache<string>(5, 60000);

      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return null for non-existent keys', () => {
      const cache = new LRUCache<string>(5, 60000);

      expect(cache.get('nonexistent')).toBeNull();
    });

    it('should check if key exists', () => {
      const cache = new LRUCache<string>(5, 60000);

      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
    });

    it('should update existing values', () => {
      const cache = new LRUCache<string>(5, 60000);

      cache.set('key1', 'value1');
      cache.set('key1', 'value2');
      expect(cache.get('key1')).toBe('value2');
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least recently used when cache is full', () => {
      const cache = new LRUCache<string>(3, 60000);

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Cache is full, adding new key should evict key1
      cache.set('key4', 'value4');

      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key4')).toBe('value4');
    });

    it('should update LRU order on access', () => {
      const cache = new LRUCache<string>(3, 60000);

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Access key1 to make it most recently used
      cache.get('key1');

      // Adding new key should evict key2 (not key1)
      cache.set('key4', 'value4');

      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBeNull();
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key4')).toBe('value4');
    });

    it('should not evict when updating existing key', () => {
      const cache = new LRUCache<string>(3, 60000);

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Update existing key shouldn't evict anything
      cache.set('key2', 'value2-updated');

      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBe('value2-updated');
      expect(cache.get('key3')).toBe('value3');
    });
  });

  describe('TTL Expiration', () => {
    it('should expire entries after TTL', async () => {
      const cache = new LRUCache<string>(5, 100); // 100ms TTL

      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(cache.get('key1')).toBeNull();
    });

    it('should not return expired entries via has()', async () => {
      const cache = new LRUCache<string>(5, 100);

      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(cache.has('key1')).toBe(false);
    });
  });

  describe('Statistics', () => {
    it('should track hits and misses', () => {
      const cache = new LRUCache<string>(5, 60000);

      cache.set('key1', 'value1');

      cache.get('key1'); // Hit
      cache.get('key2'); // Miss
      cache.get('key1'); // Hit
      cache.get('key3'); // Miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(0.5);
    });

    it('should track cache size', () => {
      const cache = new LRUCache<string>(5, 60000);

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(5);
    });

    it('should reset stats on clear', () => {
      const cache = new LRUCache<string>(5, 60000);

      cache.set('key1', 'value1');
      cache.get('key1');

      cache.clear();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.size).toBe(0);
    });
  });
});

describe('PerformanceOptimizer', () => {
  let optimizer: PerformanceOptimizer;

  beforeEach(() => {
    optimizer = new PerformanceOptimizer();
  });

  describe('Metadata Caching', () => {
    it('should cache and retrieve skill metadata', () => {
      const metadata = { name: 'test-skill', version: '1.0' };

      optimizer.setSkillMetadata('skill-1', metadata);
      const retrieved = optimizer.getSkillMetadata('skill-1');

      expect(retrieved).toEqual(metadata);
    });

    it('should return null for non-cached metadata', () => {
      const retrieved = optimizer.getSkillMetadata('nonexistent');
      expect(retrieved).toBeNull();
    });
  });

  describe('Pattern Match Caching', () => {
    it('should cache pattern match results', () => {
      const task = 'Review contract agreement';
      const skillIds = ['contract-analysis', 'legal-review'];

      optimizer.setPatternMatch(task, skillIds);
      const retrieved = optimizer.getPatternMatch(task);

      expect(retrieved).toEqual(skillIds);
    });

    it('should normalize task description for consistent hashing', () => {
      const task1 = '  Review   contract   agreement  ';
      const task2 = 'review contract agreement';
      const skillIds = ['contract-analysis'];

      optimizer.setPatternMatch(task1, skillIds);
      const retrieved = optimizer.getPatternMatch(task2);

      expect(retrieved).toEqual(skillIds);
    });

    it('should return null for non-cached patterns', () => {
      const retrieved = optimizer.getPatternMatch('New task');
      expect(retrieved).toBeNull();
    });
  });

  describe('Effectiveness Caching', () => {
    it('should cache effectiveness scores', () => {
      const skillIds = ['skill-1', 'skill-2'];
      const score = 0.85;

      optimizer.setEffectiveness(skillIds, score);
      const retrieved = optimizer.getEffectiveness(skillIds);

      expect(retrieved).toBe(score);
    });

    it('should handle skill order independence', () => {
      const skillIds1 = ['skill-a', 'skill-b'];
      const skillIds2 = ['skill-b', 'skill-a'];
      const score = 0.75;

      optimizer.setEffectiveness(skillIds1, score);
      const retrieved = optimizer.getEffectiveness(skillIds2);

      expect(retrieved).toBe(score);
    });

    it('should return null for non-cached effectiveness', () => {
      const retrieved = optimizer.getEffectiveness(['unknown-skill']);
      expect(retrieved).toBeNull();
    });
  });

  describe('Request Deduplication', () => {
    it('should deduplicate concurrent requests', async () => {
      let callCount = 0;
      const operation = async () => {
        callCount++;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 'result';
      };

      // Launch 3 concurrent requests with same key
      const promises = [
        optimizer.deduplicate('request-1', operation),
        optimizer.deduplicate('request-1', operation),
        optimizer.deduplicate('request-1', operation),
      ];

      const results = await Promise.all(promises);

      // All should get same result but operation should only run once
      expect(results).toEqual(['result', 'result', 'result']);
      expect(callCount).toBe(1);
    });

    it('should not deduplicate different request keys', async () => {
      let callCount = 0;
      const operation = async () => {
        callCount++;
        return 'result';
      };

      await Promise.all([
        optimizer.deduplicate('request-1', operation),
        optimizer.deduplicate('request-2', operation),
      ]);

      expect(callCount).toBe(2);
    });

    it('should handle operation errors correctly', async () => {
      const operation = async () => {
        throw new Error('Operation failed');
      };

      await expect(optimizer.deduplicate('request-1', operation)).rejects.toThrow(
        'Operation failed'
      );

      // Subsequent request should retry (not use cached error)
      let secondCallMade = false;
      const operation2 = async () => {
        secondCallMade = true;
        return 'success';
      };

      await optimizer.deduplicate('request-1', operation2);
      expect(secondCallMade).toBe(true);
    });
  });

  describe('Request Result Caching', () => {
    it('should cache request results', () => {
      const result = { data: 'test' };

      optimizer.setRequestResult('request-1', result);
      const retrieved = optimizer.getRequestResult('request-1');

      expect(retrieved).toEqual(result);
    });

    it('should return null for non-cached results', () => {
      const retrieved = optimizer.getRequestResult('nonexistent');
      expect(retrieved).toBeNull();
    });
  });

  describe('Performance Measurement', () => {
    it('should measure operation duration', async () => {
      const operation = async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 'result';
      };

      await optimizer.measureAsync('test-operation', operation);

      const metrics = optimizer.getMetricsByOperation('test-operation');
      expect(metrics).toHaveLength(1);
      expect(metrics[0].duration).toBeGreaterThanOrEqual(50);
      expect(metrics[0].operationName).toBe('test-operation');
      expect(metrics[0].cached).toBe(false);
    });

    it('should use cache when available', async () => {
      let callCount = 0;
      const operation = async () => {
        callCount++;
        return 'result';
      };

      // First call - not cached
      const result1 = await optimizer.measureAsync('test-op', operation, 'cache-key-1');
      expect(result1).toBe('result');
      expect(callCount).toBe(1);

      // Second call - should use cache
      const result2 = await optimizer.measureAsync('test-op', operation, 'cache-key-1');
      expect(result2).toBe('result');
      expect(callCount).toBe(1); // Operation not called again

      const metrics = optimizer.getMetricsByOperation('test-op');
      expect(metrics[0].cached).toBe(false);
      expect(metrics[1].cached).toBe(true);
    });

    it('should track performance statistics', async () => {
      // Create operations with different durations
      const fastOp = async () => await new Promise((resolve) => setTimeout(resolve, 10));
      const slowOp = async () => await new Promise((resolve) => setTimeout(resolve, 100));

      await optimizer.measureAsync('fast', fastOp);
      await optimizer.measureAsync('slow', slowOp);
      await optimizer.measureAsync('fast', fastOp);

      const stats = optimizer.getPerformanceStats();

      expect(stats.averageDuration).toBeGreaterThan(0);
      expect(stats.p50Duration).toBeGreaterThan(0);
      expect(stats.p95Duration).toBeGreaterThan(0);
      expect(stats.slowestOperations).toHaveLength(3);
    });
  });

  describe('Cache Statistics', () => {
    it('should return statistics for all caches', () => {
      optimizer.setSkillMetadata('skill-1', { name: 'test' });
      optimizer.setPatternMatch('task-1', ['skill-1']);
      optimizer.setEffectiveness(['skill-1'], 0.8);

      const stats = optimizer.getAllCacheStats();

      expect(stats.metadata.size).toBe(1);
      expect(stats.patternMatch.size).toBe(1);
      expect(stats.effectiveness.size).toBe(1);
    });

    it('should generate cache efficiency report', () => {
      optimizer.setPatternMatch('task-1', ['skill-1']);
      optimizer.getPatternMatch('task-1'); // Hit
      optimizer.getPatternMatch('task-2'); // Miss

      const report = optimizer.getCacheEfficiencyReport();

      expect(report.totalHits).toBeGreaterThan(0);
      expect(report.totalMisses).toBeGreaterThan(0);
      expect(report.overallHitRate).toBeGreaterThan(0);
      expect(Array.isArray(report.recommendations)).toBe(true);
    });
  });

  describe('Cache Management', () => {
    it('should clear all caches', () => {
      optimizer.setSkillMetadata('skill-1', { name: 'test' });
      optimizer.setPatternMatch('task-1', ['skill-1']);
      optimizer.setEffectiveness(['skill-1'], 0.8);

      optimizer.clearAllCaches();

      expect(optimizer.getSkillMetadata('skill-1')).toBeNull();
      expect(optimizer.getPatternMatch('task-1')).toBeNull();
      expect(optimizer.getEffectiveness(['skill-1'])).toBeNull();
    });
  });
});
