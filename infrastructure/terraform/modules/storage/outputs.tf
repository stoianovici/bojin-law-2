# Storage Module Outputs

output "storage_account_id" {
  description = "ID of the storage account"
  value       = azurerm_storage_account.main.id
}

output "storage_account_name" {
  description = "Name of the storage account"
  value       = azurerm_storage_account.main.name
}

output "primary_blob_endpoint" {
  description = "Primary blob endpoint"
  value       = azurerm_storage_account.main.primary_blob_endpoint
}

output "primary_access_key" {
  description = "Primary access key for storage account"
  value       = azurerm_storage_account.main.primary_access_key
  sensitive   = true
}

output "connection_string" {
  description = "Storage account connection string"
  value       = azurerm_storage_account.main.primary_connection_string
  sensitive   = true
}

output "documents_container_name" {
  description = "Name of the documents container"
  value       = azurerm_storage_container.documents.name
}

output "attachments_container_name" {
  description = "Name of the attachments container"
  value       = azurerm_storage_container.attachments.name
}

output "templates_container_name" {
  description = "Name of the templates container"
  value       = azurerm_storage_container.templates.name
}

output "backups_container_name" {
  description = "Name of the backups container"
  value       = azurerm_storage_container.backups.name
}
