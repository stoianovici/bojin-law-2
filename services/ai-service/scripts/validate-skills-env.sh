#!/bin/bash

# Skills Environment Variables Validation Script
# Validates all required Claude Skills configuration variables before deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Validation counters
ERRORS=0
WARNINGS=0
CHECKS=0

echo -e "${BLUE}=== Claude Skills Environment Validation ===${NC}"
echo ""

# Helper function to validate boolean values
validate_boolean() {
    local var_name=$1
    local var_value=$2
    CHECKS=$((CHECKS + 1))

    if [ -z "$var_value" ]; then
        echo -e "${YELLOW}⚠️  $var_name: NOT SET (using default)${NC}"
        WARNINGS=$((WARNINGS + 1))
        return 1
    fi

    if [[ "$var_value" =~ ^(true|false|1|0|yes|no)$ ]]; then
        echo -e "${GREEN}✓${NC} $var_name: ${var_value}"
        return 0
    else
        echo -e "${RED}✗${NC} $var_name: INVALID (must be true/false, got: $var_value)"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

# Helper function to validate numeric values
validate_number() {
    local var_name=$1
    local var_value=$2
    local min_value=$3
    local max_value=$4
    CHECKS=$((CHECKS + 1))

    if [ -z "$var_value" ]; then
        echo -e "${YELLOW}⚠️  $var_name: NOT SET (using default)${NC}"
        WARNINGS=$((WARNINGS + 1))
        return 1
    fi

    if ! [[ "$var_value" =~ ^[0-9]+$ ]]; then
        echo -e "${RED}✗${NC} $var_name: INVALID (must be numeric, got: $var_value)"
        ERRORS=$((ERRORS + 1))
        return 1
    fi

    if [ -n "$min_value" ] && [ "$var_value" -lt "$min_value" ]; then
        echo -e "${RED}✗${NC} $var_name: TOO LOW (minimum: $min_value, got: $var_value)"
        ERRORS=$((ERRORS + 1))
        return 1
    fi

    if [ -n "$max_value" ] && [ "$var_value" -gt "$max_value" ]; then
        echo -e "${RED}✗${NC} $var_name: TOO HIGH (maximum: $max_value, got: $var_value)"
        ERRORS=$((ERRORS + 1))
        return 1
    fi

    echo -e "${GREEN}✓${NC} $var_name: ${var_value}"
    return 0
}

# Helper function to validate version strings
validate_version() {
    local var_name=$1
    local var_value=$2
    local pattern=$3
    CHECKS=$((CHECKS + 1))

    if [ -z "$var_value" ]; then
        echo -e "${YELLOW}⚠️  $var_name: NOT SET (using default)${NC}"
        WARNINGS=$((WARNINGS + 1))
        return 1
    fi

    if [[ "$var_value" =~ $pattern ]]; then
        echo -e "${GREEN}✓${NC} $var_name: ${var_value}"
        return 0
    else
        echo -e "${RED}✗${NC} $var_name: INVALID FORMAT (expected pattern: $pattern, got: $var_value)"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

# Section: Core Skills Settings
echo -e "${BLUE}Core Skills Settings:${NC}"

# Load environment variables from .env if it exists
if [ -f "services/ai-service/.env" ]; then
    set -a
    source services/ai-service/.env
    set +a
    echo -e "${GREEN}Loaded variables from services/ai-service/.env${NC}"
    echo ""
elif [ -f ".env" ]; then
    set -a
    source .env
    set +a
    echo -e "${GREEN}Loaded variables from .env${NC}"
    echo ""
else
    echo -e "${YELLOW}No .env file found, checking system environment${NC}"
    echo ""
fi

# Validate ANTHROPIC_SKILLS_ENABLED
validate_boolean "ANTHROPIC_SKILLS_ENABLED" "$ANTHROPIC_SKILLS_ENABLED"

# Validate ANTHROPIC_CODE_EXECUTION_ENABLED
validate_boolean "ANTHROPIC_CODE_EXECUTION_ENABLED" "$ANTHROPIC_CODE_EXECUTION_ENABLED"

echo ""
echo -e "${BLUE}API Beta Versions:${NC}"

# Validate ANTHROPIC_SKILLS_BETA_VERSION (format: skills-YYYY-MM-DD)
validate_version "ANTHROPIC_SKILLS_BETA_VERSION" \
    "$ANTHROPIC_SKILLS_BETA_VERSION" \
    "^skills-[0-9]{4}-[0-9]{2}-[0-9]{2}$"

# Validate ANTHROPIC_CODE_EXECUTION_BETA_VERSION (format: code-execution-YYYY-MM-DD)
validate_version "ANTHROPIC_CODE_EXECUTION_BETA_VERSION" \
    "$ANTHROPIC_CODE_EXECUTION_BETA_VERSION" \
    "^code-execution-[0-9]{4}-[0-9]{2}-[0-9]{2}$"

echo ""
echo -e "${BLUE}Skills Management Limits:${NC}"

# Validate SKILLS_UPLOAD_MAX_SIZE_MB (1-100 MB)
validate_number "SKILLS_UPLOAD_MAX_SIZE_MB" \
    "$SKILLS_UPLOAD_MAX_SIZE_MB" \
    1 100

# Validate SKILLS_MAX_PER_WORKSPACE (1-1000)
validate_number "SKILLS_MAX_PER_WORKSPACE" \
    "$SKILLS_MAX_PER_WORKSPACE" \
    1 1000

# Validate SKILLS_CACHE_TTL_SECONDS (60-86400)
validate_number "SKILLS_CACHE_TTL_SECONDS" \
    "$SKILLS_CACHE_TTL_SECONDS" \
    60 86400

echo ""
echo -e "${BLUE}=== Validation Summary ===${NC}"
echo -e "Total checks: $CHECKS"
echo -e "${GREEN}Passed: $((CHECKS - ERRORS - WARNINGS))${NC}"

if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
fi

if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}Errors: $ERRORS${NC}"
fi

echo ""

# Exit with appropriate code
if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}❌ Validation FAILED${NC}"
    echo "Please fix the errors above before deploying."
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Validation passed with WARNINGS${NC}"
    echo "Some optional variables are not set. Using defaults."
    exit 0
else
    echo -e "${GREEN}✅ All skills environment variables are valid${NC}"
    exit 0
fi
