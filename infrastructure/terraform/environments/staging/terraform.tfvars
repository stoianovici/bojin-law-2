# Terraform Variables for Staging Environment

# General Configuration
project_name = "legal-platform"
environment  = "staging"
location     = "West Europe"

tags = {
  Project     = "Legal Platform"
  Environment = "Staging"
  ManagedBy   = "Terraform"
  CostCenter  = "Engineering"
}

# Networking
vnet_address_space = ["10.0.0.0/16"]

# AKS Cluster
aks_system_node_count = 2
aks_system_node_size  = "Standard_D2s_v3"
aks_user_node_count   = 3
aks_user_node_size    = "Standard_D4s_v3"
aks_user_node_min     = 3
aks_user_node_max     = 10

# Database (PostgreSQL)
db_admin_username         = "psqladmin"
# db_admin_password should be set via environment variable: TF_VAR_db_admin_password
db_sku_name               = "GP_Standard_D4s_v3"
db_storage_mb             = 32768 # 32GB
db_backup_retention_days  = 7

# Redis Cache
redis_capacity = 1
redis_family   = "C"
redis_sku_name = "Standard"

# Storage
storage_replication_type = "GRS" # Geo-redundant storage

# Monitoring
log_retention_days = 30

# Cost Management
monthly_budget       = 450
budget_alert_emails  = ["devops@example.com", "finance@example.com"]
