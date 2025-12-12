#!/usr/bin/env bash
# Render Management Script
# Usage: ./scripts/render.sh <command> [service]
#
# Commands:
#   status              - Show status of all services
#   suspend <service>   - Suspend a service (stops billing)
#   resume <service>    - Resume a suspended service
#   deploy <service>    - Trigger a deploy
#   logs <service>      - Show recent logs
#   cost                - Show cost estimate
#
# Services: web, gateway, ai, legacy, all
#
# Environment:
#   RENDER_API_KEY - Your Render API key (required)

set -e

# Service configuration
get_service_id() {
  case "$1" in
    web)     echo "srv-d4dk9fodl3ps73d3d7ig" ;;
    gateway) echo "srv-d4pkv8q4i8rc73fq3mvg" ;;
    ai)      echo "srv-d4t77pshg0os73cnebtg" ;;
    legacy)  echo "srv-d4k84gogjchc73a0lqo0" ;;
    *)       echo "" ;;
  esac
}

get_service_name() {
  case "$1" in
    web)     echo "legal-platform-web" ;;
    gateway) echo "legal-platform-gateway" ;;
    ai)      echo "legal-platform-ai-service" ;;
    legacy)  echo "bojin-legacy-import" ;;
    *)       echo "" ;;
  esac
}

ALL_SERVICES="web gateway ai legacy"

# Check for API key
if [ -z "$RENDER_API_KEY" ]; then
  # Try to load from .env.render
  if [ -f ".env.render" ]; then
    RENDER_API_KEY=$(grep RENDER_API_KEY .env.render | cut -d= -f2)
    export RENDER_API_KEY
  fi
  if [ -z "$RENDER_API_KEY" ]; then
    echo "Error: RENDER_API_KEY not set"
    echo "Set it with: export RENDER_API_KEY=your_key"
    exit 1
  fi
fi

API_BASE="https://api.render.com/v1"

# Helper function for API calls
api_call() {
  local method=$1
  local endpoint=$2
  curl -s -X "$method" \
    -H "Authorization: Bearer $RENDER_API_KEY" \
    -H "Content-Type: application/json" \
    "$API_BASE$endpoint"
}

# Status command
cmd_status() {
  echo "Render Services Status"
  echo "======================"
  echo ""
  printf "%-35s %-15s %-20s\n" "Service" "Status" "Last Deploy"
  printf "%-35s %-15s %-20s\n" "-------" "------" "-----------"

  for key in $ALL_SERVICES; do
    local id=$(get_service_id "$key")
    local name=$(get_service_name "$key")
    local response=$(api_call GET "/services/$id")
    local suspended=$(echo "$response" | grep -o '"suspended":"[^"]*"' | cut -d'"' -f4)
    local updated=$(echo "$response" | grep -o '"updatedAt":"[^"]*"' | cut -d'"' -f4 | cut -d'T' -f1)

    if [ "$suspended" == "suspended" ]; then
      status="SUSPENDED"
    else
      status="Running"
    fi

    printf "%-35s %-15s %-20s\n" "$name" "$status" "$updated"
  done
  echo ""
}

# Suspend command
cmd_suspend() {
  local service=$1
  if [ -z "$service" ]; then
    echo "Usage: $0 suspend <service>"
    echo "Services: web, gateway, ai, legacy"
    exit 1
  fi

  local id=$(get_service_id "$service")
  if [ -z "$id" ]; then
    echo "Unknown service: $service"
    exit 1
  fi

  local name=$(get_service_name "$service")
  echo "Suspending $name..."
  api_call POST "/services/$id/suspend" | python3 -m json.tool 2>/dev/null || cat
  echo ""
  echo "Service suspended. It will no longer incur compute charges."
}

