# Security Module Variables

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name (staging, production)"
  type        = string
}

variable "location" {
  description = "Azure region for resources"
  type        = string
}

variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
}

variable "tenant_id" {
  description = "Azure AD tenant ID"
  type        = string
}

variable "aks_identity_principal_id" {
  description = "Object ID of the AKS kubelet identity for Key Vault access"
  type        = string
}

variable "purge_protection_enabled" {
  description = "Enable purge protection for Key Vault"
  type        = bool
  default     = false
}

variable "network_default_action" {
  description = "Default network action for Key Vault (Allow or Deny)"
  type        = string
  default     = "Allow"
}

variable "database_connection_string" {
  description = "Database connection string to store in Key Vault"
  type        = string
  default     = ""
  sensitive   = true
}

variable "redis_connection_string" {
  description = "Redis connection string to store in Key Vault"
  type        = string
  default     = ""
  sensitive   = true
}

variable "storage_connection_string" {
  description = "Storage connection string to store in Key Vault"
  type        = string
  default     = ""
  sensitive   = true
}

variable "appinsights_instrumentation_key" {
  description = "Application Insights instrumentation key to store in Key Vault"
  type        = string
  default     = ""
  sensitive   = true
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
