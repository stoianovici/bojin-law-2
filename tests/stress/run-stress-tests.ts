/**
 * Stress Test Runner
 * Story 3.8: Document System Testing and Performance - Tasks 8-9
 *
 * Runs stress tests for:
 * - Large document operations (10, 50, 100, 200 pages)
 * - Concurrent operations (500 reads, 100 writes, 50 AI operations)
 */

import * as fs from 'fs';
import * as path from 'path';

// Import individual stress test modules
import { runLargeDocumentStressTests, LargeDocumentResults } from './large-documents';
import { runConcurrentOperationsStressTests, ConcurrentOperationsResults } from './concurrent-operations';

interface StressTestReport {
  timestamp: string;
  environment: string;
  largeDocuments: LargeDocumentResults;
  concurrentOperations: ConcurrentOperationsResults;
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    totalDurationMs: number;
  };
}

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║      Document System Stress Tests                    ║');
  console.log('║          Story 3.8 - Tasks 8-9                       ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  const startTime = performance.now();

  // Run large document stress tests
  console.log('\n[Phase 1] Large Document Stress Tests');
  const largeDocResults = await runLargeDocumentStressTests();

  // Run concurrent operations stress tests
  console.log('\n[Phase 2] Concurrent Operations Stress Tests');
  const concurrentResults = await runConcurrentOperationsStressTests();

  const totalDurationMs = performance.now() - startTime;

  // Calculate summary
  const totalTests =
    largeDocResults.tests.length + concurrentResults.tests.length;
  const passed =
    largeDocResults.tests.filter((t) => t.passed).length +
    concurrentResults.tests.filter((t) => t.passed).length;
  const failed = totalTests - passed;

  // Generate report
  const report: StressTestReport = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    largeDocuments: largeDocResults,
    concurrentOperations: concurrentResults,
    summary: {
      totalTests,
      passed,
      failed,
      totalDurationMs,
    },
  };

  // Save report
  const resultsDir = path.join(__dirname, 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const reportPath = path.join(resultsDir, `stress-test-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Also save as latest
  const latestPath = path.join(resultsDir, 'stress-test-latest.json');
  fs.writeFileSync(latestPath, JSON.stringify(report, null, 2));

  // Print summary
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║              Stress Test Summary                     ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`  Total tests: ${totalTests}`);
  console.log(`  Passed: ${passed} ✓`);
  console.log(`  Failed: ${failed} ${failed > 0 ? '✗' : ''}`);
  console.log(`  Duration: ${(totalDurationMs / 1000).toFixed(2)}s`);
  console.log(`  Report: ${reportPath}`);

  // Exit with error if any test failed
  if (failed > 0) {
    console.error('\n❌ Some stress tests failed');
    process.exit(1);
  }

  console.log('\n✅ All stress tests passed');
}

main().catch((error) => {
  console.error('Stress test runner failed:', error);
  process.exit(1);
});
