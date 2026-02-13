/**
 * Jurisprudence Agent Tool Handlers Tests
 *
 * Tests the tool handlers for the jurisprudence agent:
 * - search_jurisprudence: Search with validation and URL tracking
 * - submit_jurisprudence_notes: Output capture with provenance checking
 */

import { JurisprudenceAgentContext } from '../jurisprudence-agent.types';

// ============================================================================
// Mocks
// ============================================================================

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
  trace: jest.fn(),
  fatal: jest.fn(),
  child: jest.fn().mockReturnThis(),
};

jest.mock('../../utils/logger', () => mockLogger);

const mockWebSearchService = {
  search: jest.fn(),
};

jest.mock('../web-search.service', () => ({
  webSearchService: mockWebSearchService,
}));

// Mock Redis
const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
  del: jest.fn(),
  // Hash operations for RedisUrlTracker
  hset: jest.fn(),
  hexists: jest.fn(),
  hlen: jest.fn(),
};

jest.mock('@legal-platform/database', () => ({
  redis: mockRedis,
}));

/**
 * Helper to reset circuit breaker and URL tracker state in Redis mocks.
 * Since circuit breaker and URL tracking now use Redis, we need to ensure clean state.
 */
function resetCircuitBreakerMocks() {
  // Circuit breaker keys return null by default (circuit closed)
  mockRedis.get.mockImplementation((key: string) => {
    if (key.includes('circuit')) {
      return Promise.resolve(null);
    }
    return Promise.resolve(null);
  });
  mockRedis.del.mockResolvedValue(1);

  // URL tracker hash operations
  mockRedis.hset.mockResolvedValue(1);
  mockRedis.hexists.mockResolvedValue(0); // Default: URL not found
  mockRedis.hlen.mockResolvedValue(0);
  mockRedis.expire.mockResolvedValue(1);
}

import {
  createJurisprudenceToolHandlers,
  checkJurisprudenceRateLimit,
} from '../jurisprudence-agent-tools.handlers';
import { JURISPRUDENCE_CONSTRAINTS } from '../jurisprudence-agent.types';

// ============================================================================
// Test Context
// ============================================================================

const testContext: JurisprudenceAgentContext = {
  firmId: 'firm-123',
  userId: 'user-456',
  correlationId: 'corr-789',
  caseId: 'case-abc',
};

// ============================================================================
// Helper Functions
// ============================================================================

function createMockSearchResults(urls: string[]) {
  return {
    query: 'test query',
    results: urls.map((url, i) => ({
      title: `Result ${i + 1}`,
      url,
      snippet: `Snippet for result ${i + 1}`,
    })),
  };
}

// ============================================================================
// search_jurisprudence Handler Tests
// ============================================================================

describe('search_jurisprudence handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetCircuitBreakerMocks();
  });

  it('should validate input with Zod and reject invalid queries', async () => {
    const { handlers } = createJurisprudenceToolHandlers(testContext);

    // Query too short
    const result = await handlers.search_jurisprudence({ query: 'ab' });

    expect(result).toContain('EROARE_CĂUTARE');
    expect(result).toContain('INVALID_INPUT');
    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[JurisprudenceAgent] Invalid search input',
      expect.any(Object)
    );
  });

  it('should reject empty query', async () => {
    const { handlers } = createJurisprudenceToolHandlers(testContext);

    const result = await handlers.search_jurisprudence({ query: '' });

    expect(result).toContain('EROARE_CĂUTARE');
    expect(result).toContain('INVALID_INPUT');
  });

  it('should accept valid search input and track URLs', async () => {
    mockWebSearchService.search.mockResolvedValueOnce(
      createMockSearchResults(['https://rejust.ro/juris/123', 'https://scj.ro/decizii/456'])
    );

    const { handlers, getTrackedUrls } = createJurisprudenceToolHandlers(testContext);

    const result = await handlers.search_jurisprudence({ query: 'răspundere civilă' });

    expect(result).toContain('Rezultate căutare');
    expect(result).toContain('rejust.ro');
    expect(result).toContain('scj.ro');

    // Verify URLs are tracked
    const trackedUrls = getTrackedUrls();
    expect(trackedUrls.size).toBe(2);
    expect(trackedUrls.has('https://rejust.ro/juris/123')).toBe(true);
    expect(trackedUrls.has('https://scj.ro/decizii/456')).toBe(true);
  });

  it('should increment search count on each search', async () => {
    mockWebSearchService.search.mockResolvedValue(createMockSearchResults([]));

    const { handlers, getSearchCount } = createJurisprudenceToolHandlers(testContext);

    expect(getSearchCount()).toBe(0);

    await handlers.search_jurisprudence({ query: 'first search' });
    expect(getSearchCount()).toBe(1);

    await handlers.search_jurisprudence({ query: 'second search' });
    expect(getSearchCount()).toBe(2);
  });

  it('should limit court terms to avoid long queries', async () => {
    mockWebSearchService.search.mockResolvedValueOnce(createMockSearchResults([]));

    const { handlers } = createJurisprudenceToolHandlers(testContext);

    await handlers.search_jurisprudence({
      query: 'test query',
      courts: ['ÎCCJ', 'CCR', 'CA', 'Tribunal', 'Judecătorie'], // 5 courts
    });

    // Should log that courts were limited
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[JurisprudenceAgent] Court filter limited',
      expect.objectContaining({
        requested: 5,
        used: 3,
      })
    );
  });

  it('should handle year range in query', async () => {
    mockWebSearchService.search.mockResolvedValueOnce(createMockSearchResults([]));

    const { handlers } = createJurisprudenceToolHandlers(testContext);

    await handlers.search_jurisprudence({
      query: 'test',
      yearRange: { from: 2020, to: 2024 },
    });

    expect(mockWebSearchService.search).toHaveBeenCalledWith(
      expect.stringContaining('2020..2024'),
      expect.any(Object)
    );
  });

  it('should reject invalid year range (from > to)', async () => {
    const { handlers } = createJurisprudenceToolHandlers(testContext);

    const result = await handlers.search_jurisprudence({
      query: 'test query',
      yearRange: { from: 2024, to: 2020 },
    });

    expect(result).toContain('EROARE_CĂUTARE');
    expect(result).toContain('INVALID_INPUT');
  });

  it('should handle search service errors gracefully', async () => {
    // Mock all retry attempts to fail
    mockWebSearchService.search.mockRejectedValue(new Error('Network error'));

    const { handlers } = createJurisprudenceToolHandlers(testContext);

    const result = await handlers.search_jurisprudence({ query: 'test query' });

    expect(result).toContain('EROARE_CĂUTARE');
    expect(result).toContain('SEARCH_FAILED');
    // After retries exhaust, the error message appears
    expect(result).toContain('Network error');
  });

  it('should format empty results with suggestions', async () => {
    mockWebSearchService.search.mockResolvedValueOnce(createMockSearchResults([]));

    const { handlers } = createJurisprudenceToolHandlers(testContext);

    const result = await handlers.search_jurisprudence({ query: 'obscure query' });

    expect(result).toContain('Nu s-au găsit rezultate');
    expect(result).toContain('Sugestii');
  });
});

