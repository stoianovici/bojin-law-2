# Cache Module - Azure Cache for Redis
# Creates Redis cache with persistence and firewall rules

resource "azurerm_redis_cache" "main" {
  name                = "${var.project_name}-${var.environment}-redis"
  location            = var.location
  resource_group_name = var.resource_group_name

  capacity            = var.capacity
  family              = var.family
  sku_name            = var.sku_name
  enable_non_ssl_port = var.enable_non_ssl_port
  minimum_tls_version = "1.2"

  subnet_id = var.subnet_id != "" ? var.subnet_id : null

  redis_configuration {
    enable_authentication           = true
    maxmemory_reserved              = var.maxmemory_reserved
    maxmemory_delta                 = var.maxmemory_delta
    maxmemory_policy                = "allkeys-lru"
    rdb_backup_enabled              = var.rdb_backup_enabled
    rdb_backup_frequency            = var.rdb_backup_frequency
    rdb_backup_max_snapshot_count   = var.rdb_backup_max_snapshot_count
    rdb_storage_connection_string   = var.rdb_storage_connection_string
  }

  tags = var.tags
}

# Firewall rule to allow access from AKS subnet
resource "azurerm_redis_firewall_rule" "aks" {
  count               = var.aks_subnet_cidr != "" ? 1 : 0
  name                = "AllowAKS"
  redis_cache_name    = azurerm_redis_cache.main.name
  resource_group_name = var.resource_group_name
  start_ip            = cidrhost(var.aks_subnet_cidr, 0)
  end_ip              = cidrhost(var.aks_subnet_cidr, -1)
}
