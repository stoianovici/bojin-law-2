# Docker Configuration for Legal Platform

## Overview

This directory contains Dockerfiles and docker-compose configurations for the Legal Platform. The setup supports local development, CI testing, and production deployments on Azure Kubernetes Service (AKS).

### Dockerfiles

- **Dockerfile.dev**: Development build with hot-reload (existing)
- **Dockerfile.web**: Production build for Next.js frontend app
- **Dockerfile.gateway**: Production build for GraphQL API Gateway
- **Dockerfile.service**: Template for microservices (document, task, ai, integration, notification)

All production Dockerfiles use multi-stage builds for optimized image sizes (< 200MB) and non-root users for security.

## Build Process

### Local Build

```bash
# Build web app
cd apps/web
docker build -f ../../infrastructure/docker/Dockerfile.web -t legal-platform/web:latest .

# Build API Gateway (assume services/gateway exists)
cd services/gateway
docker build -f ../../infrastructure/docker/Dockerfile.gateway -t legal-platform/gateway:latest .

# Build a microservice (e.g., document-service)
cd services/document-service
docker build -f ../../infrastructure/docker/Dockerfile.service -t legal-platform/document-service:latest .
```

### CI/CD Build (GitHub Actions / Azure DevOps)

Images are built and pushed to Azure Container Registry (ACR) on merge to main:

```yaml
# Example GitHub Actions step
- name: Build and push Docker images
  run: |
    docker build -f infrastructure/docker/Dockerfile.web -t ${{ secrets.ACR_NAME }}.azurecr.io/legal-platform/web:${{ github.sha }} .
    docker push ${{ secrets.ACR_NAME }}.azurecr.io/legal-platform/web:${{ github.sha }}
    docker tag ${{ secrets.ACR_NAME }}.azurecr.io/legal-platform/web:${{ github.sha }} ${{ secrets.ACR_NAME }}.azurecr.io/legal-platform/web:latest
    docker push ${{ secrets.ACR_NAME }}.azurecr.io/legal-platform/web:latest
```

### Optimization Notes

- **Multi-stage builds**: Separate deps, build, runtime stages to reduce image size
- **pnpm caching**: Use --frozen-lockfile for reproducible builds
- **Alpine base**: Minimal Node.js images (~50MB base)
- **Non-root user**: Security best practice, UID 1001
- **Health checks**: Built-in for Kubernetes liveness/readiness probes

## docker-compose Configurations

### Local Development (docker-compose.yml)

Starts full stack with hot-reload for development:

Services:
- **postgres**: PostgreSQL 16 with pgvector extension
- **redis**: Redis 7.2 for caching/sessions
- **web**: Next.js dev server (volume mount for hot-reload)
- **gateway**: GraphQL API (volume mount)
- **document-service**: Document management microservice
- **task-service**: Task management microservice

Usage:
```bash
docker-compose up -d
# Access web at http://localhost:3000
# API at http://localhost:4000/graphql
```

### Production Testing (docker-compose.prod.yml)

Production-like environment without hot-reload, using production Dockerfiles:

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### CI Testing (docker-compose.test.yml)

Minimal stack for E2E tests, with test databases:

```bash
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

## Health Checks

All services expose `/health` endpoint for monitoring:

- **Web**: `GET /api/health` (Next.js API route)
- **Gateway**: `GET /health` (Express route)
- **Services**: `GET /health` (standard for microservices)

Kubernetes uses these for liveness and readiness probes.

## Volumes and Networking

- **Volumes**: Persistent data for postgres (./volumes/postgres), document uploads (./volumes/documents)
- **Networking**: Internal network `legal-platform-net` for service discovery
- **Ports**: web:3000, gateway:4000, services:3001-3005

## Security Considerations

- Run containers as non-root users
- Use secrets for environment variables in production
- Scan images with Trivy or Azure Defender
- Limit container privileges (no --privileged)
- Use read-only root filesystem where possible

## Troubleshooting

- **Build fails**: Check pnpm-lock.yaml consistency, run `pnpm install` locally
- **Port conflicts**: Adjust ports in docker-compose.yml
- **Database connection**: Verify DATABASE_URL, check postgres logs
- **Health check fails**: Implement /health endpoint if missing
- **Image too large**: Verify multi-stage build, remove devDependencies

For full deployment, see `DEPLOYMENT_GUIDE.md` in infrastructure/.

**Last Updated**: 2025-11-15 (Story 2.1)