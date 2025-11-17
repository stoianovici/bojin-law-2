# Architecture Documentation Update Plan

## Overview

This plan outlines required updates to align architecture documentation with:

1. **Render.com migration** (replacing Azure/Kubernetes)
2. **Claude AI primary + Grok fallback** (replacing OpenAI)
3. **Claude Skills implementation** (70% token reduction)

## Priority 1: Critical Infrastructure Updates (Week 1)

### 1. High-Level Architecture Diagram

**File**: `docs/architecture/high-level-architecture.md`
**Status**: 🔴 Critical - Shows Azure/AKS infrastructure

**Required Changes**:

```diff
- Azure CDN, Application Firewall, AKS Cluster
+ Render.com Web Services, Private Services, Databases
- Azure Blob Storage
+ Cloudflare R2 or Render Disk Storage
- OpenAI GPT-4 fallback
+ xAI Grok fallback
```

### 2. Tech Stack Documentation

**File**: `docs/architecture/tech-stack.md`
**Status**: 🔴 Critical - Lists Azure/Terraform tools

**Required Changes**:

```diff
- Infrastructure: Terraform 1.7+ with Azure provider
+ Infrastructure: render.yaml for Render deployment
- CI/CD: GitHub Actions + Azure DevOps
+ CI/CD: GitHub Actions + Render Deploy Hooks
- Monitoring: Application Insights
+ Monitoring: New Relic + Render Metrics
- Storage: Azure Blob Storage
+ Storage: Cloudflare R2 / Render Disk
```

### 3. Render Configuration

**File**: `render.yaml`
**Status**: 🟡 Partial - Has OpenAI config

**Required Changes**:

```yaml
# Replace lines 174-179 with:
- key: AI_PROVIDER
  value: anthropic
- key: ANTHROPIC_API_KEY
  sync: false
- key: ANTHROPIC_MODEL
  value: claude-3-5-sonnet-20241022
- key: ANTHROPIC_SKILLS_ENABLED
  value: true
- key: GROK_API_KEY
  sync: false
- key: GROK_MODEL
  value: grok-beta
```

## Priority 2: AI Strategy Documentation (Week 1-2)

### 4. External APIs Documentation

**File**: `docs/architecture/external-apis.md`
**Status**: 🟡 Outdated - Shows OpenAI as primary

**Required Changes**:

- Mark OpenAI as DEPRECATED
- Emphasize Claude as PRIMARY provider
- Add xAI Grok as FALLBACK provider
- Add Claude Skills API section
- Document prompt caching & batch APIs

### 5. NEW: Claude Skills Architecture

**File**: `docs/architecture/claude-skills-architecture.md` (CREATE)
**Status**: 🔴 Missing - Critical for Story 2.11

**Content to Include**:

```markdown
# Claude Skills Architecture

## Overview

Claude Skills provide 70% token reduction for repetitive legal workflows.

## Core Components

- Skills API Client
- SkillsManager Service
- SkillsRegistry
- Skills Metadata Database

## Legal Skills Portfolio

1. Contract Analysis Skill
2. Document Drafting Skill
3. Legal Research Skill
4. Compliance Check Skill

## Cost Impact

- Before Skills: $126/month (100 users)
- With Skills: $80/month (35% reduction)
- Token Reduction: 70% average

## Implementation Architecture

[Diagram showing skills flow]
```

### 6. NEW: AI Provider Strategy

**File**: `docs/architecture/ai-provider-strategy.md` (CREATE)
**Status**: 🔴 Missing - Needed for cost optimization

**Content Structure**:

- Multi-provider architecture (Claude + Grok)
- Model selection logic (Haiku/Sonnet/Opus)
- Prompt caching strategy
- Batch processing implementation
- Fallback & retry patterns

## Priority 3: Supporting Documentation (Week 2)

### 7. Environment Variables

**File**: `infrastructure/ENVIRONMENT_VARIABLES.md`
**Status**: 🟡 Needs AI updates

**Add Section**:

```markdown
## AI Provider Configuration

- ANTHROPIC_API_KEY: Claude API key (required)
- ANTHROPIC_MODEL: Model selection
- ANTHROPIC_SKILLS_ENABLED: Enable skills (true/false)
- ANTHROPIC_USE_PROMPT_CACHING: Cache prompts (true/false)
- ANTHROPIC_USE_BATCHING: Batch requests (true/false)
- GROK_API_KEY: Fallback provider key (optional)
- GROK_MODEL: Fallback model selection
```

### 8. Monitoring & Observability

**File**: `docs/architecture/monitoring-and-observability.md`
**Status**: 🟡 References Azure Monitor

**Required Changes**:

- Remove Application Insights references
- Add New Relic APM configuration
- Document Render native metrics
- Update performance targets for Render

### 9. Deployment Architecture

**File**: `docs/architecture/deployment-architecture.md`
**Status**: 🔴 Empty stub file

**Content Needed**:

- Render deployment pipeline
- Git-based deployments
- Preview environments
- Staging/production separation
- Rollback procedures

## Implementation Checklist

### Week 1 Sprint Tasks

- [ ] Update high-level-architecture.md diagram
- [ ] Fix tech-stack.md references
- [ ] Update render.yaml AI configuration
- [ ] Create claude-skills-architecture.md
- [ ] Update external-apis.md

### Week 2 Sprint Tasks

- [ ] Create ai-provider-strategy.md
- [ ] Update ENVIRONMENT_VARIABLES.md
- [ ] Fix monitoring-and-observability.md
- [ ] Complete deployment-architecture.md
- [ ] Review and update security-and-performance.md

## Already Completed ✅

- `infrastructure/DEPLOYMENT_GUIDE.md` - Updated for Render
- `infrastructure/README.md` - Updated for Render
- `infrastructure/COST_ESTIMATION.md` - Shows Render savings
- `docs/architecture/claude-cost-optimization.md` - Comprehensive guide
- Azure docs properly archived in `infrastructure/archive/`

## Validation Steps

1. Search for "Azure" in all .md files - should only appear in auth context
2. Search for "Kubernetes" or "AKS" - should be removed
3. Search for "OpenAI" - should be marked deprecated
4. Search for "Terraform" - should be replaced with render.yaml
5. Verify Claude is documented as primary AI provider
6. Confirm Skills architecture is documented

## Success Criteria

- [ ] All architecture docs reflect Render infrastructure
- [ ] AI strategy shows Claude + Grok (not OpenAI)
- [ ] Claude Skills architecture documented
- [ ] No conflicting Azure/K8s references remain
- [ ] Story 2.1.1 can proceed without confusion

## Notes

- Keep Azure AD references ONLY for authentication (OAuth)
- Microsoft Graph API docs remain valid (for Outlook/OneDrive)
- Consider creating migration guide from old to new architecture
