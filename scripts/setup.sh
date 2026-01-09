#!/bin/bash
# Simple local dev setup

set -e

cd "$(dirname "$0")/.."

echo "=== Legal Platform Setup ==="
echo ""

# 1. Check Docker
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker Desktop."
    exit 1
fi
echo "[1/4] Docker is running"

# 2. Start containers
echo "[2/4] Starting PostgreSQL and Redis..."
docker compose up -d
sleep 3

# Wait for postgres
for i in {1..20}; do
    if docker exec legal-postgres pg_isready -U postgres > /dev/null 2>&1; then
        break
    fi
    sleep 1
done
echo "       Containers ready"

# 3. Create .env.local if missing
if [ ! -f ".env.local" ]; then
    echo "[3/4] Creating .env.local from template..."
    cp .env.example .env.local
    echo ""
    echo "       !! IMPORTANT: Edit .env.local and add your credentials:"
    echo "          - AZURE_AD_CLIENT_ID"
    echo "          - AZURE_AD_CLIENT_SECRET"
    echo "          - AZURE_AD_TENANT_ID"
    echo "          - ANTHROPIC_API_KEY"
    echo ""
else
    echo "[3/4] .env.local exists"
fi

# 4. Symlink .env.local for Next.js (it needs it in its own folder)
if [ ! -L "apps/web/.env.local" ] && [ ! -f "apps/web/.env.local" ]; then
    ln -s ../../.env.local apps/web/.env.local
    echo "[4/4] Created symlink for Next.js"
elif [ -L "apps/web/.env.local" ]; then
    echo "[4/4] Next.js symlink exists"
else
    echo "[4/4] apps/web/.env.local exists (not a symlink)"
fi

# 5. Run migrations
echo ""
echo "Running database migrations..."
cd packages/database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/legal_platform" pnpm exec prisma migrate deploy 2>/dev/null || \
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/legal_platform" pnpm exec prisma db push
cd ../..

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Edit .env.local with your Azure AD and Anthropic credentials"
echo "  2. Run: pnpm dev"
echo ""
echo "Services:"
echo "  Web:     http://localhost:3000"
echo "  GraphQL: http://localhost:4000/graphql"
echo ""
