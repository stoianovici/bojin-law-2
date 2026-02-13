# Investigation: Morning Briefing Missing Important Emails

**Slug**: missing-email-briefing
**Date**: 2026-02-03
**Status**: Investigation Complete
**Severity**: High
**Next step**: `/debug missing-email-briefing` to implement fix

---

## Bug Summary

**Reported symptom**: Partner received an important email but the morning briefing didn't include it. The case detail agent processed the email (classified and linked to case), but it still didn't appear in the firm briefing even after multiple regenerations.

**Reproduction steps**:

1. Email arrives and gets classified to a case
2. Case detail agent processes email (updates case context with email summary)
3. Partner opens dashboard and views/regenerates the firm briefing
4. Important email is missing from the briefing

**Expected behavior**: The briefing should surface emails that are linked to cases, especially those processed by the case detail agent.

**Actual behavior**: The briefing agent's case tools don't read the precompiled case context where email summaries are stored.

**Frequency**: Always - case-linked email summaries are never surfaced to the briefing agent.

---

## Root Cause Analysis

### The Bug

**Root cause**: The firm briefing agent's `read_active_cases_summary` tool queries the `Case` table directly but **does not read from the `CaseBriefing` table** where email thread summaries are stored by the case context processor.

**Location**: `services/gateway/src/services/firm-operations-tools.handlers.ts:100-124`

**Data flow showing the disconnect**:

```
Email arrives → Classified to case → emailContextService updated
       ↓
4 AM: CaseContextProcessor runs
       ↓
Stores emailThreadSummaries in CaseBriefing table (line 244)
       ↓
Firm briefing runs → read_active_cases_summary
       ↓
Queries Case table directly → NO access to CaseBriefing.emailThreadSummaries!
```

**Type**: Architecture gap - two systems don't communicate

### Why It Happens

The `read_active_cases_summary` tool (lines 100-124) only selects:

```typescript
prisma.case.findMany({
  where: baseWhere,
  select: {
    id: true,
    caseNumber: true,
    title: true,
    status: true,
    client: { select: { name: true } },
    teamMembers: { ... },
    tasks: { ... },                    // Only tasks
    comprehension: { select: { isStale: true } },  // Only stale flag
    healthScores: { ... },             // Only scores
    // NO CaseBriefing relation!
    // NO emailThreadSummaries!
  },
});
```

Meanwhile, the `CaseContextProcessor` (runs at 4 AM) stores rich email context:

```typescript
// case-context.processor.ts:244
await prisma.caseBriefing.upsert({
  ...
  emailThreadSummaries: JSON.parse(JSON.stringify(emails)),
  // This data is NEVER read by firm operations tools
});
```

The case detail agent's work (email processing, thread summaries, action items) is stored in `CaseBriefing` but the firm briefing agent has no access to it.

### Secondary Issue: Email Status Tool Filters

The `read_email_status` tool (lines 649-659) also has an overly restrictive filter:

```typescript
const unreadWhere: Prisma.EmailWhereInput = {
  classificationState: { in: ['Classified', 'ClientInbox'] },
  // Excludes: Pending, Uncertain, CourtUnassigned
};
```

However, since the user confirmed the email WAS classified, this is not the primary issue. The main problem is that **even classified emails don't flow through to the briefing via case context**.

### Why It Wasn't Caught

1. **Separate development tracks**: The case context system (OPS-258-261) and firm operations agent (OPS-265) were developed independently
2. **No integration test**: No test verifies that case-level email context appears in firm briefing
3. **Assumed data flow**: The firm ops agent was designed with its own direct queries, not leveraging precompiled context

---

## Impact Assessment

**Affected functionality**:

- Firm Briefing - case-linked email activity is invisible
- Morning partner briefing - misses important email context from cases
- Email-to-case relationship visibility in briefing

**Blast radius**: High - affects all partners using firm briefing

**Related code**:

- `firm-operations-tools.handlers.ts:72-202`: `handleReadActiveCasesSummary` - doesn't read CaseBriefing
- `case-context.processor.ts:236-249`: Stores email summaries in CaseBriefing
- `email-context.service.ts`: Generates email thread summaries
- `case-briefing.service.ts`: Case-level briefing data

**Risk of similar bugs**: High - other precompiled context data may also not flow to firm briefing

---

## Proposed Fix Approaches

### Option A: Add CaseBriefing to read_active_cases_summary (Recommended)

**Approach**: Include `CaseBriefing` relation in the case query and surface email thread summaries in the tool output.

**Files to change**:

- `services/gateway/src/services/firm-operations-tools.handlers.ts`: Add CaseBriefing to query and format

**Code changes**:

```typescript
// Line 100-124: Add caseBriefing to select
prisma.case.findMany({
  where: baseWhere,
  select: {
    // ... existing fields ...
    caseBriefing: {
      select: {
        emailThreadSummaries: true,
        caseHealthIndicators: true,
      },
    },
  },
});

// Add to output formatting:
if (c.caseBriefing?.emailThreadSummaries) {
  const emails = c.caseBriefing.emailThreadSummaries as EmailThreadSummary[];
  const urgent = emails.filter((e) => e.isUrgent);
  if (urgent.length > 0) {
    result += `- **Emailuri urgente:** ${urgent.length}\n`;
  }
}
```

**Pros**:

- Single query, efficient
- Leverages existing precompiled data
- Consistent with case context architecture

