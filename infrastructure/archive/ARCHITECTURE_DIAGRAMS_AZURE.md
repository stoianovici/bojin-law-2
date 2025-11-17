# Architecture Diagrams

This document provides visual representations (in text/ASCII format) of the Legal Platform infrastructure architecture and deployment pipelines.

## Table of Contents

1. [High-Level Azure Architecture](#high-level-azure-architecture)
2. [Kubernetes Cluster Architecture](#kubernetes-cluster-architecture)
3. [Network Architecture](#network-architecture)
4. [CI/CD Pipeline Flow](#cicd-pipeline-flow)
5. [Data Flow Architecture](#data-flow-architecture)
6. [Security Architecture](#security-architecture)

---

## High-Level Azure Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Azure Cloud (West Europe)                       │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                     Virtual Network (10.0.0.0/16)                 │    │
│  │                                                                   │    │
│  │  ┌──────────────────────────────────────────────────────────┐   │    │
│  │  │           AKS Cluster Subnet (10.0.1.0/24)               │   │    │
│  │  │                                                            │   │    │
│  │  │  ┌────────────────────────────────────────────────────┐  │   │    │
│  │  │  │  Azure Kubernetes Service (AKS)                     │  │   │    │
│  │  │  │  ┌──────────────┬──────────────┬─────────────────┐ │  │   │    │
│  │  │  │  │ System Pool  │  User Pool   │  User Pool      │ │  │   │    │
│  │  │  │  │ (2 nodes)    │ (3-10 nodes) │ (autoscale)     │ │  │   │    │
│  │  │  │  │ D2s_v3       │ D4s_v3       │                 │ │  │   │    │
│  │  │  │  └──────────────┴──────────────┴─────────────────┘ │  │   │    │
│  │  │  │                                                      │  │   │    │
│  │  │  │  Pods:                                              │  │   │    │
│  │  │  │  • Web App (Next.js) x3-10                         │  │   │    │
│  │  │  │  • GraphQL Gateway x3-10                           │  │   │    │
│  │  │  │  • Document Service x2-8                           │  │   │    │
│  │  │  │  • AI Service x2-6                                 │  │   │    │
│  │  │  │  • Task Service x2-8                               │  │   │    │
│  │  │  │  • Integration Service x2-6                        │  │   │    │
│  │  │  │  • Notification Service x2-6                       │  │   │    │
│  │  │  └────────────────────────────────────────────────────┘  │   │    │
│  │  │                           │                               │   │    │
│  │  │                           │ HTTP/HTTPS                    │   │    │
│  │  │                           ▼                               │   │    │
│  │  │                  ┌─────────────────┐                      │   │    │
│  │  │                  │ NGINX Ingress   │                      │   │    │
│  │  │                  │ Controller      │                      │   │    │
│  │  │                  │ (LoadBalancer)  │                      │   │    │
│  │  │                  └─────────────────┘                      │   │    │
│  │  └──────────────────────────│─────────────────────────────────┘   │    │
│  │                             │                                     │    │
│  │  ┌──────────────────────────┼─────────────────────────────────┐  │    │
│  │  │        Database Subnet (10.0.2.0/24)                       │  │    │
│  │  │                          │                                  │  │    │
│  │  │  ┌───────────────────────┼──────────────────────────────┐  │  │    │
│  │  │  │  Azure Database for PostgreSQL Flexible Server       │  │  │    │
│  │  │  │  • Version: 16                                        │  │  │    │
│  │  │  │  • Extensions: pgvector                               │  │  │    │
│  │  │  │  • SKU: GP_Standard_D4s_v3                            │  │  │    │
│  │  │  │  • Storage: 128 GB (auto-grow enabled)                │  │  │    │
│  │  │  │  • Backup: Automated 7-day retention                  │  │  │    │
│  │  │  │  • HA: Zone-redundant enabled                         │  │  │    │
│  │  │  └───────────────────────────────────────────────────────┘  │  │    │
│  │  └──────────────────────────────────────────────────────────────┘  │    │
│  │                                                                     │    │
│  │  ┌──────────────────────────────────────────────────────────────┐  │    │
│  │  │           Cache Subnet (10.0.3.0/24)                          │  │    │
│  │  │                                                                │  │    │
│  │  │  ┌──────────────────────────────────────────────────────────┐ │  │    │
│  │  │  │  Azure Cache for Redis                                   │ │  │    │
│  │  │  │  • SKU: Standard C1                                      │ │  │    │
│  │  │  │  • TLS: Enabled                                          │ │  │    │
│  │  │  │  • Persistence: RDB enabled                              │ │  │    │
│  │  │  │  • Eviction: allkeys-lru                                 │ │  │    │
│  │  │  └──────────────────────────────────────────────────────────┘ │  │    │
│  │  └──────────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Azure Blob Storage (GRS)                                        │    │
│  │  • Container: documents                                          │    │
│  │  • Container: templates                                          │    │
│  │  • Container: exports                                            │    │
│  │  • Container: backups                                            │    │
│  │  • Lifecycle: Move to Cool after 30 days                         │    │
│  │  • Versioning: Enabled                                           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Azure Key Vault                                                 │    │
│  │  • Secrets: Database credentials, API keys, certificates         │    │
│  │  • Access Policies: AKS managed identity, DevOps service principal│   │
│  │  • Soft Delete: 90 days retention                                │    │
│  │  • Purge Protection: Enabled                                     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Application Insights                                            │    │
│  │  • Log Analytics Workspace: legal-platform-logs                  │    │
│  │  • Retention: 90 days                                            │    │
│  │  • Sampling: Adaptive (100% for errors)                          │    │
│  │  • Alerts: Error rate, response time, availability               │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Azure Container Registry (ACR)                                  │    │
│  │  • SKU: Standard                                                 │    │
│  │  • Geo-replication: North Europe                                 │    │
│  │  • Retention Policy: Keep last 10 tags per repository            │    │
│  │  • Security: Vulnerability scanning with Trivy                   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Azure AD                                                         │    │
│  │  • Authentication: OAuth 2.0 / OpenID Connect                    │    │
│  │  • MFA: Enforced for all users                                   │    │
│  │  • Conditional Access: Device compliance required                │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ Internet
                                  ▼
                           ┌─────────────┐
                           │   End Users │
                           │  (Lawyers,  │
                           │  Paralegals)│
                           └─────────────┘
```

---

## Kubernetes Cluster Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster (AKS)                           │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Namespace: staging / production                              │   │
│  │                                                                │   │
│  │  ┌────────────────────────────────────────────────────────┐  │   │
│  │  │  Ingress Layer                                          │  │   │
│  │  │  ┌──────────────────────────────────────────────────┐  │  │   │
│  │  │  │  NGINX Ingress Controller                         │  │  │   │
│  │  │  │  • SSL/TLS Termination (cert-manager)             │  │  │   │
│  │  │  │  • Rate Limiting: 100 req/sec                     │  │  │   │
│  │  │  │  • Body Size Limit: 50 MB                         │  │  │   │
│  │  │  └──────────────────────────────────────────────────┘  │  │   │
│  │  │                         │                               │  │   │
│  │  │                         ▼                               │  │   │
│  │  │  ┌──────────────────────────────────────────────────┐  │  │   │
│  │  │  │  Route: legal-platform.com/*                      │  │  │   │
│  │  │  │         ↓                                         │  │  │   │
│  │  │  │    Service: legal-platform-web                    │  │  │   │
│  │  │  │         ↓                                         │  │  │   │
│  │  │  │  ┌──────────────────────────────────────┐        │  │  │   │
│  │  │  │  │  Deployment: web                      │        │  │  │   │
│  │  │  │  │  • Replicas: 3-10 (HPA)               │        │  │  │   │
│  │  │  │  │  • Image: next.js app                 │        │  │  │   │
│  │  │  │  │  • CPU: 250m-500m                     │        │  │  │   │
│  │  │  │  │  • Memory: 256Mi-512Mi                │        │  │  │   │
│  │  │  │  │  • Liveness: /api/health              │        │  │  │   │
│  │  │  │  │  • Readiness: /api/health             │        │  │  │   │
│  │  │  │  └──────────────────────────────────────┘        │  │  │   │
│  │  │  └──────────────────────────────────────────────────┘  │  │   │
│  │  │                                                          │  │   │
│  │  │  ┌──────────────────────────────────────────────────┐  │  │   │
│  │  │  │  Route: api.legal-platform.com/graphql            │  │  │   │
│  │  │  │         ↓                                         │  │  │   │
│  │  │  │    Service: legal-platform-gateway                │  │  │   │
│  │  │  │         ↓                                         │  │  │   │
│  │  │  │  ┌──────────────────────────────────────┐        │  │  │   │
│  │  │  │  │  Deployment: gateway                  │        │  │  │   │
│  │  │  │  │  • Replicas: 3-10 (HPA)               │        │  │  │   │
│  │  │  │  │  • Image: apollo-server               │        │  │  │   │
│  │  │  │  │  • CPU: 500m-1000m                    │        │  │  │   │
│  │  │  │  │  • Memory: 512Mi-1Gi                  │        │  │  │   │
│  │  │  │  └──────────────────────────────────────┘        │  │  │   │
│  │  │  │                    │                              │  │  │   │
│  │  │  │                    │ Internal calls               │  │  │   │
│  │  │  │      ┌─────────────┼─────────────┬──────────┐    │  │  │   │
│  │  │  │      ▼             ▼             ▼          ▼    │  │  │   │
│  │  │  │   ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐│  │  │   │
│  │  │  │   │document│  │   ai   │  │  task  │  │integra-││  │  │   │
│  │  │  │   │service │  │ service│  │ service│  │tion    ││  │  │   │
│  │  │  │   │        │  │        │  │        │  │ service││  │  │   │
│  │  │  │   │ 2-8    │  │ 2-6    │  │ 2-8    │  │ 2-6    ││  │  │   │
│  │  │  │   │ pods   │  │ pods   │  │ pods   │  │ pods   ││  │  │   │
│  │  │  │   └────────┘  └────────┘  └────────┘  └────────┘│  │  │   │
│  │  │  └──────────────────────────────────────────────────┘  │  │   │
│  │  └────────────────────────────────────────────────────────┘  │   │
│  │                                                                │   │
│  │  ┌────────────────────────────────────────────────────────┐  │   │
│  │  │  Configuration Layer                                    │  │   │
│  │  │  ┌──────────────────┐    ┌─────────────────────────┐  │  │   │
│  │  │  │  ConfigMap       │    │  Secrets (from Key Vault)│  │  │   │
│  │  │  │  • API URLs      │    │  • Database URL          │  │  │   │
│  │  │  │  • Feature flags │    │  • Redis URL             │  │  │   │
│  │  │  │  • Service URLs  │    │  • OpenAI API key        │  │  │   │
│  │  │  │  • Log level     │    │  • Storage connection    │  │  │   │
│  │  │  └──────────────────┘    └─────────────────────────┘  │  │   │
│  │  └────────────────────────────────────────────────────────┘  │   │
│  │                                                                │   │
│  │  ┌────────────────────────────────────────────────────────┐  │   │
│  │  │  Autoscaling                                            │  │   │
│  │  │  • HPA: CPU 70%, Memory 80%                             │  │   │
│  │  │  • Cluster Autoscaler: 3-20 nodes                       │  │   │
│  │  │  • Scale-up: Immediate on high load                     │  │   │
│  │  │  • Scale-down: 5 min stabilization window               │  │   │
│  │  └────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Network Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Internet                                     │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                │ HTTPS (443)
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Azure Load Balancer                               │
│                    (Public IP: x.x.x.x)                              │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│             Virtual Network: vnet-legal-production                   │
│                      (10.0.0.0/16)                                   │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  AKS Subnet (10.0.1.0/24)                                     │  │
│  │  ┌─────────────────────────────────────────────────────────┐ │  │
│  │  │  Network Security Group: nsg-aks                         │ │  │
│  │  │  Inbound Rules:                                          │ │  │
│  │  │  • Allow 443 from Internet (HTTPS)                       │ │  │
│  │  │  • Allow 10.0.0.0/16 (Internal VNet)                     │ │  │
│  │  │  • Deny all other                                        │ │  │
│  │  │                                                           │ │  │
│  │  │  Outbound Rules:                                         │ │  │
│  │  │  • Allow 10.0.2.0/24 (Database subnet)                   │ │  │
│  │  │  • Allow 10.0.3.0/24 (Cache subnet)                      │ │  │
│  │  │  • Allow Internet (443, 80) for external APIs            │ │  │
│  │  │  • Deny all other                                        │ │  │
│  │  └─────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Database Subnet (10.0.2.0/24)                                │  │
│  │  ┌─────────────────────────────────────────────────────────┐ │  │
│  │  │  Network Security Group: nsg-database                    │ │  │
│  │  │  Inbound Rules:                                          │ │  │
│  │  │  • Allow 5432 from 10.0.1.0/24 (AKS subnet)              │ │  │
│  │  │  • Allow 5432 from Azure Management IPs                  │ │  │
│  │  │  • Deny all other                                        │ │  │
│  │  │                                                           │ │  │
│  │  │  Private Endpoint:                                       │ │  │
│  │  │  • psql-legal-production.postgres.database.azure.com     │ │  │
│  │  │  • Private IP: 10.0.2.10                                 │ │  │
│  │  └─────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Cache Subnet (10.0.3.0/24)                                   │  │
│  │  ┌─────────────────────────────────────────────────────────┐ │  │
│  │  │  Network Security Group: nsg-cache                       │ │  │
│  │  │  Inbound Rules:                                          │ │  │
│  │  │  • Allow 6379,6380 from 10.0.1.0/24 (AKS subnet)         │ │  │
│  │  │  • Deny all other                                        │ │  │
│  │  │                                                           │ │  │
│  │  │  Private Endpoint:                                       │ │  │
│  │  │  • redis-legal-production.redis.cache.windows.net        │ │  │
│  │  │  • Private IP: 10.0.3.10                                 │ │  │
│  │  └─────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Private DNS Zones                                            │  │
│  │  • privatelink.postgres.database.azure.com                    │  │
│  │  • privatelink.redis.cache.windows.net                        │  │
│  │  • privatelink.blob.core.windows.net                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────┘
```

---

## CI/CD Pipeline Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          GitHub Repository                                │
│                       (Source Code + Workflows)                           │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                  ┌──────────────┴──────────────┐
                  │                             │
                  ▼                             ▼
    ┌─────────────────────────┐   ┌─────────────────────────┐
    │   Pull Request Created  │   │  Push to main branch    │
    └────────────┬────────────┘   └────────────┬────────────┘
                 │                             │
                 ▼                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              GitHub Actions: PR Validation Workflow                      │
│  ┌────────────┐  ┌────────────┐  ┌──────────┐  ┌────────────────────┐ │
│  │  Install   │→│ Type Check │→│  Lint    │→│  Unit Tests        │ │
│  │ Deps (pnpm)│  │ (tsc)      │  │ (ESLint) │  │ (Jest + coverage)  │ │
│  └────────────┘  └────────────┘  └──────────┘  └────────────────────┘ │
│                                                            │              │
│  ┌────────────────────┐  ┌──────────────────────────────┐ │              │
│  │  Build All Apps    │→│  E2E Tests (Playwright)       │ │              │
│  │  & Services        │  │  (docker-compose environment) │ │              │
│  └────────────────────┘  └──────────────────────────────┘ │              │
│                                                            │              │
│  Result: ✅ All Checks Pass                              │              │
└─────────────────────────────────────────────────────────────────────────┘
                                 │
                    [Merge to main]
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│          GitHub Actions: Build & Publish Workflow                        │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Build Docker Images                                              │  │
│  │  ┌──────────┬─────────────┬──────────────┬──────────────────┐   │  │
│  │  │   web    │   gateway   │   document   │   5 more services│   │  │
│  │  │  image   │    image    │     image    │      images      │   │  │
│  │  └──────────┴─────────────┴──────────────┴──────────────────┘   │  │
│  │                           │                                       │  │
│  │  ┌────────────────────────▼─────────────────────────────────┐   │  │
│  │  │  Security Scan (Trivy)                                    │   │  │
│  │  │  • Scan for HIGH/CRITICAL vulnerabilities                 │   │  │
│  │  │  • Fail build if critical issues found                    │   │  │
│  │  └───────────────────────────────────────────────────────────┘   │  │
│  │                           │                                       │  │
│  │  ┌────────────────────────▼─────────────────────────────────┐   │  │
│  │  │  Tag Images                                               │   │  │
│  │  │  • main branch → :latest                                  │   │  │
│  │  │  • All branches → :branch-name                            │   │  │
│  │  │  • All commits → :commit-sha                              │   │  │
│  │  └───────────────────────────────────────────────────────────┘   │  │
│  │                           │                                       │  │
│  │  ┌────────────────────────▼─────────────────────────────────┐   │  │
│  │  │  Push to Azure Container Registry                         │   │  │
│  │  │  • acrlegalstaging.azurecr.io                             │   │  │
│  │  │  • acrlegalproduction.azurecr.io                          │   │  │
│  │  └───────────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                 │
                    [Images in ACR]
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│           Azure DevOps: Application Deployment Pipeline                  │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  STAGE 1: Pull & Validate Images                                 │  │
│  │  • Pull images from ACR                                           │  │
│  │  • Run security scan                                              │  │
│  └────────────────────────────┬─────────────────────────────────────┘  │
│                                ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  STAGE 2: Update Kubernetes Manifests                            │  │
│  │  • Replace image tags with commit SHA                             │  │
│  │  • Publish manifests as artifact                                  │  │
│  └────────────────────────────┬─────────────────────────────────────┘  │
│                                ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  STAGE 3: Deploy to Staging AKS                                   │  │
│  │  • Get AKS credentials                                             │  │
│  │  • Apply ConfigMaps, Secrets, Services                            │  │
│  │  • Apply Deployments                                               │  │
│  │  • Apply Ingress, HPA                                              │  │
│  │  • Wait for rollout completion                                     │  │
│  └────────────────────────────┬─────────────────────────────────────┘  │
│                                ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  STAGE 4: Smoke Tests (Staging)                                   │  │
│  │  • Health endpoint checks                                          │  │
│  │  • GraphQL query test                                              │  │
│  │  • Database connectivity test                                      │  │
│  │  • Redis connectivity test                                         │  │
│  └────────────────────────────┬─────────────────────────────────────┘  │
│                                ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  STAGE 5: Manual Approval Gate                                    │  │
│  │  ⏸️  Pause for Production Approval                                 │  │
│  │  • Notify: Technical Lead, Product Owner                           │  │
│  │  • Timeout: 24 hours                                               │  │
│  │  • Review checklist before approval                                │  │
│  └────────────────────────────┬─────────────────────────────────────┘  │
│                          [Approved]                                      │
│                                ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  STAGE 6: Blue-Green Deployment (Production)                      │  │
│  │  • Determine current color (blue/green)                            │  │
│  │  • Deploy new version with opposite color label                    │  │
│  │  • Wait for deployment ready                                       │  │
│  │  • Run health checks on new deployment                             │  │
│  │  • Switch service selector to new color                            │  │
│  │  • Keep old deployment for quick rollback                          │  │
│  └────────────────────────────┬─────────────────────────────────────┘  │
│                                ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  STAGE 7: Production Health Checks                                │  │
│  │  • Health endpoint validation (retry 5x)                           │  │
│  │  • Application Insights error check                                │  │
│  │  • ❌ If failed: Automatic rollback to previous color              │  │
│  │  • ✅ If passed: Deployment successful                             │  │
│  └────────────────────────────┬─────────────────────────────────────┘  │
│                                ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  STAGE 8: Post-Deployment Monitoring                              │  │
│  │  • Query Application Insights for errors                           │  │
│  │  • Monitor metrics for 5 minutes                                   │  │
│  │  • Send deployment summary notification                            │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
                        ✅ Deployment Complete
```

---

## Data Flow Architecture

```
┌───────────────┐
│   End User    │
│   (Browser)   │
└───────┬───────┘
        │ HTTPS
        ▼
┌─────────────────────────────────────────────────────────┐
│            NGINX Ingress Controller                      │
│            (SSL/TLS Termination)                         │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌──────────────┐          ┌──────────────────┐
│  Next.js Web │          │  GraphQL Gateway │
│  Application │          │  (Apollo Server) │
│              │──────────│                  │
│  SSR + CSR   │  API     │  • Query routing │
└──────────────┘  Calls   │  • Authentication│
                          │  • Data federation│
                          └────────┬─────────┘
                                   │
            ┌──────────────────────┼──────────────────────┐
            │                      │                      │
            ▼                      ▼                      ▼
    ┌───────────────┐     ┌───────────────┐     ┌──────────────┐
    │   Document    │     │  AI Service   │     │ Task Service │
    │   Service     │     │               │     │              │
    │               │     │ • OpenAI API  │     │ • Deadlines  │
    │ • Upload/     │     │ • Embeddings  │     │ • Reminders  │
    │   Download    │     │ • Chat        │     │              │
    │ • OCR         │     │               │     │              │
    └───────┬───────┘     └───────┬───────┘     └──────┬───────┘
            │                     │                    │
            │          ┌──────────┴────────────┐       │
            │          │                       │       │
            ▼          ▼                       ▼       ▼
    ┌────────────────────────┐       ┌────────────────────────┐
    │  Azure Blob Storage    │       │  PostgreSQL Database   │
    │                        │       │                        │
    │  • Documents           │       │  • Cases               │
    │  • Templates           │       │  • Clients             │
    │  • Exports             │       │  • Documents metadata  │
    │  • Backups             │       │  • Tasks               │
    └────────────────────────┘       │  • Users               │
                                     │  • Audit logs          │
                                     │  • Vector embeddings   │
                                     │    (pgvector)          │
                                     └────────────────────────┘
                                                │
                                     ┌──────────┴──────────┐
                                     │                     │
                                     ▼                     ▼
                            ┌────────────────┐   ┌────────────────┐
                            │ Redis Cache    │   │ Application    │
                            │                │   │ Insights       │
                            │ • Sessions     │   │                │
                            │ • Query cache  │   │ • Logs         │
                            │ • Rate limits  │   │ • Metrics      │
                            └────────────────┘   │ • Traces       │
                                                 │ • Exceptions   │
                                                 └────────────────┘
```

---

## Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Security Layers                           │
│                                                                   │
│  Layer 1: Network Security                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  • Network Security Groups (NSGs) on all subnets          │  │
│  │  • Private Endpoints for PaaS services                    │  │
│  │  • No public IPs except Load Balancer                     │  │
│  │  • WAF on Application Gateway (optional)                  │  │
│  │  • DDoS Protection Standard                               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  Layer 2: Identity & Access                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  • Azure AD for authentication                            │  │
│  │  • OAuth 2.0 / OpenID Connect                             │  │
│  │  • Multi-Factor Authentication (MFA) required             │  │
│  │  • Conditional Access policies                            │  │
│  │  • Managed Identities for Azure resources                 │  │
│  │  • RBAC on AKS namespaces                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  Layer 3: Data Protection                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  • Encryption at rest (AES-256)                           │  │
│  │  • Encryption in transit (TLS 1.2+)                       │  │
│  │  • Azure Key Vault for secrets management                 │  │
│  │  • Secrets Store CSI Driver in AKS                        │  │
│  │  • Database: SSL/TLS required                             │  │
│  │  • Redis: TLS enabled                                     │  │
│  │  • Blob Storage: HTTPS only                               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  Layer 4: Application Security                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  • Container image scanning (Trivy)                       │  │
│  │  • Pod Security Standards (restricted)                    │  │
│  │  • Network Policies (pod-to-pod isolation)                │  │
│  │  • Resource quotas and limits                             │  │
│  │  • Input validation and sanitization                      │  │
│  │  • CORS policies                                          │  │
│  │  • Rate limiting (100 req/sec)                            │  │
│  │  • Security headers (CSP, HSTS, X-Frame-Options)          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  Layer 5: Monitoring & Auditing                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  • Application Insights for application logs              │  │
│  │  • AKS audit logs (kube-audit)                            │  │
│  │  • Azure Activity Logs                                    │  │
│  │  • Key Vault access auditing                              │  │
│  │  • Database audit logs                                    │  │
│  │  • Security Center recommendations                        │  │
│  │  • Alerts for suspicious activity                         │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      Secrets Management Flow                     │
│                                                                   │
│   Developer/CI/CD                                                │
│         │                                                         │
│         │ (1) Store secrets                                      │
│         ▼                                                         │
│   ┌──────────────────┐                                          │
│   │  Azure Key Vault │                                          │
│   │                  │                                          │
│   │  • DB password   │                                          │
│   │  • Redis key     │                                          │
│   │  • API keys      │                                          │
│   │  • Certificates  │                                          │
│   └────────┬─────────┘                                          │
│            │                                                      │
│            │ (2) CSI Driver mounts                               │
│            ▼                                                      │
│   ┌──────────────────────────┐                                  │
│   │ SecretProviderClass      │                                  │
│   │ (Kubernetes CRD)         │                                  │
│   └────────┬─────────────────┘                                  │
│            │                                                      │
│            │ (3) Synced as K8s Secret                            │
│            ▼                                                      │
│   ┌──────────────────────────┐                                  │
│   │ Kubernetes Secret        │                                  │
│   │ (in memory only)         │                                  │
│   └────────┬─────────────────┘                                  │
│            │                                                      │
│            │ (4) Mounted as env vars                             │
│            ▼                                                      │
│   ┌──────────────────────────┐                                  │
│   │ Application Pods         │                                  │
│   │ (environment variables)  │                                  │
│   └──────────────────────────┘                                  │
└───────────────────────────────────────────────────────────────────┘
```

---

## Disaster Recovery Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Primary Region (West Europe)                  │
│                                                                   │
│  ┌────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ AKS Cluster    │  │ PostgreSQL      │  │ Blob Storage    │ │
│  │ (Active)       │  │ (Primary)       │  │ (GRS - Active)  │ │
│  └────────┬───────┘  └────────┬────────┘  └────────┬────────┘ │
│           │                   │                     │           │
│           │ Continuous Sync   │ Geo-Replication     │           │
│           ▼                   ▼                     ▼           │
└───────────────────────────────────────────────────────────────────┘
            │                   │                     │
            │ Failover (Manual) │ Automatic Failover  │
            ▼                   ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│               Secondary Region (North Europe)                    │
│                                                                   │
│  ┌────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ AKS Cluster    │  │ PostgreSQL      │  │ Blob Storage    │ │
│  │ (Standby)      │  │ (Read Replica)  │  │ (GRS - Standby) │ │
│  └────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                   │
│  • Infrastructure: Terraform-managed (identical to primary)      │
│  • DNS: Manual failover via DNS A record update                  │
│  • RPO: 5 minutes (database), 15 minutes (blob storage)         │
│  • RTO: 2 hours (full regional failover)                         │
└───────────────────────────────────────────────────────────────────┘
```

---

## Additional Documentation

For implementation details, see:

- [Terraform Documentation](terraform/README.md)
- [Kubernetes Documentation](kubernetes/README.md)
- [Docker Documentation](docker/README.md)
- [Deployment Guide](DEPLOYMENT_GUIDE.md)
- [Operations Runbook](OPERATIONS_RUNBOOK.md)
