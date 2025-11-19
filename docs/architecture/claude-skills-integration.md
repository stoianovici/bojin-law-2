# Claude Skills Infrastructure Integration

## Overview

This document describes the Claude Skills API integration infrastructure for achieving 70%+ token reduction and 35% cost savings on repetitive legal workflows.

## Table of Contents

- [Architecture Components](#architecture-components)
- [Skill Execution Flow](#skill-execution-flow)
- [API Integration Patterns](#api-integration-patterns)
- [Database Schema](#database-schema)
- [Cost Optimization](#cost-optimization)
- [Development Guide](#development-guide)
- [Troubleshooting](#troubleshooting)

---

## Architecture Components

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Application Layer                            │
│  (Express Routes, GraphQL Resolvers, Background Jobs)           │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Skills Orchestration Layer                      │
│                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │  SkillsRegistry  │  │  SkillsManager   │  │  CostTracker │ │
│  │                  │  │                  │  │              │ │
│  │ - Recommendation │  │ - Validation     │  │ - Metrics    │ │
│  │ - Discovery      │  │ - Caching        │  │ - Projections│ │
│  │ - Effectiveness  │  │ - Templates      │  │ - Reports    │ │
│  └──────────────────┘  └──────────────────┘  └──────────────┘ │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Client & API Layer                             │
│                                                                   │
│  ┌──────────────────────────┐    ┌─────────────────────────┐   │
│  │ AnthropicEnhancedClient  │◄───┤   SkillsAPIClient       │   │
│  │                          │    │                         │   │
│  │ - Messages API           │    │ - Upload/List/Delete    │   │
│  │ - Beta Flags             │    │ - Retry Logic           │   │
│  │ - Skills Container       │    │ - Error Handling        │   │
│  │ - Fallback Logic         │    └─────────────────────────┘   │
│  │ - Metrics Tracking       │                                   │
│  └──────────────────────────┘                                   │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Anthropic Claude API                           │
│          (skills-2025-10-02, code-execution-2025-08-25)         │
└─────────────────────────────────────────────────────────────────┘
```

### Core Components

#### 1. AnthropicEnhancedClient

**Location:** `services/ai-service/src/clients/AnthropicEnhancedClient.ts`

Extended Anthropic SDK client with skills support:

```typescript
class AnthropicEnhancedClient extends Anthropic {
  async createMessageWithSkills(params: MessageWithSkillsParams): Promise<MessageResponse>;
  private buildBetaHeaders(params): Record<string, string>;
  private addCodeExecutionTool(tools): unknown[];
  private addSkillsContainer(skills): SkillsContainer;
  private fallbackToNonSkills(params): Promise<MessageResponse>;
  calculateTokenSavings(withSkills, withoutSkills): number;
}
```

**Key Features:**

- Beta flags configuration (`skills-2025-10-02`, `code-execution-2025-08-25`)
- Progressive disclosure optimization
- Code execution tool integration
- Automatic fallback to non-skills routing
- Request/response metrics tracking

#### 2. SkillsAPIClient

**Location:** `services/ai-service/src/skills/SkillsAPIClient.ts`

Direct Skills API communication:

```typescript
class SkillsAPIClient {
  async uploadSkill(payload: FormData): Promise<SkillMetadata>;
  async listSkills(filters?: SkillFilters): Promise<SkillMetadata[]>;
  async getSkill(skillId: string): Promise<Skill>;
  async deleteSkill(skillId: string): Promise<void>;
  async updateSkill(skillId: string, updates: Partial<Skill>): Promise<Skill>;
}
```

**Key Features:**

- Exponential backoff retry logic
- Request/response logging
- Beta API error handling
- FormData packaging for uploads

#### 3. SkillsManager

**Location:** `services/ai-service/src/skills/SkillsManager.ts`

Skill lifecycle management:

```typescript
class SkillsManager {
  async uploadSkill(payload: UploadSkillPayload): Promise<SkillMetadata>;
  async getSkill(skillId: string): Promise<Skill>;
  async deleteSkill(skillId: string): Promise<void>;
  validateSkill(payload: UploadSkillPayload): ValidationResult;
  generateSkillTemplate(templateType: SkillTemplateType): UploadSkillPayload;
}
```

**Key Features:**

- Validation engine (content, size, version format)
- LRU caching with TTL (configurable, default 1 hour)
- Template generator (legal-analysis, document-extraction, compliance-check)
- Effectiveness tracking hooks

#### 4. SkillsRegistry

**Location:** `services/ai-service/src/skills/SkillsRegistry.ts`

Skill discovery and recommendation:

```typescript
class SkillsRegistry {
  async discoverSkills(taskDescription: string): Promise<Skill[]>;
  async recommendSkills(taskDescription: string, limit: number): Promise<SkillRecommendation[]>;
  shouldUseSkills(taskType: string, metrics: TaskMetrics): boolean;
  async logSkillEffectiveness(skillId: string, metrics: EffectivenessMetrics): Promise<void>;
}
```

**Key Features:**

- Pattern-based skill discovery (8 task pattern categories)
- Relevance scoring algorithm (effectiveness + usage + keyword matching)
- Skill-to-task mapping with weighted pattern detection
- Fallback recommendations with category-based alternatives
- Intelligent non-skills routing based on success thresholds

#### 5. CostTracker

**Location:** `services/ai-service/src/monitoring/CostTracker.ts`

Skills-aware cost tracking:

```typescript
class CostTracker {
  async trackRequest(response: MessageResponse, options): Promise<CostMetrics>;
  async generateReport(startDate: Date, endDate: Date): Promise<CostComparisonReport>;
  async projectCosts(period: 'daily' | 'weekly' | 'monthly'): Promise<CostProjection>;
  getRealTimeMetrics(): RealTimeMetrics;
}
```

**Key Features:**

- Token usage tracking with/without skills
- Cost savings calculation and percentage
- Skill effectiveness metrics aggregation
- Cost projections (daily/weekly/monthly)
- Real-time monitoring dashboard data
- Database persistence for historical analysis

---

## Skill Execution Flow

### Sequence Diagram

```
User/App    SkillsRegistry    SkillsManager    AnthropicEnhanced    Anthropic API    CostTracker
   │               │                  │                 │                  │               │
   │ Task Request  │                  │                 │                  │               │
   │──────────────►│                  │                 │                  │               │
   │               │                  │                 │                  │               │
   │               │ Recommend Skills │                 │                  │               │
   │               │─────────────────►│                 │                  │               │
   │               │                  │                 │                  │               │
   │               │ Skill Metadata   │                 │                  │               │
   │               │◄─────────────────│                 │                  │               │
   │               │                  │                 │                  │               │
   │  Skill IDs    │                  │                 │                  │               │
   │◄──────────────│                  │                 │                  │               │
   │               │                  │                 │                  │               │
   │ Execute with Skills              │                 │                  │               │
   │─────────────────────────────────────────────────────►                 │               │
   │               │                  │                 │                  │               │
   │               │                  │                 │ Request + Beta   │               │
   │               │                  │                 │  Flags + Skills  │               │
   │               │                  │                 │─────────────────►│               │
   │               │                  │                 │                  │               │
   │               │                  │                 │  Response        │               │
   │               │                  │                 │◄─────────────────│               │
   │               │                  │                 │                  │               │
   │               │                  │                 │ Track Metrics    │               │
   │               │                  │                 │─────────────────────────────────►│
   │               │                  │                 │                  │               │
   │  Response with Skills Used       │                 │                  │               │
   │◄─────────────────────────────────────────────────────                 │               │
   │               │                  │                 │                  │               │
   │               │ Log Effectiveness│                 │                  │               │
   │               │◄─────────────────────────────────────────────────────────────────────│
   │               │                  │                 │                  │               │
```

### Execution Steps

1. **Task Analysis & Skill Discovery**
   - User/Application submits task description
   - SkillsRegistry analyzes task patterns
   - Recommends top N skills based on relevance scoring

2. **Skill Selection**
   - Application selects skills (manually or automatically)
   - SkillsManager retrieves skill metadata from cache or API

3. **Request Construction**
   - AnthropicEnhancedClient builds request with:
     - Beta flags (`anthropic-beta: skills-2025-10-02,code-execution-2025-08-25`)
     - Skills container with skill IDs
     - Code execution tool (if enabled)
     - Progressive disclosure settings

4. **API Execution**
   - Request sent to Anthropic Claude API
   - Skills execute within Claude's context
   - Response includes which skills were used

5. **Metrics Tracking**
   - CostTracker logs token usage and costs
   - Calculates savings vs. non-skills baseline
   - Updates skill effectiveness metrics

6. **Fallback Handling**
   - If skills fail and `fallback_to_non_skills: true`
   - Automatically retries without skills
   - Logs fallback for analysis

---

## API Integration Patterns

### Pattern 1: Simple Skill Execution

```typescript
const client = new AnthropicEnhancedClient({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  enableSkills: true,
  enableCodeExecution: true,
});

const response = await client.createMessageWithSkills({
  model: 'claude-3-5-sonnet-20241022',
  messages: [
    {
      role: 'user',
      content: 'Analyze this contract for compliance issues: [contract text]',
    },
  ],
  max_tokens: 4000,
  skills: {
    skill_ids: ['skill_legal_analysis_v1'],
    progressive_disclosure: true,
    fallback_to_non_skills: true,
  },
});

console.log(`Skills used: ${response.skills_used}`);
console.log(`Tokens: ${response.usage.input_tokens + response.usage.output_tokens}`);
```

### Pattern 2: Skill Discovery with Auto-Selection

```typescript
const registry = new SkillsRegistry(skillsManager);

// Discover relevant skills
const recommendations = await registry.recommendSkills(
  'Extract key provisions from this lease agreement',
  3 // top 3
);

// Auto-select best skill
const bestSkill = recommendations[0];

// Execute with recommended skill
const response = await client.createMessageWithSkills({
  model: 'claude-3-5-sonnet-20241022',
  messages: [{ role: 'user', content: leaseAgreementText }],
  max_tokens: 4000,
  skills: {
    skill_ids: [bestSkill.skill.skill_id],
  },
});
```

### Pattern 3: Cost Tracking with Reporting

```typescript
const costTracker = new CostTracker(dbConnection);

// Track request
const metrics = await costTracker.trackRequest(response, {
  model: 'claude-3-5-sonnet-20241022',
  skillsUsed: response.skills_used,
  estimatedTokensWithoutSkills: 5000, // baseline from previous tests
  taskType: 'contract-analysis',
  userId: 'user_123',
});

console.log(`Cost: $${metrics.totalCost.toFixed(4)}`);
console.log(
  `Savings: $${metrics.costSavings?.toFixed(4)} (${metrics.savingsPercentage?.toFixed(1)}%)`
);

// Generate monthly report
const report = await costTracker.generateReport(new Date('2025-01-01'), new Date('2025-01-31'));

console.log(`Total requests: ${report.totalRequests}`);
console.log(`Total cost: $${report.totalCost.toFixed(2)}`);
console.log(`Total saved: $${report.totalCostSaved.toFixed(2)}`);
console.log(`Top skill: ${report.topSkillsBySavings[0].displayName}`);
```

### Pattern 4: Skill Upload and Management

```typescript
const manager = new SkillsManager(skillsAPIClient);

// Generate from template
const skillPayload = manager.generateSkillTemplate('legal-analysis');

// Customize
skillPayload.display_name = 'California Employment Law Analyzer';
skillPayload.description = 'Analyzes employment contracts for California-specific compliance';
skillPayload.content = `
  You are an expert in California employment law. Analyze the provided employment contract and identify:
  1. California Labor Code compliance issues
  2. FEHA (Fair Employment and Housing Act) considerations
  3. Wage and hour compliance
  4. Non-compete clause validity in California
`;

// Validate
const validation = manager['validateSkill'](skillPayload);
if (!validation.isValid) {
  console.error('Validation errors:', validation.errors);
  return;
}

// Upload
const skill = await manager.uploadSkill(skillPayload);
console.log(`Skill uploaded: ${skill.skill_id}`);
```

---

## Database Schema

### Skills Table

```sql
CREATE TABLE skills (
    id SERIAL PRIMARY KEY,
    skill_id VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    version VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'analysis', 'generation', 'extraction', etc.
    category VARCHAR(100) NOT NULL, -- 'legal-analysis', 'document-processing', etc.
    effectiveness_score DECIMAL(5,2) DEFAULT 0, -- 0-100 score
    token_savings_avg INTEGER DEFAULT 0, -- Average tokens saved per use
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_skills_category ON skills(category);
CREATE INDEX idx_skills_effectiveness ON skills(effectiveness_score DESC);
CREATE INDEX idx_skills_type ON skills(type);
```

### Skill Usage Logs Table

```sql
CREATE TABLE skill_usage_logs (
    id SERIAL PRIMARY KEY,
    request_id VARCHAR(255) NOT NULL,
    skill_ids TEXT[] NOT NULL, -- Array of skill IDs used
    task_type VARCHAR(100),
    tokens_used INTEGER NOT NULL,
    tokens_saved_estimate INTEGER DEFAULT 0,
    cost_usd DECIMAL(10,6) NOT NULL,
    cost_saved_usd DECIMAL(10,6) DEFAULT 0,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    execution_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_usage_logs_created_at ON skill_usage_logs(created_at DESC);
CREATE INDEX idx_usage_logs_skill_ids ON skill_usage_logs USING GIN(skill_ids);
CREATE INDEX idx_usage_logs_task_type ON skill_usage_logs(task_type);
```

### Skill Versions Table

```sql
CREATE TABLE skill_versions (
    id SERIAL PRIMARY KEY,
    skill_id VARCHAR(255) NOT NULL REFERENCES skills(skill_id),
    version VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    config JSONB,
    changelog TEXT,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(skill_id, version)
);

CREATE INDEX idx_skill_versions_skill_id ON skill_versions(skill_id);
CREATE INDEX idx_skill_versions_active ON skill_versions(skill_id, is_active) WHERE is_active = true;
```

---

## Cost Optimization

### Target Metrics (from Story 2.11)

- **Token Reduction:** 70%+ on skill-enhanced tasks
- **Cost Savings:** 35-40% ($126/month → $80/month for 100 users)
- **Prompt Engineering Time:** 73% reduction

### Optimization Strategies

#### 1. Progressive Disclosure

Skills enable Claude to request only needed context:

```typescript
// Standard approach: send full context upfront
const withoutSkills = {
  system: `Full legal expertise prompt with 2000+ tokens...`,
  messages: [{ role: 'user', content: contractText }],
};

// Skills approach: progressive disclosure
const withSkills = {
  messages: [{ role: 'user', content: contractText }],
  skills: {
    skill_ids: ['skill_legal_analysis'],
    progressive_disclosure: true, // Claude requests context as needed
  },
};

// Result: 60-70% input token reduction
```

#### 2. Skill Caching

SkillsManager maintains LRU cache to reduce API calls:

```typescript
// Configure cache
const manager = new SkillsManager(apiClient, {
  cacheMaxSize: 100, // Keep 100 most-used skills in memory
  cacheTTL: 3600, // 1-hour TTL
});

// First call: fetches from API
const skill1 = await manager.getSkill('skill_abc123');

// Subsequent calls within TTL: served from cache (0ms latency)
const skill2 = await manager.getSkill('skill_abc123');
```

#### 3. Skill Effectiveness Tracking

Automatically track and optimize skill usage:

```typescript
// CostTracker logs every request
await costTracker.trackRequest(response, {
  skillsUsed: ['skill_legal_analysis'],
  estimatedTokensWithoutSkills: 5000,
});

// Query effectiveness metrics
const effectivenessMetrics = await costTracker.generateReport(startDate, endDate);

// Identify underperforming skills
const lowPerformers = effectivenessMetrics.skillsEffectiveness.filter(
  (s) => s.averageSavingsPercentage < 30
);

// Refine or replace low performers
for (const skill of lowPerformers) {
  await manager.deleteSkill(skill.skillId);
  // Upload improved version
}
```

#### 4. Intelligent Fallback

Use skills when effective, fallback when not:

```typescript
const shouldUseSkills = registry.shouldUseSkills('contract-analysis', {
  historicalSuccessRate: 0.85, // 85% of past uses successful
  averageSavings: 0.65, // 65% average token savings
  taskComplexity: 'high',
});

if (shouldUseSkills) {
  // Use skills
  await client.createMessageWithSkills({ skills: { ... } });
} else {
  // Fallback to standard Messages API
  await client.messages.create({ ... });
}
```

---

## Development Guide

### Creating a New Skill

#### Step 1: Design Skill Content

```typescript
const skillContent = `
You are an expert legal document reviewer specializing in ${domain}.

Your task is to analyze the provided document and identify:
1. ${objective1}
2. ${objective2}
3. ${objective3}

Format your response as structured JSON with these fields:
{
  "summary": "Brief overview",
  "findings": ["finding1", "finding2", ...],
  "recommendations": ["rec1", "rec2", ...],
  "risk_level": "low | medium | high"
}
`;
```

#### Step 2: Test Locally

```typescript
// Test with manual prompting first
const testResponse = await client.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  messages: [{ role: 'user', content: `${skillContent}\n\nDocument: ${testDoc}` }],
  max_tokens: 4000,
});

// Measure baseline token usage
const baselineTokens = testResponse.usage.input_tokens + testResponse.usage.output_tokens;
console.log(`Baseline: ${baselineTokens} tokens`);
```

#### Step 3: Upload as Skill

```typescript
const payload: UploadSkillPayload = {
  display_name: 'Contract Risk Analyzer',
  description: 'Identifies legal risks in contracts',
  type: 'analysis',
  category: 'legal-analysis',
  content: skillContent,
  version: '1.0.0',
  config: {
    max_tokens: 4000,
    temperature: 0.3,
    progressive_disclosure: true,
  },
};

const skill = await manager.uploadSkill(payload);
```

#### Step 4: Test with Skills API

```typescript
const skillResponse = await client.createMessageWithSkills({
  model: 'claude-3-5-sonnet-20241022',
  messages: [{ role: 'user', content: `Document: ${testDoc}` }],
  max_tokens: 4000,
  skills: {
    skill_ids: [skill.skill_id],
    progressive_disclosure: true,
  },
});

const skillsTokens = skillResponse.usage.input_tokens + skillResponse.usage.output_tokens;
const savings = ((baselineTokens - skillsTokens) / baselineTokens) * 100;
console.log(`With skills: ${skillsTokens} tokens (${savings.toFixed(1)}% savings)`);
```

#### Step 5: Deploy and Monitor

```typescript
// Monitor effectiveness for first 100 uses
for (let i = 0; i < 100; i++) {
  const response = await client.createMessageWithSkills({
    skills: { skill_ids: [skill.skill_id] },
  });

  await costTracker.trackRequest(response, {
    skillsUsed: [skill.skill_id],
    estimatedTokensWithoutSkills: baselineTokens,
  });
}

// Review performance
const metrics = await costTracker.generateReport(deployDate, new Date());
const skillMetrics = metrics.skillsEffectiveness.find((s) => s.skillId === skill.skill_id);

if (skillMetrics.averageSavingsPercentage < 50) {
  console.warn(`Skill underperforming: only ${skillMetrics.averageSavingsPercentage}% savings`);
  // Iterate and improve
}
```

---

## Troubleshooting

### Common Issues

#### 1. Skills API 400 Error: "Invalid beta version"

**Symptom:**

```
SkillAPIError: Skills API request failed with status 400
Details: { error: "Invalid beta version" }
```

**Solution:**
Check environment variables match current beta versions:

```bash
# .env
ANTHROPIC_SKILLS_BETA_VERSION=skills-2025-10-02
ANTHROPIC_CODE_EXECUTION_BETA_VERSION=code-execution-2025-08-25
```

Verify in Anthropic console for updated beta versions.

#### 2. Skill Upload Fails: "Content too large"

**Symptom:**

```
SkillUploadError: Skill content exceeds maximum size
```

**Solution:**
Skills have a max size limit (default 10MB). Reduce content:

```typescript
// Too large
const bloatedSkill = {
  content: `${longPrompt}\n\nExamples:\n${1000ExamplesHere}...`,
};

// Optimized
const optimizedSkill = {
  content: `${concisePrompt}\n\nRefer to documentation for examples.`,
};
```

#### 3. Low Token Savings (<30%)

**Symptom:**
Cost reports show minimal savings compared to baseline.

**Solution:**
Skills work best for **repetitive, structured tasks**:

```typescript
// Bad use case: one-off creative task
const badSkill = {
  description: 'Write a unique, creative legal brief',
  // Skills add overhead for one-off tasks
};

// Good use case: repetitive extraction
const goodSkill = {
  description: 'Extract standard clauses from contracts',
  // Skills excel at repetitive pattern matching
};
```

#### 4. Fallback Loop: Skills keep failing

**Symptom:**
Logs show repeated fallback to non-skills routing.

**Solution:**
Check skill validation and error patterns:

```typescript
// Query recent failures
const failures = await db.query(`
  SELECT skill_ids, error_message, COUNT(*) as count
  FROM skill_usage_logs
  WHERE success = false AND created_at > NOW() - INTERVAL '24 hours'
  GROUP BY skill_ids, error_message
  ORDER BY count DESC
  LIMIT 10
`);

// Common issues:
// - Skill content has syntax errors
// - Skill references non-existent resources
// - Beta flags misconfigured
```

#### 5. Database Connection Errors

**Symptom:**

```
Error: Failed to persist metrics: Connection refused
```

**Solution:**
CostTracker degrades gracefully without DB:

```typescript
// Without DB: in-memory only
const tracker = new CostTracker(); // Still works, no persistence

// With DB: full persistence
const trackerWithDb = new CostTracker(dbConnection);
```

---

## Best Practices

1. **Start with Templates:** Use `SkillsManager.generateSkillTemplate()` for consistent structure
2. **Test Before Deploy:** Always test skills with sample data and measure token savings
3. **Monitor Effectiveness:** Review cost reports weekly and refine underperforming skills
4. **Version Skills:** Use semantic versioning and maintain changelogs
5. **Cache Aggressively:** Configure appropriate TTL based on skill update frequency
6. **Enable Fallback:** Always set `fallback_to_non_skills: true` in production
7. **Log Everything:** CostTracker provides invaluable optimization insights

---

## References

- [Anthropic Skills API Documentation](https://docs.anthropic.com/en/docs/build-with-claude/skills)
- [Story 2.11: Skills Infrastructure](../stories/2.11.story.md)
- [Cost Optimization Strategy](./claude-cost-optimization.md)
- [Database Migrations](../../packages/database/migrations/001_add_skills_tables.sql)

---

**Last Updated:** 2025-11-19
**Version:** 1.0.0
**Maintained By:** AI Services Team
