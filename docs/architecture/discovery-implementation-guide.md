# Document Type Discovery - Implementation Guide

## Quick Start Checklist

### Immediate Actions (Story 2.12 Completion)

✅ **Keep current 4 skills as-is** - They provide the foundational framework
✅ **Mark Story 2.12 as complete** - Current scope is sufficient for Phase 1
📝 **Create Story 2.12.1** - "Specialized Skills from Legacy Discovery"

### Database Migration (Priority 1)

```bash
# Run this migration first to enable discovery tracking
npx prisma migrate dev --name add-document-type-registry
```

### Code Integration Points

#### 1. Update AI Document Analyzer (Story 3.2.5)

**File:** `apps/legacy-import/src/services/ai-document-analyzer.ts`

Add after line 341 (in `saveAnalysisResults`):

```typescript
// Register discovered document type
await this.registerDocumentType(result);
```

#### 2. Enhance Training Pipeline (Story 3.2.6)

**File:** `apps/web/src/services/training-pipeline.ts` (when created)

Add type-aware processing:

```typescript
// Group documents by type before pattern analysis
const typeGroups = await this.groupByDiscoveredType(documents);
```

#### 3. Create Admin Dashboard View

**File:** `apps/web/src/app/admin/document-types/page.tsx` (new)

```typescript
export default function DocumentTypesPage() {
  // Shows discovered types, frequencies, and actions needed
  return <DocumentDiscoveryDashboard />;
}
```

---

## Priority Order for Implementation

### Week 1: Foundation

1. **Database Setup**
   - Add `document_type_registry` table
   - Add `document_type_instances` table
   - Create indexes

2. **Basic Discovery**
   - Update AI analyzer to populate registry
   - Track document type occurrences
   - Store sample documents

### Week 2: Intelligence

3. **Decision Engine**
   - Implement threshold checks
   - Auto-mapping logic
   - Priority scoring

4. **Admin Interface**
   - Discovery dashboard
   - Manual mapping UI
   - Review queue

### Week 3: Automation

5. **Feedback Loop**
   - Weekly analysis job
   - Template effectiveness tracking
   - ROI calculations

6. **Template Creation**
   - Queue high-priority types
   - Track creation status
   - Update skill mappings

---

## Configuration Files to Create

### 1. Thresholds Configuration

**File:** `config/discovery-thresholds.yml`

```yaml
template_creation:
  auto_create:
    min_occurrences: 50
  queue_for_review:
    min_occurrences: 20
```

### 2. Romanian Type Mappings

**File:** `config/romanian-document-types.json`

```json
{
  "contract_de_vanzare_cumparare": {
    "skill": "contract-analysis",
    "englishName": "Sales Purchase Agreement"
  },
  "notificare_avocateasca": {
    "skill": "document-drafting",
    "englishName": "Legal Notice"
  }
}
```

---

## Monitoring Setup

### Metrics to Track (Grafana Dashboard)

1. **Discovery Rate** - New types found per week
2. **Coverage** - % of documents successfully mapped
3. **Template Efficiency** - Time saved per template
4. **Queue Depth** - Items pending review

### Alerts to Configure

```yaml
alerts:
  - name: 'High frequency unmapped type'
    condition: "occurrences > 30 AND mapping_status = 'pending'"
    action: 'Notify product owner'

  - name: 'Low mapping confidence'
    condition: 'avg(mapping_confidence) < 0.70'
    action: 'Review mappings'
```

---

## Testing Strategy

### Unit Tests Required

- Document type normalization
- Threshold evaluation logic
- Priority scoring algorithm
- Mapping confidence calculation

### Integration Tests

- End-to-end discovery flow
- Registry update transactions
- Queue processing
- Dashboard data aggregation

### Sample Test Data

Create test fixtures with Romanian legal documents:

- 10 Contracts (various types)
- 5 Legal Notices
- 5 Court Documents
- 5 Miscellaneous

---

## Risk Mitigation

### Potential Issues & Solutions

| Risk                   | Impact                   | Mitigation                              |
| ---------------------- | ------------------------ | --------------------------------------- |
| Over-fragmentation     | Too many micro-types     | Set minimum occurrence threshold (20+)  |
| Poor mapping quality   | Wrong skill assignments  | Manual review queue + confidence scores |
| Template proliferation | Maintenance burden       | ROI calculation before creation         |
| Language confusion     | Incorrect categorization | Separate Romanian/English mappings      |

---

## Success Metrics (First 30 Days)

### Target KPIs

- ✅ 100+ document types discovered
- ✅ 70%+ auto-mapped successfully
- ✅ 5+ Romanian templates created
- ✅ <3 day average review time
- ✅ 90%+ mapping accuracy

### Review Checkpoint

After 30 days, evaluate:

1. Most common unmapped types
2. Template creation backlog
3. Mapping accuracy rates
4. User feedback on suggestions

---

## Team Responsibilities

### Product Owner

- Review weekly discovery reports
- Prioritize template creation
- Approve ROI thresholds

### Development Team

- Implement discovery engine
- Create admin dashboard
- Build feedback loops

### Legal Team

- Validate document mappings
- Review template quality
- Provide business value scores

### QA Team

- Test discovery accuracy
- Validate mapping logic
- Performance testing with 1000+ documents

---

## FAQ

**Q: What if we discover 100+ unique types?**
A: Focus on top 20% by frequency (Pareto principle)

**Q: How to handle multilingual documents?**
A: Create separate registry entries for each language version

**Q: When to create vs. map?**
A: Create if >50 occurrences AND no 80%+ similarity match

**Q: How to measure ROI?**
A: Time saved × hourly rate × monthly volume

---

**Quick Reference Commands:**

```bash
# Check discovery status
curl localhost:3000/api/admin/document-types/discovery-status

# Manually map a type
curl -X POST localhost:3000/api/admin/document-types/{id}/map \
  -d '{"targetSkill": "contract-analysis", "confidence": 0.95}'

# Trigger weekly analysis
npm run jobs:weekly-discovery-analysis

# Export discovery report
npm run reports:document-type-discovery
```

---

**Last Updated:** 2024-11-19
**Version:** 1.0.0
**Status:** Ready for Implementation
