# Rollback Guide

This guide provides procedures for rolling back deployments in the Legal Platform when issues are detected in production or staging environments.

## Table of Contents

1. [Rollback Decision Matrix](#rollback-decision-matrix)
2. [Application Rollback](#application-rollback)
3. [Infrastructure Rollback](#infrastructure-rollback)
4. [Database Rollback](#database-rollback)
5. [Emergency Procedures](#emergency-procedures)
6. [Post-Rollback Actions](#post-rollback-actions)

---

## Rollback Decision Matrix

### When to Rollback

Execute rollback immediately if:

- ✅ Application health checks failing
- ✅ Error rate > 5% in Application Insights
- ✅ Critical functionality broken (login, document access, search)
- ✅ Data corruption detected
- ✅ Security vulnerability introduced
- ✅ Performance degradation > 50% (response time doubled)
- ✅ Database migration failed

### When to Fix Forward

Consider fixing forward instead of rolling back if:

- ⚠️ Minor UI bugs (non-critical)
- ⚠️ Low-priority features not working
- ⚠️ Error rate < 1% for non-critical operations
- ⚠️ Issue can be hotfixed in < 30 minutes
- ⚠️ Rollback would cause data loss

### Approval Required

**Staging:** DevOps engineer can rollback without approval

**Production:**

- **Automated:** Pipeline rolls back automatically if health checks fail
- **Manual:** Requires approval from:
  - Technical Lead or CTO
  - Product Owner (if affects user data)

---

## Application Rollback

### Method 1: Automated Rollback (Blue-Green Deployment)

The Azure DevOps deployment pipeline includes automatic rollback if health checks fail.

#### How It Works

1. New version (green) deployed alongside current (blue)
2. Health checks run against green deployment
3. **If health checks pass:** Traffic switches to green
4. **If health checks fail:** Traffic remains on blue, green deleted

#### Manual Trigger (if automated rollback failed)

```bash
# Get AKS credentials
az aks get-credentials \
  --resource-group rg-legal-production \
  --name aks-legal-production

# Check current active deployment
kubectl get service legal-platform-web -n production -o yaml | grep version

# If current is "green", switch back to "blue" (or vice versa)
kubectl patch service legal-platform-web \
  -n production \
  -p '{"spec":{"selector":{"version":"blue"}}}'

kubectl patch service legal-platform-gateway \
  -n production \
  -p '{"spec":{"selector":{"version":"blue"}}}'

# Verify traffic switched
kubectl get service legal-platform-web -n production -o yaml | grep version
```

### Method 2: Kubernetes Deployment Rollback

If blue-green deployment isn't available, use Kubernetes rollout undo.

#### Rollback Single Service

```bash
# View rollout history
kubectl rollout history deployment/web -n production

# Example output:
# REVISION  CHANGE-CAUSE
# 1         Deploy v1.0.0
# 2         Deploy v1.1.0
# 3         Deploy v1.2.0 (current)

# Rollback to previous revision
kubectl rollout undo deployment/web -n production

# Rollback to specific revision
kubectl rollout undo deployment/web --to-revision=1 -n production

# Watch rollback progress
kubectl rollout status deployment/web -n production

# Verify pods are running
kubectl get pods -n production -l app=web
```

#### Rollback All Services

```bash
# Rollback all deployments in namespace
for deployment in $(kubectl get deployments -n production -o name); do
  echo "Rolling back $deployment..."
  kubectl rollout undo $deployment -n production
done

# Monitor rollback
kubectl get pods -n production --watch
```

### Method 3: Redeploy Previous Docker Image

If rollout undo doesn't work, manually set previous image tag.

```bash
# Set previous image tag
kubectl set image deployment/web \
  web=acrlegalproduction.azurecr.io/legal-platform/web:v1.1.0 \
  -n production

kubectl set image deployment/gateway \
  gateway=acrlegalproduction.azurecr.io/legal-platform/gateway:v1.1.0 \
  -n production

# Watch rollout
kubectl rollout status deployment/web -n production
kubectl rollout status deployment/gateway -n production
```

### Method 4: Re-run Azure DevOps Pipeline (Previous Commit)

```bash
# In Azure DevOps:
# 1. Navigate to Pipelines > azure-pipelines-deploy
# 2. Click "Run pipeline"
# 3. Select "Resources" > "Choose branch/tag"
# 4. Enter previous commit SHA or tag (e.g., v1.1.0)
# 5. Click "Run"
# 6. Approve production deployment when prompted
```

### Verify Application Rollback

```bash
# Check pod status
kubectl get pods -n production

# Test health endpoints
curl https://legal-platform.com/api/health
curl https://api.legal-platform.com/health

# Check Application Insights for errors
az monitor app-insights query \
  --app legal-platform-production \
  --analytics-query "exceptions | where timestamp > ago(5m) | summarize count()"

# Monitor metrics
kubectl top pods -n production
```

---

## Infrastructure Rollback

### Terraform State Rollback

**⚠️ WARNING:** Infrastructure rollback can be destructive. Always backup state first.

#### Step 1: Backup Current State

```bash
cd infrastructure/terraform

# Download current state
terraform state pull > terraform-state-backup-$(date +%Y%m%d-%H%M%S).json

# Upload backup to Azure Blob
az storage blob upload \
  --account-name stlegalterraformstate \
  --container-name tfstate-backups \
  --file terraform-state-backup-*.json
```

#### Step 2: List State Versions

```bash
# List blob versions
az storage blob list \
  --account-name stlegalterraformstate \
  --container-name tfstate \
  --prefix production.tfstate \
  --include v

# Get specific version
az storage blob download \
  --account-name stlegalterraformstate \
  --container-name tfstate \
  --name production.tfstate \
  --version-id <VERSION_ID> \
  --file production-previous.tfstate
```

#### Step 3: Restore Previous State

```bash
# Push previous state (BE CAREFUL!)
terraform state push production-previous.tfstate

# Verify state
terraform show

# Re-run terraform plan to see differences
terraform plan -var-file=environments/production/terraform.tfvars
```

#### Step 4: Apply Previous Configuration

```bash
# Checkout previous Terraform code
git checkout <previous-commit-sha> infrastructure/terraform/

# Re-apply infrastructure
terraform apply -var-file=environments/production/terraform.tfvars

# This will:
# - Destroy resources added in recent deployment
# - Restore previous resource configurations
```

### Rollback Specific Resources

#### Rollback AKS Node Pool Changes

```bash
# If node pool scaling caused issues
az aks nodepool scale \
  --resource-group rg-legal-production \
  --cluster-name aks-legal-production \
  --name usernodepool \
  --node-count 5  # Previous count

# If node pool VM size changed, recreate with previous size
# (requires destroying and recreating - causes downtime)
```

#### Rollback PostgreSQL Configuration

```bash
# Restore database from point-in-time backup
az postgres flexible-server restore \
  --resource-group rg-legal-production \
  --name psql-legal-production-restored \
  --source-server psql-legal-production \
  --restore-time "2024-11-15T10:30:00Z"  # Before bad deployment

# Update connection string in Key Vault
az keyvault secret set \
  --vault-name kv-legal-production \
  --name database-url \
  --value "postgresql://user:pass@psql-legal-production-restored:5432/db"

# Restart pods to pick up new connection string
kubectl rollout restart deployment/gateway -n production
```

---

## Database Rollback

### Rollback Database Migration

#### Method 1: Run Down Migration

```bash
# If using migration tool (e.g., Flyway, Liquibase)
# SSH into a pod with database access
kubectl exec -it deployment/gateway -n production -- sh

# Run down migration
npm run migrate:down  # or equivalent command
```

#### Method 2: Point-in-Time Restore

```bash
# List available restore points
az postgres flexible-server geo-backup list \
  --resource-group rg-legal-production \
  --name psql-legal-production

# Restore to specific point in time
az postgres flexible-server restore \
  --resource-group rg-legal-production \
  --name psql-legal-production-restored \
  --source-server psql-legal-production \
  --restore-time "2024-11-15T10:00:00Z"

# Test restored database
psql postgresql://user:pass@psql-legal-production-restored:5432/db -c "SELECT COUNT(*) FROM cases;"

# If verified, update connection string (see above)
```

#### Method 3: Restore from Backup

```bash
# If using automated backups
az postgres flexible-server backup list \
  --resource-group rg-legal-production \
  --name psql-legal-production

# Restore from specific backup
az postgres flexible-server restore \
  --resource-group rg-legal-production \
  --name psql-legal-production-restored \
  --source-server psql-legal-production \
  --backup-id <BACKUP_ID>
```

### Data Consistency After Rollback

**⚠️ IMPORTANT:** After database rollback, check for data inconsistencies.

```sql
-- Check for orphaned records
SELECT * FROM documents WHERE case_id NOT IN (SELECT id FROM cases);

-- Check for missing required relationships
SELECT * FROM cases WHERE attorney_id IS NULL;

-- Verify recent transactions
SELECT * FROM audit_log WHERE created_at > NOW() - INTERVAL '1 hour';
```

---

## Emergency Procedures

### Scenario 1: Complete Site Outage

**Symptoms:** All health checks failing, no pods running

**Immediate Actions:**

```bash
# 1. Check AKS cluster health
az aks show --resource-group rg-legal-production --name aks-legal-production

# 2. Check node status
kubectl get nodes

# 3. If nodes are NotReady, check VM scale set
az vmss list --resource-group MC_rg-legal-production_aks-legal-production_westeurope

# 4. Restart nodes if needed
az vmss restart \
  --resource-group MC_rg-legal-production_aks-legal-production_westeurope \
  --name <vmss-name> \
  --instance-ids "*"

# 5. If cluster unresponsive, enable cluster autoscaling
az aks update \
  --resource-group rg-legal-production \
  --name aks-legal-production \
  --enable-cluster-autoscaler \
  --min-count 3 \
  --max-count 10
```

### Scenario 2: Database Corrupted/Unavailable

**Immediate Actions:**

```bash
# 1. Put application in maintenance mode
kubectl scale deployment/web --replicas=0 -n production
kubectl scale deployment/gateway --replicas=0 -n production

# 2. Display maintenance page via Ingress
kubectl apply -f kubernetes/ingress/maintenance-mode.yaml -n production

# 3. Restore database from latest backup (see Database Rollback above)

# 4. Verify data integrity
psql $DATABASE_URL -c "SELECT COUNT(*) FROM cases;"

# 5. Bring application back online
kubectl scale deployment/web --replicas=3 -n production
kubectl scale deployment/gateway --replicas=3 -n production
```

### Scenario 3: Security Breach Detected

**Immediate Actions:**

```bash
# 1. Isolate affected pods
kubectl label pods -l app=web quarantine=true -n production
kubectl delete networkpolicy allow-all -n production

# 2. Rotate all secrets
az keyvault secret set-attributes --vault-name kv-legal-production --name database-password --enabled false

# 3. Revoke ACR credentials
az acr credential renew --name acrlegalproduction --password-name password

# 4. Force pod restart with new secrets
kubectl delete pods -l app=web -n production
kubectl delete pods -l app=gateway -n production

# 5. Enable audit logging
az monitor diagnostic-settings create \
  --resource /subscriptions/.../aks-legal-production \
  --name audit-logs \
  --logs '[{"category":"kube-audit","enabled":true}]'
```

---

## Post-Rollback Actions

### 1. Document Rollback

Create incident report including:

- Time of rollback initiation
- Reason for rollback
- Commands executed
- Data affected
- Downtime duration
- Lessons learned

### 2. Verify System Health

```bash
# Run full health check suite
./scripts/health-check-production.sh

# Expected checks:
# ✅ All pods running
# ✅ Health endpoints responding
# ✅ Database queries successful
# ✅ Redis cache accessible
# ✅ Blob storage working
# ✅ Application Insights receiving data
```

### 3. Monitor for 24 Hours

- Check Application Insights every hour
- Monitor error rates
- Review user reports
- Check performance metrics

### 4. Root Cause Analysis

- Review failed deployment logs
- Identify what went wrong
- Update deployment procedures
- Add additional validation checks

### 5. Plan Fix Forward

- Create hotfix branch
- Implement proper fix
- Test thoroughly in staging
- Deploy to production when ready

---

## Rollback Time Estimates

| Rollback Type                      | Estimated Time | Downtime      |
| ---------------------------------- | -------------- | ------------- |
| Application (blue-green)           | 2 minutes      | 0 seconds     |
| Application (Kubernetes)           | 5 minutes      | 10-30 seconds |
| Application (full redeploy)        | 10 minutes     | 1-2 minutes   |
| Infrastructure (specific resource) | 15 minutes     | Varies        |
| Infrastructure (full state)        | 30 minutes     | 5-10 minutes  |
| Database (migration down)          | 5 minutes      | 1 minute      |
| Database (point-in-time restore)   | 20 minutes     | 5-10 minutes  |
| Database (backup restore)          | 30-60 minutes  | 10-30 minutes |

---

## Prevention Strategies

To minimize the need for rollbacks:

1. **Staging First:** Always deploy to staging before production
2. **Smoke Tests:** Run comprehensive smoke tests in staging
3. **Gradual Rollout:** Use blue-green or canary deployments
4. **Feature Flags:** Hide incomplete features behind flags
5. **Database Migrations:** Make migrations backward-compatible
6. **Automated Testing:** Expand test coverage
7. **Monitoring:** Set up alerts for early issue detection

---

## Emergency Contacts

**Rollback Approval:**

- Technical Lead: +1-555-0100
- CTO: +1-555-0101
- Product Owner: +1-555-0102

**On-Call Engineers:**

- Primary: Check PagerDuty schedule
- Secondary: Check PagerDuty schedule

**Vendor Support:**

- Azure Support: Submit ticket via Azure Portal (Premier support: 24/7)
- Database Issues: Azure PostgreSQL support
- Network Issues: Azure Networking support

---

## Additional Resources

- [Deployment Guide](DEPLOYMENT_GUIDE.md)
- [Operations Runbook](OPERATIONS_RUNBOOK.md)
- [Azure DevOps Setup](AZURE_DEVOPS_SETUP.md)
- [Terraform Documentation](terraform/README.md)
- [Kubernetes Documentation](kubernetes/README.md)
