resource "azurerm_kubernetes_cluster" "this" {
  name                = var.aks_cluster_name
  location            = var.location
  resource_group_name = var.resource_group_name
  dns_prefix          = var.aks_cluster_name

  default_node_pool {
    name                = "system"
    node_count          = 2
    vm_size             = "Standard_D2s_v3"
    type                = "System"
    enable_auto_scaling = false
    os_disk_size_gb     = 30
  }

  identity {
    type = "SystemAssigned"
  }

  linux_profile {
    admin_username = "azureuser"
    ssh_key {
      key_data = var.ssh_public_key
    }
  }

  network_profile {
    network_plugin    = "azure"
    load_balancer_sku = "standard"
    service_cidr      = var.service_cidr
    dns_service_ip    = var.dns_service_ip
  }

  tags = var.tags
}

resource "azurerm_kubernetes_cluster_node_pool" "user" {
  kubernetes_cluster_id = azurerm_kubernetes_cluster.this.id
  name                  = "userpool"
  node_count            = 3
  vm_size               = "Standard_D4s_v3"
  enable_auto_scaling   = true
  min_count             = 3
  max_count             = 10
  os_disk_size_gb       = 100
  vnet_subnet_id        = var.user_node_subnet_id
  zones                 = ["1", "2", "3"]

  tags = var.tags
}