// ============================================================================
// submit_jurisprudence_notes Handler Tests
// ============================================================================

describe('submit_jurisprudence_notes handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetCircuitBreakerMocks();
  });

  const validSubmitInput = {
    topic: 'Răspundere civilă delictuală',
    summary: 'Summary of findings',
    citations: [
      {
        id: 'src1',
        decisionNumber: '30/2020',
        court: 'ÎCCJ',
        url: 'https://rejust.ro/juris/123',
        summary: 'Decision summary',
        relevance: 'Relevant because...',
      },
    ],
    analysis: 'Analysis of the jurisprudence',
    gaps: ['No decisions after 2022'],
  };

  it('should capture valid output', async () => {
    // First search to track the URL
    mockWebSearchService.search.mockResolvedValueOnce(
      createMockSearchResults(['https://rejust.ro/juris/123'])
    );

    // Mock hexists to find the URL (Redis-backed URL tracker)
    mockRedis.hexists.mockResolvedValue(1);

    const { handlers, getOutput } = createJurisprudenceToolHandlers(testContext);

    // Search first to track URL
    await handlers.search_jurisprudence({ query: 'test' });

    // Now submit
    const result = await handlers.submit_jurisprudence_notes(validSubmitInput);

    expect(result).toContain('Nota jurisprudențială a fost primită');
    expect(result).toContain('Citări: 1');

    const output = getOutput();
    expect(output).not.toBeNull();
    expect(output?.topic).toBe('Răspundere civilă delictuală');
    expect(output?.citations.length).toBe(1);
    expect(output?.citations[0].verified).toBe(true);
  });

  it('should mark citations as verified when URL was in search results', async () => {
    mockWebSearchService.search.mockResolvedValueOnce(
      createMockSearchResults(['https://rejust.ro/juris/123'])
    );

    // Mock hexists to find the URL (Redis-backed URL tracker)
    mockRedis.hexists.mockResolvedValue(1);

    const { handlers, getOutput } = createJurisprudenceToolHandlers(testContext);

    await handlers.search_jurisprudence({ query: 'test' });
    await handlers.submit_jurisprudence_notes(validSubmitInput);

    const output = getOutput();
    expect(output?.citations[0].verified).toBe(true);
  });

  it('should mark citations as unverified when URL was NOT in search results', async () => {
    // Search with different URL
    mockWebSearchService.search.mockResolvedValueOnce(
      createMockSearchResults(['https://rejust.ro/juris/OTHER'])
    );

    const { handlers, getOutput } = createJurisprudenceToolHandlers(testContext);

    await handlers.search_jurisprudence({ query: 'test' });
    await handlers.submit_jurisprudence_notes(validSubmitInput);

    const output = getOutput();
    expect(output?.citations[0].verified).toBe(false);

    // Should log warning
    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[JurisprudenceAgent] Citation URL not from search results (flagged as unverified)',
      expect.any(Object)
    );
  });

  it('should reject citations from unknown domains', async () => {
    mockWebSearchService.search.mockResolvedValueOnce(createMockSearchResults([]));

    const { handlers, getOutput } = createJurisprudenceToolHandlers(testContext);

    await handlers.search_jurisprudence({ query: 'test' });

    const inputWithFakeUrl = {
      ...validSubmitInput,
      citations: [
        {
          ...validSubmitInput.citations[0],
          url: 'https://fake-legal-site.com/decision/123',
        },
      ],
    };

    await handlers.submit_jurisprudence_notes(inputWithFakeUrl);

    const output = getOutput();
    expect(output?.citations.length).toBe(0); // Citation rejected

    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[JurisprudenceAgent] Citation rejected: unknown domain',
      expect.any(Object)
    );
  });

  it('should reject citations with missing required fields via Zod validation', async () => {
    mockWebSearchService.search.mockResolvedValueOnce(createMockSearchResults([]));

    const { handlers } = createJurisprudenceToolHandlers(testContext);

    await handlers.search_jurisprudence({ query: 'test' });

    const inputWithInvalidCitation = {
      ...validSubmitInput,
      citations: [
        {
          id: 'src1',
          // Missing decisionNumber, court, url - Zod will reject this
          summary: 'Test',
          relevance: 'Test',
        },
      ],
    };

    // Zod validation should throw for missing required fields
    await expect(handlers.submit_jurisprudence_notes(inputWithInvalidCitation)).rejects.toThrow(
      'Validare eșuată'
    );
  });

  it('should validate input and reject invalid data', async () => {
    const { handlers } = createJurisprudenceToolHandlers(testContext);

    const invalidInput = {
      topic: '', // Empty topic should fail
      summary: 'Summary',
      citations: [],
      analysis: 'Analysis',
      gaps: [],
    };

    await expect(handlers.submit_jurisprudence_notes(invalidInput)).rejects.toThrow(
      'Validare eșuată'
    );
  });

  it('should log provenance statistics', async () => {
    mockWebSearchService.search.mockResolvedValueOnce(
      createMockSearchResults(['https://rejust.ro/juris/123'])
    );

    // Mock hexists: first URL tracked, second not
    mockRedis.hexists.mockImplementation((_key: string, normalizedUrl: string) => {
      if (normalizedUrl.includes('rejust.ro')) {
        return Promise.resolve(1); // Found
      }
      return Promise.resolve(0); // Not found
    });

    const { handlers } = createJurisprudenceToolHandlers(testContext);

    await handlers.search_jurisprudence({ query: 'test' });

    // Citation with tracked URL
    const inputWithMixedCitations = {
      ...validSubmitInput,
      citations: [
        {
          id: 'src1',
          decisionNumber: '30/2020',
          court: 'ÎCCJ',
          url: 'https://rejust.ro/juris/123', // Tracked
          summary: 'Summary 1',
          relevance: 'Relevance 1',
        },
        {
          id: 'src2',
          decisionNumber: '40/2021',
          court: 'CCR',
          url: 'https://ccr.ro/decizie/456', // Not tracked but valid domain
          summary: 'Summary 2',
          relevance: 'Relevance 2',
        },
      ],
    };

    await handlers.submit_jurisprudence_notes(inputWithMixedCitations);

    expect(mockLogger.info).toHaveBeenCalledWith(
      '[JurisprudenceAgent] Citation provenance summary',
      expect.objectContaining({
        inputCitations: 2,
        validCitations: 2,
        verified: 1,
        unverified: 1,
        skippedMissingFields: 0,
        skippedDuplicates: 0,
        skippedInvalidDomain: 0,
      })
    );
  });

  it('should warn on invalid date formats', async () => {
    mockWebSearchService.search.mockResolvedValueOnce(
      createMockSearchResults(['https://rejust.ro/juris/123'])
    );

    const { handlers } = createJurisprudenceToolHandlers(testContext);

    await handlers.search_jurisprudence({ query: 'test' });

    const inputWithInvalidDate = {
      ...validSubmitInput,
      citations: [
        {
          ...validSubmitInput.citations[0],
          date: 'not-a-date',
          dateFormatted: 'also-not-valid',
        },
      ],
    };

    await handlers.submit_jurisprudence_notes(inputWithInvalidDate);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[JurisprudenceAgent] Could not normalize ISO date, trying Romanian format',
      expect.any(Object)
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[JurisprudenceAgent] Could not normalize Romanian date',
      expect.any(Object)
    );
  });
});

