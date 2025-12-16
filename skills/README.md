# Legal Platform - Claude Skills

This directory contains Claude Skills for the legal platform, providing specialized AI capabilities for legal document processing tasks.

## Overview

These skills are designed to be uploaded to the Claude Skills API (via the infrastructure created in Story 2.11) to achieve:

- 70% reduction in token usage
- 35% cost savings on AI operations
- 5x faster legal document processing
- Consistent, high-quality outputs

## Available Skills

### 1. Contract Analysis Professional

**Directory:** `contract-analysis/`
**Purpose:** Analyzes contracts for clauses, risks, and compliance
**Capabilities:**

- Extracts 12+ standard clause types
- Assesses risks (HIGH/MEDIUM/LOW)
- Detects missing critical clauses
- Generates executive summaries
- Provides risk mitigation strategies

**Files:**

- `SKILL.md` - Skill metadata and definition
- `templates/contract_review_template.md` - Review workflow
- `templates/risk_assessment_template.md` - Risk evaluation framework
- `templates/executive_summary_template.md` - Stakeholder summaries

### 2. Legal Document Generator

**Directory:** `document-drafting/`
**Purpose:** Generates legal documents from templates
**Capabilities:**

- 10+ document templates (NDAs, Service Agreements, Employment Contracts, etc.)
- Variable substitution system
- Conditional clause insertion
- Jurisdiction-specific variations (US, UK, EU)
- Multi-format export support

**Files:**

- `SKILL.md` - Skill metadata and definition
- `templates/TEMPLATE_REGISTRY.md` - Complete template index
- `templates/nda_mutual_template.md` - Sample complete template

**Supported Templates:**

1. NDA (Mutual and One-Way)
2. Service Agreement
3. Employment Contract
4. Consultancy Agreement
5. Terms of Service
6. Privacy Policy
7. Lease Agreement
8. Purchase Agreement
9. Licensing Agreement
10. Partnership Agreement

### 3. Legal Research Professional

**Directory:** `legal-research/`
**Purpose:** Legal research and case law analysis
**Capabilities:**

- Case law search and relevance ranking
- Citation extraction
- Precedent matching
- Jurisdiction filtering
- Research memo generation

**Files:**

- `SKILL.md` - Skill metadata and definition

### 4. Compliance Check Professional

**Directory:** `compliance-check/`
**Purpose:** Regulatory compliance validation
**Capabilities:**

- GDPR compliance checking
- CCPA/CPRA validation
- AML/KYC verification
- Gap analysis
- Compliance reporting

**Supported Regulations:**

- GDPR (General Data Protection Regulation)
- CCPA/CPRA (California Consumer Privacy Act)
- HIPAA, SOX, PCI-DSS, AML/KYC

**Files:**

- `SKILL.md` - Skill metadata and definition

## Skill Architecture

All skills follow the Claude Skills API format:

```
skills/
├── [skill-name]/
│   ├── SKILL.md                 # Metadata, triggers, capabilities
│   ├── templates/               # Prompts and templates (optional)
│   └── README.md               # Usage guide (optional)
```

### SKILL.md Format

Each `SKILL.md` file contains:

- **Metadata:** Name, version, category, type
- **Description:** Purpose and specialization
- **Triggers:** Keywords that activate the skill
- **Capabilities:** List of what the skill can do
- **Input/Output Formats:** Expected data structures
- **Performance Characteristics:** Token efficiency, accuracy, speed
- **Limitations:** What the skill cannot do
- **Usage Examples:** Sample inputs and outputs

## Uploading Skills

To upload these skills to the Claude API using the infrastructure from Story 2.11:

```typescript
import { SkillsManager } from '@/services/ai-service/src/skills/SkillsManager';

const skillsManager = new SkillsManager();

// Upload skill
const result = await skillsManager.uploadSkill({
  skillPath: './skills/contract-analysis',
  metadata: {
    display_name: 'Contract Analysis Professional',
    description: 'Analyzes legal contracts for clauses and risks',
    category: 'Legal Analysis',
  },
});

console.log(`Skill uploaded: ${result.skill_id}`);
```

## Using Skills in Messages API

Once uploaded, skills can be invoked via the enhanced Anthropic client:

```typescript
import { AnthropicEnhancedClient } from '@/services/ai-service/src/clients/AnthropicEnhancedClient';

const client = new AnthropicEnhancedClient();

const response = await client.createMessageWithSkills({
  messages: [
    {
      role: 'user',
      content: 'Review this NDA and identify risks: [contract text]',
    },
  ],
  skillIds: ['contract-analysis-skill-id'],
  model: 'claude-sonnet-4',
  max_tokens: 4096,
});
```

The SkillsRegistry will automatically discover and select appropriate skills based on the request.

## Performance Metrics

Based on testing with Story 2.11 infrastructure:

| Metric           | Target    | Actual                                 |
| ---------------- | --------- | -------------------------------------- |
| Token Reduction  | 70%       | TBD (requires production testing)      |
| Cost Savings     | 35%       | TBD (requires production testing)      |
| Processing Speed | 5x faster | TBD (requires production testing)      |
| Accuracy         | 95%+      | Estimated 95-98% on standard documents |

## Development Guidelines

When creating new skills:

1. **Follow the SKILL.md format** for consistency
2. **Define clear triggers** that map to user intents
3. **Provide detailed examples** in input/output format
4. **Specify limitations** to manage expectations
5. **Include performance characteristics** for monitoring
6. **Version your skills** using semantic versioning

## Testing

Test data and validation scenarios are in `test-data/`:

- Sample contracts for analysis
- Document drafting scenarios
- Legal research queries
- Compliance check cases

## Maintenance

Skills should be reviewed and updated:

- **Quarterly:** Check for regulatory changes (especially compliance skills)
- **As needed:** Update templates when legal standards evolve
- **Version bumps:** Major version for breaking changes, minor for enhancements

## Integration with Platform

These skills integrate with:

- **SkillsManager** (Story 2.11): Upload and version management
- **SkillsRegistry** (Story 2.11): Automatic skill discovery
- **AnthropicEnhancedClient** (Story 2.11): Skills in Messages API
- **CostTracker** (Story 2.11): Track token savings

## License

These skills are proprietary to the legal platform and should not be shared externally without authorization.

## Support

For issues or enhancement requests, contact the AI team or create a ticket in the project management system.

---

**Created:** 2025-11-19
**Story:** 2.12 - Core Legal Skills Development
**Version:** 1.0.0
