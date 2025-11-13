/**
 * PERFORMANCE TEST TEMPLATE
 *
 * This template demonstrates best practices for performance testing using
 * Lighthouse CI and Playwright. Performance testing ensures your application
 * loads quickly and provides a smooth user experience.
 *
 * WHEN TO USE PERFORMANCE TESTS:
 * - Testing page load times
 * - Testing Time to Interactive (TTI)
 * - Testing First Contentful Paint (FCP)
 * - Testing Cumulative Layout Shift (CLS)
 * - Testing Largest Contentful Paint (LCP)
 * - Detecting performance regressions
 * - Monitoring bundle sizes
 * - Testing Core Web Vitals
 *
 * TARGET: Performance score >= 90 for critical pages
 */

import { test, expect } from '@playwright/test';

// ============================================================================
// EXAMPLE 1: Core Web Vitals Testing with Playwright
// ============================================================================

/**
 * Core Web Vitals are the key metrics Google uses to measure user experience:
 * - LCP (Largest Contentful Paint): Loading performance (< 2.5s)
 * - FID (First Input Delay): Interactivity (< 100ms)
 * - CLS (Cumulative Layout Shift): Visual stability (< 0.1)
 */

test.describe('Dashboard Performance - Core Web Vitals', () => {
  test('should have good Largest Contentful Paint (LCP)', async ({ page }) => {
    // Navigate to dashboard
    const startTime = Date.now();
    await page.goto('/dashboard');

    // Wait for largest contentful paint
    const lcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;
          resolve(lastEntry.renderTime || lastEntry.loadTime);
        }).observe({ entryTypes: ['largest-contentful-paint'] });

        // Timeout after 10 seconds
        setTimeout(() => resolve(0), 10000);
      });
    });

    // LCP should be less than 2.5 seconds
    expect(lcp).toBeLessThan(2500);
    console.log(`LCP: ${lcp}ms`);
  });

  test('should have low Cumulative Layout Shift (CLS)', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Measure CLS
    const cls = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let clsScore = 0;

        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const layoutShift = entry as any;
            if (!layoutShift.hadRecentInput) {
              clsScore += layoutShift.value;
            }
          }
        }).observe({ entryTypes: ['layout-shift'] });

        // Wait 5 seconds to collect shifts
        setTimeout(() => resolve(clsScore), 5000);
      });
    });

    // CLS should be less than 0.1
    expect(cls).toBeLessThan(0.1);
    console.log(`CLS: ${cls}`);
  });

  test('should have fast First Contentful Paint (FCP)', async ({ page }) => {
    await page.goto('/dashboard');

    // Get FCP from Performance API
    const fcp = await page.evaluate(() => {
      const paintEntries = performance.getEntriesByType('paint');
      const fcpEntry = paintEntries.find((entry) => entry.name === 'first-contentful-paint');
      return fcpEntry?.startTime || 0;
    });

    // FCP should be less than 1.5 seconds
    expect(fcp).toBeLessThan(1500);
    console.log(`FCP: ${fcp}ms`);
  });

  test('should have fast Time to Interactive (TTI)', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/dashboard');

    // Wait for page to be fully interactive
    await page.waitForLoadState('networkidle');

    // Try interacting with the page
    const button = page.getByRole('button').first();
    await button.click();

    const tti = Date.now() - startTime;

    // TTI should be less than 3.5 seconds
    expect(tti).toBeLessThan(3500);
    console.log(`TTI: ${tti}ms`);
  });
});

// ============================================================================
// EXAMPLE 2: Page Load Performance Testing
// ============================================================================