// ============================================================================
// createJurisprudenceToolHandlers Tests
// ============================================================================

describe('createJurisprudenceToolHandlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetCircuitBreakerMocks();
  });

  it('should create handlers for both tools', () => {
    const { handlers } = createJurisprudenceToolHandlers(testContext);

    expect(handlers).toHaveProperty('search_jurisprudence');
    expect(handlers).toHaveProperty('submit_jurisprudence_notes');
    expect(typeof handlers.search_jurisprudence).toBe('function');
    expect(typeof handlers.submit_jurisprudence_notes).toBe('function');
  });

  it('should provide getOutput function', () => {
    const { getOutput } = createJurisprudenceToolHandlers(testContext);

    expect(typeof getOutput).toBe('function');
    expect(getOutput()).toBeNull(); // Initially null
  });

  it('should provide getSearchCount function', () => {
    const { getSearchCount } = createJurisprudenceToolHandlers(testContext);

    expect(typeof getSearchCount).toBe('function');
    expect(getSearchCount()).toBe(0); // Initially 0
  });

  it('should provide getTrackedUrls function', () => {
    const { getTrackedUrls } = createJurisprudenceToolHandlers(testContext);

    expect(typeof getTrackedUrls).toBe('function');
    expect(getTrackedUrls().size).toBe(0); // Initially empty
  });

  it('should accumulate tracked URLs across multiple searches', async () => {
    mockWebSearchService.search
      .mockResolvedValueOnce(createMockSearchResults(['https://rejust.ro/1']))
      .mockResolvedValueOnce(createMockSearchResults(['https://scj.ro/2']));

    const { handlers, getTrackedUrls } = createJurisprudenceToolHandlers(testContext);

    await handlers.search_jurisprudence({ query: 'first' });
    expect(getTrackedUrls().size).toBe(1);

    await handlers.search_jurisprudence({ query: 'second' });
    expect(getTrackedUrls().size).toBe(2);
    expect(getTrackedUrls().has('https://rejust.ro/1')).toBe(true);
    expect(getTrackedUrls().has('https://scj.ro/2')).toBe(true);
  });
});

