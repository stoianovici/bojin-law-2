# Archived Azure Infrastructure Documentation

This directory contains archived documentation from the original Azure/Kubernetes infrastructure design.

## Background

These documents were created during initial infrastructure planning when Azure AKS (Azure Kubernetes Service) was the intended deployment platform. After comprehensive cost analysis and evaluation, the project pivoted to Render.com Platform-as-a-Service (PaaS) to achieve:

- **83% cost reduction** ($11,784/year savings)
- **75% reduction in DevOps overhead** (20 hours/month → 5 hours/month)
- **Faster time-to-market** (6-8 weeks → 3-5 days)
- **Simpler deployment model** (git push vs Kubernetes/Terraform complexity)

## Archived Documents

| Document                         | Description                            | Original Purpose                                |
| -------------------------------- | -------------------------------------- | ----------------------------------------------- |
| `DEPLOYMENT_GUIDE_AZURE.md`      | Azure AKS deployment procedures        | Guide for deploying to Azure Kubernetes Service |
| `ROLLBACK_GUIDE_AZURE.md`        | Azure rollback and recovery procedures | How to rollback failed deployments on Azure     |
| `OPERATIONS_RUNBOOK_AZURE.md`    | Azure operations and maintenance       | Day-to-day operations on Azure infrastructure   |
| `ARCHITECTURE_DIAGRAMS_AZURE.md` | Azure architecture diagrams            | Visual architecture for Azure/Kubernetes setup  |

## Current Infrastructure

**For current infrastructure documentation, see:**

- [`infrastructure/README.md`](../README.md) - Overview of Render.com infrastructure
- [`infrastructure/DEPLOYMENT_GUIDE.md`](../DEPLOYMENT_GUIDE.md) - Render deployment procedures
- [`infrastructure/OPERATIONS_RUNBOOK.md`](../OPERATIONS_RUNBOOK.md) - Render operations guide
- [`infrastructure/COST_ESTIMATION.md`](../COST_ESTIMATION.md) - Render cost analysis

## Why Keep These Archives?

These documents are preserved for:

1. **Historical reference** - Understanding the decision-making process
2. **Learning** - Comparison between Azure/Kubernetes and Render approaches
3. **Future migration planning** - If the platform eventually outgrows Render (estimated: 10k+ users)
4. **Knowledge retention** - Preserving the research and planning effort

## Migration Timeline

- **November 2025** - Azure infrastructure designed (Story 2.1)
- **November 2025** - Cost analysis revealed Azure limitations
- **November 2025** - Decision to migrate to Render (Story 2.1.1)
- **Current** - Running on Render.com

## When Would We Reconsider Azure?

The platform might benefit from migrating back to Azure/Kubernetes when:

- Daily active users exceed 10,000
- Multi-region latency requirements emerge
- Database size exceeds 500GB
- Compliance requires specific cloud provider (e.g., FedRAMP)
- Custom networking or infrastructure needs arise

**Estimated timeline:** 2-5 years for most legal SaaS platforms

---

**Note:** These documents are not maintained and may be outdated. Refer to current documentation in the parent `infrastructure/` directory.