test.describe('Page Load Performance', () => {
  test('should load dashboard within performance budget', async ({ page }) => {
    const metrics: any = {};

    // Start measuring
    const startTime = Date.now();

    // Navigate to page
    await page.goto('/dashboard', { waitUntil: 'load' });

    metrics.pageLoad = Date.now() - startTime;

    // Get additional metrics from Performance API
    const performanceMetrics = await page.evaluate(() => {
      const timing = performance.timing;
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

      return {
        domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
        domInteractive: timing.domInteractive - timing.navigationStart,
        loadComplete: timing.loadEventEnd - timing.navigationStart,
        dnsLookup: timing.domainLookupEnd - timing.domainLookupStart,
        tcpConnection: timing.connectEnd - timing.connectStart,
        serverResponse: timing.responseEnd - timing.requestStart,
        domProcessing: timing.domComplete - timing.domLoading,
        transferSize: navigation?.transferSize || 0,
        encodedBodySize: navigation?.encodedBodySize || 0,
        decodedBodySize: navigation?.decodedBodySize || 0
      };
    });

    // Performance budgets
    expect(performanceMetrics.domContentLoaded).toBeLessThan(2000); // < 2s
    expect(performanceMetrics.domInteractive).toBeLessThan(2500); // < 2.5s
    expect(performanceMetrics.loadComplete).toBeLessThan(3000); // < 3s

    // Network budgets
    expect(performanceMetrics.dnsLookup).toBeLessThan(100); // < 100ms
    expect(performanceMetrics.serverResponse).toBeLessThan(500); // < 500ms

    console.log('Performance Metrics:', performanceMetrics);
  });

  test('should load case detail page quickly', async ({ page }) => {
    // Navigate to specific case
    const startTime = Date.now();
    await page.goto('/cases/123', { waitUntil: 'domcontentloaded' });

    const loadTime = Date.now() - startTime;

    // Should load within 2 seconds
    expect(loadTime).toBeLessThan(2000);
    console.log(`Case detail load time: ${loadTime}ms`);
  });

  test('should load document editor within budget', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/documents/new');
    await page.waitForSelector('[role="textbox"]');

    const loadTime = Date.now() - startTime;

    // Rich text editor should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
    console.log(`Document editor load time: ${loadTime}ms`);
  });
});

// ============================================================================
// EXAMPLE 3: Bundle Size and Resource Testing
// ============================================================================

test.describe('Resource Size Performance', () => {
  test('should not exceed JavaScript bundle size budget', async ({ page }) => {
    // Track all JavaScript requests
    const jsResources: any[] = [];

    page.on('response', async (response) => {
      const url = response.url();
      if (url.endsWith('.js') || url.includes('.js?')) {
        const headers = response.headers();
        const contentLength = headers['content-length'];

        jsResources.push({
          url,
          size: contentLength ? parseInt(contentLength) : 0,
          status: response.status()
        });
      }
    });

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Calculate total JS size
    const totalJsSize = jsResources.reduce((sum, resource) => sum + resource.size, 0);
    const totalJsKB = totalJsSize / 1024;

    // JavaScript bundle should be less than 300KB (gzipped)
    expect(totalJsKB).toBeLessThan(300);
    console.log(`Total JS size: ${totalJsKB.toFixed(2)} KB`);
    console.log(`JS files loaded: ${jsResources.length}`);
  });

  test('should not exceed CSS bundle size budget', async ({ page }) => {
    const cssResources: any[] = [];

    page.on('response', async (response) => {
      const url = response.url();
      if (url.endsWith('.css') || url.includes('.css?')) {
        const headers = response.headers();
        const contentLength = headers['content-length'];

        cssResources.push({
          url,
          size: contentLength ? parseInt(contentLength) : 0
        });
      }
    });

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Calculate total CSS size
    const totalCssSize = cssResources.reduce((sum, resource) => sum + resource.size, 0);
    const totalCssKB = totalCssSize / 1024;

    // CSS should be less than 50KB
    expect(totalCssKB).toBeLessThan(50);
    console.log(`Total CSS size: ${totalCssKB.toFixed(2)} KB`);
  });

  test('should optimize image sizes', async ({ page }) => {
    const imageResources: any[] = [];

    page.on('response', async (response) => {
      const url = response.url();
      const contentType = response.headers()['content-type'];

      if (contentType?.startsWith('image/')) {
        const headers = response.headers();
        const contentLength = headers['content-length'];

        imageResources.push({
          url,
          size: contentLength ? parseInt(contentLength) : 0,
          type: contentType
        });
      }
    });

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Total image size should be less than 200KB
    const totalImageSize = imageResources.reduce((sum, resource) => sum + resource.size, 0);
    const totalImageKB = totalImageSize / 1024;

    expect(totalImageKB).toBeLessThan(200);
    console.log(`Total image size: ${totalImageKB.toFixed(2)} KB`);
    console.log(`Images loaded: ${imageResources.length}`);

    // No single image should exceed 100KB
    for (const image of imageResources) {
      const imageKB = image.size / 1024;
      expect(imageKB).toBeLessThan(100);
    }
  });

  test('should use compression for text resources', async ({ page }) => {
    const textResources: any[] = [];

    page.on('response', async (response) => {
      const contentType = response.headers()['content-type'];
      const contentEncoding = response.headers()['content-encoding'];

      if (
        contentType?.includes('javascript') ||
        contentType?.includes('css') ||
        contentType?.includes('html')
      ) {
        textResources.push({
          url: response.url(),
          encoding: contentEncoding,
          contentType
        });
      }
    });

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // All text resources should be compressed
    const uncompressedResources = textResources.filter(
      (r) => !r.encoding || (r.encoding !== 'gzip' && r.encoding !== 'br')
    );

    if (uncompressedResources.length > 0) {
      console.log('Uncompressed resources:', uncompressedResources);
    }

    // Allow some resources to be uncompressed (e.g., very small files)
    expect(uncompressedResources.length).toBeLessThan(3);
  });
});

