/**
 * Web Vitals Performance Monitoring
 * Reports LCP, FID, CLS metrics to console (dev) or analytics (prod)
 */

type MetricName = 'LCP' | 'FID' | 'CLS' | 'FCP' | 'TTFB' | 'INP';

interface WebVitalMetric {
  name: MetricName;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
}

const isDev = process.env.NODE_ENV === 'development';

function logMetric(metric: WebVitalMetric) {
  if (isDev) {
    const color =
      metric.rating === 'good'
        ? '\u{1F7E2}'
        : metric.rating === 'needs-improvement'
          ? '\u{1F7E1}'
          : '\u{1F534}';
    console.log(`${color} ${metric.name}: ${metric.value.toFixed(2)} (${metric.rating})`);
  }
  // In production, you could send to analytics here
  // Example: sendToAnalytics({ metric: metric.name, value: metric.value, rating: metric.rating });
}

/**
 * Initialize Web Vitals monitoring using Performance Observer API
 * Call this once on app initialization (client-side only)
 */
export function reportWebVitals() {
  if (typeof window === 'undefined') return;

  try {
    // LCP - Largest Contentful Paint
    // Measures loading performance - should be under 2.5s for good UX
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as PerformanceEntry & { startTime: number };
      if (lastEntry) {
        const value = lastEntry.startTime;
        logMetric({
          name: 'LCP',
          value,
          rating: value < 2500 ? 'good' : value < 4000 ? 'needs-improvement' : 'poor',
          delta: value,
          id: `lcp-${Date.now()}`,
        });
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });

    // CLS - Cumulative Layout Shift
    // Measures visual stability - should be under 0.1 for good UX
    let clsValue = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & {
        hadRecentInput: boolean;
        value: number;
      })[]) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }
      logMetric({
        name: 'CLS',
        value: clsValue,
        rating: clsValue < 0.1 ? 'good' : clsValue < 0.25 ? 'needs-improvement' : 'poor',
        delta: clsValue,
        id: `cls-${Date.now()}`,
      });
    }).observe({ type: 'layout-shift', buffered: true });

    // FID - First Input Delay
    // Measures interactivity - should be under 100ms for good UX
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const firstEntry = entries[0] as PerformanceEntry & {
        processingStart: number;
        startTime: number;
      };
      if (firstEntry) {
        const value = firstEntry.processingStart - firstEntry.startTime;
        logMetric({
          name: 'FID',
          value,
          rating: value < 100 ? 'good' : value < 300 ? 'needs-improvement' : 'poor',
          delta: value,
          id: `fid-${Date.now()}`,
        });
      }
    }).observe({ type: 'first-input', buffered: true });
  } catch {
    // PerformanceObserver not supported in this browser
    if (isDev) {
      console.warn('[Performance] PerformanceObserver not supported');
    }
  }
}