// ============================================================================
// Rate Limiting Tests
// ============================================================================

describe('checkJurisprudenceRateLimit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetCircuitBreakerMocks();
  });

  it('should allow request when under rate limit', async () => {
    const newCount = 5; // After atomic increment
    mockRedis.incr.mockResolvedValueOnce(newCount);
    mockRedis.ttl.mockResolvedValueOnce(1800); // 30 minutes remaining

    const result = await checkJurisprudenceRateLimit('user-123');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(JURISPRUDENCE_CONSTRAINTS.RATE_LIMIT_REQUESTS - newCount);
    expect(mockRedis.incr).toHaveBeenCalledWith('jurisprudence:rate:user-123');
  });

  it('should deny request when rate limit exceeded', async () => {
    const maxRequests = JURISPRUDENCE_CONSTRAINTS.RATE_LIMIT_REQUESTS;
    // Atomic increment returns count > maxRequests (over limit)
    mockRedis.incr.mockResolvedValueOnce(maxRequests + 1);
    mockRedis.ttl.mockResolvedValueOnce(1800); // 30 minutes until reset

    const result = await checkJurisprudenceRateLimit('user-123');

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    // With atomic approach, incr IS called (increment-then-check)
    expect(mockRedis.incr).toHaveBeenCalledWith('jurisprudence:rate:user-123');
  });

  it('should set expiry on first request', async () => {
    mockRedis.incr.mockResolvedValueOnce(1); // First request
    mockRedis.ttl.mockResolvedValueOnce(JURISPRUDENCE_CONSTRAINTS.RATE_LIMIT_WINDOW_SECONDS);

    const result = await checkJurisprudenceRateLimit('user-123');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(JURISPRUDENCE_CONSTRAINTS.RATE_LIMIT_REQUESTS - 1);
    expect(mockRedis.expire).toHaveBeenCalledWith(
      'jurisprudence:rate:user-123',
      JURISPRUDENCE_CONSTRAINTS.RATE_LIMIT_WINDOW_SECONDS
    );
  });

  it('should return correct reset time', async () => {
    const ttlSeconds = 1800; // 30 minutes
    mockRedis.incr.mockResolvedValueOnce(6);
    mockRedis.ttl.mockResolvedValueOnce(ttlSeconds);

    const before = Date.now();
    const result = await checkJurisprudenceRateLimit('user-123');
    const after = Date.now();

    // resetAt should be approximately now + ttl seconds
    const resetTime = result.resetAt.getTime();
    const expectedMinReset = before + ttlSeconds * 1000;
    const expectedMaxReset = after + ttlSeconds * 1000 + 1000; // 1s tolerance

    expect(resetTime).toBeGreaterThanOrEqual(expectedMinReset - 1000);
    expect(resetTime).toBeLessThanOrEqual(expectedMaxReset);
  });

  it('should handle first request gracefully (incr returns 1)', async () => {
    mockRedis.incr.mockResolvedValueOnce(1);
    mockRedis.ttl.mockResolvedValueOnce(3600);

    const result = await checkJurisprudenceRateLimit('user-123');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(JURISPRUDENCE_CONSTRAINTS.RATE_LIMIT_REQUESTS - 1);
    // Should set expiry since it's the first request
    expect(mockRedis.expire).toHaveBeenCalled();
  });

  it('should handle exact limit boundary', async () => {
    const maxRequests = JURISPRUDENCE_CONSTRAINTS.RATE_LIMIT_REQUESTS;
    // Atomic increment returns exactly maxRequests (at limit, but still allowed)
    mockRedis.incr.mockResolvedValueOnce(maxRequests);
    mockRedis.ttl.mockResolvedValueOnce(3600);

    const result = await checkJurisprudenceRateLimit('user-123');

    expect(result.allowed).toBe(true); // This request was allowed (count <= max)
    expect(result.remaining).toBe(0); // But no more remaining
  });

  it('should use atomic increment to prevent race conditions', async () => {
    // This test verifies the atomic pattern:
    // Even if two requests come simultaneously, they get different counts
    const maxRequests = JURISPRUDENCE_CONSTRAINTS.RATE_LIMIT_REQUESTS;

    // First concurrent request gets count = maxRequests (allowed)
    mockRedis.incr.mockResolvedValueOnce(maxRequests);
    mockRedis.ttl.mockResolvedValueOnce(3600);
    const result1 = await checkJurisprudenceRateLimit('user-123');

    // Second concurrent request gets count = maxRequests + 1 (denied)
    mockRedis.incr.mockResolvedValueOnce(maxRequests + 1);
    mockRedis.ttl.mockResolvedValueOnce(3600);
    const result2 = await checkJurisprudenceRateLimit('user-123');

    expect(result1.allowed).toBe(true);
    expect(result2.allowed).toBe(false);
    // Both called incr (atomic increment pattern)
    expect(mockRedis.incr).toHaveBeenCalledTimes(2);
  });
});

