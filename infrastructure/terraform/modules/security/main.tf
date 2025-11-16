# Security Module - Azure Key Vault
# Creates Key Vault for secrets management with access policies

data "azurerm_client_config" "current" {}

resource "azurerm_key_vault" "main" {
  name                       = "${var.project_name}-${var.environment}-kv"
  location                   = var.location
  resource_group_name        = var.resource_group_name
  tenant_id                  = var.tenant_id
  sku_name                   = "standard"
  soft_delete_retention_days = 7
  purge_protection_enabled   = var.purge_protection_enabled

  enable_rbac_authorization = false

  network_acls {
    bypass         = "AzureServices"
    default_action = var.network_default_action
  }

  tags = var.tags
}

# Access Policy for current user/service principal (Terraform)
resource "azurerm_key_vault_access_policy" "terraform" {
  key_vault_id = azurerm_key_vault.main.id
  tenant_id    = var.tenant_id
  object_id    = data.azurerm_client_config.current.object_id

  secret_permissions = [
    "Get",
    "List",
    "Set",
    "Delete",
    "Recover",
    "Backup",
    "Restore",
    "Purge"
  ]

  certificate_permissions = [
    "Get",
    "List",
    "Create",
    "Delete",
    "Update"
  ]

  key_permissions = [
    "Get",
    "List",
    "Create",
    "Delete",
    "Update"
  ]
}

# Access Policy for AKS kubelet identity
resource "azurerm_key_vault_access_policy" "aks" {
  key_vault_id = azurerm_key_vault.main.id
  tenant_id    = var.tenant_id
  object_id    = var.aks_identity_principal_id

  secret_permissions = [
    "Get",
    "List"
  ]
}

# Store Database Connection String
resource "azurerm_key_vault_secret" "database_connection_string" {
  count        = var.database_connection_string != "" ? 1 : 0
  name         = "database-connection-string"
  value        = var.database_connection_string
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

# Store Redis Connection String
resource "azurerm_key_vault_secret" "redis_connection_string" {
  count        = var.redis_connection_string != "" ? 1 : 0
  name         = "redis-connection-string"
  value        = var.redis_connection_string
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

# Store Storage Connection String
resource "azurerm_key_vault_secret" "storage_connection_string" {
  count        = var.storage_connection_string != "" ? 1 : 0
  name         = "storage-connection-string"
  value        = var.storage_connection_string
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

# Store Application Insights Instrumentation Key
resource "azurerm_key_vault_secret" "appinsights_instrumentation_key" {
  count        = var.appinsights_instrumentation_key != "" ? 1 : 0
  name         = "appinsights-instrumentation-key"
  value        = var.appinsights_instrumentation_key
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [azurerm_key_vault_access_policy.terraform]
}
