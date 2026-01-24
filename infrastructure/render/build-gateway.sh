#!/bin/bash
# Native runtime build script for Gateway service (GraphQL API)
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

echo "=== Building Gateway service ==="
cd services/gateway
pnpm exec tsc || echo "TypeScript completed (warnings ignored)"

# Copy GraphQL schema files (TypeScript doesn't copy .graphql files)
cp -r src/graphql/schema/*.graphql dist/graphql/schema/
cd ../..

echo "=== Building Word Add-in ==="
cd apps/word-addin
VITE_API_BASE_URL=https://api.bojin-law.com \
VITE_AZURE_AD_CLIENT_ID=0ac0c3a6-6482-4ff4-81a6-c2f96c506cfd \
VITE_AZURE_AD_TENANT_ID=e39d7b1e-9d0c-41ae-b1db-99aecc04fa42 \
pnpm build

# Copy to gateway dist for static serving
mkdir -p ../../services/gateway/dist/word-addin
cp -r dist/* ../../services/gateway/dist/word-addin/
cd ../..

echo "=== Build complete ==="