// ============================================================================
// Redis Integration Tests (Caching)
// ============================================================================

describe('Redis caching behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no cache
    mockRedis.get.mockResolvedValue(null);
    mockRedis.setex.mockResolvedValue('OK');
  });

  it('should cache search results in Redis', async () => {
    mockWebSearchService.search.mockResolvedValueOnce(
      createMockSearchResults(['https://rejust.ro/juris/123'])
    );

    const { handlers } = createJurisprudenceToolHandlers(testContext);
    await handlers.search_jurisprudence({ query: 'răspundere civilă' });

    // Should have attempted to cache the result
    expect(mockRedis.setex).toHaveBeenCalledWith(
      expect.stringContaining('jurisprudence:search:'),
      JURISPRUDENCE_CONSTRAINTS.SEARCH_CACHE_TTL_SECONDS,
      expect.any(String)
    );

    // Verify the cached content includes required fields
    const cachedCall = mockRedis.setex.mock.calls[0];
    const cachedData = JSON.parse(cachedCall[2]);
    expect(cachedData.results).toBeDefined();
    expect(cachedData.cachedAt).toBeDefined();
  });

  it('should return cached results on cache hit', async () => {
    const cachedResponse = {
      query: 'test query',
      results: [{ title: 'Cached Result', url: 'https://rejust.ro/cached', snippet: 'From cache' }],
      cachedAt: new Date().toISOString(),
    };

    mockRedis.get.mockResolvedValueOnce(JSON.stringify(cachedResponse));

    const progressEvents: { type: string }[] = [];
    const { handlers, getTrackedUrls } = createJurisprudenceToolHandlers(testContext, (event) => {
      progressEvents.push(event);
    });

    const result = await handlers.search_jurisprudence({ query: 'test query' });

    // Should not have called the search service
    expect(mockWebSearchService.search).not.toHaveBeenCalled();

    // Should return cached results
    expect(result).toContain('Cached Result');
    expect(result).toContain('rejust.ro');

    // Should emit cache_hit progress event
    expect(progressEvents.some((e) => e.type === 'cache_hit')).toBe(true);

    // Cached URLs should still be tracked for provenance
    const trackedUrls = getTrackedUrls();
    expect(trackedUrls.has('https://rejust.ro/cached')).toBe(true);
  });

  it('should call search service on cache miss', async () => {
    mockRedis.get.mockResolvedValueOnce(null); // Cache miss
    mockWebSearchService.search.mockResolvedValueOnce(
      createMockSearchResults(['https://scj.ro/fresh'])
    );

    const progressEvents: { type: string }[] = [];
    const { handlers } = createJurisprudenceToolHandlers(testContext, (event) => {
      progressEvents.push(event);
    });

    await handlers.search_jurisprudence({ query: 'new query' });

    // Should have called search service
    expect(mockWebSearchService.search).toHaveBeenCalled();

    // Should not have cache_hit event
    expect(progressEvents.some((e) => e.type === 'cache_hit')).toBe(false);
  });

  it('should generate consistent cache keys for same parameters', async () => {
    mockWebSearchService.search.mockResolvedValue(createMockSearchResults([]));

    const { handlers } = createJurisprudenceToolHandlers(testContext);

    // First search
    await handlers.search_jurisprudence({ query: 'test', courts: ['ÎCCJ', 'CCR'] });
    const firstCacheKey = mockRedis.setex.mock.calls[0][0];

    jest.clearAllMocks();
    mockRedis.get.mockResolvedValue(null);

    // Second search with same params (order matters)
    await handlers.search_jurisprudence({ query: 'test', courts: ['ÎCCJ', 'CCR'] });
    const secondCacheKey = mockRedis.setex.mock.calls[0][0];

    expect(firstCacheKey).toBe(secondCacheKey);
  });

  it('should generate different cache keys for different parameters', async () => {
    mockWebSearchService.search.mockResolvedValue(createMockSearchResults([]));

    const { handlers } = createJurisprudenceToolHandlers(testContext);

    // First search
    await handlers.search_jurisprudence({ query: 'test', courts: ['ÎCCJ'] });
    const firstCacheKey = mockRedis.setex.mock.calls[0][0];

    jest.clearAllMocks();
    mockRedis.get.mockResolvedValue(null);

    // Different courts
    await handlers.search_jurisprudence({ query: 'test', courts: ['CCR'] });
    const secondCacheKey = mockRedis.setex.mock.calls[0][0];

    expect(firstCacheKey).not.toBe(secondCacheKey);
  });

  it('should include year range in cache key', async () => {
    mockWebSearchService.search.mockResolvedValue(createMockSearchResults([]));

    const { handlers } = createJurisprudenceToolHandlers(testContext);

    // Without year range
    await handlers.search_jurisprudence({ query: 'test' });
    const keyWithoutYear = mockRedis.setex.mock.calls[0][0];

    jest.clearAllMocks();
    mockRedis.get.mockResolvedValue(null);

    // With year range
    await handlers.search_jurisprudence({ query: 'test', yearRange: { from: 2020, to: 2024 } });
    const keyWithYear = mockRedis.setex.mock.calls[0][0];

    expect(keyWithoutYear).not.toBe(keyWithYear);
  });

  it('should handle corrupted cache gracefully', async () => {
    // Return invalid JSON that will fail to parse
    mockRedis.get.mockResolvedValueOnce('{ invalid json }}}');
    mockWebSearchService.search.mockResolvedValueOnce(
      createMockSearchResults(['https://rejust.ro/fresh'])
    );

    const { handlers } = createJurisprudenceToolHandlers(testContext);

    const result = await handlers.search_jurisprudence({ query: 'test query' });

    // Should have logged a warning about cache corruption
    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[JurisprudenceAgent] Cache corrupted, fetching fresh results',
      expect.any(Object)
    );

    // Should have called the search service (fallback)
    expect(mockWebSearchService.search).toHaveBeenCalled();

    // Should return fresh results
    expect(result).toContain('rejust.ro');
  });

  it('should handle cache with invalid structure', async () => {
    // Return valid JSON but with missing results field
    mockRedis.get.mockResolvedValueOnce(JSON.stringify({ query: 'test', cachedAt: '2024-01-01' }));
    mockWebSearchService.search.mockResolvedValueOnce(
      createMockSearchResults(['https://scj.ro/fresh'])
    );

    const { handlers } = createJurisprudenceToolHandlers(testContext);

    const result = await handlers.search_jurisprudence({ query: 'test query' });

    // Should have logged a warning about invalid cache structure
    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[JurisprudenceAgent] Cache corrupted, fetching fresh results',
      expect.any(Object)
    );

    // Should return fresh results
    expect(result).toContain('scj.ro');
  });
});

