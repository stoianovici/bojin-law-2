# Docker Configuration

This directory contains production-optimized Dockerfiles and docker-compose configurations for the Legal Platform, designed for deployment on Render.com.

## Dockerfiles

### Dockerfile.web

Production Dockerfile for the Next.js frontend application, optimized for Render.

**Features:**

- Multi-stage build (dependencies → builder → runner)
- Production-optimized bundle with standalone output
- Non-root user (nextjs:nodejs)
- Health check endpoint at `/health`
- Minimal Alpine Linux base image (node:20-alpine)
- Optimized layer caching for faster Render builds

**Build:**

```bash
docker build -f infrastructure/docker/Dockerfile.web \
  --build-arg NEXT_PUBLIC_API_URL=https://api.yourdomain.com/graphql \
  --build-arg NEXT_PUBLIC_APP_URL=https://app.yourdomain.com \
  -t legal-platform-web:latest .
```

**Environment Variables (Build Args):**

- `NEXT_PUBLIC_API_URL` - GraphQL API endpoint (embedded at build time)
- `NEXT_PUBLIC_APP_URL` - Application URL (embedded at build time)

**Run:**

```bash
docker run -p 3000:3000 \
  --name web \
  legal-platform-web:latest
```

**Render Deployment:**

Render automatically builds this Dockerfile when deploying the web service. See `render.yaml` for configuration.

### Dockerfile.gateway

Production Dockerfile for the GraphQL API Gateway service.

**Features:**

- Multi-stage build for minimal image size
- TypeScript compilation during build
- Production dependencies only
- Health check endpoint at `/api/health`
- Non-root user (nodejs:nodejs)
- Optimized for Render's build environment

**Build:**

```bash
docker build -f infrastructure/docker/Dockerfile.gateway \
  -t legal-platform-gateway:latest .
```

**Run:**

```bash
docker run -p 4000:4000 \
  --env-file .env \
  --name gateway \
  legal-platform-gateway:latest
```

### Dockerfile.service

Generic production Dockerfile template for all microservices.

**Supports:**

- document-service (port 5001)
- task-service (port 5003)
- ai-service (port 5002)
- integration-service (port 5004)
- notification-service (port 5005)

**Features:**

- Multi-stage build
- Service-specific build args
- Parameterized service name and port
- Health check endpoint at `/health`

**Build Examples:**

```bash
# Document Service
docker build -f infrastructure/docker/Dockerfile.service \
  --build-arg SERVICE_NAME=document-service \
  --build-arg SERVICE_PORT=5001 \
  -t legal-platform-document-service:latest .

# AI Service
docker build -f infrastructure/docker/Dockerfile.service \
  --build-arg SERVICE_NAME=ai-service \
  --build-arg SERVICE_PORT=5002 \
  -t legal-platform-ai-service:latest .

# Task Service
docker build -f infrastructure/docker/Dockerfile.service \
  --build-arg SERVICE_NAME=task-service \
  --build-arg SERVICE_PORT=5003 \
  -t legal-platform-task-service:latest .
```

**Run Example:**

```bash
docker run -p 5001:5001 \
  --env-file .env \
  --name document-service \
  legal-platform-document-service:latest
```

## docker-compose Configurations

### docker-compose.yml

Full local development stack with hot-reload and development database.

**Services:**

- PostgreSQL 16 with pgvector extension
- Redis 7.2
- Next.js web app (dev mode with hot-reload)
- GraphQL API Gateway
- All microservices (document, task, ai, integration, notification)

**Usage:**

