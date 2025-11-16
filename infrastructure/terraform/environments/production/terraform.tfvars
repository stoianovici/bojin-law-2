# Terraform Variables for Production Environment

# General Configuration
project_name = "legal-platform"
environment  = "production"
location     = "West Europe"

tags = {
  Project     = "Legal Platform"
  Environment = "Production"
  ManagedBy   = "Terraform"
  CostCenter  = "Operations"
  Compliance  = "GDPR"
}

# Networking
vnet_address_space = ["10.1.0.0/16"]

# AKS Cluster (Higher capacity for production)
aks_system_node_count = 3
aks_system_node_size  = "Standard_D4s_v3"
aks_user_node_count   = 5
aks_user_node_size    = "Standard_D8s_v3"
aks_user_node_min     = 5
aks_user_node_max     = 20

# Database (PostgreSQL - Higher tier for production)
db_admin_username         = "psqladmin"
# db_admin_password should be set via environment variable: TF_VAR_db_admin_password
db_sku_name               = "GP_Standard_D8s_v3"
db_storage_mb             = 65536 # 64GB
db_backup_retention_days  = 35    # 5 weeks

# Redis Cache (Higher tier for production)
redis_capacity = 2
redis_family   = "C"
redis_sku_name = "Premium"

# Storage (Zone-redundant for production)
storage_replication_type = "GZRS" # Geo-zone-redundant storage

# Monitoring (Longer retention for production)
log_retention_days = 90

# Cost Management
monthly_budget       = 1300
budget_alert_emails  = ["devops@example.com", "engineering-manager@example.com", "finance@example.com"]
