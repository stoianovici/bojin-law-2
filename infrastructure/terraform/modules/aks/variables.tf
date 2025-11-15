variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
}

variable "location" {
  description = "Azure location"
  type        = string
}

variable "aks_cluster_name" {
  description = "Name of the AKS cluster"
  type        = string
}

variable "ssh_public_key" {
  description = "SSH public key for AKS nodes"
  type        = string
}

variable "service_cidr" {
  description = "CIDR for Kubernetes services"
  type        = string
  default     = "10.0.0.0/16"
}

variable "dns_service_ip" {
  description = "IP for Kubernetes DNS"
  type        = string
  default     = "10.0.0.10"
}

variable "user_node_subnet_id" {
  description = "Subnet ID for user node pool"
  type        = string
}

variable "tags" {
  description = "Tags for the resources"
  type        = map(string)
}