**Cons**:

- Increases response size

**Risk**: Low

### Option B: Create new tool `read_case_email_context`

**Approach**: Add a dedicated tool that reads from CaseBriefing for email context.

**Files to change**:

- `firm-operations-tools.handlers.ts`: Add new handler
- `firm-operations-tools.schema.ts`: Add new tool definition
- `firm-operations-agent.prompts.ts`: Update prompt to use new tool

**Pros**:

- Separation of concerns
- Agent can decide when to use it

**Cons**:

- More complex
- Agent may not call it
- Extra tool round-trip

**Risk**: Medium

### Option C: Hybrid - Add key metrics + new tool

**Approach**: Add urgent email count to case summary, create detailed tool for full context.

**Files to change**:

- `firm-operations-tools.handlers.ts`: Add summary metrics + new detailed tool

**Pros**:

- Best of both worlds
- Agent sees urgent flags immediately
- Can drill down if needed

**Cons**:

- Most complex to implement

**Risk**: Medium

### Recommendation

**Option A (Add CaseBriefing to read_active_cases_summary)** is recommended because:

1. The data is already precompiled and ready
2. Single query is efficient
3. Email context belongs with case context
4. Matches user expectation - "case detail agent caught it" implies it should flow to briefing

---

## Testing Requirements

After fix is implemented, verify:

1. [ ] Case with recent email activity shows email summary in briefing
2. [ ] Urgent email threads are highlighted
3. [ ] Email action items appear in case context
4. [ ] Briefing includes email counts per case
5. [ ] Empty email context doesn't break formatting

### Suggested Test Cases

```typescript
// firm-operations-tools.handlers.test.ts
describe('handleReadActiveCasesSummary', () => {
  it('should include email thread summaries from CaseBriefing', async () => {
    // Create case with CaseBriefing containing emailThreadSummaries
    // Call handleReadActiveCasesSummary
    // Verify output includes email context
  });

  it('should highlight urgent email threads', async () => {
    // Create case with urgent email thread
    // Verify output marks it as urgent
  });

  it('should handle cases without CaseBriefing gracefully', async () => {
    // Create case without CaseBriefing record
    // Verify no error, clean output
  });
});
```

---

## Investigation Notes

### Files Examined

| File                                | Purpose                          | Relevant Finding                                                  |
| ----------------------------------- | -------------------------------- | ----------------------------------------------------------------- |
| `firm-operations-tools.handlers.ts` | Briefing agent tools             | **BUG**: `read_active_cases_summary` doesn't query `CaseBriefing` |
| `case-context.processor.ts`         | Precompiles case context at 4 AM | Stores `emailThreadSummaries` in `CaseBriefing`                   |
| `case-briefing.service.ts`          | Case-level briefing data         | Has email context, used by case ops                               |
| `email-context.service.ts`          | Email thread summaries           | Source of email data                                              |
| `email-categorization.worker.ts`    | Classifies emails                | Not the issue - email WAS classified                              |

### Architecture Diagram

```
┌─────────────────────┐     ┌─────────────────────┐
│ Email Arrives       │────►│ Email Classified    │
└─────────────────────┘     │ to Case             │
                            └──────────┬──────────┘
                                       │
                                       ▼
┌─────────────────────┐     ┌─────────────────────┐
│ emailContextService │◄────│ Case Detail Agent   │
│ (thread summaries)  │     │ processes email     │
└──────────┬──────────┘     └─────────────────────┘
           │
           ▼ (4 AM batch)
┌─────────────────────┐
│ CaseBriefing table  │
│ .emailThreadSummaries│
└──────────┬──────────┘
           │
           ╳ DISCONNECT ╳
           │
           ▼ (firm briefing reads from Case, not CaseBriefing)
┌─────────────────────┐
│ Firm Briefing Agent │
│ read_active_cases   │ ──► Queries Case table only
│ _summary tool       │     Missing email context!
└─────────────────────┘
```

### Key Finding

The firm operations agent was built with its own direct database queries, not leveraging the precompiled `CaseBriefing` context that the case context processor generates. This creates a blind spot where case-level email activity is invisible to the firm briefing.

---

## Fix Implemented

**Status**: Fixed on 2026-02-03

**Approach**: Instead of Option A (adding CaseBriefing data), we implemented a cleaner architecture using CaseActivityEntry as a recent events feed.

### Changes Made

1. **Email classification worker** (`workers/email-categorization.worker.ts`):
   - When an email is classified to a case, now records a `CommunicationReceived` activity entry
   - Includes email subject, sender, and metadata

2. **New tool** `read_recent_case_events`:
   - Schema added to `firm-operations-tools.schema.ts`
   - Handler added to `firm-operations-tools.handlers.ts`
   - Queries `CaseActivityEntry` for events in the last N hours
   - Returns formatted list of recent events (emails, documents, tasks)

3. **Agent prompt** (`firm-operations-agent.prompts.ts`):
   - Updated to list 7 tools (was 6)
   - New tool: `read_recent_case_events` - Evenimente recente: emailuri, documente, sarcini din ultimele 24h

### Why This Approach

- The briefing agent now sees a curated feed of "what happened recently"
- Token-efficient - only recent events, not full case context
- Case detail agent's work (email processing) automatically flows to briefing via activity entries
- More maintainable than hardcoding specific data into case summary tool
