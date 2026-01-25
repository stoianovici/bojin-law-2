#!/bin/bash

# Discord-Claude Bridge
# Polls a Discord channel and responds using Claude Code (Max subscription)
#
# Usage: ./scripts/discord-claude.sh
#
# Required environment variables (in .env.local):
#   DISCORD_BOT_TOKEN - Bot token from discord.com/developers
#   DISCORD_CHANNEL_ID - Channel ID to monitor

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
STATE_FILE="/tmp/discord-claude-last-msg"
POLL_INTERVAL=5

# Load environment
if [[ -f "$PROJECT_DIR/.env.local" ]]; then
  source "$PROJECT_DIR/.env.local"
fi

# Validate required vars
if [[ -z "${DISCORD_BOT_TOKEN:-}" ]]; then
  echo "Error: DISCORD_BOT_TOKEN not set in .env.local"
  exit 1
fi

if [[ -z "${DISCORD_CHANNEL_ID:-}" ]]; then
  echo "Error: DISCORD_CHANNEL_ID not set in .env.local"
  exit 1
fi

log() {
  echo "[$(date +'%H:%M:%S')] $*"
}

# Fetch messages from Discord
fetch_messages() {
  curl -s -H "Authorization: Bot $DISCORD_BOT_TOKEN" \
    "https://discord.com/api/v10/channels/$DISCORD_CHANNEL_ID/messages?limit=10"
}

# Send message to Discord
send_message() {
  local content="$1"
  local reply_to="${2:-}"

  local payload
  if [[ -n "$reply_to" ]]; then
    payload=$(jq -n --arg c "$content" --arg r "$reply_to" '{
      content: $c,
      message_reference: { message_id: $r }
    }')
  else
    payload=$(jq -n --arg c "$content" '{ content: $c }')
  fi

  curl -s -X POST \
    -H "Authorization: Bot $DISCORD_BOT_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$payload" \
    "https://discord.com/api/v10/channels/$DISCORD_CHANNEL_ID/messages" > /dev/null
}

# Send typing indicator
send_typing() {
  curl -s -X POST \
    -H "Authorization: Bot $DISCORD_BOT_TOKEN" \
    "https://discord.com/api/v10/channels/$DISCORD_CHANNEL_ID/typing" > /dev/null
}

# Process message with Claude Code
process_with_claude() {
  local message="$1"

  # Run Claude Code with project context
  cd "$PROJECT_DIR"
  claude -p "$message" 2>/dev/null || echo "Error processing message"
}

# Get last processed message ID
get_last_id() {
  cat "$STATE_FILE" 2>/dev/null || echo "0"
}

# Save last processed message ID
save_last_id() {
  echo "$1" > "$STATE_FILE"
}

# Main loop
main() {
  log "Discord-Claude bridge started"
  log "Monitoring channel: $DISCORD_CHANNEL_ID"
  log "Project directory: $PROJECT_DIR"
  log "Poll interval: ${POLL_INTERVAL}s"
  log "Press Ctrl+C to stop"
  echo ""

  local last_id
  last_id=$(get_last_id)

  # On first run, just mark current messages as read
  if [[ "$last_id" == "0" ]]; then
    local latest
    latest=$(fetch_messages | jq -r '.[0].id // "0"')
    if [[ "$latest" != "0" ]]; then
      save_last_id "$latest"
      log "Initialized - will respond to new messages only"
    fi
  fi

  while true; do
    local messages
    messages=$(fetch_messages)

    if [[ -z "$messages" ]] || [[ "$messages" == "null" ]]; then
      sleep "$POLL_INTERVAL"
      continue
    fi

    last_id=$(get_last_id)

    # Process messages (oldest first)
    echo "$messages" | jq -r --arg last "$last_id" '
      reverse | .[] |
      select(.author.bot != true) |
      select(.id > $last) |
      "\(.id)\t\(.author.username)\t\(.content)"
    ' | while IFS=$'\t' read -r msg_id author content; do
      [[ -z "$msg_id" ]] && continue

      log "Message from $author: $content"

      # Show typing indicator
      send_typing &

      # Get Claude's response
      log "Processing with Claude..."
      local response
      response=$(process_with_claude "$content")

      # Truncate if too long (Discord limit is 2000)
      if [[ ${#response} -gt 1900 ]]; then
        response="${response:0:1900}..."
      fi

      # Send reply
      if [[ -n "$response" ]]; then
        send_message "$response" "$msg_id"
        log "Sent response (${#response} chars)"
      else
        send_message "No response generated" "$msg_id"
        log "No response"
      fi

      # Update state
      save_last_id "$msg_id"
      echo ""
    done

    sleep "$POLL_INTERVAL"
  done
}

# Handle Ctrl+C gracefully
trap 'echo ""; log "Stopped"; exit 0' INT TERM

main "$@"