// ============================================================================
// Rate Limiting TTL Edge Cases
// ============================================================================

describe('checkJurisprudenceRateLimit TTL edge cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetCircuitBreakerMocks();
  });

  it('should handle TTL returning -1 (key has no expiry)', async () => {
    mockRedis.incr.mockResolvedValueOnce(6);
    mockRedis.ttl.mockResolvedValueOnce(-1); // No expiry set

    const result = await checkJurisprudenceRateLimit('user-123');

    expect(result.allowed).toBe(true);
    // Should use default window instead of -1
    expect(result.resetAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('should handle TTL returning -2 (key does not exist)', async () => {
    mockRedis.incr.mockResolvedValueOnce(6);
    mockRedis.ttl.mockResolvedValueOnce(-2); // Key doesn't exist

    const result = await checkJurisprudenceRateLimit('user-123');

    expect(result.allowed).toBe(true);
    // Should use default window instead of -2
    expect(result.resetAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('should handle TTL returning -1 when rate limited', async () => {
    const maxRequests = JURISPRUDENCE_CONSTRAINTS.RATE_LIMIT_REQUESTS;
    // Atomic increment returns over limit
    mockRedis.incr.mockResolvedValueOnce(maxRequests + 1);
    mockRedis.ttl.mockResolvedValueOnce(-1); // No expiry (edge case)

    const result = await checkJurisprudenceRateLimit('user-123');

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    // Should still produce valid reset time using default window
    expect(result.resetAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('should handle TTL returning 0', async () => {
    mockRedis.incr.mockResolvedValueOnce(6);
    mockRedis.ttl.mockResolvedValueOnce(0); // Key about to expire

    const result = await checkJurisprudenceRateLimit('user-123');

    expect(result.allowed).toBe(true);
    // Should use default window instead of 0
    expect(result.resetAt.getTime()).toBeGreaterThan(Date.now());
  });
});

// ============================================================================
// URL Normalization Edge Cases
// ============================================================================

describe('URL normalization with percent-encoding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis.get.mockResolvedValue(null);
    mockWebSearchService.search.mockResolvedValue(createMockSearchResults([]));
  });

  it('should treat percent-encoded and decoded URLs as equivalent for provenance', async () => {
    // Search returns URL with percent encoding
    mockWebSearchService.search.mockResolvedValueOnce(
      createMockSearchResults(['https://rejust.ro/juris/test%2Fpath'])
    );

    // Mock hexists to return 1 (found) - URL tracker uses normalized URLs
    mockRedis.hexists.mockResolvedValue(1);

    const { handlers, getOutput, getTrackedUrls } = createJurisprudenceToolHandlers(testContext);

    await handlers.search_jurisprudence({ query: 'test' });

    // Verify the URL is tracked in local cache
    const trackedUrls = getTrackedUrls();
    expect(trackedUrls.size).toBe(1);

    // Submit citation with non-encoded URL (same path)
    await handlers.submit_jurisprudence_notes({
      topic: 'Test topic',
      summary: 'Test summary',
      citations: [
        {
          id: 'src1',
          decisionNumber: '30/2020',
          court: 'ÎCCJ',
          url: 'https://rejust.ro/juris/test/path', // Non-encoded version
          summary: 'Summary',
          relevance: 'Relevance',
        },
      ],
      analysis: 'Analysis',
      gaps: [],
    });

    const output = getOutput();
    // The citation should be verified because normalized URLs match
    expect(output?.citations[0].verified).toBe(true);
  });
});

// ============================================================================
// RedisUrlTracker Tests (Redis-backed URL tracking)
// ============================================================================

describe('RedisUrlTracker (Redis-backed URL tracking)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetCircuitBreakerMocks();
  });

  it('should store tracked URLs in Redis hash', async () => {
    mockWebSearchService.search.mockResolvedValueOnce(
      createMockSearchResults(['https://rejust.ro/juris/123'])
    );

    const { handlers } = createJurisprudenceToolHandlers(testContext);

    await handlers.search_jurisprudence({ query: 'test' });

    // Should have called hset to store URL in Redis
    expect(mockRedis.hset).toHaveBeenCalledWith(
      expect.stringContaining('jurisprudence:urls:'),
      expect.any(String),
      expect.any(String)
    );
  });

  it('should set TTL on Redis hash for URL tracking', async () => {
    mockWebSearchService.search.mockResolvedValueOnce(
      createMockSearchResults(['https://rejust.ro/juris/123'])
    );

    const { handlers } = createJurisprudenceToolHandlers(testContext);

    await handlers.search_jurisprudence({ query: 'test' });

    // Should have set expiry on the URL tracking hash
    expect(mockRedis.expire).toHaveBeenCalledWith(
      expect.stringContaining('jurisprudence:urls:'),
      expect.any(Number)
    );
  });

  it('should accumulate URLs in local cache across searches', async () => {
    mockWebSearchService.search
      .mockResolvedValueOnce(createMockSearchResults(['https://rejust.ro/1']))
      .mockResolvedValueOnce(createMockSearchResults(['https://scj.ro/2']));

    const { handlers, getTrackedUrls } = createJurisprudenceToolHandlers(testContext);

    await handlers.search_jurisprudence({ query: 'first' });
    expect(getTrackedUrls().size).toBe(1);

    await handlers.search_jurisprudence({ query: 'second' });
    expect(getTrackedUrls().size).toBe(2);
  });

  it('should check Redis for URLs from other instances during verification', async () => {
    mockWebSearchService.search.mockResolvedValueOnce(createMockSearchResults([]));

    // URL not in local cache but exists in Redis (tracked by another instance)
    mockRedis.hexists.mockResolvedValue(1);

    const { handlers, getOutput } = createJurisprudenceToolHandlers(testContext);

    await handlers.search_jurisprudence({ query: 'test' });

    // Submit citation with URL that's only in Redis (not local cache)
    await handlers.submit_jurisprudence_notes({
      topic: 'Test topic',
      summary: 'Test summary',
      citations: [
        {
          id: 'src1',
          decisionNumber: '30/2020',
          court: 'ÎCCJ',
          url: 'https://rejust.ro/juris/from-other-instance',
          summary: 'Summary',
          relevance: 'Relevance',
        },
      ],
      analysis: 'Analysis',
      gaps: [],
    });

    const output = getOutput();
    // Should be verified because hexists returned 1
    expect(output?.citations[0].verified).toBe(true);
    expect(mockRedis.hexists).toHaveBeenCalled();
  });

  it('should maintain citation verification with Redis-backed tracking', async () => {
    // First search returns a URL
    mockWebSearchService.search.mockResolvedValueOnce(
      createMockSearchResults(['https://rejust.ro/juris/important'])
    );

    // Mock hexists to find the URL
    mockRedis.hexists.mockResolvedValue(1);

    const { handlers, getOutput, getTrackedUrls } = createJurisprudenceToolHandlers(testContext);

    // Search to track the URL
    await handlers.search_jurisprudence({ query: 'test' });
    expect(getTrackedUrls().has('https://rejust.ro/juris/important')).toBe(true);

    // Submit a citation with the tracked URL
    await handlers.submit_jurisprudence_notes({
      topic: 'Test topic',
      summary: 'Test summary',
      citations: [
        {
          id: 'src1',
          decisionNumber: '30/2020',
          court: 'ÎCCJ',
          url: 'https://rejust.ro/juris/important',
          summary: 'Summary',
          relevance: 'Relevance',
        },
      ],
      analysis: 'Analysis',
      gaps: [],
    });

    const output = getOutput();
    expect(output?.citations[0].verified).toBe(true);
  });

  it('should gracefully handle Redis errors during URL tracking', async () => {
    mockWebSearchService.search.mockResolvedValueOnce(
      createMockSearchResults(['https://rejust.ro/juris/123'])
    );

    // Simulate Redis error on hset
    mockRedis.hset.mockRejectedValue(new Error('Redis connection error'));

    const { handlers, getTrackedUrls } = createJurisprudenceToolHandlers(testContext);

    // Should not throw - gracefully falls back to local cache
    await expect(handlers.search_jurisprudence({ query: 'test' })).resolves.not.toThrow();

    // Local cache should still work
    expect(getTrackedUrls().size).toBe(1);

    // Should have logged warning
    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[JurisprudenceAgent] Failed to sync URL to Redis',
      expect.any(Object)
    );
  });
});

