#!/bin/bash
set -e

required_vars=(
  DATABASE_URL
  REDIS_URL
  AZURE_AD_CLIENT_ID
  AZURE_AD_TENANT_ID
  AZURE_AD_CLIENT_SECRET
  SESSION_SECRET
  JWT_SECRET
  CLAUDE_API_KEY
  AZURE_STORAGE_ACCOUNT_NAME
  AZURE_STORAGE_ACCOUNT_KEY
)

missing_vars=()

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    missing_vars+=("$var")
  fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
  echo "Error: Missing required environment variables:"
  for var in "${missing_vars[@]}"; do
    echo "  - $var"
  done
  exit 1
fi

echo "All required environment variables are set."