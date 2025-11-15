variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
  default     = "legal-platform-rg"
}

variable "location" {
  description = "Azure region for resources"
  type        = string
  default     = "West Europe"
}

variable "environment" {
  description = "Environment name (staging, production)"
  type        = string
  default     = "staging"
}

variable "aks_cluster_name" {
  description = "Name of the AKS cluster"
  type        = string
  default     = "legal-platform-aks"
}

variable "postgres_server_name" {
  description = "Name of the PostgreSQL server"
  type        = string
  default     = "legal-platform-postgres"
}

variable "redis_cache_name" {
  description = "Name of the Redis cache"
  type        = string
  default     = "legal-platform-redis"
}

variable "storage_account_name" {
  description = "Name of the storage account"
  type        = string
  default     = "legalplatformstorage"
}

variable "app_insights_name" {
  description = "Name of the Application Insights resource"
  type        = string
  default     = "legal-platform-ai"
}

variable "key_vault_name" {
  description = "Name of the Key Vault"
  type        = string
  default     = "legal-platform-kv"
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default = {
    Environment = "staging"
    Project     = "Legal Platform"
    ManagedBy   = "Terraform"
  }
}