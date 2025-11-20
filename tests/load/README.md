# Skills Load Testing Framework

**Story 2.14 - Task 1: Load Testing**

## Overview

This directory contains Artillery-based load testing infrastructure for validating skills performance under load.

## Performance Requirements

- **AC#4**: Response time <5s at p95
- **AC#6**: Error rate <2%
- **Target Load**: 1000 requests/minute sustained
- **Concurrent Users**: 100

## Usage

### Run Local Load Test

```bash
# Start the local server first
npm run dev

# Run load test against local server
npm run test:load
```

### Run Staging Load Test

```bash
npm run test:load:staging
```

### Run Production Load Test

```bash
# ⚠️ Use with caution - will generate real load
npm run test:load:production
```

### Generate HTML Report

```bash
# After running load test
npm run test:load:report
```

## Test Scenarios

The load test includes 4 weighted scenarios:

1. **Contract Analysis** (40% of traffic)
   - Tests skill-enhanced contract analysis
   - Romanian contract content

2. **Document Drafting** (30% of traffic)
   - Tests template-based document generation
   - Uses `contract_servicii_ro` template

3. **Legal Research** (20% of traffic)
   - Tests Romanian legal research queries
   - Jurisdiction-aware queries

4. **Compliance Check** (10% of traffic)
   - Tests compliance validation
   - Multiple regulation checks (Codul Muncii, GDPR)

## Load Test Phases

1. **Warm-up**: 60s @ 10 req/s
2. **Ramp-up**: 300s @ 10-100 req/s
3. **Sustained Load**: 600s @ 100 req/s (target)
4. **Spike Test**: 60s @ 200 req/s
5. **Cool-down**: 120s @ 10 req/s

**Total Duration**: ~20 minutes

## Performance Assertions

The test automatically validates:

- ✅ P95 response time <5000ms
- ✅ P99 response time <10000ms
- ✅ Error rate <2%
- ✅ Success rate >98%

## Results

Results are saved to `tests/load/results/`:

- `report.json` - Raw Artillery results
- `load-test-metrics.json` - Custom metrics summary
- `report.html` - Visual HTML report

## Custom Metrics Tracked

The custom processor tracks:

- Execution times (p50, p95, p99, average)
- Token usage (total, average, min, max)
- Cost metrics (total, average)
- Error rates and timeouts
- Memory usage

## Performance Budget Validation

Results are automatically validated against performance budgets defined in:

`services/ai-service/src/config/performance-budget.ts`

Violations are reported in the console output.

## Environment Variables

- `TARGET_URL` - Base URL for load test (default: `http://localhost:3000`)
- `LOAD_TEST_DURATION` - Override test duration
- `LOAD_TEST_ARRIVAL_RATE` - Override arrival rate

## Example Output

```
=== Load Test Summary ===
Total Requests: 60000
Success Rate: 98.50%
Error Rate: 1.50%
Timeout Rate: 0.25%

Performance Metrics:
  P50 Response Time: 3200.00ms
  P95 Response Time: 4800.00ms
  P99 Response Time: 8500.00ms
  Average Response Time: 3500.00ms

Cost Metrics:
  Average Cost: $0.0145
  Total Cost: $870.00

Token Usage:
  Average Tokens: 2500
  Total Tokens: 150000000

=== Performance Budget Validation ===
✅ All performance budgets met
```

## Troubleshooting

### High Error Rates

- Check server logs for errors
- Verify skills are deployed and cached
- Check database connection pool size
- Monitor Redis cache performance

### Slow Response Times

- Profile skill execution time
- Check routing overhead
- Verify cache hit rates
- Monitor Claude API latency

### Timeouts

- Increase skill timeout configuration
- Check for long-running skills
- Monitor memory usage
- Review skill complexity

## Integration with CI/CD

Load tests can be integrated into deployment pipeline:

```yaml
# .github/workflows/load-test.yml
- name: Run Load Test
  run: npm run test:load:staging

- name: Validate Performance
  run: |
    if grep -q "Performance budget violations" tests/load/results/load-test-metrics.json; then
      echo "Performance budget violations detected"
      exit 1
    fi
```

## See Also

- Performance Budget: `services/ai-service/src/config/performance-budget.ts`
- Story Documentation: `docs/stories/2.14.story.md`
- Monitoring Setup: `docs/runbooks/skills-deployment.md`
