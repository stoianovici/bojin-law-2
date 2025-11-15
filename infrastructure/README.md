# Infrastructure as Code for Legal Platform

## Overview

This directory contains all Infrastructure as Code (IaC) configurations for the Romanian Legal Practice Management Platform. The infrastructure is provisioned on Microsoft Azure using Terraform for declarative setup and Kubernetes for container orchestration.

The setup follows the architecture defined in `docs/architecture/high-level-architecture.md` and supports the monorepo structure outlined in the repository tree.

## Directory Structure

```
infrastructure/
├── terraform/                  # Terraform configurations for Azure resources
│   ├── main.tf                 # Main Terraform configuration
│   ├── variables.tf            # Input variables
│   ├── outputs.tf              # Output values
│   ├── backend.tf              # Remote state backend
│   ├── environments/           # Environment-specific configurations
│   │   ├── staging/            # Staging environment tfvars
│   │   └── production/         # Production environment tfvars
│   └── modules/                # Reusable Terraform modules
│       ├── aks/                # AKS cluster module
│       ├── database/           # PostgreSQL module
│       ├── cache/              # Redis module
│       ├── storage/            # Blob Storage module
│       ├── monitoring/         # Application Insights module
│       ├── networking/         # VNet and subnet module
│       └── security/           # Key Vault module
├── kubernetes/                 # Kubernetes manifests for AKS
│   ├── namespaces/             # Namespace definitions
│   ├── deployments/            # Deployment configurations for services
│   ├── services/               # Service and load balancer configs
│   ├── configmaps/             # Configuration management
│   ├── secrets/                # Secret templates (Key Vault integration)
│   ├── ingress/                # Ingress controllers and routing
│   └── hpa/                    # Horizontal Pod Autoscaler configs
├── docker/                     # Docker configurations
│   ├── Dockerfile.web          # Production Dockerfile for web app
│   ├── Dockerfile.gateway      # Production Dockerfile for API gateway
│   ├── Dockerfile.service      # Template for microservices
│   ├── docker-compose.yml      # Local development stack
│   ├── docker-compose.prod.yml # Production-like testing
│   └── docker-compose.test.yml # CI testing environment
├── scripts/                    # Deployment and validation scripts
│   ├── validate-env.sh         # Environment variable validation
│   ├── deploy-infra.sh         # Infrastructure deployment helper
│   └── health-check.sh         # Service health checks
└── docs/                       # Infrastructure documentation
    ├── DEPLOYMENT_GUIDE.md     # Step-by-step deployment instructions
    ├── ROLLBACK_GUIDE.md       # Rollback procedures
    ├── COST_ESTIMATION.md      # Cost analysis and optimization
    └── ENVIRONMENT_VARIABLES.md # Environment variable documentation
```

## Prerequisites

- **Azure Subscription**: Active subscription with Contributor role
- **Terraform**: Version 1.7+ installed
- **kubectl**: For Kubernetes management
- **Helm**: For chart deployments (optional)
- **Azure CLI**: For authentication and resource management
- **Docker**: For local development and testing

## Quick Start

### 1. Authentication

```bash
az login
az account set --subscription \"Your Subscription ID\"
```

### 2. Infrastructure Provisioning (Staging)

```bash
cd infrastructure/terraform
terraform init
terraform plan -var-file=environments/staging/terraform.tfvars
terraform apply -var-file=environments/staging/terraform.tfvars
```

### 3. Local Development

```bash
docker-compose up -d
# Access web app at http://localhost:3000
# API Gateway at http://localhost:4000
```

### 4. Kubernetes Deployment

```bash
kubectl apply -f infrastructure/kubernetes/
kubectl get pods -n legal-platform
```

## Key Commands

### Infrastructure

```bash
# Validate configuration
terraform validate

# Plan changes
terraform plan

# Apply changes
terraform apply

# Destroy resources
terraform destroy
```

### Docker

```bash
# Build all images
docker-compose build

# Start services
docker-compose up -d

# Run tests
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

### Kubernetes

```bash
# Apply manifests
kubectl apply -k infrastructure/kubernetes/

# Scale services
kubectl scale deployment/web --replicas=3

# Check health
kubectl get hpa
```

## Environment-Specific Configurations

- **Staging**: Full feature set, limited scaling, public endpoints for testing
- **Production**: High availability, private networking, auto-scaling, monitoring alerts

## Cost Management

See `COST_ESTIMATION.md` for detailed cost breakdown and optimization strategies. Current estimated monthly costs:

- Staging: ~$390
- Production: ~$1,200 (estimated)

## Security Considerations

- All Azure resources use private endpoints where possible
- Secrets managed via Azure Key Vault with managed identities
- Infrastructure state stored in secure Azure Blob with locking
- Network security groups restrict access to approved IPs

## Monitoring and Logging

- Application Insights integrated for all services
- Centralized logging via Log Analytics
- Health checks configured for all deployments
- Cost alerts set up for budget monitoring

For detailed deployment procedures, see `DEPLOYMENT_GUIDE.md`. For troubleshooting, refer to the runbook in `docs/runbook.md`.

**Last Updated:** 2025-11-15
**Version:** 1.0 (Story 2.1)
