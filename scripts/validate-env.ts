#!/usr/bin/env tsx
/**
 * Environment Variable Validation Script
 *
 * Validates that all required environment variables are set for each service.
 * Usage:
 *   pnpm run validate:env              # Validate all services
 *   pnpm run validate:env gateway      # Validate specific service
 */

import * as fs from 'fs';
import * as path from 'path';

interface EnvVarConfig {
  name: string;
  required: boolean;
  sensitive: boolean;
  description?: string;
}

interface ServiceConfig {
  name: string;
  path: string;
  envFile: string;
  variables: EnvVarConfig[];
}

// Common variables used by all backend services
const COMMON_BACKEND_VARS: EnvVarConfig[] = [
  { name: 'NODE_ENV', required: true, sensitive: false },
  { name: 'DATABASE_URL', required: true, sensitive: true },
  { name: 'REDIS_URL', required: true, sensitive: true },
  { name: 'AZURE_AD_CLIENT_ID', required: true, sensitive: false },
  { name: 'AZURE_AD_CLIENT_SECRET', required: true, sensitive: true },
  { name: 'AZURE_AD_TENANT_ID', required: true, sensitive: false },
  { name: 'APPLICATION_INSIGHTS_CONNECTION_STRING', required: true, sensitive: true },
  { name: 'LOG_LEVEL', required: false, sensitive: false },
];

const SERVICES: ServiceConfig[] = [
  {
    name: 'web',
    path: 'apps/web',
    envFile: '.env.local',
    variables: [
      { name: 'NEXT_PUBLIC_API_URL', required: true, sensitive: false },
      { name: 'NEXT_PUBLIC_AZURE_AD_CLIENT_ID', required: true, sensitive: false },
      { name: 'NEXT_PUBLIC_AZURE_AD_TENANT_ID', required: true, sensitive: false },
      { name: 'NODE_ENV', required: true, sensitive: false },
      { name: 'PORT', required: false, sensitive: false },
    ],
  },
  {
    name: 'gateway',
    path: 'services/gateway',
    envFile: '.env',
    variables: [
      ...COMMON_BACKEND_VARS,
      { name: 'PORT', required: true, sensitive: false },
      { name: 'JWT_SECRET', required: true, sensitive: true },
      { name: 'DOCUMENT_SERVICE_URL', required: true, sensitive: false },
      { name: 'TASK_SERVICE_URL', required: true, sensitive: false },
      { name: 'AI_SERVICE_URL', required: true, sensitive: false },
      { name: 'INTEGRATION_SERVICE_URL', required: true, sensitive: false },
      { name: 'NOTIFICATION_SERVICE_URL', required: true, sensitive: false },
    ],
  },
  {
    name: 'document-service',
    path: 'services/document-service',
    envFile: '.env',
    variables: [
      ...COMMON_BACKEND_VARS,
      { name: 'PORT', required: true, sensitive: false },
      { name: 'AZURE_STORAGE_CONNECTION_STRING', required: true, sensitive: true },
      { name: 'AZURE_STORAGE_CONTAINER_NAME', required: true, sensitive: false },
    ],
  },
  {
    name: 'ai-service',
    path: 'services/ai-service',
    envFile: '.env',
    variables: [
      ...COMMON_BACKEND_VARS,
      { name: 'PORT', required: true, sensitive: false },
      { name: 'OPENAI_API_KEY', required: true, sensitive: true },
      { name: 'OPENAI_MODEL', required: false, sensitive: false },
    ],
  },
  {
    name: 'task-service',
    path: 'services/task-service',
    envFile: '.env',
    variables: [...COMMON_BACKEND_VARS, { name: 'PORT', required: true, sensitive: false }],
  },
  {
    name: 'integration-service',
    path: 'services/integration-service',
    envFile: '.env',
    variables: [
      ...COMMON_BACKEND_VARS,
      { name: 'PORT', required: true, sensitive: false },
      { name: 'M365_CLIENT_ID', required: true, sensitive: false },
      { name: 'M365_CLIENT_SECRET', required: true, sensitive: true },
      { name: 'M365_TENANT_ID', required: true, sensitive: false },
    ],
  },
  {
    name: 'notification-service',
    path: 'services/notification-service',
    envFile: '.env',
    variables: [
      ...COMMON_BACKEND_VARS,
      { name: 'PORT', required: true, sensitive: false },
      { name: 'SMTP_HOST', required: true, sensitive: false },
      { name: 'SMTP_PORT', required: true, sensitive: false },
      { name: 'SMTP_USER', required: true, sensitive: true },
      { name: 'SMTP_PASSWORD', required: true, sensitive: true },
      { name: 'SMTP_FROM', required: true, sensitive: false },
    ],
  },
];

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const env: Record<string, string> = {};

  content.split('\n').forEach((line) => {
    // Skip comments and empty lines
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      return;
    }

    // Parse KEY=VALUE
    const match = trimmedLine.match(/^([^=]+)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      env[key.trim()] = value.trim();
    }
  });

  return env;
}

function validateService(service: ServiceConfig): {
  valid: boolean;
  missing: string[];
  empty: string[];
} {
  const envPath = path.join(process.cwd(), service.path, service.envFile);
  const env = parseEnvFile(envPath);

  const missing: string[] = [];
  const empty: string[] = [];

  service.variables.forEach((varConfig) => {
    if (varConfig.required) {
      if (!(varConfig.name in env)) {
        missing.push(varConfig.name);
      } else if (
        !env[varConfig.name] ||
        env[varConfig.name].includes('your-') ||
        env[varConfig.name].includes('xxxxx')
      ) {
        empty.push(varConfig.name);
      }
    }
  });

  return {
    valid: missing.length === 0 && empty.length === 0,
    missing,
    empty,
  };
}

function main() {
  const args = process.argv.slice(2);
  const targetService = args[0];

  console.log('🔍 Environment Variable Validation\n');

  let servicesToValidate = SERVICES;
  if (targetService) {
    const service = SERVICES.find((s) => s.name === targetService);
    if (!service) {
      console.error(`❌ Unknown service: ${targetService}`);
      console.log('\nAvailable services:');
      SERVICES.forEach((s) => console.log(`  - ${s.name}`));
      process.exit(1);
    }
    servicesToValidate = [service];
  }

  let allValid = true;
  const results: Array<{ service: string; valid: boolean; missing: string[]; empty: string[] }> =
    [];

  servicesToValidate.forEach((service) => {
    const result = validateService(service);
    results.push({
      service: service.name,
      valid: result.valid,
      missing: result.missing,
      empty: result.empty,
    });

    if (!result.valid) {
      allValid = false;
    }
  });

  // Print results
  results.forEach(({ service, valid, missing, empty }) => {
    if (valid) {
      console.log(`✅ ${service}: All required variables set`);
    } else {
      console.log(`❌ ${service}: Missing or empty variables`);
      if (missing.length > 0) {
        console.log(`   Missing: ${missing.join(', ')}`);
      }
      if (empty.length > 0) {
        console.log(`   Empty/Template: ${empty.join(', ')}`);
      }
    }
  });

  console.log('');

  if (allValid) {
    console.log('✨ All environment variables are valid!');
    process.exit(0);
  } else {
    console.log('💡 Tip: Copy .env.example to .env and fill in the values');
    console.log('📖 See infrastructure/ENVIRONMENT_VARIABLES.md for details');
    process.exit(1);
  }
}

main();
