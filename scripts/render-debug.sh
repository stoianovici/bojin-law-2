#!/bin/bash
# Render Debug Helper - Quick access to logs and service status
# Usage: ./scripts/render-debug.sh [command] [options]

RENDER_API_KEY="rnd_xPmOVitvPACYNfeNEMSDH5ZQfSR0"
OWNER_ID="tea-d4dir3vdiees73cklbs0"
GATEWAY_ID="srv-d4pkv8q4i8rc73fq3mvg"
WEB_ID="srv-d4dk9fodl3ps73d3d7ig"
GATEWAY_URL="https://legal-platform-gateway.onrender.com"
WEB_URL="https://legal-platform-web.onrender.com"

api() {
  curl -s -H "Authorization: Bearer $RENDER_API_KEY" "$@"
}

case "${1:-help}" in
  logs|log)
    # Usage: ./render-debug.sh logs [gateway|web] [lines]
    SERVICE="${2:-gateway}"
    LINES="${3:-30}"

    if [ "$SERVICE" = "web" ]; then
      SVC_ID="$WEB_ID"
    else
      SVC_ID="$GATEWAY_ID"
    fi

    echo "=== $SERVICE logs (last $LINES lines) ==="
    api "https://api.render.com/v1/logs?ownerId=$OWNER_ID&resource=$SVC_ID&limit=$LINES" \
      | jq -r '.logs[] | "\(.timestamp | split("T")[1] | split(".")[0]) [\(.labels[] | select(.name=="level") | .value | .[0:5])] \(.message)"' \
      | tac
    ;;

  errors)
    # Show only error logs
    SERVICE="${2:-gateway}"
    LINES="${3:-50}"

    if [ "$SERVICE" = "web" ]; then
      SVC_ID="$WEB_ID"
    else
      SVC_ID="$GATEWAY_ID"
    fi

    echo "=== $SERVICE errors ==="
    api "https://api.render.com/v1/logs?ownerId=$OWNER_ID&resource=$SVC_ID&limit=$LINES" \
      | jq -r '.logs[] | select(.labels[] | select(.name=="level" and .value=="error")) | "\(.timestamp | split("T")[1] | split(".")[0]) \(.message)"' \
      | tac
    ;;

  status)
    # Show deployment status for both services
    echo "=== Gateway ==="
    api "https://api.render.com/v1/services/$GATEWAY_ID/deploys?limit=1" \
      | jq -r '.[0] | "Status: \(.deploy.status)\nCommit: \(.deploy.commit.id[0:7])\nCreated: \(.deploy.createdAt)"'

    echo ""
    echo "=== Web ==="
    api "https://api.render.com/v1/services/$WEB_ID/deploys?limit=1" \
      | jq -r '.[0] | "Status: \(.deploy.status)\nCommit: \(.deploy.commit.id[0:7])\nCreated: \(.deploy.createdAt)"'
    ;;

  deploys)
    # Show recent deploys
    SERVICE="${2:-gateway}"

    if [ "$SERVICE" = "web" ]; then
      SVC_ID="$WEB_ID"
    else
      SVC_ID="$GATEWAY_ID"
    fi

    echo "=== $SERVICE recent deploys ==="
    api "https://api.render.com/v1/services/$SVC_ID/deploys?limit=5" \
      | jq -r '.[] | "\(.deploy.commit.id[0:7]) | \(.deploy.status | .[0:12]) | \(.deploy.createdAt | split("T") | .[0] + " " + .[1][0:8])"'
    ;;

  redeploy)
    # Trigger a new deploy
    SERVICE="${2:-gateway}"

    if [ "$SERVICE" = "web" ]; then
      SVC_ID="$WEB_ID"
    else
      SVC_ID="$GATEWAY_ID"
    fi

    echo "Triggering redeploy for $SERVICE..."
    api -X POST "https://api.render.com/v1/services/$SVC_ID/deploys" \
      -H "Content-Type: application/json" \
      -d '{}' \
      | jq -r '"Deploy ID: \(.deploy.id)\nStatus: \(.deploy.status)"'
    ;;

  cancel)
    # Cancel a deploy
    DEPLOY_ID="$2"
    if [ -z "$DEPLOY_ID" ]; then
      echo "Usage: ./render-debug.sh cancel <deploy-id>"
      exit 1
    fi

    echo "Cancelling deploy $DEPLOY_ID..."
    api -X POST "https://api.render.com/v1/deploys/$DEPLOY_ID/cancel" | jq '.'
    ;;

  services)
    # List all services
    echo "=== All Services ==="
    api "https://api.render.com/v1/services?limit=10" \
      | jq -r '.[] | "\(.service.id) | \(.service.name) | \(.service.type)"'
    ;;

  redis)
    # Check Redis status
    echo "=== Redis Status ==="
    api "https://api.render.com/v1/redis?limit=5" \
      | jq -r '.[] | "\(.redis.id) | \(.redis.name) | \(.redis.status) | \(.redis.plan)"'
    ;;

  health)
    # Check service health endpoints
    echo "=== Gateway Health ==="
    curl -s "$GATEWAY_URL/health" | jq '.' 2>/dev/null || echo "No response or not JSON"

    echo ""
    echo "=== Web Health ==="
    curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" "$WEB_URL"
    ;;

  graphql)
    # Execute a GraphQL query (requires token as $2)
    QUERY="$2"
    TOKEN="$3"

    if [ -z "$QUERY" ]; then
      echo "Usage: ./render-debug.sh graphql '<query>' [auth-token]"
      echo "Example: ./render-debug.sh graphql '{ me { id email } }' 'Bearer xxx'"
      exit 1
    fi

    curl -s "$GATEWAY_URL/graphql" \
      -H "Content-Type: application/json" \
      ${TOKEN:+-H "Authorization: $TOKEN"} \
      -d "{\"query\": \"$QUERY\"}" | jq '.'
    ;;

  help|*)
    echo "Render Debug Helper"
    echo ""
    echo "Commands:"
    echo "  logs [gateway|web] [n]  - Show last n log lines (default: gateway, 30)"
    echo "  errors [gateway|web]    - Show only error logs"
    echo "  status                  - Show deployment status for all services"
    echo "  deploys [gateway|web]   - Show recent deploys"
    echo "  redeploy [gateway|web]  - Trigger a new deploy"
    echo "  cancel <deploy-id>      - Cancel a deploy"
    echo "  services                - List all Render services"
    echo "  redis                   - Check Redis instance status"
    echo "  health                  - Check service health endpoints"
    echo "  graphql <query> [token] - Execute GraphQL query"
    echo ""
    echo "Examples:"
    echo "  ./scripts/render-debug.sh logs gateway 50"
    echo "  ./scripts/render-debug.sh errors"
    echo "  ./scripts/render-debug.sh status"
    echo "  ./scripts/render-debug.sh redeploy gateway"
    ;;
esac
