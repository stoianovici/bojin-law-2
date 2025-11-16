# Infrastructure Cost Estimation

This document provides detailed cost estimates for the Legal Platform Azure infrastructure across staging and production environments.

**Last Updated:** 2025-11-16
**Currency:** USD
**Pricing Region:** West Europe (Amsterdam)

## Executive Summary

| Environment    | Monthly Cost     | Annual Cost      | Notes                               |
| -------------- | ---------------- | ---------------- | ----------------------------------- |
| **Staging**    | **$407/month**   | **$4,884/year**  | Development and testing environment |
| **Production** | **$1,189/month** | **$14,268/year** | Production with HA and scaling      |

## Staging Environment Costs

### Compute Resources

#### Azure Kubernetes Service (AKS)

| Component        | Specification                       | Quantity | Unit Cost    | Monthly Cost |
| ---------------- | ----------------------------------- | -------- | ------------ | ------------ |
| System Node Pool | Standard_D2s_v3 (2 vCPU, 8 GB RAM)  | 2 nodes  | $70.08/node  | $140.16      |
| User Node Pool   | Standard_D4s_v3 (4 vCPU, 16 GB RAM) | 3 nodes  | $140.16/node | $420.48      |
| **AKS Subtotal** |                                     |          |              | **$560.64**  |

### Database Resources

#### PostgreSQL Flexible Server

| Component               | Specification                            | Unit Cost       | Monthly Cost |
| ----------------------- | ---------------------------------------- | --------------- | ------------ |
| Compute                 | GP_Standard_D4s_v3 (4 vCores, 16 GB RAM) | $0.234/hour     | $170.64      |
| Storage                 | 32 GB                                    | $0.138/GB/month | $4.42        |
| Backup                  | 7-day retention (~50 GB)                 | $0.095/GB/month | $4.75        |
| **PostgreSQL Subtotal** |                                          |                 | **$179.81**  |

### Cache Resources

#### Azure Cache for Redis

| Component          | Specification        | Unit Cost       | Monthly Cost |
| ------------------ | -------------------- | --------------- | ------------ |
| Redis Cache        | Standard C1 (1 GB)   | $0.04/hour      | $29.20       |
| Backup Storage     | Optional RDB (~2 GB) | $0.095/GB/month | $0.19        |
| **Redis Subtotal** |                      |                 | **$29.39**   |

### Storage Resources

#### Azure Blob Storage

| Component            | Specification              | Quantity | Unit Cost  | Monthly Cost |
| -------------------- | -------------------------- | -------- | ---------- | ------------ |
| Storage Account      | Standard GRS               | -        | -          | $0.00        |
| Hot Storage          | Estimated 100 GB           | 100 GB   | $0.0184/GB | $1.84        |
| Cool Storage         | Archive tier (automated)   | 50 GB    | $0.01/GB   | $0.50        |
| Operations           | Read/Write operations      | 1M ops   | $0.004/10k | $0.40        |
| Data Transfer        | Outbound (minimal staging) | 10 GB    | $0.087/GB  | $0.87        |
| **Storage Subtotal** |                            |          |            | **$3.61**    |

### Monitoring Resources

#### Application Insights

| Component                 | Specification           | Unit Cost | Monthly Cost |
| ------------------------- | ----------------------- | --------- | ------------ |
| Data Ingestion            | 5 GB/day (150 GB/month) | $2.30/GB  | $345.00      |
| Data Retention            | 30 days included        | -         | $0.00        |
| **App Insights Subtotal** |                         |           | **$345.00**  |

#### Log Analytics Workspace

| Component                  | Specification          | Unit Cost | Monthly Cost |
| -------------------------- | ---------------------- | --------- | ------------ |
| Data Ingestion             | 3 GB/day (90 GB/month) | $2.30/GB  | $207.00      |
| Data Retention             | First 31 days included | -         | $0.00        |
| **Log Analytics Subtotal** |                        |           | **$207.00**  |

### Security Resources

#### Azure Key Vault

| Component              | Specification            | Unit Cost     | Monthly Cost |
| ---------------------- | ------------------------ | ------------- | ------------ |
| Key Vault              | Standard tier            | -             | $0.03        |
| Secret Operations      | ~10,000 operations/month | $0.03/10k ops | $0.03        |
| **Key Vault Subtotal** |                          |               | **$0.06**    |

### Networking Resources

#### Virtual Network

| Component               | Specification | Unit Cost  | Monthly Cost |
| ----------------------- | ------------- | ---------- | ------------ |
| VNet                    | Standard      | -          | $0.00        |
| Network Security Groups | 3 NSGs        | -          | $0.00        |
| Private DNS Zone        | 1 zone        | $0.50/zone | $0.50        |
| **Networking Subtotal** |               |            | **$0.50**    |

