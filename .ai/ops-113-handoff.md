# Handoff: [OPS-113] Rule-Based Document Filtering

**Session**: 1
**Date**: 2024-12-23
**Status**: Open

## Issue Summary

Filter junk email attachments (calendar invites, tiny images, email signatures) during import using rule-based filtering. Currently ALL attachments are imported, cluttering case documents with noise. Estimated 40-60% reduction in attachment clutter.

## Initial Triage Findings

**From /ops-ideate session:**
- Explored 4 approaches: rule-based, AI-assisted, user-driven, hybrid
- Selected rule-based as MVP (fast, zero runtime cost, predictable)
- Designed comprehensive filter rules covering common junk patterns
- Identified integration point in `EmailAttachmentService.syncAllAttachments()`

**Key Integration Point:**
`services/gateway/src/services/email-attachment.service.ts` line ~270-280
- After the `@odata.type !== '#microsoft.graph.fileAttachment'` check
- Add filter evaluation before downloading attachment content

## Environment Strategy

**Recommended**: Local dev for implementation, prod data for rule validation

- For development: `pnpm dev`
- For rule testing against real data: `source .env.prod && pnpm dev`
- For final verification: `pnpm preview`

## Local Verification Status

| Step           | Status     | Notes |
| -------------- | ---------- | ----- |
| Prod data test | ⬜ Pending |       |
| Preflight      | ⬜ Pending |       |
| Docker test    | ⬜ Pending |       |

**Verified**: No

## Prototype Design (Ready for Implementation)

### 1. DocumentFilterService (`services/gateway/src/config/document-filter.config.ts`)

```typescript
// Types
type FilterAction = 'dismiss' | 'quarantine' | 'flag';

interface FilterRule {
  id: string;
  name: string;
  description: string;
  action: FilterAction;
  enabled: boolean;
  conditions: FilterCondition[];
}

interface FilterCondition {
  type: 'extension' | 'contentType' | 'sizeRange' | 'namePattern' | 'inline';
  value: string[] | { min?: number; max?: number } | string | boolean;
}

// Key method
evaluate(attachment: { name, contentType, size, isInline }): FilterResult
```

### 2. Default Rules (7 rules)

| ID | Catches | Example |
|----|---------|---------|
| calendar-invites | .ics, .vcf | meeting.ics |
| tiny-images | < 5KB images | tracking pixel |
| inline-small-images | < 20KB inline | email body decoration |
| email-cruft-images | image\d+.png | image001.png |
| signature-files | logo.*, signature.* | signature_john.gif |
| animated-gifs | < 50KB .gif | animated emoji |
| winmail-dat | winmail.dat, ATT*.dat | Outlook wrapper |

### 3. Schema Addition

```prisma
model EmailAttachment {
  // Add these fields
  filterStatus    String?   // 'imported' | 'dismissed' | 'quarantined' | 'flagged'
  filterRuleId    String?
  filterReason    String?
  dismissedAt     DateTime?
}
```

## Next Steps

1. Create `services/gateway/src/config/document-filter.config.ts` with DocumentFilterService
2. Create migration for EmailAttachment filter fields
3. Integrate filter evaluation in `syncAllAttachments()`
4. Add logging for filter decisions
5. Test with `analyzeBatch()` against existing attachments
6. Run preflight and docker verification

## Files to Create/Modify

**Create:**
- `services/gateway/src/config/document-filter.config.ts`
- `packages/database/prisma/migrations/YYYYMMDDHHMMSS_add_attachment_filter_fields/`

**Modify:**
- `packages/database/prisma/schema.prisma` (EmailAttachment model)
- `services/gateway/src/services/email-attachment.service.ts` (syncAllAttachments)

## Testing Approach

1. Write unit tests for DocumentFilterService rule evaluation
2. Run `analyzeBatch()` on real attachment data to validate rules catch expected junk
3. Manual test: sync an email with known junk attachments, verify filtering
