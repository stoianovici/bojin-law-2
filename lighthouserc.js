/**
 * Lighthouse CI Configuration
 * Automated performance testing for critical pages
 */

module.exports = {
  ci: {
    collect: {
      // URLs to test - adjust port if needed
      // Note: Dynamic route URLs ([case-id], [doc-id]) should be configured
      // via environment variables or test data seeding in CI
      url: [
        'http://localhost:3000',
        'http://localhost:3000/dashboard',
        'http://localhost:3000/dashboard/partner',
        'http://localhost:3000/dashboard/associate',
        'http://localhost:3000/dashboard/paralegal',
        // TODO: Replace with actual case/document IDs from seeded test data
        // 'http://localhost:3000/cases/[case-id]',
        // 'http://localhost:3000/documents/editor/[doc-id]',
      ],
      // Number of runs for each URL (higher = more reliable but slower)
      numberOfRuns: 3,
      // Chrome flags for consistent testing
      settings: {
        preset: 'desktop',
        chromeFlags: '--no-sandbox --disable-dev-shm-usage',
      },
      // Start a local server before collecting (optional - enable if not already running)
      startServerCommand: null,
      startServerReadyPattern: 'ready',
      startServerReadyTimeout: 60000,
    },
    assert: {
      // Performance budgets - all values must meet these thresholds
      assertions: {
        // Performance score >= 90
        'categories:performance': ['error', { minScore: 0.9 }],

        // Accessibility score >= 90 (WCAG AA compliance)
        'categories:accessibility': ['error', { minScore: 0.9 }],

        // Best practices score >= 90
        'categories:best-practices': ['error', { minScore: 0.9 }],

        // SEO score >= 90
        'categories:seo': ['error', { minScore: 0.9 }],

        // Core Web Vitals
        'first-contentful-paint': ['error', { maxNumericValue: 1500 }], // < 1.5s
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }], // < 2.5s
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }], // < 0.1
        'total-blocking-time': ['error', { maxNumericValue: 200 }], // < 200ms
        'speed-index': ['error', { maxNumericValue: 3500 }], // < 3.5s
        'interactive': ['error', { maxNumericValue: 3500 }], // < 3.5s (TTI)

        // Resource budgets
        'resource-summary:document:size': ['warn', { maxNumericValue: 50000 }], // 50KB
        'resource-summary:script:size': ['warn', { maxNumericValue: 300000 }], // 300KB
        'resource-summary:stylesheet:size': ['warn', { maxNumericValue: 50000 }], // 50KB
        'resource-summary:image:size': ['warn', { maxNumericValue: 200000 }], // 200KB
        'resource-summary:font:size': ['warn', { maxNumericValue: 100000 }], // 100KB
        'resource-summary:total:size': ['warn', { maxNumericValue: 1000000 }], // 1MB total

        // Network requests
        'network-requests': ['warn', { maxNumericValue: 50 }], // < 50 requests
        'uses-long-cache-ttl': ['warn', { minScore: 0.8 }],
        'uses-optimized-images': ['warn', { minScore: 0.9 }],
        'modern-image-formats': ['warn', { minScore: 0.8 }],

        // JavaScript
        'bootup-time': ['warn', { maxNumericValue: 3000 }], // < 3s JS execution time
        'mainthread-work-breakdown': ['warn', { maxNumericValue: 3000 }], // < 3s main thread work
        'unused-javascript': ['warn', { minScore: 0.8 }],

        // Rendering
        'dom-size': ['warn', { maxNumericValue: 1500 }], // < 1500 DOM nodes
        'layout-shift-elements': ['warn', { maxLength: 0 }], // No layout shifts
      },
      // Preset for stricter checks
      preset: 'lighthouse:recommended',
    },
    upload: {
      // Upload results to temporary public storage (can be configured to use GitHub Actions artifacts instead)
      target: 'temporary-public-storage',
      // Or configure to upload to a Lighthouse CI server:
      // target: 'lhci',
      // serverBaseUrl: 'https://your-lhci-server.com',
      // token: process.env.LHCI_TOKEN,
    },
    server: {
      // Optional: Configure Lighthouse CI server if self-hosting
      // port: 9001,
      // storage: {
      //   storageMethod: 'sql',
      //   sqlDialect: 'postgres',
      //   sqlConnectionUrl: process.env.LHCI_DATABASE_URL,
      // },
    },
  },
};
