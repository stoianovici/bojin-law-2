resource_group_name = "legal-platform-staging-rg"
location           = "West Europe"
environment        = "staging"
aks_cluster_name   = "legal-platform-aks-staging"
postgres_server_name = "legal-platform-postgres-staging"
redis_cache_name   = "legal-platform-redis-staging"
storage_account_name = "legalplatformstorage${random_string.suffix.result}"
app_insights_name  = "legal-platform-ai-staging"
key_vault_name     = "legal-platform-kv-staging"
tags = {
  Environment = "staging"
  Project     = "Legal Platform"
  ManagedBy   = "Terraform"
}