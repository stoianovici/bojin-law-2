# AKS Module - Azure Kubernetes Service Cluster
# Creates AKS cluster with system and user node pools

resource "azurerm_kubernetes_cluster" "main" {
  name                = "${var.project_name}-${var.environment}-aks"
  location            = var.location
  resource_group_name = var.resource_group_name
  dns_prefix          = "${var.project_name}-${var.environment}"
  kubernetes_version  = var.kubernetes_version

  default_node_pool {
    name                = "system"
    node_count          = var.system_node_count
    vm_size             = var.system_node_size
    vnet_subnet_id      = var.vnet_subnet_id
    type                = "VirtualMachineScaleSets"
    enable_auto_scaling = false
    os_disk_size_gb     = 30

    node_labels = {
      "nodepool-type" = "system"
      "environment"   = var.environment
    }

    tags = merge(var.tags, {
      "nodepool" = "system"
    })
  }

  identity {
    type = "SystemAssigned"
  }

  network_profile {
    network_plugin     = "azure"
    network_policy     = "azure"
    load_balancer_sku  = "standard"
    service_cidr       = "10.2.0.0/16"
    dns_service_ip     = "10.2.0.10"
  }

  auto_scaler_profile {
    balance_similar_node_groups = true
    max_graceful_termination_sec = 600
  }

  tags = var.tags

  lifecycle {
    ignore_changes = [
      default_node_pool[0].node_count,
    ]
  }
}

# User Node Pool for application workloads
resource "azurerm_kubernetes_cluster_node_pool" "user" {
  name                  = "user"
  kubernetes_cluster_id = azurerm_kubernetes_cluster.main.id
  vm_size               = var.user_node_size
  vnet_subnet_id        = var.vnet_subnet_id

  node_count          = var.user_node_count
  enable_auto_scaling = true
  min_count           = var.user_node_min
  max_count           = var.user_node_max

  node_labels = {
    "nodepool-type" = "user"
    "environment"   = var.environment
  }

  node_taints = []

  tags = merge(var.tags, {
    "nodepool" = "user"
  })
}

# Role Assignment for AKS to pull from ACR
resource "azurerm_role_assignment" "aks_acr_pull" {
  count                = var.acr_id != "" ? 1 : 0
  principal_id         = azurerm_kubernetes_cluster.main.kubelet_identity[0].object_id
  role_definition_name = "AcrPull"
  scope                = var.acr_id
  skip_service_principal_aad_check = true
}
