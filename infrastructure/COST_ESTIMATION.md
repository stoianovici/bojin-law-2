# Infrastructure Cost Estimation

## Overview

This document provides estimated monthly costs for the Legal Platform infrastructure on Azure. Estimates are based on Azure Pricing Calculator (as of November 2025) for the staging environment in West Europe region. Production costs will be 2-3x higher due to scaling and redundancy.

**Total Estimated Monthly Cost for Staging**: ~$390 USD

**Assumptions**:
- Pay-as-you-go pricing (no reservations or savings plans)
- Standard tiers for all services
- Moderate usage (e.g., 5 GB/day logging, 1 TB storage)
- No data transfer costs included (intra-region)
- Costs exclude Azure AD and Key Vault (minimal)

## Breakdown by Service

### 1. Azure Kubernetes Service (AKS)
- **Configuration**: 2 system nodes (D2s_v3, 2 vCPU, 8 GB RAM each) + 3 user nodes (D4s_v3, 4 vCPU, 16 GB RAM each, autoscaling 3-10)
- **Estimated Cost**: $150/month
  - System pool: $60 (2 nodes x $0.096/hour x 730 hours)
  - User pool: $90 (3 nodes x $0.192/hour x 730 hours)
- **Optimization**: Use spot instances for user pool to reduce by 50%

### 2. Azure Database for PostgreSQL Flexible Server
- **Configuration**: 16.0 version, 4 vCores, 32 GB RAM, 1 TB storage, pgvector extension, 7-day backups, high availability
- **Estimated Cost**: $100/month
  - Compute: $73 (Burstable B4ms, $0.10/hour x 730)
  - Storage: $20 (1 TB x $0.115/GB/month)
  - Backups: $7 (7 days x 1 TB x $0.20/GB/month)
- **Optimization**: Use General Purpose tier for production, scale down during off-hours

### 3. Azure Cache for Redis
- **Configuration**: Standard C1 tier (1 GB, 100 MB/s bandwidth), persistence enabled
- **Estimated Cost**: $70/month
  - Compute: $68 (C1 x $0.093/hour x 730)
  - Data persistence: $2
- **Optimization**: Upgrade to Premium for better SLA, but higher cost

### 4. Azure Blob Storage
- **Configuration**: Standard LRS (or GRS for geo-redundancy), 1 TB storage, 10 GB/day operations
- **Estimated Cost**: $20/month
  - Storage: $18 (1 TB x $0.0184/GB/month)
  - Operations: $2 (10K write + 10K read x $0.0004/10K)
- **Optimization**: Use Cool tier for archived documents, lifecycle policies to delete old versions

### 5. Azure Application Insights & Log Analytics
- **Configuration**: 5 GB/day ingestion, 30-day retention, basic sampling
- **Estimated Cost**: $50/month
  - Ingestion: $36 (5 GB x $2.3/GB x 30 days, with free 5 GB/month)
  - Retention: $14 (30 days x $0.10/GB/month x 5 GB/day x 30)
- **Optimization**: Enable sampling (50%) to reduce ingestion costs

### 6. Azure Key Vault
- **Configuration**: Standard tier, 10 operations/day, HSM not required
- **Estimated Cost**: $0.20/month (minimal, free tier covers)
- **Note**: Billed per 10,000 operations; negligible for this use case

### 7. Networking (VNet, Subnets, Load Balancer)
- **Configuration**: Basic VNet with 3 subnets, Standard Load Balancer
- **Estimated Cost**: $5/month
  - Load Balancer: $5 (Standard SKU, inbound data)
- **Optimization**: Use Basic SKU for dev environments

## Total Cost Summary

| Service | Estimated Cost | % of Total |
|---------|---------------|------------|
| AKS | $150 | 38% |
| PostgreSQL | $100 | 26% |
| Redis | $70 | 18% |
| Blob Storage | $20 | 5% |
| Application Insights | $50 | 13% |
| Key Vault & Networking | $5 | 1% |
| **Total** | **$395** | **100%** |

## Production Estimate
- Scale: 2x nodes, Premium tiers, GRS storage, 10 GB/day logging
- **Estimated**: $800-1,200/month
- Add: Azure AD Premium ($6/user/month), CDN for frontend ($50/month)

## Cost Optimization Recommendations
1. **Reservations**: Commit to 1-year reservations for AKS and PostgreSQL (save 30-50%)
2. **Autoscaling**: Enable AKS autoscaling and PostgreSQL auto-pause for dev
3. **Monitoring**: Set budget alerts at 80% of estimate
4. **Cleanup**: Use Terraform destroy for dev environments when not in use
5. **Free Tier**: Leverage Azure free credits for initial setup

## Monitoring & Alerts
- Use Azure Cost Management to track actual vs estimated
- Set budget alert at $350/month for staging
- Review monthly with Azure Pricing Calculator updates

## References
- Azure Pricing Calculator: https://azure.microsoft.com/pricing/calculator/
- AKS Pricing: https://azure.microsoft.com/pricing/details/kubernetes-service/
- PostgreSQL Pricing: https://azure.microsoft.com/pricing/details/postgresql/flexible-server/
- Last Updated: 2025-11-15
- Version: 1.0