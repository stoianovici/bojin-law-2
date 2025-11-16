# Terraform Outputs for Legal Platform Infrastructure

# Resource Group
output "resource_group_name" {
  description = "Name of the main resource group"
  value       = azurerm_resource_group.main.name
}

output "resource_group_location" {
  description = "Location of the main resource group"
  value       = azurerm_resource_group.main.location
}

# Networking
output "vnet_id" {
  description = "Virtual Network ID"
  value       = module.networking.vnet_id
}

output "aks_subnet_id" {
  description = "AKS subnet ID"
  value       = module.networking.aks_subnet_id
}

# AKS Cluster
output "aks_cluster_name" {
  description = "AKS cluster name"
  value       = module.aks.cluster_name
}

output "aks_cluster_id" {
  description = "AKS cluster ID"
  value       = module.aks.cluster_id
}

output "aks_kube_config" {
  description = "Kubernetes configuration for kubectl"
  value       = module.aks.kube_config
  sensitive   = true
}

output "aks_cluster_fqdn" {
  description = "AKS cluster FQDN"
  value       = module.aks.cluster_fqdn
}

# Database
output "postgresql_fqdn" {
  description = "PostgreSQL server FQDN"
  value       = module.database.server_fqdn
}

output "postgresql_database_name" {
  description = "PostgreSQL database name"
  value       = module.database.database_name
}

output "postgresql_connection_string" {
  description = "PostgreSQL connection string"
  value       = module.database.connection_string
  sensitive   = true
}

# Redis Cache
output "redis_hostname" {
  description = "Redis cache hostname"
  value       = module.cache.redis_hostname
}

output "redis_port" {
  description = "Redis cache SSL port"
  value       = module.cache.redis_ssl_port
}

output "redis_primary_access_key" {
  description = "Redis primary access key"
  value       = module.cache.redis_primary_key
  sensitive   = true
}

output "redis_connection_string" {
  description = "Redis connection string"
  value       = module.cache.redis_connection_string
  sensitive   = true
}

# Storage
output "storage_account_name" {
  description = "Storage account name"
  value       = module.storage.storage_account_name
}

output "storage_connection_string" {
  description = "Storage account connection string"
  value       = module.storage.connection_string
  sensitive   = true
}

output "documents_container_name" {
  description = "Documents blob container name"
  value       = module.storage.documents_container_name
}

# Key Vault
output "key_vault_name" {
  description = "Key Vault name"
  value       = module.security.key_vault_name
}

output "key_vault_uri" {
  description = "Key Vault URI"
  value       = module.security.key_vault_uri
}

# Monitoring
output "application_insights_instrumentation_key" {
  description = "Application Insights instrumentation key"
  value       = module.monitoring.application_insights_instrumentation_key
  sensitive   = true
}

output "application_insights_connection_string" {
  description = "Application Insights connection string"
  value       = module.monitoring.application_insights_connection_string
  sensitive   = true
}

output "log_analytics_workspace_id" {
  description = "Log Analytics workspace ID"
  value       = module.monitoring.log_analytics_workspace_id
}