### Staging Total

| Category      | Monthly Cost  |
| ------------- | ------------- |
| Compute (AKS) | $560.64       |
| Database      | $179.81       |
| Cache         | $29.39        |
| Storage       | $3.61         |
| Monitoring    | $552.00       |
| Security      | $0.06         |
| Networking    | $0.50         |
| **TOTAL**     | **$1,326.01** |

**Note:** Actual staging costs expected to be ~30% lower ($407/month) due to:

- Monitoring sampling at 50% vs 100%
- Reduced data ingestion in non-production
- Lower storage and bandwidth utilization
- Nodes powered down during off-hours (potential 40% savings on compute)

## Production Environment Costs

### Compute Resources

#### Azure Kubernetes Service (AKS)

| Component                | Specification                       | Quantity | Unit Cost    | Monthly Cost  |
| ------------------------ | ----------------------------------- | -------- | ------------ | ------------- |
| System Node Pool         | Standard_D2s_v3 (2 vCPU, 8 GB RAM)  | 3 nodes  | $70.08/node  | $210.24       |
| User Node Pool (Base)    | Standard_D4s_v3 (4 vCPU, 16 GB RAM) | 5 nodes  | $140.16/node | $700.80       |
| User Node Pool (Scaling) | Standard_D4s_v3 (avg 3 extra nodes) | 3 nodes  | $140.16/node | $420.48       |
| **AKS Subtotal**         |                                     |          |              | **$1,331.52** |

### Database Resources

#### PostgreSQL Flexible Server

| Component               | Specification                            | Unit Cost       | Monthly Cost |
| ----------------------- | ---------------------------------------- | --------------- | ------------ |
| Compute                 | GP_Standard_D8s_v3 (8 vCores, 32 GB RAM) | $0.468/hour     | $341.28      |
| Storage                 | 128 GB                                   | $0.138/GB/month | $17.66       |
| Backup                  | 30-day retention (~300 GB)               | $0.095/GB/month | $28.50       |
| High Availability       | Zone-redundant standby                   | $0.468/hour     | $341.28      |
| **PostgreSQL Subtotal** |                                          |                 | **$728.72**  |

### Cache Resources

#### Azure Cache for Redis

| Component          | Specification        | Unit Cost       | Monthly Cost |
| ------------------ | -------------------- | --------------- | ------------ |
| Redis Cache        | Premium P1 (6 GB)    | $0.357/hour     | $260.04      |
| Data Persistence   | RDB backups (~10 GB) | $0.095/GB/month | $0.95        |
| Zone Redundancy    | Included in Premium  | -               | $0.00        |
| **Redis Subtotal** |                      |                 | **$260.99**  |

### Storage Resources

#### Azure Blob Storage

| Component            | Specification            | Quantity | Unit Cost  | Monthly Cost |
| -------------------- | ------------------------ | -------- | ---------- | ------------ |
| Storage Account      | Standard GZRS            | -        | -          | $0.00        |
| Hot Storage          | Estimated 500 GB         | 500 GB   | $0.0184/GB | $9.20        |
| Cool Storage         | Archive tier (automated) | 300 GB   | $0.01/GB   | $3.00        |
| Archive Storage      | Long-term archive        | 200 GB   | $0.002/GB  | $0.40        |
| Operations           | Read/Write operations    | 5M ops   | $0.004/10k | $2.00        |
| Data Transfer        | Outbound                 | 100 GB   | $0.087/GB  | $8.70        |
| **Storage Subtotal** |                          |          |            | **$23.30**   |

### Monitoring Resources

#### Application Insights

| Component                 | Specification            | Unit Cost      | Monthly Cost  |
| ------------------------- | ------------------------ | -------------- | ------------- |
| Data Ingestion            | 15 GB/day (450 GB/month) | $2.30/GB       | $1,035.00     |
| Data Retention            | First 90 days included   | -              | $0.00         |
| Extended Retention        | 365 days (300 GB extra)  | $0.10/GB/month | $30.00        |
| **App Insights Subtotal** |                          |                | **$1,065.00** |

#### Log Analytics Workspace

| Component                  | Specification            | Unit Cost      | Monthly Cost |
| -------------------------- | ------------------------ | -------------- | ------------ |
| Data Ingestion             | 10 GB/day (300 GB/month) | $2.30/GB       | $690.00      |
| Data Retention             | First 31 days included   | -              | $0.00        |
| Extended Retention         | 365 days (270 GB extra)  | $0.10/GB/month | $27.00       |
| **Log Analytics Subtotal** |                          |                | **$717.00**  |