# Resume command
cmd_resume() {
  local service=$1
  if [ -z "$service" ]; then
    echo "Usage: $0 resume <service>"
    echo "Services: web, gateway, ai, legacy"
    exit 1
  fi

  local id=$(get_service_id "$service")
  if [ -z "$id" ]; then
    echo "Unknown service: $service"
    exit 1
  fi

  local name=$(get_service_name "$service")
  echo "Resuming $name..."
  api_call POST "/services/$id/resume" | python3 -m json.tool 2>/dev/null || cat
  echo ""
  echo "Service resumed. It will start and begin incurring charges."
}

# Deploy command
cmd_deploy() {
  local service=$1

  if [ -z "$service" ] || [ "$service" == "all" ]; then
    echo "Deploying all services..."
    for key in $ALL_SERVICES; do
      local id=$(get_service_id "$key")
      local name=$(get_service_name "$key")
      echo "  Deploying $name..."
      api_call POST "/services/$id/deploys" > /dev/null
    done
    echo "All deploys triggered."
  else
    local id=$(get_service_id "$service")
    if [ -z "$id" ]; then
      echo "Unknown service: $service"
      exit 1
    fi

    local name=$(get_service_name "$service")
    echo "Deploying $name..."
    api_call POST "/services/$id/deploys" | python3 -m json.tool 2>/dev/null || cat
  fi
}

# Logs command
cmd_logs() {
  local service=$1
  if [ -z "$service" ]; then
    echo "Usage: $0 logs <service>"
    echo "Services: web, gateway, ai, legacy"
    exit 1
  fi

  local id=$(get_service_id "$service")
  if [ -z "$id" ]; then
    echo "Unknown service: $service"
    exit 1
  fi

  local name=$(get_service_name "$service")
  echo "Recent deploys for $name:"
  api_call GET "/services/$id/deploys?limit=5" | python3 -m json.tool 2>/dev/null || cat
}

# Cost command
cmd_cost() {
  echo "Current Monthly Cost Estimate"
  echo "=============================="
  echo ""
  echo "Services (Starter @ \$0.0121/hr = ~\$9/mo):"

  for key in $ALL_SERVICES; do
    local id=$(get_service_id "$key")
    local name=$(get_service_name "$key")
    local response=$(api_call GET "/services/$id")
    local suspended=$(echo "$response" | grep -o '"suspended":"[^"]*"' | cut -d'"' -f4)

    if [ "$suspended" == "suspended" ]; then
      printf "  %-35s \$0/mo (suspended)\n" "$name"
    else
      printf "  %-35s ~\$9/mo\n" "$name"
    fi
  done

  echo ""
  echo "Datastores:"
  echo "  Postgres (Basic 1GB)              ~\$23/mo"
  echo "  Redis (Starter)                   ~\$10/mo"
  echo ""
  echo "Hobby Plan:                         \$0/mo"
  echo ""
}

# Help
cmd_help() {
  echo "Render Management Script"
  echo ""
  echo "Usage: $0 <command> [service]"
  echo ""
  echo "Commands:"
  echo "  status              Show status of all services"
  echo "  suspend <service>   Suspend a service (stops billing)"
  echo "  resume <service>    Resume a suspended service"
  echo "  deploy [service]    Trigger a deploy (default: all)"
  echo "  logs <service>      Show recent deploys"
  echo "  cost                Show cost estimate"
  echo "  help                Show this help"
  echo ""
  echo "Services: web, gateway, ai, legacy, all"
  echo ""
  echo "Examples:"
  echo "  $0 status"
  echo "  $0 suspend legacy"
  echo "  $0 resume legacy"
  echo "  $0 deploy web"
  echo "  $0 deploy all"
}

# Main
case "${1:-help}" in
  status)  cmd_status ;;
  suspend) cmd_suspend "$2" ;;
  resume)  cmd_resume "$2" ;;
  deploy)  cmd_deploy "$2" ;;
  logs)    cmd_logs "$2" ;;
  cost)    cmd_cost ;;
  help)    cmd_help ;;
  *)       echo "Unknown command: $1"; cmd_help; exit 1 ;;
esac
