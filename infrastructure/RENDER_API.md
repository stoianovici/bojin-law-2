# Render API Integration

This document explains how to use the Render API for deployment automation and monitoring.

## Setup

### 1. API Key Configuration

The Render API key is stored in `.env.render` (gitignored):

```bash
# Load environment variables
source .env.render

# Or export manually
export RENDER_API_KEY="rnd_H9BySnd0vtkLLLZtI9LpYI2l7JXu"
export RENDER_WEB_SERVICE_ID="srv-d4dk9fodl3ps73d3d7ig"
```

### 2. Verify Connection

```bash
# Test API connection
curl -H "Authorization: Bearer $RENDER_API_KEY" \
  "https://api.render.com/v1/services/$RENDER_WEB_SERVICE_ID"
```

## Common Operations

### Check Deployment Status

```bash
# Get latest deployments
curl -H "Authorization: Bearer $RENDER_API_KEY" \
  "https://api.render.com/v1/services/$RENDER_WEB_SERVICE_ID/deploys?limit=5" \
  | python3 -m json.tool

# Check specific deployment
DEPLOY_ID="dep-xyz..."
curl -H "Authorization: Bearer $RENDER_API_KEY" \
  "https://api.render.com/v1/services/$RENDER_WEB_SERVICE_ID/deploys/$DEPLOY_ID" \
  | python3 -m json.tool
```

### View Service Details

```bash
# Get service information
curl -H "Authorization: Bearer $RENDER_API_KEY" \
  "https://api.render.com/v1/services/$RENDER_WEB_SERVICE_ID" \
  | python3 -m json.tool

# List all services
curl -H "Authorization: Bearer $RENDER_API_KEY" \
  "https://api.render.com/v1/services?limit=20" \
  | python3 -m json.tool
```

### Trigger Manual Deploy

```bash
# Trigger a new deployment
curl -X POST \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  "https://api.render.com/v1/services/$RENDER_WEB_SERVICE_ID/deploys" \
  -d '{}'
```

### Suspend/Resume Services

```bash
# Suspend a service
SERVICE_ID="srv-xyz..."
curl -X POST \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  "https://api.render.com/v1/services/$SERVICE_ID/suspend"

# Resume a service
curl -X POST \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  "https://api.render.com/v1/services/$SERVICE_ID/resume"
```

## Service IDs

**IMPORTANT: DO NOT create new services - these already exist!**

Active services:

| Service           | ID                         | URL                                            |
| ----------------- | -------------------------- | ---------------------------------------------- |
| Web Frontend      | `srv-d4dk9fodl3ps73d3d7ig` | https://legal-platform-web.onrender.com        |
| Gateway (GraphQL) | `srv-d4pkv8q4i8rc73fq3mvg` | https://legal-platform-gateway.onrender.com    |
| AI Service        | `srv-d4uor5be5dus73a0hs3g` | https://legal-platform-ai-service.onrender.com |
| Legacy Import     | `srv-d4k84gogjchc73a0lqo0` | https://bojin-legacy-import.onrender.com       |

Health Check endpoints:

- Web: `/api/health`
- Gateway: `/health`
- AI Service: `/api/ai/health`
- Legacy Import: `/api/health`

## Deployment Statuses

- `build_in_progress` - Currently building
- `live` - Successfully deployed and running
- `build_failed` - Build failed (check logs)
- `update_failed` - Deployment failed during update
- `canceled` - Deployment was canceled
- `deactivated` - Service is suspended

## Quick Status Check Script

For quick status checks, you can use this one-liner:

```bash
# Check current deployment status
source .env.render && \
curl -s -H "Authorization: Bearer $RENDER_API_KEY" \
  "https://api.render.com/v1/services/$RENDER_WEB_SERVICE_ID/deploys?limit=1" \
  | python3 -m json.tool \
  | grep -E '"status"|"commit"|"createdAt"'
```

## API Documentation

Full Render API documentation: https://api-docs.render.com/

## Security Notes

- **NEVER commit `.env.render` to git**
- The API key has full access to your Render account
- Rotate the key if it's ever exposed
- To rotate: Dashboard → Account Settings → API Keys → Revoke & Create New

## For AI Assistants / Future Sessions

When working with this project:

1. Check if `.env.render` exists
2. Load the environment variables: `source .env.render`
3. Use the commands above to interact with Render
4. Service IDs and URLs are documented above
5. Always use the API for deployment status checks instead of manual dashboard checks

## Troubleshooting

### 401 Unauthorized

- Check that `RENDER_API_KEY` is set correctly
- Verify the API key hasn't been revoked

### 404 Not Found

- Verify the service ID is correct
- Check that the service hasn't been deleted

### Deployment Taking Too Long

- Normal build time: ~10 minutes
- If > 15 minutes, check for stuck builds in dashboard
- Can cancel and retrigger if needed