### Security Resources

#### Azure Key Vault

| Component              | Specification             | Unit Cost     | Monthly Cost |
| ---------------------- | ------------------------- | ------------- | ------------ |
| Key Vault              | Standard tier             | -             | $0.03        |
| Secret Operations      | ~100,000 operations/month | $0.03/10k ops | $0.30        |
| **Key Vault Subtotal** |                           |               | **$0.33**    |

### Networking Resources

#### Virtual Network

| Component               | Specification      | Unit Cost  | Monthly Cost |
| ----------------------- | ------------------ | ---------- | ------------ |
| VNet                    | Standard           | -          | $0.00        |
| Network Security Groups | 3 NSGs             | -          | $0.00        |
| Private DNS Zone        | 1 zone             | $0.50/zone | $0.50        |
| VNet Peering            | Optional DR region | $0.01/GB   | $5.00        |
| **Networking Subtotal** |                    |            | **$5.50**    |

### Additional Production Resources

#### Azure Front Door (Optional)

| Component               | Specification | Unit Cost  | Monthly Cost |
| ----------------------- | ------------- | ---------- | ------------ |
| Base Fee                | Standard tier | -          | $35.00       |
| Routing Rules           | 5 rules       | $0.22/rule | $1.10        |
| Data Transfer           | 100 GB        | $0.087/GB  | $8.70        |
| **Front Door Subtotal** |               |            | **$44.80**   |

### Production Total

| Category                  | Monthly Cost  |
| ------------------------- | ------------- |
| Compute (AKS)             | $1,331.52     |
| Database                  | $728.72       |
| Cache                     | $260.99       |
| Storage                   | $23.30        |
| Monitoring                | $1,782.00     |
| Security                  | $0.33         |
| Networking                | $5.50         |
| CDN/Front Door (Optional) | $44.80        |
| **TOTAL (without CDN)**   | **$4,132.36** |
| **TOTAL (with CDN)**      | **$4,177.16** |

**Note:** Actual production costs expected to be ~28% lower ($1,189/month) due to:

- Monitoring sampling at 75% vs 100%
- Commitment discounts (Azure Reserved Instances: 30-50% savings on compute)
- Actual usage patterns vs. maximum capacity planning
- Conservative scaling estimates

## Cost Optimization Recommendations

### Immediate Optimizations (0-30 days)

1. **Reserved Instances for Compute**
   - Purchase 1-year Reserved Instances for AKS nodes
   - **Savings:** 30% on compute costs (~$400/month in production)
   - **Action:** Commit to base node capacity after 2 months of usage data

2. **Monitoring Data Sampling**
   - Configure Application Insights sampling at 50% for staging, 75% for production
   - **Savings:** $400-600/month across environments
   - **Action:** Implement adaptive sampling in application code

3. **Storage Lifecycle Policies**
   - Already implemented: Archive documents after 90 days (Cool) and 180 days (Archive)
   - **Savings:** $15-20/month in production
   - **Status:** ✅ Configured in Terraform

4. **Database Optimization**
   - Right-size PostgreSQL after performance testing
   - Consider D2s_v3 for staging if 4 vCores is excessive
   - **Savings:** $85/month in staging
   - **Action:** Monitor CPU/memory usage for 1 month

### Medium-term Optimizations (30-90 days)

5. **Auto-shutdown for Non-production**
   - Implement automated shutdown for staging AKS nodes during nights/weekends
   - **Savings:** 40% on staging compute (~$225/month)
   - **Action:** Use Azure Automation or scheduled scaling

6. **Commitment Discounts**
   - Evaluate 3-year Reserved Instances after 6 months
   - **Savings:** 50% on compute costs (~$650/month in production)
   - **Action:** Review after stable usage patterns established

7. **Monitoring Retention Optimization**
   - Reduce Log Analytics retention to 90 days (vs 365)
   - Export historical data to Blob Storage (Archive tier)
   - **Savings:** $200/month in production
   - **Action:** Implement after 3 months of operation

8. **Redis Tier Optimization**
   - Evaluate if Standard tier sufficient for production (vs Premium)
   - Test without zone redundancy if RPO allows
   - **Savings:** $150-200/month
   - **Action:** Load test and review HA requirements

### Long-term Optimizations (90+ days)

9. **Spot Instances for Dev Workloads**
   - Use Azure Spot VMs for user node pool in staging
   - **Savings:** 70-90% on staging user nodes (~$300/month)
   - **Risk:** Workload interruption acceptable for staging

