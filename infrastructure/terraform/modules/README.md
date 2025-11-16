# Terraform Modules

This directory contains reusable Terraform modules for provisioning the Legal Platform infrastructure on Azure.

## Module Structure

Each module follows a consistent structure:

- `main.tf` - Resource definitions
- `variables.tf` - Input variables
- `outputs.tf` - Output values

## Available Modules

### 1. Networking (`./modules/networking`)

Creates the virtual network infrastructure with subnets for all services.

**Resources:**

- Virtual Network with configurable address space
- AKS subnet (CIDR auto-calculated)
- PostgreSQL subnet with delegation
- Redis subnet
- Network Security Groups for each subnet
- Private DNS zone for PostgreSQL

**Key Outputs:**

- `vnet_id` - Virtual network ID
- `aks_subnet_id` - Subnet ID for AKS cluster
- `database_subnet_id` - Subnet ID for PostgreSQL
- `cache_subnet_id` - Subnet ID for Redis
- `postgres_private_dns_zone_id` - Private DNS zone ID

### 2. AKS (`./modules/aks`)

Creates Azure Kubernetes Service cluster with system and user node pools.

**Resources:**

- AKS cluster with Azure CNI networking
- System node pool (2 nodes, Standard_D2s_v3 by default)
- User node pool with autoscaling (3-10 nodes, Standard_D4s_v3 by default)
- Role assignment for ACR pull access

**Key Outputs:**

- `cluster_id` - AKS cluster ID
- `cluster_name` - AKS cluster name
- `kube_config` - Kubernetes configuration (sensitive)
- `kubelet_identity_object_id` - Kubelet identity for Key Vault access

### 3. Database (`./modules/database`)

Creates PostgreSQL Flexible Server with pgvector extension.

**Resources:**

- PostgreSQL Flexible Server version 16
- Database with UTF8 charset
- pgvector extension configuration
- High availability (optional, zone-redundant)
- Automated backups with configurable retention
- Performance tuning (max_connections, work_mem, shared_buffers)

**Key Outputs:**

- `server_fqdn` - PostgreSQL server FQDN
- `database_name` - Database name
- `connection_string` - Full connection string (sensitive)

### 4. Cache (`./modules/cache`)

Creates Azure Cache for Redis with persistence options.

**Resources:**

- Redis cache (Standard C1 by default)
- TLS 1.2 minimum
- Optional RDB persistence
- Firewall rules for AKS subnet
- Memory management policies (allkeys-lru)

**Key Outputs:**

- `redis_hostname` - Redis hostname
- `redis_ssl_port` - SSL port (6380)
- `redis_connection_string` - Full connection string (sensitive)

### 5. Storage (`./modules/storage`)

Creates Azure Blob Storage with containers and lifecycle policies.

**Resources:**

- Storage account with GRS replication
- Containers: documents, attachments, templates, backups
- Blob versioning enabled
- Lifecycle policies (archive old documents, delete old backups)
- TLS 1.2 minimum, HTTPS-only

**Key Outputs:**

- `storage_account_name` - Storage account name
- `connection_string` - Connection string (sensitive)
- Container names for each blob container

### 6. Security (`./modules/security`)

Creates Azure Key Vault for secrets management.

**Resources:**

- Key Vault with soft delete protection
- Access policies for Terraform and AKS
- Secrets for database, Redis, storage, and App Insights
- Network ACLs (allow Azure services)

**Key Outputs:**

- `key_vault_name` - Key Vault name
- `key_vault_uri` - Key Vault URI

### 7. Monitoring (`./modules/monitoring`)

Creates Application Insights and Log Analytics for monitoring.

**Resources:**

- Log Analytics workspace
- Application Insights (web application type)
- Action group for alerts
- Metric alerts for high CPU and memory (optional)
- Configurable retention and sampling

**Key Outputs:**

- `application_insights_instrumentation_key` - Instrumentation key (sensitive)
- `application_insights_connection_string` - Connection string (sensitive)
- `log_analytics_workspace_id` - Workspace ID

## Usage

Modules are referenced in the root `main.tf` file. Example:

```hcl
module "networking" {
  source = "./modules/networking"

  project_name        = var.project_name
  environment         = var.environment
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  vnet_address_space  = var.vnet_address_space

  tags = var.tags
}
```

## Module Dependencies

The modules have the following dependency chain:

1. **Networking** (no dependencies)
2. **AKS** (depends on: Networking)
3. **Database** (depends on: Networking)
4. **Cache** (depends on: Networking)
5. **Storage** (no dependencies)
6. **Monitoring** (depends on: AKS for alerts)
7. **Security** (depends on: AKS, Database, Cache, Storage, Monitoring)

## Validation

To validate the Terraform configuration:

```bash
cd infrastructure/terraform
terraform init
terraform validate
terraform plan -var-file=environments/staging/terraform.tfvars
```

## Environment Variables

Required variables are defined in `variables.tf` and can be set via:

- `terraform.tfvars` files in `environments/staging/` or `environments/production/`
- Environment variables (`TF_VAR_*`)
- Command line flags (`-var`)

**Sensitive variables (must be set):**

- `db_admin_password` - PostgreSQL admin password

## Notes

- All modules use consistent naming: `{project_name}-{environment}-{resource_type}`
- All modules accept a `tags` variable for resource tagging
- Sensitive outputs are marked with `sensitive = true`
- Network security is configured with principle of least privilege
