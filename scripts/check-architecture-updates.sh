#!/bin/bash

# Architecture Documentation Update Checker
# This script identifies files that need updating for Render/Claude migration

echo "====================================="
echo "Architecture Update Checker"
echo "====================================="
echo ""

# Color codes for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Counter for issues found
ISSUES=0

echo "Checking for outdated Azure/Kubernetes references..."
echo "------------------------------------------------"

# Check for Azure references (excluding authentication context)
echo -e "${YELLOW}Files with Azure references (excluding auth):${NC}"
grep -r "Azure" docs/architecture/ infrastructure/ --include="*.md" | \
  grep -v "Azure AD" | \
  grep -v "authentication" | \
  grep -v "archive" | \
  cut -d: -f1 | sort -u | while read file; do
    echo -e "${RED}  ✗ $file${NC}"
    ((ISSUES++))
done

echo ""

# Check for Kubernetes/AKS references
echo -e "${YELLOW}Files with Kubernetes/AKS references:${NC}"
grep -r -E "(Kubernetes|AKS|kubectl)" docs/architecture/ infrastructure/ --include="*.md" | \
  grep -v "archive" | \
  cut -d: -f1 | sort -u | while read file; do
    echo -e "${RED}  ✗ $file${NC}"
    ((ISSUES++))
done

echo ""

# Check for Terraform references
echo -e "${YELLOW}Files with Terraform references:${NC}"
grep -r "Terraform" docs/architecture/ infrastructure/ --include="*.md" | \
  grep -v "archive" | \
  cut -d: -f1 | sort -u | while read file; do
    echo -e "${RED}  ✗ $file${NC}"
    ((ISSUES++))
done

echo ""

# Check for OpenAI references
echo -e "${YELLOW}Files with OpenAI references (should be Claude):${NC}"
grep -r "OpenAI" docs/architecture/ infrastructure/ render.yaml --include="*.md" --include="*.yaml" | \
  grep -v "archive" | \
  grep -v "deprecated" | \
  cut -d: -f1 | sort -u | while read file; do
    echo -e "${RED}  ✗ $file${NC}"
    ((ISSUES++))
done

echo ""

# Check for missing Claude Skills documentation
echo "Checking for Claude Skills documentation..."
echo "------------------------------------------------"

if [ ! -f "docs/architecture/claude-skills-architecture.md" ]; then
    echo -e "${RED}✗ Missing: docs/architecture/claude-skills-architecture.md${NC}"
    ((ISSUES++))
else
    echo -e "${GREEN}✓ Found: claude-skills-architecture.md${NC}"
fi

if [ ! -f "docs/architecture/ai-provider-strategy.md" ]; then
    echo -e "${RED}✗ Missing: docs/architecture/ai-provider-strategy.md${NC}"
    ((ISSUES++))
else
    echo -e "${GREEN}✓ Found: ai-provider-strategy.md${NC}"
fi

echo ""

# Check render.yaml for correct AI configuration
echo "Checking render.yaml AI configuration..."
echo "------------------------------------------------"

if grep -q "OPENAI_API_KEY" render.yaml; then
    echo -e "${RED}✗ render.yaml still has OPENAI_API_KEY${NC}"
    ((ISSUES++))
fi

if grep -q "ANTHROPIC_API_KEY" render.yaml; then
    echo -e "${GREEN}✓ render.yaml has ANTHROPIC_API_KEY${NC}"
else
    echo -e "${RED}✗ render.yaml missing ANTHROPIC_API_KEY${NC}"
    ((ISSUES++))
fi

echo ""

# Check for Azure Blob Storage references
echo -e "${YELLOW}Files with Azure Blob Storage references:${NC}"
grep -r "Azure Blob Storage" docs/architecture/ infrastructure/ --include="*.md" | \
  grep -v "archive" | \
  cut -d: -f1 | sort -u | while read file; do
    echo -e "${RED}  ✗ $file${NC}"
    ((ISSUES++))
done

echo ""

# Summary
echo "====================================="
echo "Summary"
echo "====================================="

# Get actual count of issues
ACTUAL_ISSUES=$(grep -r "Azure" docs/architecture/ infrastructure/ --include="*.md" | \
  grep -v "Azure AD" | grep -v "authentication" | grep -v "archive" | wc -l)

ACTUAL_ISSUES=$((ACTUAL_ISSUES + $(grep -r -E "(Kubernetes|AKS)" docs/architecture/ infrastructure/ --include="*.md" | grep -v "archive" | wc -l)))
ACTUAL_ISSUES=$((ACTUAL_ISSUES + $(grep -r "Terraform" docs/architecture/ infrastructure/ --include="*.md" | grep -v "archive" | wc -l)))
ACTUAL_ISSUES=$((ACTUAL_ISSUES + $(grep -r "OpenAI" docs/architecture/ infrastructure/ render.yaml --include="*.md" --include="*.yaml" | grep -v "archive" | grep -v "deprecated" | wc -l)))

if [ $ACTUAL_ISSUES -gt 0 ]; then
    echo -e "${RED}Found $ACTUAL_ISSUES outdated references that need updating${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Review docs/architecture/UPDATE_PLAN.md for detailed changes"
    echo "2. Update high-priority files first (blocks Story 2.1.1)"
    echo "3. Create missing Claude Skills documentation"
    echo "4. Run this script again to verify all updates"
else
    echo -e "${GREEN}✓ All architecture documentation is up to date!${NC}"
fi

echo ""
echo "For detailed update instructions, see:"
echo "  docs/architecture/UPDATE_PLAN.md"
echo ""