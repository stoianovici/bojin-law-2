# AKS Module Variables

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

variable "vnet_subnet_id" {
  description = "ID of the subnet for AKS nodes"
  type        = string
}

variable "kubernetes_version" {
  description = "Kubernetes version"
  type        = string
  default     = "1.28"
}

variable "system_node_count" {
  description = "Number of nodes in the system node pool"
  type        = number
  default     = 2
}

variable "system_node_size" {
  description = "VM size for system nodes"
  type        = string
  default     = "Standard_D2s_v3"
}

variable "user_node_count" {
  description = "Initial number of nodes in the user node pool"
  type        = number
  default     = 3
}

variable "user_node_size" {
  description = "VM size for user nodes"
  type        = string
  default     = "Standard_D4s_v3"
}

variable "user_node_min" {
  description = "Minimum number of user nodes (autoscaling)"
  type        = number
  default     = 3
}

variable "user_node_max" {
  description = "Maximum number of user nodes (autoscaling)"
  type        = number
  default     = 10
}

variable "acr_id" {
  description = "ID of Azure Container Registry for AcrPull role assignment"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
