# Terraform Variables for Legal Platform Infrastructure

# General Configuration
variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "legal-platform"
}

variable "environment" {
  description = "Environment name (staging, production)"
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be either 'staging' or 'production'."
  }
}

variable "location" {
  description = "Azure region for resources"
  type        = string
  default     = "West Europe"
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default = {
    Project     = "Legal Platform"
    ManagedBy   = "Terraform"
    Environment = "staging"
  }
}

# Networking Configuration
variable "vnet_address_space" {
  description = "Address space for the virtual network"
  type        = list(string)
  default     = ["10.0.0.0/16"]
}

# AKS Configuration
variable "aks_system_node_count" {
  description = "Number of nodes in the system node pool"
  type        = number
  default     = 2
}

variable "aks_system_node_size" {
  description = "VM size for system node pool"
  type        = string
  default     = "Standard_D2s_v3"
}

variable "aks_user_node_count" {
  description = "Initial number of nodes in the user node pool"
  type        = number
  default     = 3
}

variable "aks_user_node_size" {
  description = "VM size for user node pool"
  type        = string
  default     = "Standard_D4s_v3"
}

variable "aks_user_node_min" {
  description = "Minimum number of nodes for autoscaling"
  type        = number
  default     = 3
}

variable "aks_user_node_max" {
  description = "Maximum number of nodes for autoscaling"
  type        = number
  default     = 10
}

# Database Configuration
variable "db_admin_username" {
  description = "PostgreSQL administrator username"
  type        = string
  default     = "psqladmin"
  sensitive   = true
}

variable "db_admin_password" {
  description = "PostgreSQL administrator password"
  type        = string
  sensitive   = true
}

variable "db_sku_name" {
  description = "PostgreSQL SKU name"
  type        = string
  default     = "GP_Standard_D4s_v3"
}

variable "db_storage_mb" {
  description = "PostgreSQL storage in MB"
  type        = number
  default     = 32768 # 32GB
}

variable "db_backup_retention_days" {
  description = "Database backup retention in days"
  type        = number
  default     = 7
}

# Redis Configuration
variable "redis_capacity" {
  description = "Redis cache capacity"
  type        = number
  default     = 1
}

variable "redis_family" {
  description = "Redis cache family"
  type        = string
  default     = "C"
}

variable "redis_sku_name" {
  description = "Redis cache SKU"
  type        = string
  default     = "Standard"
}

# Storage Configuration
variable "storage_replication_type" {
  description = "Storage account replication type"
  type        = string
  default     = "GRS" # Geo-redundant storage
}

# Monitoring Configuration
variable "log_retention_days" {
  description = "Log Analytics retention in days"
  type        = number
  default     = 30
}

# Cost Management Configuration
variable "monthly_budget" {
  description = "Monthly budget in USD for cost alerts"
  type        = number
  default     = 500
}

variable "budget_alert_emails" {
  description = "Email addresses for budget alert notifications"
  type        = list(string)
  default     = ["devops@example.com"]
}
