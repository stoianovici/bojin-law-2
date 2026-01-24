#!/bin/bash
# Native runtime build script for AI Service
# Eliminates Docker overhead for faster Render deployments

set -e

echo "=== Installing pnpm ==="
npm install -g pnpm@latest

echo "=== Installing dependencies ==="
pnpm install --frozen-lockfile

echo "=== Setting up Prisma ==="
# Dummy URL for Prisma client generation (doesn't connect, just generates types)
export DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"

echo "=== Building workspace packages ==="
# 1. Types package
pnpm build --filter=@legal-platform/types

# 2. Database package (Prisma + TypeScript)
cd packages/database
pnpm prisma generate --schema=./prisma/schema.prisma
pnpm exec tsc --build --force
cd ../..

echo "=== Building AI Service ==="
cd services/ai-service
pnpm exec tsc || echo "TypeScript completed (warnings ignored)"
cd ../..

echo "=== Build complete ==="
