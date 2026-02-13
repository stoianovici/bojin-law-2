# Investigation: Word Add-in Text Insertion Failure in Production

**Slug**: word-addin-split-error
**Date**: 2026-01-15
**Status**: Investigation Complete
**Severity**: High
**Next step**: `/debug word-addin-split-error` to implement fix

---

## Bug Summary

**Reported symptom**: Word add-in fails to insert AI-generated text in production with error "Cannot read properties of undefined (reading 'split')". Works locally but never in production.

**Reproduction steps**:

1. Open Word Online with the Bojin AI add-in
2. Go to Draft tab
3. Select context (Client or Internal)
4. Enter a prompt that triggers research (e.g., contains "caută", "legislație")
5. Click "Generează"
6. AI performs web searches successfully (progress events visible)
7. AI finishes research and attempts to send content
8. Error appears: "Cannot read properties of undefined (reading 'split')"

**Expected behavior**: AI-generated content should be inserted into the Word document

**Actual behavior**: Error occurs after AI finishes generating, content is not inserted

**Frequency**: 100% in production for research-enabled drafts (large responses). Works locally.

---

## Root Cause Analysis

### The Bug

**Root cause**: SSE event type state is reset between network reads, causing large events to be silently dropped.

**Location**: `apps/word-addin/src/services/api-client.ts:217`

**Code path**:

```
User clicks Generează → apiClient.draftStream() → SSE stream processing → processBuffer() called on each network read → eventType reset to '' → large events dropped → response.content is empty → insertMarkdown('') or insertOoxml fails → .split() called on undefined
```

**Type**: State bug / Race condition

### Why It Happens

In `api-client.ts`, the SSE parsing logic has a critical bug at line 217:

```typescript
const processBuffer = () => {
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';

  let eventType = '';  // BUG: This resets on EVERY call to processBuffer()

  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventType = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      // Uses eventType to determine how to handle data
      if (eventType === 'chunk') { ... }
      else if (eventType === 'ooxml') { ... }
    }
  }
};
```

The `eventType` variable is declared **inside** `processBuffer()`, so it resets to `''` every time the function is called. Since `processBuffer()` is called on each network read (line 267), when an SSE event spans multiple reads, the event type is lost.

**Local vs Production difference**:

| Environment | Network Behavior                                         | Result          |
| ----------- | -------------------------------------------------------- | --------------- |
| Local       | Fast localhost, entire SSE events arrive in single reads | Works correctly |
| Production  | Proxies/CDNs chunk large messages across multiple reads  | Events dropped  |

**Example of the failure in production**:

For a research response with 18KB content and 80KB OOXML:

```
Read 1: "event: chunk\ndata: \"partial content..."
  → processBuffer() called
  → eventType = '' (initialized)
  → Sets eventType = 'chunk'
  → data line incomplete, kept in buffer

Read 2: "...more content\"\n\nevent: ooxml\ndata: \"<?xml..."
  → processBuffer() called
  → eventType = '' (RESET - THIS IS THE BUG!)
  → Complete chunk data line available
  → But eventType is '', so chunk is IGNORED
  → accumulatedContent stays empty
```

The content is silently dropped because when the data line is finally complete, `eventType` has been reset to `''`.

### Why It Wasn't Caught

1. **Works locally**: The fast localhost network delivers events in single reads
2. **Small events work**: Progress events are small (~100 bytes) and arrive complete
3. **Silent failure**: The catch block only logs a warning, doesn't surface the issue
4. **No integration tests**: No tests simulate chunked network delivery

---

## Impact Assessment

**Affected functionality**:

- Draft generation with research (large responses)
- Any streaming response > ~16KB in production
- Potentially affects Improve/Explain if responses are large

**Blast radius**: Moderate - affects all production users using research-enabled drafts

**Related code**:

- `apps/word-addin/src/services/api-client.ts`: SSE parsing
- `apps/word-addin/src/components/DraftTab.tsx`: Calls draftStream, handles response
- `apps/word-addin/src/services/word-api.ts`: insertMarkdown/insertOoxml called with undefined

**Risk of similar bugs**: Medium - any streaming response handling could have similar issues

---

## Proposed Fix Approaches

### Option A: Move eventType outside processBuffer (Recommended)

**Approach**: Move `let eventType = ''` to the outer scope alongside `buffer` and `accumulatedContent`

**Files to change**:

- `apps/word-addin/src/services/api-client.ts`: Move line 217 to line 210

**Code change**:

```typescript
// Before (line 209-217):
let accumulatedContent = '';
let ooxmlContent: string | undefined;

const processBuffer = () => {
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';

  let eventType = '';  // Bug: resets on each call

// After:
let accumulatedContent = '';
let ooxmlContent: string | undefined;
let eventType = '';  // Fix: persists across calls

const processBuffer = () => {
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';

  // eventType is now preserved between calls
```

**Pros**:

- Minimal change (move one line)
- Fixes the root cause
- No behavioral changes for working scenarios

**Cons**:

- None significant

