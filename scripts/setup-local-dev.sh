#!/bin/bash

# =============================================================================
# Local Development Setup Script
# Sets up local dev environment to mirror production with local database
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo -e "${BLUE}=== Legal Platform Local Development Setup ===${NC}"
echo ""

# =============================================================================
# Step 1: Check Docker
# =============================================================================
echo -e "${YELLOW}[1/6] Checking Docker...${NC}"

if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running. Please start Docker Desktop.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"

# =============================================================================
# Step 2: Start PostgreSQL and Redis containers
# =============================================================================
echo ""
echo -e "${YELLOW}[2/6] Starting database containers...${NC}"

# Check if containers exist and are running
POSTGRES_RUNNING=$(docker ps -q -f name=legal-platform-postgres)
REDIS_RUNNING=$(docker ps -q -f name=legal-platform-redis)

if [ -z "$POSTGRES_RUNNING" ] || [ -z "$REDIS_RUNNING" ]; then
    echo "Starting containers from docker-compose..."
    docker compose -f infrastructure/docker/docker-compose.yml up postgres redis -d

    # Wait for PostgreSQL to be healthy
    echo "Waiting for PostgreSQL to be ready..."
    for i in {1..30}; do
        if docker exec legal-platform-postgres pg_isready -U postgres > /dev/null 2>&1; then
            break
        fi
        sleep 1
    done
fi

echo -e "${GREEN}✓ PostgreSQL running at localhost:5432${NC}"
echo -e "${GREEN}✓ Redis running at localhost:6379${NC}"

# =============================================================================
# Step 3: Check/Create environment files
# =============================================================================
echo ""
echo -e "${YELLOW}[3/6] Checking environment files...${NC}"

# Check .env.local (root)
if [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}Creating .env.local from template...${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example .env.local
        # Update for local database
        sed -i '' 's|DATABASE_URL=.*|DATABASE_URL=postgresql://postgres:postgres@localhost:5432/legal_platform_dev|' .env.local 2>/dev/null || true
        sed -i '' 's|REDIS_URL=.*|REDIS_URL=redis://localhost:6379|' .env.local 2>/dev/null || true
        echo -e "${YELLOW}⚠ Please update .env.local with your Azure AD and API credentials${NC}"
    else
        echo -e "${RED}Error: .env.example not found${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ .env.local exists${NC}"
fi

# Check apps/web/.env.local
if [ ! -f "apps/web/.env.local" ]; then
    echo -e "${YELLOW}Creating apps/web/.env.local...${NC}"
    cat > apps/web/.env.local << 'EOF'
# Azure AD / Microsoft Entra ID Configuration
NEXT_PUBLIC_AZURE_AD_CLIENT_ID=
NEXT_PUBLIC_AZURE_AD_TENANT_ID=

# GraphQL Gateway
GRAPHQL_ENDPOINT=http://localhost:4000/graphql
EOF
    echo -e "${YELLOW}⚠ Please add Azure AD credentials to apps/web/.env.local${NC}"
else
    echo -e "${GREEN}✓ apps/web/.env.local exists${NC}"
fi

# Check services/gateway/.env
if [ ! -f "services/gateway/.env" ]; then
    echo -e "${YELLOW}Creating services/gateway/.env from example...${NC}"
    if [ -f "services/gateway/.env.example" ]; then
        cp services/gateway/.env.example services/gateway/.env
        # Update for local database
        sed -i '' 's|DATABASE_URL=.*|DATABASE_URL=postgresql://postgres:postgres@localhost:5432/legal_platform_dev|' services/gateway/.env 2>/dev/null || true
        echo -e "${YELLOW}⚠ Please update services/gateway/.env with your Azure AD credentials${NC}"
    fi
else
    echo -e "${GREEN}✓ services/gateway/.env exists${NC}"
fi

# =============================================================================
# Step 4: Run Prisma migrations
# =============================================================================
echo ""
echo -e "${YELLOW}[4/6] Running database migrations...${NC}"

cd packages/database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/legal_platform_dev" pnpm db:migrate:deploy
cd "$PROJECT_ROOT"

echo -e "${GREEN}✓ Migrations applied${NC}"

# =============================================================================
# Step 5: Check for production database import
# =============================================================================
echo ""
echo -e "${YELLOW}[5/6] Database data setup...${NC}"

USER_COUNT=$(docker exec legal-platform-postgres psql -U postgres -d legal_platform_dev -t -c "SELECT count(*) FROM users;" 2>/dev/null | tr -d ' ')

if [ "$USER_COUNT" -eq 0 ] 2>/dev/null; then
    echo -e "${YELLOW}Database is empty.${NC}"
    echo ""
    echo "Options:"
    echo "  1) Import production backup (download from Render Dashboard first)"
    echo "  2) Run seed data"
    echo "  3) Skip (start with empty database)"
    echo ""
    read -p "Choose option [1/2/3]: " db_choice

    case $db_choice in
        1)
            read -p "Enter path to backup file (.tar.gz): " backup_file
            if [ -f "$backup_file" ]; then
                echo "Extracting and importing backup..."
                TEMP_DIR=$(mktemp -d)
                tar -xzf "$backup_file" -C "$TEMP_DIR"

                # Find the backup directory
                BACKUP_DIR=$(find "$TEMP_DIR" -name "toc.dat" -exec dirname {} \; | head -1)

                if [ -n "$BACKUP_DIR" ]; then
                    # Install libpq if needed
                    if ! command -v pg_restore &> /dev/null; then
                        if command -v brew &> /dev/null; then
                            echo "Installing PostgreSQL client tools..."
                            brew install libpq 2>/dev/null || true
                            brew link --force libpq 2>/dev/null || true
                        fi
                    fi

                    PG_RESTORE=$(command -v pg_restore || echo "/opt/homebrew/opt/libpq/bin/pg_restore")

                    PGPASSWORD=postgres $PG_RESTORE \
                        --host=localhost \
                        --port=5432 \
                        --username=postgres \
                        --dbname=legal_platform_dev \
                        --no-owner \
                        --no-privileges \
                        --clean \
                        --if-exists \
                        "$BACKUP_DIR" 2>&1 || true

                    echo -e "${GREEN}✓ Production data imported${NC}"
                else
                    echo -e "${RED}Could not find backup data in archive${NC}"
                fi

                rm -rf "$TEMP_DIR"
            else
                echo -e "${RED}Backup file not found: $backup_file${NC}"
            fi
            ;;
        2)
            echo "Running seed data..."
            cd packages/database
            pnpm db:seed
            cd "$PROJECT_ROOT"
            echo -e "${GREEN}✓ Seed data loaded${NC}"
            ;;
        3)
            echo -e "${YELLOW}Skipping database data setup${NC}"
            ;;
    esac