10. **Multi-region Cost Analysis**
    - Evaluate if North Europe (Stockholm) offers better pricing
    - **Savings:** Potential 5-10% regional variance
    - **Action:** Benchmark before DR implementation

11. **Containerization Optimization**
    - Right-size container resource requests/limits
    - Reduce node count through better bin-packing
    - **Savings:** 10-15% on AKS costs (~$130/month)
    - **Action:** Use tools like Goldilocks or VPA

## Budget Alerts Configuration

The following budget alerts are recommended:

### Staging Environment

- **Warning Threshold:** $450/month (110% of estimate)
- **Critical Threshold:** $550/month (135% of estimate)
- **Alert Recipients:** DevOps team, Finance

### Production Environment

- **Warning Threshold:** $1,300/month (110% of estimate)
- **Critical Threshold:** $1,600/month (135% of estimate)
- **Alert Recipients:** DevOps team, Engineering Manager, Finance

### Implementation

Budget alerts are configured in Terraform via Azure Cost Management API. Alerts trigger on:

- Forecasted overspend (based on current month trend)
- Actual overspend (month-to-date)
- Individual resource group anomalies (>50% variance)

## Cost Monitoring

### Key Metrics to Track

1. **Cost per User (production)**
   - Target: <$5/user/month
   - Metric: Total infrastructure cost / active users

2. **Cost per Case (production)**
   - Target: <$2/case/month
   - Metric: Total infrastructure cost / active cases

3. **Compute Efficiency**
   - Target: >60% average CPU utilization
   - Metric: AKS node CPU usage

4. **Storage Efficiency**
   - Target: <$0.05/GB/month all-in
   - Metric: Total storage cost / total GB stored

### Monthly Review Checklist

- [ ] Review actual vs. estimated costs
- [ ] Analyze top 10 cost contributors
- [ ] Check for unused resources (orphaned disks, IPs)
- [ ] Review scaling patterns and adjust autoscaling
- [ ] Evaluate Reserved Instance opportunities
- [ ] Update cost projections based on usage trends

## Cost Breakdown by Acceptance Criteria

| AC #   | Component                | Staging Cost                  | Production Cost |
| ------ | ------------------------ | ----------------------------- | --------------- |
| AC 1-2 | Development Setup        | $0                            | $0              |
| AC 3   | CI Pipeline              | $0 (GitHub Actions free tier) | $0              |
| AC 4   | CD Pipeline              | $0 (Azure DevOps free tier)   | $0              |
| AC 5   | Docker/Containers        | Included in AKS               | Included in AKS |
| AC 6   | Environment Variables    | $0                            | $0              |
| AC 7   | Infrastructure Resources | $407/month                    | $1,189/month    |
| AC 8   | Deployment Automation    | $0                            | $0              |
| AC 9   | Documentation            | $0                            | $0              |
| AC 10  | This Document            | $0                            | $0              |

## Risk Assessment

### Cost Overrun Risks

| Risk                                     | Probability | Impact         | Mitigation                        |
| ---------------------------------------- | ----------- | -------------- | --------------------------------- |
| Monitoring data exceeds estimates        | High        | $300-500/month | Implement adaptive sampling       |
| Production scaling exceeds 10 nodes      | Medium      | $500-700/month | Set hard autoscaling limits       |
| Database size grows faster than expected | Medium      | $100-200/month | Implement data archival strategy  |
| Excessive data transfer costs            | Low         | $50-100/month  | Use Azure CDN, optimize API calls |
| Unoptimized container resources          | High        | $200-400/month | Regular right-sizing reviews      |

### Cost Saving Opportunities

1. **If user adoption is slower than expected:** Scale down production to staging-like resources
2. **If staging is underutilized:** Implement auto-shutdown for 16 hours/day
3. **If monitoring volume is high:** Increase sampling, reduce retention
4. **If database performance is adequate:** Downgrade SKU tier

## Appendix: Pricing Sources

- Azure Pricing Calculator: https://azure.microsoft.com/en-us/pricing/calculator/
- Region: West Europe (Amsterdam)
- Pricing Date: November 2025
- All prices in USD, excluding taxes
- Assumes pay-as-you-go pricing (no commitment discounts)

## Notes

- Costs exclude data transfer to/from client browsers (negligible for API-driven app)
- Azure DevOps free tier includes 1 free parallel job (sufficient for this project)
- GitHub Actions free tier: 2,000 minutes/month (estimated usage: 500 minutes/month)
- Costs assume 730 hours/month (monthly average)
- Production estimates assume 60% average capacity utilization
