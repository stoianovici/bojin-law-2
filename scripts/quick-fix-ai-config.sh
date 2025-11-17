#!/bin/bash

# Quick fix script for AI configuration updates
# This handles the most critical OpenAI -> Claude migrations

echo "Starting quick AI configuration fixes..."

# 1. Fix render.yaml AI configuration
echo "Updating render.yaml AI configuration..."
if [ -f "render.yaml" ]; then
    # Backup original
    cp render.yaml render.yaml.backup

    # Replace OpenAI with Claude configuration
    sed -i '' 's/OPENAI_API_KEY/ANTHROPIC_API_KEY/g' render.yaml
    sed -i '' 's/OPENAI_MODEL/ANTHROPIC_MODEL/g' render.yaml
    sed -i '' 's/value: gpt-4/value: claude-3-5-sonnet-20241022/g' render.yaml

    echo "✓ render.yaml updated (backup saved as render.yaml.backup)"
else
    echo "✗ render.yaml not found"
fi

# 2. Update environment template
echo "Updating environment templates..."
if [ -f "infrastructure/render/environment-template.yaml" ]; then
    sed -i '' 's/OPENAI_API_KEY/ANTHROPIC_API_KEY/g' infrastructure/render/environment-template.yaml
    echo "✓ Environment template updated"
fi

# 3. Update .env.example
echo "Updating .env.example files..."
find . -name ".env.example" -type f | while read file; do
    if grep -q "OPENAI" "$file"; then
        sed -i '' 's/OPENAI_API_KEY/ANTHROPIC_API_KEY/g' "$file"
        sed -i '' 's/OPENAI_MODEL/ANTHROPIC_MODEL/g' "$file"
        echo "✓ Updated $file"
    fi
done

# 4. Add Claude configuration to .env.example if missing
if [ -f ".env.example" ]; then
    if ! grep -q "ANTHROPIC_API_KEY" .env.example; then
        echo "" >> .env.example
        echo "# AI Provider Configuration (Claude primary, Grok fallback)" >> .env.example
        echo "AI_PROVIDER=anthropic" >> .env.example
        echo "ANTHROPIC_API_KEY=your_claude_api_key_here" >> .env.example
        echo "ANTHROPIC_MODEL=claude-3-5-sonnet-20241022" >> .env.example
        echo "ANTHROPIC_SKILLS_ENABLED=true" >> .env.example
        echo "ANTHROPIC_USE_PROMPT_CACHING=true" >> .env.example
        echo "ANTHROPIC_USE_BATCHING=true" >> .env.example
        echo "GROK_API_KEY=your_grok_api_key_here" >> .env.example
        echo "GROK_MODEL=grok-beta" >> .env.example
        echo "✓ Added Claude configuration to .env.example"
    fi
fi

echo ""
echo "Quick fixes complete! Next steps:"
echo "1. Review the changes made (especially render.yaml)"
echo "2. Update architecture diagrams manually"
echo "3. Create Claude Skills documentation"
echo "4. Run ./scripts/check-architecture-updates.sh to verify"
echo ""
echo "Backups created with .backup extension"