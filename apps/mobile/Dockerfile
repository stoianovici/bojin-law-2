# Mobile App Dockerfile for Coolify
# Optimized multi-stage build for monorepo

# ============================================================================
# Stage 1: Dependencies
# ============================================================================
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

RUN corepack enable pnpm

# Copy workspace config files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copy package.json files for workspace packages we need
COPY packages/database/package.json ./packages/database/
COPY packages/config/package.json ./packages/config/
COPY apps/mobile/package.json ./apps/mobile/

# Copy Prisma schema for postinstall
COPY packages/database/prisma ./packages/database/prisma

# Install dependencies (ignore scripts, we'll generate Prisma later)
RUN pnpm install --frozen-lockfile --ignore-scripts

# ============================================================================
# Stage 2: Builder
# ============================================================================
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

RUN corepack enable pnpm

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=deps /app/apps/mobile/node_modules ./apps/mobile/node_modules

# Copy source code
COPY packages/database ./packages/database
COPY packages/config ./packages/config
COPY apps/mobile ./apps/mobile
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.json ./

# Generate Prisma client
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
RUN cd packages/database && npx prisma generate

# Build the app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @legal-platform/mobile build

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
COPY --from=builder /app/apps/mobile/.next/standalone ./
COPY --from=builder /app/apps/mobile/.next/static ./apps/mobile/.next/static

# Copy public folder if it exists (use conditional copy pattern)
COPY --from=builder /app/apps/mobile/public* ./apps/mobile/

# Copy Prisma client
COPY --from=builder /app/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma ./node_modules/.prisma

# Set ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3002
ENV PORT=3002
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/mobile/server.js"]