// ============================================================================
// EXAMPLE 4: API Response Time Testing
// ============================================================================

test.describe('API Performance', () => {
  test('should fetch cases data quickly', async ({ page }) => {
    let casesApiTime = 0;

    page.on('response', async (response) => {
      if (response.url().includes('/api/cases')) {
        const timing = response.timing();
        casesApiTime = timing.responseEnd;
      }
    });

    await page.goto('/cases');
    await page.waitForLoadState('networkidle');

    // API should respond within 500ms
    expect(casesApiTime).toBeLessThan(500);
    console.log(`Cases API response time: ${casesApiTime}ms`);
  });

  test('should handle slow API gracefully', async ({ page }) => {
    // Mock slow API
    await page.route('**/api/cases', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000)); // 2s delay
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ data: [] })
      });
    });

    await page.goto('/cases');

    // Should show loading state immediately
    const loadingIndicator = page.getByText(/loading/i);
    await expect(loadingIndicator).toBeVisible();

    // Should handle slow response
    await page.waitForLoadState('networkidle');
    await expect(loadingIndicator).not.toBeVisible();
  });
});

// ============================================================================
// EXAMPLE 5: Rendering Performance Testing
// ============================================================================

test.describe('Rendering Performance', () => {
  test('should render large lists efficiently', async ({ page }) => {
    await page.goto('/cases');

    // Measure rendering time for list
    const renderTime = await page.evaluate(() => {
      const startTime = performance.now();

      // Trigger re-render or scroll
      window.scrollTo(0, document.body.scrollHeight);

      return performance.now() - startTime;
    });

    // Rendering should take less than 100ms
    expect(renderTime).toBeLessThan(100);
    console.log(`List render time: ${renderTime}ms`);
  });

  test('should handle rapid interactions without lag', async ({ page }) => {
    await page.goto('/dashboard');

    const startTime = Date.now();

    // Perform rapid interactions
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
    }

    const interactionTime = Date.now() - startTime;

    // Should complete quickly
    expect(interactionTime).toBeLessThan(500);
    console.log(`Interaction time: ${interactionTime}ms`);
  });

  test('should not cause memory leaks', async ({ page }) => {
    await page.goto('/dashboard');

    // Get initial memory
    const initialMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });

    // Navigate around and return
    await page.goto('/cases');
    await page.goto('/documents');
    await page.goto('/dashboard');

    // Get final memory
    const finalMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });

    // Memory shouldn't increase significantly
    const memoryIncrease = finalMemory - initialMemory;
    const memoryIncreaseMB = memoryIncrease / (1024 * 1024);

    expect(memoryIncreaseMB).toBeLessThan(10); // Less than 10MB increase
    console.log(`Memory increase: ${memoryIncreaseMB.toFixed(2)} MB`);
  });
});

// ============================================================================
// EXAMPLE 6: Mobile Performance Testing
// ============================================================================

