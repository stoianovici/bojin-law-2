/**
 * Configuration Validation Tests
 * Validates that test infrastructure configurations are properly set up
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

test.describe('Test Infrastructure Configuration', () => {
  test('GitHub Actions workflow file exists and is valid YAML', () => {
    const workflowPath = path.join(process.cwd(), '.github/workflows/test.yml');

    // Check file exists
    expect(fs.existsSync(workflowPath)).toBeTruthy();

    // Read and parse YAML
    const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
    const workflow = yaml.parse(workflowContent);

    // Validate workflow structure
    expect(workflow).toHaveProperty('name');
    expect(workflow.name).toBe('Test Suite');

    // Validate trigger configuration
    expect(workflow).toHaveProperty('on');
    expect(workflow.on).toHaveProperty('pull_request');
    expect(workflow.on).toHaveProperty('push');

    // Validate jobs exist
    expect(workflow).toHaveProperty('jobs');
    expect(workflow.jobs).toHaveProperty('unit-tests');
    expect(workflow.jobs).toHaveProperty('e2e-tests');
    expect(workflow.jobs).toHaveProperty('test-results-comment');
  });

  test('Playwright configuration file exists and is valid', () => {
    const playwrightConfigPath = path.join(process.cwd(), 'playwright.config.ts');

    // Check file exists
    expect(fs.existsSync(playwrightConfigPath)).toBeTruthy();

    // Read file content
    const content = fs.readFileSync(playwrightConfigPath, 'utf-8');

    // Validate essential configuration elements exist in the file
    expect(content).toContain('testDir:');
    expect(content).toContain('timeout:');
    expect(content).toContain('use:');
  });

  test('Jest configuration file exists and has coverage thresholds', () => {
    const jestConfigPath = path.join(process.cwd(), 'jest.config.js');

    // Check file exists
    expect(fs.existsSync(jestConfigPath)).toBeTruthy();

    // Read file content
    const content = fs.readFileSync(jestConfigPath, 'utf-8');

    // Validate coverage thresholds are set
    expect(content).toContain('coverageThreshold');
    expect(content).toContain('80'); // 80% threshold
    expect(content).toContain('coverageDirectory');
    expect(content).toContain('coverageReporters');
  });

  test('Test environment example file exists', () => {
    const envTestPath = path.join(process.cwd(), '.env.test.example');

    // Check file exists
    expect(fs.existsSync(envTestPath)).toBeTruthy();

    // Read file content
    const content = fs.readFileSync(envTestPath, 'utf-8');

    // Validate required environment variables are documented
    expect(content).toContain('TEST_DATABASE_URL');
    expect(content).toContain('NODE_ENV');
  });

  test('Docker compose includes test database service', () => {
    const dockerComposePath = path.join(process.cwd(), 'docker-compose.yml');

    // Check file exists
    expect(fs.existsSync(dockerComposePath)).toBeTruthy();

    // Read and parse YAML
    const content = fs.readFileSync(dockerComposePath, 'utf-8');
    const dockerCompose = yaml.parse(content);

    // Validate test database service exists
    expect(dockerCompose).toHaveProperty('services');
    expect(dockerCompose.services).toHaveProperty('postgres-test');

    // Validate test database configuration
    const postgresTest = dockerCompose.services['postgres-test'];

    // Environment can be either array or object format in docker-compose
    const envVars = Array.isArray(postgresTest.environment)
      ? postgresTest.environment
      : Object.entries(postgresTest.environment).map(([key, value]) => `${key}=${value}`);

    expect(envVars.some((env: string) => env.includes('legal_platform_test'))).toBeTruthy();
    expect(postgresTest.ports).toContain('5433:5432');
  });

  test('Test data seed script exists', () => {
    const seedScriptPath = path.join(process.cwd(), 'scripts/seed-test-db.ts');

    // Check file exists
    expect(fs.existsSync(seedScriptPath)).toBeTruthy();
  });

  test('Test database initialization script exists', () => {
    const initScriptPath = path.join(
      process.cwd(),
      'infrastructure/docker/init-scripts/02-init-test-db.sql'
    );

    // Check file exists
    expect(fs.existsSync(initScriptPath)).toBeTruthy();

    // Read file content
    const content = fs.readFileSync(initScriptPath, 'utf-8');

    // Validate required extensions are created
    expect(content).toContain('CREATE EXTENSION IF NOT EXISTS vector');
    expect(content).toContain('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    expect(content).toContain('CREATE EXTENSION IF NOT EXISTS pg_trgm');
  });

  test('Package.json has all required test scripts', () => {
    const packageJsonPath = path.join(process.cwd(), 'package.json');

    // Check file exists
    expect(fs.existsSync(packageJsonPath)).toBeTruthy();

    // Read and parse JSON
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    // Validate test scripts exist
    expect(packageJson.scripts).toHaveProperty('test');
    expect(packageJson.scripts).toHaveProperty('test:watch');
    expect(packageJson.scripts).toHaveProperty('test:coverage');
    expect(packageJson.scripts).toHaveProperty('test:ci');
    expect(packageJson.scripts).toHaveProperty('test:e2e');
    expect(packageJson.scripts).toHaveProperty('test:e2e:ui');
    expect(packageJson.scripts).toHaveProperty('test:e2e:debug');
  });
});