```bash
# Start all services
docker-compose up -d

# Start specific services
docker-compose up web gateway postgres redis

# View logs
docker-compose logs -f web

# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### docker-compose.test.yml

CI testing environment for automated tests.

**Usage:**

```bash
# Used in GitHub Actions CI pipeline
docker-compose -f docker-compose.test.yml up -d
pnpm test:ci
pnpm test:e2e
docker-compose -f docker-compose.test.yml down
```

## Multi-Stage Build Strategy

All Dockerfiles use a three-stage build process optimized for Render:

### Stage 1: Dependencies

- Install production dependencies only
- Uses `pnpm install --frozen-lockfile --prod`
- Leverages Docker layer caching for faster builds
- Render caches this layer aggressively

### Stage 2: Builder

- Compiles TypeScript to JavaScript
- Builds Next.js application
- Minifies and optimizes assets
- Tree-shakes unused code

### Stage 3: Runner

- Minimal runtime image (Alpine Linux)
- Copies only built artifacts and production dependencies
- Runs as non-root user for security
- Includes health check endpoint
- Optimized for Render's container runtime

**Benefits:**

- **Smaller images:** ~200MB vs ~1GB for full Node.js images
- **Faster deployments:** Less data to transfer and cache on Render
- **Better security:** Minimal attack surface, no build tools in production
- **Layer caching:** Faster builds when dependencies don't change (especially on Render)
- **Cost savings:** Smaller images reduce Render build time and storage costs

## Health Check Endpoints

All services expose a health check endpoint that returns:

```json
{
  "status": "ok",
  "service": "gateway",
  "version": "1.0.0",
  "uptime": 12345
}
```

**Endpoints:**

- **Web:** `/health`
- **Gateway:** `/api/health`
- **All Services:** `/health`

**Used by:**

- Docker `HEALTHCHECK` instruction
- Render's health monitoring and zero-downtime deploys
- Load balancers for traffic routing

## Database Initialization Scripts

Located in `infrastructure/docker/init-scripts/`:

- `01-init-pgvector.sql` - Installs pgvector extension
- `02-init-test-db.sql` - Creates test database and schema

These scripts run automatically when PostgreSQL container starts for the first time (local development only).

**Note:** Render PostgreSQL databases handle pgvector installation through database migrations, not init scripts.

## Render-Specific Optimizations

### Build Context Optimization

Use `.dockerignore` to exclude unnecessary files:

```
# See .dockerignore in project root
- Documentation (docs/, *.md)
- Tests (**/*.test.ts, coverage/)
- Git files (.git/, .github/)
- IDE files (.vscode/, .idea/)
- Infrastructure archives (infrastructure/archive/)
```

**Impact:** Reduces build context from ~500MB to ~150MB, speeding up Render builds by 40-60%.

### Layer Caching Strategy

Dockerfiles are ordered to maximize Render's layer caching:

1. **Base image** (cached for weeks)
2. **System dependencies** (cached for weeks)
3. **Package files** (cached until dependencies change)
4. **Install dependencies** (cached until package.json changes)
5. **Source code** (rebuilt on every commit)
6. **Build assets** (rebuilt on every commit)

**Impact:** Typical rebuild time on Render: 2-3 minutes (vs 8-10 minutes without caching).

### Security Hardening

All images follow Render security best practices:

- **Non-root user:** All containers run as unprivileged user (uid 1001)
- **Minimal base:** Alpine Linux reduces attack surface
- **No secrets in image:** All secrets injected at runtime via Render env vars
- **Dependency scanning:** Render automatically scans for vulnerabilities

## Image Optimization Best Practices

1. **Use Alpine Linux base images** - Smaller footprint (~5MB vs ~150MB)
2. **Multi-stage builds** - Separate build and runtime stages
3. **Production dependencies only** - Don't include devDependencies
4. **Layer caching** - Order commands from least to most frequently changing
5. **Non-root user** - Run containers as unprivileged user
6. **Health checks** - Enable Render's automatic restart on failure
7. **Security scanning** - Render automatically scans for CVEs
8. **Minimize layers** - Combine RUN commands where possible
9. **Use .dockerignore** - Reduce build context size
10. **Leverage BuildKit** - Render uses Docker BuildKit for faster, parallel builds

## Local Development

### Building Images Locally

```bash
# Test Next.js web build
docker build -f infrastructure/docker/Dockerfile.web \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:4000/graphql \
  --build-arg NEXT_PUBLIC_APP_URL=http://localhost:3000 \
  -t legal-platform-web:dev .

# Test Gateway build
docker build -f infrastructure/docker/Dockerfile.gateway \
  -t legal-platform-gateway:dev .

# Test a microservice
docker build -f infrastructure/docker/Dockerfile.service \
  --build-arg SERVICE_NAME=ai-service \
  --build-arg SERVICE_PORT=5002 \
  -t legal-platform-ai-service:dev .
```

### Testing Health Checks

```bash
# Start container
docker run -d -p 3000:3000 --name web legal-platform-web:dev

# Wait for startup
sleep 10

# Test health endpoint
curl http://localhost:3000/health

# Check Docker health status
docker inspect --format='{{.State.Health.Status}}' web

# Clean up
docker stop web && docker rm web
```

## Troubleshooting

### Build Failures

**Problem:** `pnpm install` fails
**Solution:** Clear Docker cache and rebuild

```bash
docker build --no-cache -f infrastructure/docker/Dockerfile.web .
```

**Problem:** TypeScript compilation errors
**Solution:** Verify source code builds locally first

```bash
pnpm build
```

**Problem:** Build context too large
**Solution:** Verify `.dockerignore` is configured

```bash
# Check ignored files
docker buildx build --progress=plain -f infrastructure/docker/Dockerfile.web .
```

### Runtime Issues

**Problem:** Container exits immediately
**Solution:** Check logs

```bash
docker logs <container-id>
```

**Problem:** Health check failing
**Solution:** Verify service is listening on correct port

```bash
docker exec <container-id> wget -q -O- http://localhost:3000/health
```

**Problem:** Environment variables not set
**Solution:** Check env file or Render dashboard configuration

```bash
docker exec <container-id> env | grep DATABASE_URL
```

### Image Size Issues

**Problem:** Images are too large
**Solution:** Use multi-stage builds and verify `.dockerignore`

```bash
# Check image size
docker images | grep legal-platform

# Analyze layers
docker history legal-platform-web:latest

# Target image sizes:
# - web: ~180MB
# - gateway: ~150MB
# - services: ~140MB
```

## Render Deployment

### Automatic Builds

Render automatically:

1. Clones your repository
2. Reads `render.yaml` for build configuration
3. Builds Docker images using the specified Dockerfile
4. Runs health checks
5. Performs zero-downtime deployment
6. Monitors service health

No manual image building or pushing required!

### Build Logs

View build logs in Render dashboard:

- Build → Logs tab
- Real-time streaming during builds
- Full build history retained

### Manual Testing Before Deploy

Test locally before pushing to Render:

```bash
# Build images
docker-compose -f infrastructure/docker/docker-compose.prod.yml build

# Start services
docker-compose -f infrastructure/docker/docker-compose.prod.yml up -d

# Run integration tests
pnpm test:integration

# Clean up
docker-compose -f infrastructure/docker/docker-compose.prod.yml down
```

## See Also

- [Infrastructure Overview](../README.md)
- [Environment Variables](../ENVIRONMENT_VARIABLES.md)
- [Deployment Guide](../DEPLOYMENT_GUIDE.md)
- [Render Configuration](../../render.yaml)
- [Local Development Guide](../LOCAL_DEVELOPMENT.md)
