# Cache Module Outputs

output "redis_id" {
  description = "ID of the Redis cache"
  value       = azurerm_redis_cache.main.id
}

output "redis_name" {
  description = "Name of the Redis cache"
  value       = azurerm_redis_cache.main.name
}

output "redis_hostname" {
  description = "Hostname of the Redis cache"
  value       = azurerm_redis_cache.main.hostname
}

output "redis_ssl_port" {
  description = "SSL port of the Redis cache"
  value       = azurerm_redis_cache.main.ssl_port
}

output "redis_port" {
  description = "Non-SSL port of the Redis cache"
  value       = azurerm_redis_cache.main.port
}

output "redis_primary_key" {
  description = "Primary access key for Redis cache"
  value       = azurerm_redis_cache.main.primary_access_key
  sensitive   = true
}

output "redis_secondary_key" {
  description = "Secondary access key for Redis cache"
  value       = azurerm_redis_cache.main.secondary_access_key
  sensitive   = true
}

output "redis_connection_string" {
  description = "Redis connection string"
  value       = "${azurerm_redis_cache.main.hostname}:${azurerm_redis_cache.main.ssl_port},password=${azurerm_redis_cache.main.primary_access_key},ssl=True,abortConnect=False"
  sensitive   = true
}
