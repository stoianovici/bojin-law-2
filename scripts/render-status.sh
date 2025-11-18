#!/bin/bash
# Render Deployment Status Checker
# Quick script to check the status of Render deployments

# Load environment variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

if [ -f "$PROJECT_ROOT/.env.render" ]; then
    source "$PROJECT_ROOT/.env.render"
else
    echo "❌ Error: .env.render not found"
    echo "Please create .env.render with your Render API key"
    exit 1
fi

# Check if API key is set
if [ -z "$RENDER_API_KEY" ]; then
    echo "❌ Error: RENDER_API_KEY not set in .env.render"
    exit 1
fi

# Default to web service
SERVICE_ID="${RENDER_WEB_SERVICE_ID}"

echo "🔍 Checking Render deployment status..."
echo ""

# Get latest deployment
DEPLOY_JSON=$(curl -s -H "Authorization: Bearer $RENDER_API_KEY" \
    "https://api.render.com/v1/services/$SERVICE_ID/deploys?limit=1")

# Parse and display
echo "$DEPLOY_JSON" | python3 << 'EOF'
import sys, json

try:
    data = json.loads(sys.stdin.read())
    if not data or len(data) == 0:
        print("❌ No deployments found")
        sys.exit(1)

    deploy = data[0]['deploy']

    # Status emoji
    status = deploy['status']
    status_emoji = {
        'live': '✅',
        'build_in_progress': '🔨',
        'build_failed': '❌',
        'update_failed': '❌',
        'canceled': '⚠️',
        'deactivated': '💤'
    }.get(status, '❓')

    print(f"Status: {status_emoji} {status.upper().replace('_', ' ')}")
    print(f"Commit: {deploy['commit']['id'][:8]}")
    print(f"Message: {deploy['commit']['message'].split(chr(10))[0]}")
    print(f"Started: {deploy.get('startedAt', 'Not started yet')}")

    if deploy.get('finishedAt'):
        print(f"Finished: {deploy['finishedAt']}")

    if status == 'live':
        print(f"\n🌐 Service is live!")
    elif status == 'build_in_progress':
        print(f"\n⏳ Build in progress... (usually takes ~10 minutes)")
    elif 'failed' in status:
        print(f"\n💥 Deployment failed - check logs in Render dashboard")

except Exception as e:
    print(f"❌ Error parsing response: {e}")
    sys.exit(1)
EOF

echo ""
echo "📊 Dashboard: https://dashboard.render.com/web/$SERVICE_ID"
echo "🌐 Service URL: $RENDER_WEB_URL"