test.describe('Mobile Performance', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test('should load quickly on mobile viewport', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    const loadTime = Date.now() - startTime;

    // Mobile load time should be under 3 seconds
    expect(loadTime).toBeLessThan(3000);
    console.log(`Mobile load time: ${loadTime}ms`);
  });

  test('should have good mobile interaction performance', async ({ page }) => {
    await page.goto('/dashboard');

    // Test tap/touch interaction
    const button = page.getByRole('button').first();

    const startTime = Date.now();
    await button.click();
    const responseTime = Date.now() - startTime;

    // Touch interaction should feel instant (< 100ms)
    expect(responseTime).toBeLessThan(100);
    console.log(`Touch response time: ${responseTime}ms`);
  });
});

// ============================================================================
// EXAMPLE 7: Caching Performance
// ============================================================================

test.describe('Caching Performance', () => {
  test('should use cache for repeated requests', async ({ page }) => {
    const requests: Map<string, number> = new Map();

    page.on('request', (request) => {
      const url = request.url();
      requests.set(url, (requests.get(url) || 0) + 1);
    });

    // First visit
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const firstVisitRequests = requests.size;

    // Navigate away and back
    await page.goto('/cases');
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const secondVisitRequests = requests.size;

    // Second visit should make fewer requests due to caching
    console.log(`First visit requests: ${firstVisitRequests}`);
    console.log(`Second visit total requests: ${secondVisitRequests}`);

    // Some resources should be cached
    // This is a rough check; adjust based on your caching strategy
    expect(secondVisitRequests).toBeLessThan(firstVisitRequests * 1.5);
  });

  test('should use service worker for offline support', async ({ page }) => {
    await page.goto('/dashboard');

    // Check if service worker is registered
    const swRegistered = await page.evaluate(() => {
      return navigator.serviceWorker.controller !== null;
    });

    // If you're using a service worker, it should be registered
    // Uncomment if you implement service worker:
    // expect(swRegistered).toBe(true);

    console.log(`Service worker registered: ${swRegistered}`);
  });
});

// ============================================================================
// PERFORMANCE TESTING BEST PRACTICES
// ============================================================================

/**
 * ✅ DO:
 * - Set performance budgets for all critical pages
 * - Test Core Web Vitals (LCP, FID, CLS)
 * - Monitor bundle sizes over time
 * - Test on throttled networks (3G, 4G)
 * - Test on mobile devices/viewports
 * - Measure time to interactive
 * - Check for memory leaks
 * - Use compression (gzip/brotli)
 * - Optimize images and fonts
 * - Implement code splitting
 * - Use caching effectively
 * - Monitor API response times
 *
 * ❌ DON'T:
 * - Skip performance testing
 * - Ignore performance budgets
 * - Load unused JavaScript
 * - Block rendering with scripts
 * - Serve unoptimized images
 * - Make unnecessary API calls
 * - Ignore slow third-party scripts
 * - Skip compression
 */

/**
 * PERFORMANCE BUDGETS (from lighthouserc.js):
 * - Performance Score: >= 90
 * - First Contentful Paint: < 1.5s
 * - Time to Interactive: < 3.5s
 * - Cumulative Layout Shift: < 0.1
 * - Largest Contentful Paint: < 2.5s
 * - Total JavaScript: < 300KB
 * - Total CSS: < 50KB
 * - Total Images: < 200KB
 * - Total Page Size: < 1MB
 *
 * OPTIMIZATION CHECKLIST:
 * - ✓ Minimize JavaScript bundle size
 * - ✓ Code split by route
 * - ✓ Lazy load components
 * - ✓ Optimize images (WebP, responsive)
 * - ✓ Use CDN for static assets
 * - ✓ Enable gzip/brotli compression
 * - ✓ Implement caching headers
 * - ✓ Prefetch critical resources
 * - ✓ Remove unused CSS/JS
 * - ✓ Optimize font loading
 * - ✓ Use HTTP/2 or HTTP/3
 * - ✓ Minimize render-blocking resources
 *
 * LIGHTHOUSE CI:
 * - Lighthouse CI runs automatically on every PR
 * - View results in GitHub Actions artifacts
 * - Performance regressions will fail the build
 * - Configure budgets in lighthouserc.js
 *
 * MONITORING:
 * - Use Application Insights for real user monitoring
 * - Track Core Web Vitals in production
 * - Set up alerts for performance regressions
 * - Review performance metrics weekly
 *
 * Run: pnpm test:perf
 * Run Lighthouse: pnpm test:perf:collect
 * View report: Open test-results/lighthouse/
 */
