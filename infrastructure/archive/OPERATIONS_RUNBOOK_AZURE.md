# Operations Runbook

This runbook provides step-by-step procedures for common infrastructure operations, maintenance tasks, and troubleshooting scenarios.

## Table of Contents

1. [Daily Operations](#daily-operations)
2. [Scaling Operations](#scaling-operations)
3. [Backup and Recovery](#backup-and-recovery)
4. [Monitoring and Alerts](#monitoring-and-alerts)
5. [Security Operations](#security-operations)
6. [Disaster Recovery](#disaster-recovery)
7. [Cost Optimization](#cost-optimization)
8. [Troubleshooting](#troubleshooting)

---

## Daily Operations

### Morning Health Check

Run daily at 9:00 AM (before peak hours):

```bash
#!/bin/bash
# scripts/daily-health-check.sh

echo "=== Legal Platform Daily Health Check ==="
echo "Date: $(date)"
echo

# 1. Check AKS cluster health
echo "1. AKS Cluster Status"
az aks show \
  --resource-group rg-legal-production \
  --name aks-legal-production \
  --query "{Status:provisioningState, Nodes:agentPoolProfiles[0].count}" \
  --output table

# 2. Check pod status
echo -e "\n2. Pod Status"
kubectl get pods -n production --no-headers | \
  awk '{print $3}' | sort | uniq -c

# 3. Check resource usage
echo -e "\n3. Resource Usage"
kubectl top nodes
kubectl top pods -n production --sort-by=cpu | head -5

# 4. Check database connections
echo -e "\n4. Database Status"
az postgres flexible-server show \
  --resource-group rg-legal-production \
  --name psql-legal-production \
  --query "{State:state, Storage:storageProfile.storageMB}" \
  --output table

# 5. Check Application Insights errors (last 24h)
echo -e "\n5. Application Errors (24h)"
az monitor app-insights query \
  --app legal-platform-production \
  --analytics-query "exceptions | where timestamp > ago(24h) | summarize count() by type" \
  --output table

# 6. Check SSL certificates
echo -e "\n6. SSL Certificate Status"
kubectl get certificate -n production

# 7. Check HPA status
echo -e "\n7. Autoscaler Status"
kubectl get hpa -n production

echo -e "\n=== Health Check Complete ==="
```

### Weekly Maintenance Tasks

Run every Sunday at 2:00 AM:

```bash
# 1. Clean up old Docker images from ACR
az acr repository list --name acrlegalproduction --output table

# Delete images older than 30 days (keep last 10 versions)
for repo in $(az acr repository list --name acrlegalproduction -o tsv); do
  az acr repository show-manifests \
    --name acrlegalproduction \
    --repository $repo \
    --orderby time_desc \
    --query "[10:].digest" -o tsv | \
  while read digest; do
    az acr repository delete \
      --name acrlegalproduction \
      --image $repo@$digest \
      --yes
  done
done

# 2. Review and clean up unused Kubernetes resources
kubectl delete pod --field-selector status.phase=Failed -n production
kubectl delete pod --field-selector status.phase=Succeeded -n production

# 3. Rotate log files
kubectl logs -n production --all-containers=true --timestamps=true > logs/production-$(date +%Y%m%d).log

# 4. Update Node OS
az aks upgrade \
  --resource-group rg-legal-production \
  --name aks-legal-production \
  --node-image-only \
  --yes

# 5. Review Application Insights retention
az monitor app-insights component update \
  --app legal-platform-production \
  --resource-group rg-legal-production \
  --retention-time 90
```

---

## Scaling Operations

### Scale Application Horizontally (Pods)

#### Manual Scaling

```bash
# Scale web application
kubectl scale deployment/web --replicas=10 -n production

# Scale gateway
kubectl scale deployment/gateway --replicas=10 -n production

# Scale specific microservice
kubectl scale deployment/document-service --replicas=5 -n production

# Verify scaling
kubectl get deployments -n production
kubectl get pods -n production | grep Running | wc -l
```

#### Configure Autoscaling (HPA)

```bash
# Update HPA min/max replicas
kubectl patch hpa web-hpa -n production -p '{"spec":{"minReplicas":5,"maxReplicas":20}}'

# Update HPA target CPU utilization
kubectl patch hpa web-hpa -n production -p '{"spec":{"targetCPUUtilizationPercentage":60}}'

# Verify HPA configuration
kubectl get hpa -n production -o yaml
```

### Scale AKS Cluster (Nodes)

#### Manual Node Scaling

```bash
# Scale user node pool
az aks nodepool scale \
  --resource-group rg-legal-production \
  --cluster-name aks-legal-production \
  --name usernodepool \
  --node-count 10

# Monitor scaling
watch kubectl get nodes
```

#### Configure Cluster Autoscaler

```bash
# Enable cluster autoscaler
az aks update \
  --resource-group rg-legal-production \
  --name aks-legal-production \
  --enable-cluster-autoscaler \
  --min-count 5 \
  --max-count 20

# Update autoscaler limits
az aks nodepool update \
  --resource-group rg-legal-production \
  --cluster-name aks-legal-production \
  --name usernodepool \
  --update-cluster-autoscaler \
  --min-count 3 \
  --max-count 15
```

### Scale Database (PostgreSQL)

#### Vertical Scaling (Change SKU)

```bash
# Scale up to 8 vCores
az postgres flexible-server update \
  --resource-group rg-legal-production \
  --name psql-legal-production \
  --sku-name GP_Standard_D8s_v3

# Scale down to 4 vCores
az postgres flexible-server update \
  --resource-group rg-legal-production \
  --name psql-legal-production \
  --sku-name GP_Standard_D4s_v3

# Note: Scaling causes brief connection interruption (5-10 seconds)
```

#### Increase Storage

```bash
# Increase storage to 256 GB
az postgres flexible-server update \
  --resource-group rg-legal-production \
  --name psql-legal-production \
  --storage-size 256

# Note: Storage can only be increased, not decreased
```

### Scale Redis Cache

```bash
# Scale up Redis to Premium P2
az redis update \
  --resource-group rg-legal-production \
  --name redis-legal-production \
  --sku Premium \
  --vm-size P2

# Note: Scaling Premium tier causes downtime, use during maintenance window
```

---

## Backup and Recovery

### Database Backups

#### On-Demand Backup

```bash
# Trigger manual backup
az postgres flexible-server backup create \
  --resource-group rg-legal-production \
  --name psql-legal-production \
  --backup-name "manual-backup-$(date +%Y%m%d-%H%M)"

# List available backups
az postgres flexible-server backup list \
  --resource-group rg-legal-production \
  --name psql-legal-production \
  --output table
```

#### Restore from Backup

```bash
# Restore to new server
az postgres flexible-server restore \
  --resource-group rg-legal-production \
  --name psql-legal-production-restored \
  --source-server psql-legal-production \
  --restore-time "2024-11-15T12:00:00Z"

# Or restore from specific backup
az postgres flexible-server geo-restore \
  --resource-group rg-legal-production \
  --name psql-legal-production-restored \
  --source-server /subscriptions/.../psql-legal-production \
  --location northeurope  # For disaster recovery
```

#### Export Database

```bash
# Export to SQL file
kubectl run -it --rm postgres-client \
  --image=postgres:16 \
  --restart=Never \
  -n production -- \
  pg_dump -h psql-legal-production.postgres.database.azure.com \
  -U adminuser \
  -d legaldb \
  -F c \
  -f /tmp/backup.dump

# Upload to Azure Blob Storage
az storage blob upload \
  --account-name stalegalproduction \
  --container-name backups \
  --name "database-backup-$(date +%Y%m%d).dump" \
  --file /tmp/backup.dump
```

### Kubernetes State Backup

```bash
# Backup all Kubernetes manifests
kubectl get all --all-namespaces -o yaml > k8s-backup-$(date +%Y%m%d).yaml

# Backup specific namespace
kubectl get all -n production -o yaml > production-backup-$(date +%Y%m%d).yaml

# Backup ConfigMaps and Secrets
kubectl get configmap -n production -o yaml > configmaps-backup.yaml
kubectl get secret -n production -o yaml > secrets-backup.yaml

# Upload to Azure Blob
az storage blob upload \
  --account-name stalegalproduction \
  --container-name k8s-backups \
  --name "k8s-backup-$(date +%Y%m%d).tar.gz" \
  --file k8s-backup-$(date +%Y%m%d).yaml
```

### Terraform State Backup

```bash
# Export current Terraform state
cd infrastructure/terraform
terraform state pull > terraform-state-$(date +%Y%m%d).json

# Upload to Azure Blob (versioned)
az storage blob upload \
  --account-name stlegalterraformstate \
  --container-name tfstate-backups \
  --name "production-$(date +%Y%m%d).tfstate" \
  --file terraform-state-$(date +%Y%m%d).json

# Verify blob versions enabled
az storage account blob-service-properties show \
  --account-name stlegalterraformstate \
  --resource-group rg-legal-terraform-state \
  --query "{Versioning:isVersioningEnabled}"
```

---

## Monitoring and Alerts

### Configure Application Insights Alerts

#### High Error Rate Alert

```bash
az monitor metrics alert create \
  --name "High Error Rate - Production" \
  --resource-group rg-legal-production \
  --scopes /subscriptions/.../microsoft.insights/components/legal-platform-production \
  --condition "avg exceptions/request > 0.05" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action-group /subscriptions/.../actionGroups/devops-alerts \
  --description "Alert when error rate exceeds 5%"
```

#### High Response Time Alert

```bash
az monitor metrics alert create \
  --name "High Response Time - Production" \
  --resource-group rg-legal-production \
  --scopes /subscriptions/.../microsoft.insights/components/legal-platform-production \
  --condition "avg requests/duration > 2000" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action-group /subscriptions/.../actionGroups/devops-alerts \
  --description "Alert when avg response time > 2 seconds"
```

### Configure AKS Alerts

#### Node CPU Alert

```bash
az monitor metrics alert create \
  --name "High Node CPU - Production" \
  --resource-group rg-legal-production \
  --scopes /subscriptions/.../Microsoft.ContainerService/managedClusters/aks-legal-production \
  --condition "avg Percentage CPU > 80" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action-group /subscriptions/.../actionGroups/devops-alerts
```

#### Pod Memory Alert

```bash
az monitor metrics alert create \
  --name "High Memory Usage - Production" \
  --resource-group rg-legal-production \
  --scopes /subscriptions/.../Microsoft.ContainerService/managedClusters/aks-legal-production \
  --condition "avg Percentage Memory > 85" \
  --window-size 5m \
  --action-group /subscriptions/.../actionGroups/devops-alerts
```

### View Metrics

```bash
# Application Insights queries
az monitor app-insights query \
  --app legal-platform-production \
  --analytics-query "requests | summarize avg(duration), count() by bin(timestamp, 5m)"

az monitor app-insights query \
  --app legal-platform-production \
  --analytics-query "exceptions | where timestamp > ago(1h) | summarize count() by type"

# AKS metrics
az monitor metrics list \
  --resource /subscriptions/.../aks-legal-production \
  --metric "node_cpu_usage_percentage" \
  --start-time 2024-11-15T00:00:00Z \
  --end-time 2024-11-15T23:59:59Z \
  --interval PT5M

# Database metrics
az monitor metrics list \
  --resource /subscriptions/.../psql-legal-production \
  --metric "cpu_percent,memory_percent,storage_percent" \
  --interval PT5M
```

---

## Security Operations

### Rotate Secrets

#### Database Password Rotation

```bash
# 1. Generate new password
NEW_PASSWORD=$(openssl rand -base64 32)

# 2. Update database password
az postgres flexible-server update \
  --resource-group rg-legal-production \
  --name psql-legal-production \
  --admin-password $NEW_PASSWORD

# 3. Update Key Vault
az keyvault secret set \
  --vault-name kv-legal-production \
  --name database-password \
  --value $NEW_PASSWORD

# 4. Restart pods to pick up new secret
kubectl rollout restart deployment/gateway -n production
kubectl rollout restart deployment/document-service -n production
```

#### Redis Key Rotation

```bash
# 1. Regenerate primary key
az redis regenerate-key \
  --resource-group rg-legal-production \
  --name redis-legal-production \
  --key-type Primary

# 2. Get new key
NEW_KEY=$(az redis list-keys \
  --resource-group rg-legal-production \
  --name redis-legal-production \
  --query primaryKey -o tsv)

# 3. Update Key Vault
az keyvault secret set \
  --vault-name kv-legal-production \
  --name redis-primary-key \
  --value $NEW_KEY

# 4. Restart pods
kubectl rollout restart deployment/gateway -n production
```

### Security Scanning

#### Scan Kubernetes for Vulnerabilities

```bash
# Install kubesec
brew install kubesec

# Scan deployment
kubesec scan infrastructure/kubernetes/deployments/web.yaml

# Scan all manifests
for file in infrastructure/kubernetes/deployments/*.yaml; do
  echo "Scanning $file..."
  kubesec scan $file
done
```

#### Scan Docker Images

```bash
# Scan images with Trivy
docker run --rm \
  aquasec/trivy:latest image \
  --severity HIGH,CRITICAL \
  acrlegalproduction.azurecr.io/legal-platform/web:latest

# Scan all production images
IMAGES=(web gateway document-service ai-service task-service integration-service notification-service)
for img in "${IMAGES[@]}"; do
  echo "Scanning $img..."
  docker run --rm aquasec/trivy:latest image \
    --severity HIGH,CRITICAL \
    acrlegalproduction.azurecr.io/legal-platform/$img:latest
done
```

### Audit Logging

```bash
# Enable AKS audit logs
az monitor diagnostic-settings create \
  --resource /subscriptions/.../aks-legal-production \
  --name audit-logs \
  --logs '[
    {"category":"kube-audit","enabled":true},
    {"category":"kube-audit-admin","enabled":true},
    {"category":"guard","enabled":true}
  ]' \
  --workspace /subscriptions/.../logAnalyticsWorkspace

# Query audit logs
az monitor log-analytics query \
  --workspace kv-legal-production-logs \
  --analytics-query "AzureDiagnostics | where Category == 'kube-audit' | take 100"
```

---

## Disaster Recovery

### Failover to Secondary Region

**Prerequisites:** Infrastructure deployed to secondary region (North Europe)

```bash
# 1. Update DNS to point to secondary region ingress
# (Cloudflare/Azure DNS/Route53)
# Change A record for legal-platform.com to secondary ingress IP

# 2. Verify secondary database (geo-replica)
az postgres flexible-server show \
  --resource-group rg-legal-production-secondary \
  --name psql-legal-production-replica \
  --query state

# 3. Promote secondary database to primary
az postgres flexible-server replica promote \
  --resource-group rg-legal-production-secondary \
  --name psql-legal-production-replica

# 4. Update connection strings in Key Vault
az keyvault secret set \
  --vault-name kv-legal-production \
  --name database-url \
  --value "postgresql://...@psql-legal-production-replica..."

# 5. Deploy applications to secondary AKS
az aks get-credentials \
  --resource-group rg-legal-production-secondary \
  --name aks-legal-production-secondary

kubectl apply -f infrastructure/kubernetes/ -n production

# 6. Monitor secondary region
kubectl get pods -n production --watch
```

### Recovery Point Objectives (RPO) / Recovery Time Objectives (RTO)

| Component        | RPO        | RTO        | Recovery Method            |
| ---------------- | ---------- | ---------- | -------------------------- |
| Application      | 0 minutes  | 2 minutes  | Blue-green deployment      |
| Database         | 5 minutes  | 20 minutes | Point-in-time restore      |
| Blob Storage     | 15 minutes | 30 minutes | GRS geo-replication        |
| Infrastructure   | 0 minutes  | 30 minutes | Terraform re-apply         |
| Full DR Failover | 1 hour     | 2 hours    | Secondary region promotion |

---

## Cost Optimization

### Analyze Costs

```bash
# Get cost breakdown by resource
az consumption usage list \
  --start-date 2024-11-01 \
  --end-date 2024-11-30 \
  --query "[?contains(instanceName, 'legal')].{Name:instanceName, Cost:pretaxCost}" \
  --output table

# Get AKS cost
az aks show \
  --resource-group rg-legal-production \
  --name aks-legal-production \
  --query "{Nodes:agentPoolProfiles[0].count, VMSize:agentPoolProfiles[0].vmSize}"

# Estimate monthly cost
# 5 nodes * Standard_D4s_v3 = ~$730/month
```

### Cost Reduction Actions

```bash
# 1. Right-size node pools
az aks nodepool update \
  --resource-group rg-legal-production \
  --cluster-name aks-legal-production \
  --name usernodepool \
  --enable-cluster-autoscaler \
  --min-count 3 \
  --max-count 10

# 2. Use spot instances for dev/test
az aks nodepool add \
  --resource-group rg-legal-staging \
  --cluster-name aks-legal-staging \
  --name spotnodepool \
  --priority Spot \
  --eviction-policy Delete \
  --spot-max-price -1 \
  --enable-cluster-autoscaler \
  --min-count 1 \
  --max-count 5

# 3. Delete unused resources
az postgres flexible-server list --query "[?state=='Disabled'].name"
az redis list --query "[?provisioningState=='Succeeded' && tags.environment=='dev'].name"

# 4. Optimize storage lifecycle
az storage blob service-properties update \
  --account-name stalegalproduction \
  --enable-delete-retention true \
  --delete-retention-days 7
```

---

## Troubleshooting

### High CPU Usage

```bash
# 1. Identify pods with high CPU
kubectl top pods -n production --sort-by=cpu

# 2. Check pod details
kubectl describe pod <pod-name> -n production

# 3. Check application logs for CPU-intensive operations
kubectl logs <pod-name> -n production | grep -i "slow\|timeout\|error"

# 4. Scale horizontally if needed
kubectl scale deployment/<deployment-name> --replicas=10 -n production

# 5. Or scale vertically (increase CPU limits)
kubectl edit deployment/<deployment-name> -n production
# Update: resources.limits.cpu: "2000m"
```

### Memory Leaks

```bash
# 1. Monitor memory over time
kubectl top pods -n production --sort-by=memory

# 2. Check for OOMKilled pods
kubectl get pods -n production | grep OOMKilled

# 3. Review memory usage trend in Application Insights
az monitor app-insights query \
  --app legal-platform-production \
  --analytics-query "performanceCounters | where name == 'Memory' | render timechart"

# 4. Restart affected pods
kubectl delete pod <pod-name> -n production

# 5. Increase memory limits if genuine requirement
kubectl patch deployment web -n production -p \
  '{"spec":{"template":{"spec":{"containers":[{"name":"web","resources":{"limits":{"memory":"1Gi"}}}]}}}}'
```

### Database Connection Pool Exhausted

```bash
# 1. Check current connections
kubectl exec -n production deployment/gateway -- \
  psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# 2. Check max connections
az postgres flexible-server parameter show \
  --resource-group rg-legal-production \
  --server-name psql-legal-production \
  --name max_connections

# 3. Increase max connections
az postgres flexible-server parameter set \
  --resource-group rg-legal-production \
  --server-name psql-legal-production \
  --name max_connections \
  --value 200

# 4. Or scale database SKU
az postgres flexible-server update \
  --resource-group rg-legal-production \
  --name psql-legal-production \
  --sku-name GP_Standard_D8s_v3
```

---

## Additional Resources

- [Deployment Guide](DEPLOYMENT_GUIDE.md)
- [Rollback Guide](ROLLBACK_GUIDE.md)
- [Azure DevOps Setup](AZURE_DEVOPS_SETUP.md)
- [Azure AKS Documentation](https://learn.microsoft.com/azure/aks/)
- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)
- [PostgreSQL Performance Tuning](https://www.postgresql.org/docs/current/performance-tips.html)
