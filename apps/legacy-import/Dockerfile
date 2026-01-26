# Legacy Import Dockerfile for Coolify
# Optimized multi-stage build to reduce image size from ~7GB to ~500MB

# ============================================================================
# Stage 1: Dependencies
# ============================================================================
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable pnpm

# Copy workspace config files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copy package.json files for all workspace packages we need
COPY packages/database/package.json ./packages/database/
COPY packages/shared/types/package.json ./packages/shared/types/
COPY packages/config/package.json ./packages/config/
COPY apps/legacy-import/package.json ./apps/legacy-import/

# Copy Prisma schema so postinstall can generate the client
COPY packages/database/prisma ./packages/database/prisma

# Install dependencies (ignore scripts initially, we'll generate Prisma later)
RUN pnpm install --frozen-lockfile --ignore-scripts

# ============================================================================
# Stage 2: Builder
# ============================================================================
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

RUN corepack enable pnpm

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=deps /app/packages/shared/types/node_modules ./packages/shared/types/node_modules
COPY --from=deps /app/apps/legacy-import/node_modules ./apps/legacy-import/node_modules

# Copy source code
COPY packages/database ./packages/database
COPY packages/shared/types ./packages/shared/types
COPY packages/config ./packages/config
COPY apps/legacy-import ./apps/legacy-import
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.json ./

# Generate Prisma client
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
RUN cd packages/database && npx prisma generate

# Build types package
RUN pnpm --filter @legal-platform/types build

# Build the app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @legal-platform/legacy-import build

# ============================================================================
# Stage 3: Production Runner
# ============================================================================
FROM node:22-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy Next.js standalone output
COPY --from=builder /app/apps/legacy-import/.next/standalone ./
COPY --from=builder /app/apps/legacy-import/.next/static ./apps/legacy-import/.next/static

# Copy Prisma client (pnpm stores it in node_modules/.pnpm)
# The standalone output includes node_modules with symlinks, but we need the actual Prisma binaries
COPY --from=builder /app/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma ./node_modules/.prisma

# Also copy the generated Prisma client for the app (if it generates locally)
COPY --from=builder /app/apps/legacy-import/src/generated ./apps/legacy-import/src/generated

# Set ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3001
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

# Start the standalone server
CMD ["node", "apps/legacy-import/server.js"]
