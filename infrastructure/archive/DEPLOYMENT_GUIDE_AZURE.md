# Deployment Guide

This guide provides step-by-step instructions for deploying the Legal Platform infrastructure and applications to Azure.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Infrastructure Deployment](#infrastructure-deployment)
4. [Application Deployment](#application-deployment)
5. [Post-Deployment Verification](#post-deployment-verification)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools

- **Azure CLI** 2.50+: `az --version`
- **Terraform** 1.7+: `terraform --version`
- **kubectl** 1.28+: `kubectl version`
- **Helm** 3.13+: `helm version`
- **Docker** 24+: `docker --version`
- **pnpm** 9.0+: `pnpm --version`
- **Node.js** 20+: `node --version`

### Required Access

- Azure subscription with Owner or Contributor role
- GitHub repository admin access
- Azure DevOps organization admin access
- Domain registrar access (for DNS configuration)

### Install Tools (macOS)

```bash
# Install Azure CLI
brew install azure-cli

# Install Terraform
brew tap hashicorp/tap
brew install hashicorp/tap/terraform

# Install kubectl
brew install kubectl

# Install Helm
brew install helm

# Install pnpm
npm install -g pnpm
```

---

## Initial Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/legal-platform.git
cd legal-platform
```

### 2. Install Dependencies

```bash
# Install all workspace dependencies
pnpm install

# Verify build
pnpm build

# Run tests
pnpm test
```

### 3. Azure Authentication

```bash
# Login to Azure
az login

# Set default subscription
az account set --subscription "YOUR_SUBSCRIPTION_ID"

# Verify
az account show
```

### 4. Create Terraform State Storage

Terraform requires remote state storage for team collaboration.

```bash
# Set variables
RESOURCE_GROUP="rg-legal-terraform-state"
STORAGE_ACCOUNT="stlegalterraformstate"
CONTAINER_NAME="tfstate"
LOCATION="westeurope"

# Create resource group
az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION

# Create storage account
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS \
  --encryption-services blob

# Create blob container
az storage container create \
  --name $CONTAINER_NAME \
  --account-name $STORAGE_ACCOUNT

# Enable versioning
az storage account blob-service-properties update \
  --account-name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --enable-versioning true
```

### 5. Configure GitHub Secrets

Add the following secrets to your GitHub repository (Settings > Secrets and variables > Actions):

```
AZURE_CREDENTIALS          # Service principal JSON for Azure login
ACR_STAGING_USERNAME       # ACR username for staging
ACR_STAGING_PASSWORD       # ACR password for staging
ACR_PRODUCTION_USERNAME    # ACR username for production
ACR_PRODUCTION_PASSWORD    # ACR password for production
```

Create Azure service principal:

```bash
az ad sp create-for-rbac \
  --name "github-actions-legal-platform" \
  --role Contributor \
  --scopes /subscriptions/YOUR_SUBSCRIPTION_ID \
  --sdk-auth
```

Copy the JSON output to `AZURE_CREDENTIALS` secret.

---

## Infrastructure Deployment

### Phase 1: Deploy Staging Infrastructure

#### Step 1: Configure Terraform Variables

```bash
cd infrastructure/terraform/environments/staging

# Edit terraform.tfvars
vim terraform.tfvars

# Set required variables:
# - environment = "staging"
# - location = "westeurope"
# - project_name = "legal"
# - admin_email = "your-email@example.com"
```

#### Step 2: Initialize Terraform

```bash
cd infrastructure/terraform

terraform init \
  -backend-config="resource_group_name=rg-legal-terraform-state" \
  -backend-config="storage_account_name=stlegalterraformstate" \
  -backend-config="container_name=tfstate" \
  -backend-config="key=staging.tfstate"
```

#### Step 3: Plan Infrastructure

```bash
terraform plan \
  -var-file=environments/staging/terraform.tfvars \
  -out=staging.tfplan

# Review the plan carefully
# Expected resources: ~50 resources
```

#### Step 4: Apply Infrastructure

```bash
terraform apply staging.tfplan

# This will create:
# - Azure Kubernetes Service (AKS) cluster
# - PostgreSQL Flexible Server with pgvector
# - Azure Cache for Redis
# - Azure Blob Storage
# - Application Insights
# - Azure Key Vault
# - Virtual Network and subnets
# - Network security groups
# - Budget alerts

# Deployment time: ~15-20 minutes
```

#### Step 5: Capture Terraform Outputs

```bash
terraform output -json > staging-outputs.json

# Important outputs:
# - aks_cluster_name
# - aks_resource_group_name
# - acr_login_server
# - database_server_fqdn
# - redis_hostname
# - key_vault_name
```

### Phase 2: Configure Azure DevOps

Follow the [Azure DevOps Setup Guide](AZURE_DEVOPS_SETUP.md) to:

1. Create Azure DevOps organization and project
2. Configure service connections
3. Set up variable groups
4. Configure ACR integration

### Phase 3: Configure AKS Cluster

#### Step 1: Get AKS Credentials

```bash
az aks get-credentials \
  --resource-group rg-legal-staging \
  --name aks-legal-staging \
  --overwrite-existing

# Verify connection
kubectl cluster-info
kubectl get nodes
```

#### Step 2: Install NGINX Ingress Controller

```bash
# Add Helm repository
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

# Install NGINX Ingress
helm install nginx-ingress ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.replicaCount=2 \
  --set controller.service.annotations."service\.beta\.kubernetes\.io/azure-load-balancer-health-probe-request-path"=/healthz

# Get external IP (wait 2-3 minutes)
kubectl get service nginx-ingress-ingress-nginx-controller -n ingress-nginx
```

#### Step 3: Install cert-manager

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Verify installation
kubectl get pods -n cert-manager

# Apply cluster issuers
kubectl apply -f kubernetes/ingress/cert-issuer.yaml
```

#### Step 4: Configure Secrets Store CSI Driver

```bash
# Install Secrets Store CSI Driver
helm repo add secrets-store-csi-driver https://kubernetes-sigs.github.io/secrets-store-csi-driver/charts
helm install csi-secrets-store secrets-store-csi-driver/secrets-store-csi-driver \
  --namespace kube-system

# Install Azure Key Vault Provider
kubectl apply -f https://raw.githubusercontent.com/Azure/secrets-store-csi-driver-provider-azure/master/deployment/provider-azure-installer.yaml

# Enable managed identity for AKS
az aks update \
  --resource-group rg-legal-staging \
  --name aks-legal-staging \
  --enable-managed-identity
```

#### Step 5: Grant Key Vault Access

```bash
# Get AKS managed identity
AKS_IDENTITY=$(az aks show \
  --resource-group rg-legal-staging \
  --name aks-legal-staging \
  --query identityProfile.kubeletidentity.clientId -o tsv)

# Grant Key Vault permissions
az keyvault set-policy \
  --name kv-legal-staging \
  --object-id $AKS_IDENTITY \
  --secret-permissions get list
```

### Phase 4: Configure DNS

#### Step 1: Get Ingress IP

```bash
INGRESS_IP=$(kubectl get service nginx-ingress-ingress-nginx-controller \
  -n ingress-nginx \
  -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

echo "Ingress IP: $INGRESS_IP"
```

#### Step 2: Create DNS A Records

In your DNS provider (e.g., Azure DNS, Cloudflare, Route53), create:

**Staging:**

- `staging.legal-platform.com` → `$INGRESS_IP`
- `api.staging.legal-platform.com` → `$INGRESS_IP`

**Production:**

- `legal-platform.com` → `$INGRESS_IP`
- `api.legal-platform.com` → `$INGRESS_IP`

---

## Application Deployment

### Method 1: Automated (via Azure DevOps)

The recommended method is to use Azure DevOps pipelines for automated deployment.

#### Prerequisites

- Azure DevOps setup completed (see [AZURE_DEVOPS_SETUP.md](AZURE_DEVOPS_SETUP.md))
- GitHub Actions build workflow successful
- Docker images pushed to ACR

#### Trigger Infrastructure Pipeline

1. Navigate to Azure DevOps > Pipelines
2. Select `azure-pipelines-infrastructure.yml`
3. Click **Run pipeline**
4. Select branch: `main`
5. Review and approve Terraform plan
6. Wait for infrastructure deployment (~15 minutes)
7. Verify health checks pass

#### Trigger Application Deployment Pipeline

1. Merge code to `main` branch (triggers GitHub Actions)
2. Wait for Docker images to be built and pushed to ACR
3. Azure DevOps deployment pipeline triggers automatically
4. Pipeline stages:
   - Pull images from ACR
   - Update Kubernetes manifests
   - Deploy to staging
   - Run smoke tests
   - **[Manual approval required]**
   - Deploy to production (blue-green)
   - Run health checks
   - Rollback on failure

### Method 2: Manual (for testing/debugging)

#### Step 1: Build and Push Docker Images

```bash
# Login to ACR
az acr login --name acrlegalstaging

# Build images
docker build -f infrastructure/docker/Dockerfile.web -t acrlegalstaging.azurecr.io/legal-platform/web:v1.0.0 .
docker build -f infrastructure/docker/Dockerfile.gateway -t acrlegalstaging.azurecr.io/legal-platform/gateway:v1.0.0 .

# Push images
docker push acrlegalstaging.azurecr.io/legal-platform/web:v1.0.0
docker push acrlegalstaging.azurecr.io/legal-platform/gateway:v1.0.0
```

#### Step 2: Deploy Kubernetes Manifests

```bash
cd infrastructure/kubernetes

# Create namespace
kubectl apply -f namespaces/staging.yaml

# Deploy ConfigMaps
kubectl apply -f configmaps/ -n staging

# Create secrets (from Key Vault or manually)
kubectl apply -f secrets/secret-provider-class.yaml -n staging

# Deploy services
kubectl apply -f services/ -n staging

# Deploy applications
kubectl apply -f deployments/ -n staging

# Deploy ingress
kubectl apply -f ingress/ingress.yaml -n staging

# Deploy HPA
kubectl apply -f hpa/ -n staging
```

#### Step 3: Verify Deployment

```bash
# Check pod status
kubectl get pods -n staging

# Check deployments
kubectl get deployments -n staging

# Check services
kubectl get services -n staging

# Check ingress
kubectl get ingress -n staging

# Wait for SSL certificate (2-5 minutes)
kubectl get certificate -n staging --watch
```

---

## Post-Deployment Verification

### 1. Health Check Endpoints

```bash
# Web app health check
curl https://staging.legal-platform.com/api/health

# GraphQL gateway health check
curl https://api.staging.legal-platform.com/health

# Expected response: {"status": "healthy"}
```

### 2. Verify Database Connection

```bash
# Get gateway pod
POD=$(kubectl get pod -n staging -l app=gateway -o jsonpath='{.items[0].metadata.name}')

# Test database connection
kubectl exec -n staging $POD -- psql $DATABASE_URL -c "SELECT version();"
```

### 3. Verify Redis Connection

```bash
kubectl exec -n staging $POD -- redis-cli -h $REDIS_HOST PING
# Expected: PONG
```

### 4. Verify Blob Storage

```bash
# Test file upload via API
curl -X POST https://staging.legal-platform.com/api/documents/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-document.pdf"
```

### 5. Check Application Insights

```bash
# Query recent logs
az monitor app-insights query \
  --app legal-platform-staging \
  --analytics-query "traces | where timestamp > ago(5m) | limit 10"
```

### 6. Monitor Resource Usage

```bash
# Check node resource usage
kubectl top nodes

# Check pod resource usage
kubectl top pods -n staging

# Check HPA status
kubectl get hpa -n staging
```

---

## Troubleshooting

### Pods Not Starting

**Symptom:** Pods stuck in `Pending` or `CrashLoopBackOff`

**Solution:**

```bash
# Describe pod for events
kubectl describe pod <pod-name> -n staging

# Check logs
kubectl logs <pod-name> -n staging

# Common issues:
# - ImagePullBackOff: Check ACR integration
# - OOMKilled: Increase memory limits
# - CrashLoopBackOff: Check environment variables
```

### SSL Certificate Not Issuing

**Symptom:** Certificate stuck in `False` status

**Solution:**

```bash
# Check certificate status
kubectl describe certificate legal-platform-tls -n staging

# Check cert-manager logs
kubectl logs -n cert-manager deployment/cert-manager

# Common issues:
# - DNS not propagated: Wait 5-10 minutes
# - Rate limit: Use staging issuer first
# - Challenge failed: Check ingress configuration
```

### Database Connection Fails

**Symptom:** Apps can't connect to PostgreSQL

**Solution:**

```bash
# Verify database firewall rules
az postgres flexible-server firewall-rule list \
  --resource-group rg-legal-staging \
  --name psql-legal-staging

# Add AKS outbound IP to firewall
kubectl get nodes -o wide  # Get node IPs
az postgres flexible-server firewall-rule create \
  --resource-group rg-legal-staging \
  --name psql-legal-staging \
  --rule-name "allow-aks" \
  --start-ip-address <AKS_IP> \
  --end-ip-address <AKS_IP>
```

### Deployment Rollback Required

See [ROLLBACK_GUIDE.md](ROLLBACK_GUIDE.md) for detailed rollback procedures.

---

## Production Deployment

After successful staging deployment:

1. **Repeat infrastructure deployment** with production variables:

   ```bash
   cd infrastructure/terraform
   terraform init -backend-config="key=production.tfstate"
   terraform plan -var-file=environments/production/terraform.tfvars
   terraform apply
   ```

2. **Configure production DNS** with ingress IP

3. **Use Azure DevOps pipeline** for production deployment (includes approval gates)

4. **Monitor production** closely for first 24 hours

---

## Next Steps

- Configure monitoring alerts in Application Insights
- Set up backup procedures (see OPERATIONS_RUNBOOK.md)
- Configure log aggregation and retention
- Implement disaster recovery plan
- Schedule penetration testing
- Document incident response procedures

---

## Support

For issues or questions:

- Create GitHub issue: https://github.com/your-org/legal-platform/issues
- Contact DevOps team: devops@legal-platform.com
- Azure support: Submit ticket via Azure Portal
