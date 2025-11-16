# Cache Module Variables

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

variable "subnet_id" {
  description = "ID of the subnet for Redis (Premium SKU only)"
  type        = string
  default     = ""
}

variable "capacity" {
  description = "Redis cache capacity (0-6 for Basic/Standard, 1-5 for Premium)"
  type        = number
  default     = 1
}

variable "family" {
  description = "Redis cache family (C for Basic/Standard, P for Premium)"
  type        = string
  default     = "C"
}

variable "sku_name" {
  description = "Redis cache SKU (Basic, Standard, Premium)"
  type        = string
  default     = "Standard"
}

variable "enable_non_ssl_port" {
  description = "Enable non-SSL port (6379)"
  type        = bool
  default     = false
}

variable "maxmemory_reserved" {
  description = "Maxmemory reserved setting in MB"
  type        = number
  default     = 50
}

variable "maxmemory_delta" {
  description = "Maxmemory delta setting in MB"
  type        = number
  default     = 50
}

variable "rdb_backup_enabled" {
  description = "Enable RDB persistence"
  type        = bool
  default     = false
}

variable "rdb_backup_frequency" {
  description = "RDB backup frequency in minutes (15, 30, 60, 360, 720, 1440)"
  type        = number
  default     = 60
}

variable "rdb_backup_max_snapshot_count" {
  description = "Maximum number of RDB snapshots"
  type        = number
  default     = 1
}

variable "rdb_storage_connection_string" {
  description = "Storage account connection string for RDB backups"
  type        = string
  default     = ""
  sensitive   = true
}

variable "aks_subnet_cidr" {
  description = "CIDR of AKS subnet for firewall rules"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
