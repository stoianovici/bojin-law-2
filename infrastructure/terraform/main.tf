# Terraform Main Configuration for Legal Platform
# Azure Infrastructure as Code

terraform {
  required_version = ">= 1.7.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.80"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "azurerm" {
  features {
    resource_group {
      prevent_deletion_if_contains_resources = true
    }

    key_vault {
      purge_soft_delete_on_destroy    = false
      recover_soft_deleted_key_vaults = true
    }
  }
}

# Data Sources
data "azurerm_client_config" "current" {}

# Resource Group
resource "azurerm_resource_group" "main" {
  name     = "${var.project_name}-${var.environment}-rg"
  location = var.location

  tags = var.tags
}

# Networking Module
module "networking" {
  source = "./modules/networking"

  project_name        = var.project_name
  environment         = var.environment
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  vnet_address_space  = var.vnet_address_space

  tags = var.tags
}

# AKS Module
module "aks" {
  source = "./modules/aks"

  project_name        = var.project_name
  environment         = var.environment
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  vnet_subnet_id      = module.networking.aks_subnet_id

  system_node_count = var.aks_system_node_count
  system_node_size  = var.aks_system_node_size
  user_node_count   = var.aks_user_node_count
  user_node_size    = var.aks_user_node_size
  user_node_min     = var.aks_user_node_min
  user_node_max     = var.aks_user_node_max

  tags = var.tags
}

# PostgreSQL Module
module "database" {
  source = "./modules/database"

  project_name        = var.project_name
  environment         = var.environment
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  subnet_id           = module.networking.database_subnet_id
  private_dns_zone_id = module.networking.postgres_private_dns_zone_id

  administrator_login    = var.db_admin_username
  administrator_password = var.db_admin_password
  sku_name               = var.db_sku_name
  storage_mb             = var.db_storage_mb
  backup_retention_days  = var.db_backup_retention_days

  tags = var.tags
}

# Redis Module
module "cache" {
  source = "./modules/cache"

  project_name        = var.project_name
  environment         = var.environment
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  subnet_id           = module.networking.cache_subnet_id

  capacity          = var.redis_capacity
  family            = var.redis_family
  sku_name          = var.redis_sku_name
  enable_non_ssl_port = false

  tags = var.tags
}

# Storage Module
module "storage" {
  source = "./modules/storage"

  project_name        = var.project_name
  environment         = var.environment
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name

  account_replication_type = var.storage_replication_type

  tags = var.tags
}

# Key Vault Module
module "security" {
  source = "./modules/security"

  project_name        = var.project_name
  environment         = var.environment
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name

  tenant_id                 = data.azurerm_client_config.current.tenant_id
  aks_identity_principal_id = module.aks.kubelet_identity_object_id

  database_connection_string       = module.database.connection_string
  redis_connection_string          = module.cache.redis_connection_string
  storage_connection_string        = module.storage.connection_string
  appinsights_instrumentation_key  = module.monitoring.application_insights_instrumentation_key

  tags = var.tags
}

# Monitoring Module
module "monitoring" {
  source = "./modules/monitoring"

  project_name        = var.project_name
  environment         = var.environment
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name

  retention_in_days   = var.log_retention_days
  target_resource_id  = module.aks.cluster_id
  enable_alerts       = var.environment == "production"

  tags = var.tags
}

# Cost Management - Budget Alerts
resource "azurerm_consumption_budget_resource_group" "main" {
  name              = "${var.project_name}-${var.environment}-budget"
  resource_group_id = azurerm_resource_group.main.id

  amount     = var.monthly_budget
  time_grain = "Monthly"

  time_period {
    start_date = formatdate("YYYY-MM-01'T'00:00:00Z", timestamp())
  }

  notification {
    enabled        = true
    threshold      = 90
    operator       = "GreaterThanOrEqualTo"
    threshold_type = "Forecasted"

    contact_emails = var.budget_alert_emails
  }

  notification {
    enabled        = true
    threshold      = 100
    operator       = "GreaterThanOrEqualTo"
    threshold_type = "Actual"

    contact_emails = var.budget_alert_emails
  }

  notification {
    enabled        = true
    threshold      = 110
    operator       = "GreaterThanOrEqualTo"
    threshold_type = "Actual"

    contact_emails = var.budget_alert_emails
  }

  notification {
    enabled        = true
    threshold      = 135
    operator       = "GreaterThanOrEqualTo"
    threshold_type = "Actual"

    contact_emails = var.budget_alert_emails
  }

  lifecycle {
    ignore_changes = [
      time_period[0].start_date,
    ]
  }
}
