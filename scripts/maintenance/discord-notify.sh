#!/usr/bin/env bash

# Discord Notification Helper
# Usage: ./discord-notify.sh "success|error|info|warning" "Title" "Message"
#
# Required Environment Variables:
#   DISCORD_WEBHOOK_URL - Discord webhook URL

set -euo pipefail

WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-https://discord.com/api/webhooks/1464931697245159550/wtfhLLRGOw1oo_UGer3osFwXMjFJFX7fqApLoCCKejqLf2JOmoJ5LLhNpA-0Qnjhkj2w}"

send_notification() {
  local level="$1"
  local title="$2"
  local message="$3"
  local color
  local emoji

  case "$level" in
    success)
      color=3066993  # Green
      emoji="white_check_mark"
      ;;
    error)
      color=15158332  # Red
      emoji="x"
      ;;
    warning)
      color=15844367  # Yellow/Orange
      emoji="warning"
      ;;
    info|*)
      color=3447003  # Blue
      emoji="information_source"
      ;;
  esac

  local timestamp
  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  # Build JSON payload
  local payload
  payload=$(cat <<EOF
{
  "embeds": [{
    "title": ":${emoji}: ${title}",
    "description": "${message}",
    "color": ${color},
    "timestamp": "${timestamp}",
    "footer": {
      "text": "Legal Platform | Hetzner/Coolify"
    }
  }]
}
EOF
)

  # Send to Discord
  curl -s -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    --data-raw "$payload" > /dev/null

  return $?
}

# Main
if [[ $# -lt 3 ]]; then
  echo "Usage: $0 <success|error|info|warning> <title> <message>"
  exit 1
fi

send_notification "$1" "$2" "$3"
