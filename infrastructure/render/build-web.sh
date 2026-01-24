#!/bin/bash
# Native runtime build script for Next.js web service
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

# 3. UI package
pnpm build --filter=@legal-platform/ui

echo "=== Building Next.js app ==="
# Set public env vars for build (these get baked into the client bundle)
export NEXT_PUBLIC_APP_URL=https://app.bojin-law.com
export NEXT_PUBLIC_AZURE_AD_CLIENT_ID=0ac0c3a6-6482-4ff4-81a6-c2f96c506cfd
export NEXT_PUBLIC_AZURE_AD_TENANT_ID=e39d7b1e-9d0c-41ae-b1db-99aecc04fa42
export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=2048"

cd apps/web
pnpm next build
cd ../..

echo "=== Build complete ==="