else
    echo -e "${GREEN}✓ Database has $USER_COUNT users${NC}"
fi

# =============================================================================
# Step 6: Final checks
# =============================================================================
echo ""
echo -e "${YELLOW}[6/6] Final verification...${NC}"

# Verify database connection
if docker exec legal-platform-postgres psql -U postgres -d legal_platform_dev -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Database connection OK${NC}"
else
    echo -e "${RED}✗ Database connection failed${NC}"
fi

# Verify Redis connection
if docker exec legal-platform-redis redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Redis connection OK${NC}"
else
    echo -e "${RED}✗ Redis connection failed${NC}"
fi

# Check for required env vars
check_env_var() {
    local file=$1
    local var=$2
    if grep -q "^${var}=.\+" "$file" 2>/dev/null; then
        return 0
    fi
    return 1
}

MISSING_VARS=()

if ! check_env_var "apps/web/.env.local" "NEXT_PUBLIC_AZURE_AD_CLIENT_ID"; then
    MISSING_VARS+=("apps/web/.env.local: NEXT_PUBLIC_AZURE_AD_CLIENT_ID")
fi

if ! check_env_var "services/gateway/.env" "AZURE_AD_CLIENT_SECRET"; then
    MISSING_VARS+=("services/gateway/.env: AZURE_AD_CLIENT_SECRET")
fi

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}⚠ Missing environment variables:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo ""
echo "To start the development server:"
echo -e "  ${BLUE}pnpm dev${NC}"
echo ""
echo "Services will be available at:"
echo "  Web:     http://localhost:3000"
echo "  API:     http://localhost:4000/graphql"
echo "  DB:      postgresql://postgres:postgres@localhost:5432/legal_platform_dev"
echo "  Redis:   redis://localhost:6379"
echo ""

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo -e "${YELLOW}Note: Configure missing environment variables before running.${NC}"
    echo ""
fi
