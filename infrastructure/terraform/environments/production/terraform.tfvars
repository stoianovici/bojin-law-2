resource_group_name = "legal-platform-prod-rg"
location           = "West Europe"
environment        = "production"
aks_cluster_name   = "legal-platform-aks-prod"
postgres_server_name = "legal-platform-postgres-prod"
redis_cache_name   = "legal-platform-redis-prod"
storage_account_name = "legalplatformstorageprod${random_string.suffix.result}"
app_insights_name  = "legal-platform-ai-prod"
key_vault_name     = "legal-platform-kv-prod"
tags = {
  Environment = "production"
  Project     = "Legal Platform"
  ManagedBy   = "Terraform"
}