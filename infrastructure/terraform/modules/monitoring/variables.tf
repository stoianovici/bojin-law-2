# Monitoring Module Variables

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

variable "retention_in_days" {
  description = "Log retention in days"
  type        = number
  default     = 30
}

variable "sampling_percentage" {
  description = "Application Insights sampling percentage"
  type        = number
  default     = 100
}

variable "alert_email_address" {
  description = "Email address for alert notifications"
  type        = string
  default     = "ops@example.com"
}

variable "enable_alerts" {
  description = "Enable metric alerts"
  type        = bool
  default     = false
}

variable "target_resource_id" {
  description = "Resource ID to monitor (e.g., AKS cluster ID)"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