// ============================================================================
// Redis-based Circuit Breaker Tests
// ============================================================================

describe('Redis-based circuit breaker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetCircuitBreakerMocks();
  });

  it('should allow requests when circuit is closed (no opened_at key)', async () => {
    mockRedis.get.mockResolvedValue(null); // No circuit state = closed
    mockWebSearchService.search.mockResolvedValueOnce(
      createMockSearchResults(['https://rejust.ro/juris/1'])
    );

    const { handlers } = createJurisprudenceToolHandlers(testContext);
    const result = await handlers.search_jurisprudence({ query: 'test query' });

    expect(result).toContain('Rezultate căutare');
    expect(mockWebSearchService.search).toHaveBeenCalled();
  });

  it('should block requests when circuit is open', async () => {
    // Simulate open circuit
    const openedAt = Date.now() - 5000; // Opened 5 seconds ago
    mockRedis.get.mockImplementation((key: string) => {
      if (key === 'jurisprudence:circuit:opened_at') {
        return Promise.resolve(String(openedAt));
      }
      return Promise.resolve(null);
    });

    const { handlers } = createJurisprudenceToolHandlers(testContext);
    const result = await handlers.search_jurisprudence({ query: 'test query' });

    expect(result).toContain('EROARE_CĂUTARE');
    expect(result).toContain('temporar indisponibil');
    expect(mockWebSearchService.search).not.toHaveBeenCalled();
  });

  it('should allow half-open test request after reset timeout', async () => {
    // Simulate circuit that was opened long ago (past reset timeout)
    const openedAt = Date.now() - 60000; // Opened 60 seconds ago (past 30s timeout)
    mockRedis.get.mockImplementation((key: string) => {
      if (key === 'jurisprudence:circuit:opened_at') {
        return Promise.resolve(String(openedAt));
      }
      return Promise.resolve(null);
    });
    mockWebSearchService.search.mockResolvedValueOnce(
      createMockSearchResults(['https://rejust.ro/juris/1'])
    );

    const { handlers } = createJurisprudenceToolHandlers(testContext);
    const result = await handlers.search_jurisprudence({ query: 'test query' });

    // Should allow the test request
    expect(result).toContain('Rezultate căutare');
    expect(mockWebSearchService.search).toHaveBeenCalled();
  });

  it('should reset circuit state on successful request', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockWebSearchService.search.mockResolvedValueOnce(
      createMockSearchResults(['https://rejust.ro/juris/1'])
    );

    const { handlers } = createJurisprudenceToolHandlers(testContext);
    await handlers.search_jurisprudence({ query: 'test query' });

    // Should have called del to clear circuit breaker state
    expect(mockRedis.del).toHaveBeenCalledWith('jurisprudence:circuit:failures');
    expect(mockRedis.del).toHaveBeenCalledWith('jurisprudence:circuit:opened_at');
  });

  it('should increment failure counter on failed request', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.incr.mockResolvedValue(1);
    mockWebSearchService.search.mockRejectedValue(new Error('Network error'));

    const { handlers } = createJurisprudenceToolHandlers(testContext);
    const result = await handlers.search_jurisprudence({ query: 'test query' });

    expect(result).toContain('EROARE_CĂUTARE');
    // Should have called incr for circuit breaker failures
    expect(mockRedis.incr).toHaveBeenCalledWith('jurisprudence:circuit:failures');
  });

  it('should fail open on Redis errors (allow requests)', async () => {
    // Simulate Redis error
    mockRedis.get.mockRejectedValue(new Error('Redis connection error'));
    mockWebSearchService.search.mockResolvedValueOnce(
      createMockSearchResults(['https://rejust.ro/juris/1'])
    );

    const { handlers } = createJurisprudenceToolHandlers(testContext);
    const result = await handlers.search_jurisprudence({ query: 'test query' });

    // Should still allow the request (fail open)
    expect(result).toContain('Rezultate căutare');
    expect(mockWebSearchService.search).toHaveBeenCalled();

    // Should have logged a warning
    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[JurisprudenceAgent] Circuit breaker Redis check failed, failing open',
      expect.any(Object)
    );
  });
});