**Risk**: Low

### Option B: Refactor to event-based SSE parser

**Approach**: Use a proper SSE parser library or refactor to accumulate complete events before processing

**Files to change**:

- `apps/word-addin/src/services/api-client.ts`: Major refactor of draftStream

**Pros**:

- More robust parsing
- Handles edge cases better

**Cons**:

- Larger change
- More testing required
- Overkill for this specific bug

**Risk**: Medium

### Recommendation

**Option B (OOXML via REST)** - Chosen approach after discussion. Instead of sending 80KB OOXML over SSE (which is fragile with proxies/CDNs), fetch OOXML via a separate REST call after streaming completes.

**Implementation plan:**

1. **Server**: Add new REST endpoint `POST /api/ai/word/ooxml`
   - Accepts markdown content
   - Returns OOXML fragment
   - Uses existing `docxGeneratorService.markdownToOoxmlFragment()`

2. **Server**: Remove OOXML from SSE response
   - Remove `event: ooxml` from streaming
   - `done` event only sends metadata (title, tokensUsed, processingTimeMs)

3. **Client**: Fetch OOXML after streaming completes
   - `draftStream()` returns content + metadata (no OOXML)
   - New `getOoxml(markdown)` method calls REST endpoint
   - `DraftTab` fetches OOXML before insertion

4. **Client**: Also fix the `eventType` bug (defensive)
   - Move `let eventType = ''` outside `processBuffer`
   - Prevents similar issues with other events

---

## Testing Requirements

After fix is implemented, verify:

1. [ ] Original bug no longer reproduces in production (Word Online)
2. [ ] Research-enabled drafts work with large responses
3. [ ] Regular drafts (non-research) still work
4. [ ] Progress events still display during research
5. [ ] New `/api/ai/word/ooxml` endpoint works correctly
6. [ ] OOXML insertion works in Word Desktop
7. [ ] Markdown/HTML fallback works in Word Online
8. [ ] Error handling works if OOXML endpoint fails
9. [ ] SSE parsing handles chunked delivery (eventType fix)

### Suggested Test Cases

Manual testing in production:

1. Create a draft with research keywords ("caută legislație despre...")
2. Verify progress events show tool usage
3. Verify content is inserted after completion
4. Test with both Word Online and Word Desktop

If adding automated tests:

```typescript
// api-client.test.ts
describe('SSE parsing', () => {
  it('should handle events split across multiple reads', () => {
    // Simulate chunked delivery of a large event
    // Verify content is accumulated correctly
  });

  it('should preserve eventType across processBuffer calls', () => {
    // Verify eventType is not reset between calls
  });
});
```

---

## Investigation Notes

### Files Examined

| File                                               | Purpose                 | Relevant Finding                        |
| -------------------------------------------------- | ----------------------- | --------------------------------------- |
| `apps/word-addin/src/services/api-client.ts`       | SSE stream parsing      | Bug at line 217: eventType resets       |
| `apps/word-addin/src/services/word-api.ts`         | Word document insertion | .split() calls that fail with undefined |
| `apps/word-addin/src/components/DraftTab.tsx`      | Draft UI component      | Passes response.content to insertion    |
| `services/gateway/src/routes/word-ai.routes.ts`    | Server SSE sending      | Confirmed server sends correctly        |
| `services/gateway/src/services/word-ai.service.ts` | AI service              | Research flow confirmed working         |

### Server Logs (Confirmed Working)

```
[2026-01-15T20:00:02.411Z] INFO: Word draft with research completed {
  tokensUsed: 349009,
  costEur: 1.915365
}
[2026-01-15T20:00:02.411Z] DEBUG: Converting markdown to OOXML fragment { inputLength: 18403 }
[2026-01-15T20:00:02.426Z] DEBUG: OOXML fragment generated { outputLength: 79730 }
[2026-01-15T20:00:02.427Z] INFO: Draft stream: sending final response { contentLength: 18403, ooxmlLength: 79730, writable: true }
```

The server successfully:

1. Completed AI research (11 rounds of web searches)
2. Generated 18KB of markdown content
3. Converted to 80KB of OOXML
4. Sent the response

### Git History

Recent relevant commits:

- `7c93e78` - "fix(word-addin): split large SSE response to prevent client timeout" - This added separate `ooxml` event to avoid large single messages, but didn't fix the client parsing bug
- `71a8577` - "fix(word-addin): don't send content twice in streaming response"

### Questions Answered During Investigation

- Q: Where does the error occur?
- A: Client-side in Word add-in, during/after streaming completion

- Q: Why does it work locally but not in production?
- A: Network chunking in production splits large SSE events across reads, triggering the eventType reset bug

- Q: Is the server working correctly?
- A: Yes, server logs confirm successful generation and sending of content

---

## Handoff to Fix Phase

This investigation is complete. To implement the fix:

```
/debug word-addin-split-error
```

The debug phase will:

1. Read this investigation document
2. Implement Option A (move eventType to outer scope)
3. Test the fix
4. Verify in production
