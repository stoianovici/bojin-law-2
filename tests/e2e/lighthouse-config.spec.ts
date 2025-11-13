/**
 * Lighthouse CI Configuration Validation Tests
 * Validates that Lighthouse CI is properly configured
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Lighthouse CI Configuration', () => {
  test('lighthouserc.js file exists and is valid', () => {
    const lighthouseConfigPath = path.join(process.cwd(), 'lighthouserc.js');

    // Check file exists
    expect(fs.existsSync(lighthouseConfigPath)).toBeTruthy();

    // Read file content
    const content = fs.readFileSync(lighthouseConfigPath, 'utf-8');

    // Validate essential configuration elements
    expect(content).toContain('ci:');
    expect(content).toContain('collect:');
    expect(content).toContain('assert:');
    expect(content).toContain('assertions:');
  });

  test('lighthouserc.js contains performance budgets', () => {
    const lighthouseConfigPath = path.join(process.cwd(), 'lighthouserc.js');
    const content = fs.readFileSync(lighthouseConfigPath, 'utf-8');

    // Check for Core Web Vitals thresholds
    expect(content).toContain('first-contentful-paint');
    expect(content).toContain('largest-contentful-paint');
    expect(content).toContain('cumulative-layout-shift');
    expect(content).toContain('total-blocking-time');
    expect(content).toContain('interactive');

    // Check for performance score
    expect(content).toContain('categories:performance');
  });

  test('lighthouserc.js configures critical pages', () => {
    const lighthouseConfigPath = path.join(process.cwd(), 'lighthouserc.js');
    const content = fs.readFileSync(lighthouseConfigPath, 'utf-8');

    // Check for critical pages mentioned in requirements
    expect(content).toContain('dashboard');
    expect(content).toContain('cases');
    expect(content).toContain('documents');
  });

  test('package.json has Lighthouse CI test scripts', () => {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    // Validate Lighthouse CI scripts exist
    expect(packageJson.scripts).toHaveProperty('test:perf');
    expect(packageJson.scripts['test:perf']).toContain('lhci');
  });

  test('GitHub Actions workflow includes Lighthouse CI job', () => {
    const workflowPath = path.join(process.cwd(), '.github/workflows/test.yml');
    const content = fs.readFileSync(workflowPath, 'utf-8');

    // Validate Lighthouse CI job exists
    expect(content).toContain('lighthouse-ci:');
    expect(content).toContain('Run Lighthouse CI');
    expect(content).toContain('test:perf');
  });

  test('Performance budgets are set according to requirements', () => {
    const lighthouseConfigPath = path.join(process.cwd(), 'lighthouserc.js');
    const content = fs.readFileSync(lighthouseConfigPath, 'utf-8');

    // Performance score >= 90
    expect(content).toMatch(/minScore:\s*0\.9/);

    // First Contentful Paint < 1.5s (1500ms)
    expect(content).toMatch(/first-contentful-paint.*1500/);

    // Cumulative Layout Shift < 0.1
    expect(content).toMatch(/cumulative-layout-shift.*0\.1/);

    // Time to Interactive < 3.5s (3500ms)
    expect(content).toMatch(/interactive.*3500/);
  });

  test('Lighthouse CI configured for accessibility testing', () => {
    const lighthouseConfigPath = path.join(process.cwd(), 'lighthouserc.js');
    const content = fs.readFileSync(lighthouseConfigPath, 'utf-8');

    // Check for accessibility score threshold
    expect(content).toContain('categories:accessibility');
    expect(content).toMatch(/categories:accessibility.*0\.9/);
  });

  test('Resource budgets are configured', () => {
    const lighthouseConfigPath = path.join(process.cwd(), 'lighthouserc.js');
    const content = fs.readFileSync(lighthouseConfigPath, 'utf-8');

    // Check for resource budget assertions
    expect(content).toContain('resource-summary:script:size');
    expect(content).toContain('resource-summary:stylesheet:size');
    expect(content).toContain('resource-summary:image:size');
    expect(content).toContain('resource-summary:total:size');
  });
});
