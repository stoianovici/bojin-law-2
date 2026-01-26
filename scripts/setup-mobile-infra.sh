#!/bin/bash
# Setup Mobile App Infrastructure
#
# This script configures:
# 1. Coolify service for apps/mobile
# 2. DNS record for m.bojin-law.com
# 3. Cloudflare Worker for mobile redirect
# 4. Azure AD redirect URI (manual step)
#
# Prerequisites:
# - Source .env.local for credentials
# - ssh access to 135.181.44.197

set -e

# Load environment
source .env.local 2>/dev/null || {
  echo "Error: .env.local not found"
  exit 1
}

COOLIFY_URL="${COOLIFY_URL:-http://135.181.44.197:8000}"
HETZNER_IP="135.181.44.197"

echo "==================================="
echo "Mobile App Infrastructure Setup"
echo "==================================="

# Check required env vars
check_env() {
  local var=$1
  if [ -z "${!var}" ]; then
    echo "Error: $var not set in .env.local"
    exit 1
  fi
}

check_env "COOLIFY_API_TOKEN"
check_env "CLOUDFLARE_API_TOKEN"
check_env "CLOUDFLARE_ZONE_ID"

# ============================================
# 1. Create Coolify Service
# ============================================
echo ""
echo "1. Creating Coolify service..."

# First, get the project ID
PROJECT_ID=$(curl -s -X GET "${COOLIFY_URL}/api/v1/projects" \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}" \
  -H "Content-Type: application/json" | jq -r '.[0].uuid')

echo "   Project ID: $PROJECT_ID"

# Note: Coolify API for creating services is complex
# For now, provide manual instructions
echo ""
echo "   Manual setup required in Coolify dashboard:"
echo "   1. Go to ${COOLIFY_URL}"
echo "   2. Select the Legal Platform project"
echo "   3. Add new service → Application → Docker"
echo "   4. Settings:"
echo "      - Name: mobile"
echo "      - Build Pack: Nixpacks"
echo "      - Base Directory: apps/mobile"
echo "      - Port: 3002"
echo "      - Domain: m.bojin-law.com"
echo "   5. Environment variables:"
echo "      - NODE_ENV=production"
echo "      - NEXT_PUBLIC_AZURE_AD_CLIENT_ID=${AZURE_AD_CLIENT_ID}"
echo "      - NEXT_PUBLIC_AZURE_AD_TENANT_ID=${AZURE_AD_TENANT_ID}"
echo "      - GATEWAY_URL=https://api.bojin-law.com"
echo ""

# ============================================
# 2. Create DNS Record
# ============================================
echo "2. Creating DNS record for m.bojin-law.com..."

# Check if record exists
EXISTING=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records?name=m.bojin-law.com" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" | jq -r '.result[0].id // empty')

if [ -n "$EXISTING" ]; then
  echo "   DNS record already exists (ID: $EXISTING)"
else
  # Create A record
  RESULT=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data '{
      "type": "A",
      "name": "m",
      "content": "'"${HETZNER_IP}"'",
      "ttl": 1,
      "proxied": true
    }')

  if echo "$RESULT" | jq -e '.success' > /dev/null; then
    echo "   DNS record created successfully"
  else
    echo "   Error creating DNS record:"
    echo "$RESULT" | jq '.errors'
    exit 1
  fi
fi

# ============================================
# 3. Create Cloudflare Worker for Redirect
# ============================================
echo ""
echo "3. Creating Cloudflare Worker for mobile redirect..."

WORKER_SCRIPT='addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const ua = request.headers.get("user-agent") || "";
  const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);

  // Skip redirect for API calls and static assets
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/") ||
      url.pathname.startsWith("/_next/") ||
      url.pathname.includes(".")) {
    return fetch(request);
  }

  if (isMobile && url.hostname === "app.bojin-law.com") {
    url.hostname = "m.bojin-law.com";
    return Response.redirect(url.toString(), 302);
  }

  return fetch(request);
}'

# Create/update worker
echo "   Creating worker: mobile-redirect"
RESULT=$(curl -s -X PUT "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/scripts/mobile-redirect" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/javascript" \
  --data "$WORKER_SCRIPT" 2>&1)

if echo "$RESULT" | jq -e '.success' > /dev/null 2>&1; then
  echo "   Worker created successfully"

  # Create route
  echo "   Creating route for app.bojin-law.com/*"
  curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/workers/routes" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data '{
      "pattern": "app.bojin-law.com/*",
      "script": "mobile-redirect"
    }' | jq -r 'if .success then "   Route created" else "   Route may already exist" end'
else
  echo "   Note: Worker creation requires Cloudflare Account ID"
  echo "   Add CLOUDFLARE_ACCOUNT_ID to .env.local"
  echo ""
  echo "   Alternative: Create worker manually at:"
  echo "   https://dash.cloudflare.com/workers"
  echo ""
  echo "   Worker code:"
  echo "$WORKER_SCRIPT"
fi

# ============================================
# 4. Azure AD Redirect URI
# ============================================
echo ""
echo "4. Azure AD Configuration (manual step):"
echo "   1. Go to Azure Portal → App registrations"
echo "   2. Select the Bojin Law app"
echo "   3. Go to Authentication → Add platform → Web"
echo "   4. Add redirect URI: https://m.bojin-law.com/auth/callback"
echo "   5. Save"
echo ""

echo "==================================="
echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Complete Coolify service setup in dashboard"
echo "2. Add Azure AD redirect URI"
echo "3. Deploy: git push (triggers Coolify build)"
echo "4. Verify: https://m.bojin-law.com"
echo "==================================="
