# Investigation: Word Online Add-in Shows Empty Task Pane

**Slug**: word-online-empty
**Date**: 2026-01-10
**Status**: Investigation Complete
**Severity**: High
**Next step**: `/debug word-online-empty` to implement fix

---

## Bug Summary

**Reported symptom**: Word Online add-in appears in the ribbon but the task pane is completely empty with no way to interact with it.

**Reproduction steps**:

1. Open Word Online (e.g., via SharePoint)
2. The "Legal AI" tab appears in the ribbon with buttons (Redacteaza, Sugereaza, Explica, Imbunatateste)
3. Click any button to open the task pane
4. Task pane opens with title "Legal AI Assistant" but content area is blank

**Expected behavior**: Task pane should show the React application with login/AI features

**Actual behavior**: Task pane header appears but content is empty (React app fails to load)

**Frequency**: Always (100% reproducible)

---

## Root Cause Analysis

### The Bug

**Root cause**: Vite build outputs asset paths starting with `/assets/...` but files are served from `/word-addin/assets/...`. This causes 404 errors when Word Online tries to load the JavaScript and CSS.

**Location**: `apps/word-addin/vite.config.ts:27-35`

**Code path**:

```
User clicks button → Word Online loads taskpane.html →
Browser requests /assets/taskpane-xxx.js → 404 (file is at /word-addin/assets/) →
React never mounts → Empty task pane
```

**Type**: Configuration/Build bug

### Why It Happens

The Word Add-in is served from the gateway at `/word-addin/*` (configured in `services/gateway/src/index.ts:96-105`). However, the Vite build config doesn't set a `base` property, so it defaults to `/`. This means:

- Generated HTML: `<script src="/assets/taskpane-xxx.js">`
- Browser resolves to: `https://legal-platform-gateway.onrender.com/assets/taskpane-xxx.js`
- Actual file location: `https://legal-platform-gateway.onrender.com/word-addin/assets/taskpane-xxx.js`

Evidence from production:

```
$ curl -s -I "https://legal-platform-gateway.onrender.com/assets/taskpane-RRqNBB8Z.js"
HTTP/2 404

$ curl -s -I "https://legal-platform-gateway.onrender.com/word-addin/taskpane.html"
HTTP/2 200
```

### Secondary Issue: OnlineFormFactor Accidentally Removed

Commit `4ca8a39` ("fix(web): wait for auth before querying cases") accidentally removed the `OnlineFormFactor` section from both manifest files:

- `apps/word-addin/manifest.dev.xml`: 69 lines removed
- `apps/word-addin/manifest.prod.xml`: 90 lines removed

This was added in commit `15f3af5` and removed one commit later. The commit message doesn't mention the manifest changes, suggesting it was an accidental inclusion (possibly from a stale working directory).

While the primary issue is the asset paths, the missing OnlineFormFactor may cause:

- Button icons not loading (showing "?" placeholders)
- Potential feature differences between desktop and web
- Non-optimal behavior in Word Online

### Why It Wasn't Caught

1. **Local development works**: In dev mode, Vite serves from root and the add-in runs at `https://localhost:3005`, not a subpath
2. **Desktop Word may work**: Desktop Word loads the add-in differently and may not hit the same path issue
3. **No E2E tests for production paths**: The integration tests run against localhost, not the deployed `/word-addin/` path
4. **Accidental commit**: The OnlineFormFactor removal was bundled with an unrelated fix

---

## Impact Assessment

**Affected functionality**:

- Word Online add-in is completely non-functional
- Users cannot use AI features in Word Online (browser)
- Affects all Word Online users (SharePoint, Office.com)

**Blast radius**: High - Entire Word Online experience broken

**Related code**:

- `apps/word-addin/vite.config.ts`: Missing `base` config
- `apps/word-addin/manifest.prod.xml`: Missing OnlineFormFactor
- `apps/word-addin/manifest.dev.xml`: Missing OnlineFormFactor
- `services/gateway/src/index.ts`: Static file serving (correct)
- `infrastructure/docker/Dockerfile.gateway`: Build process (correct)

**Risk of similar bugs**: Medium - Any app served from a subpath needs explicit base config

---

## Proposed Fix Approaches

### Option A: Add Vite base config (Recommended)

**Approach**: Set `base: '/word-addin/'` in Vite config for production builds

**Files to change**:

- `apps/word-addin/vite.config.ts`: Add `base` property

```typescript
export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/word-addin/' : '/',
  // ... rest of config
});
```

**Pros**:

- Simple one-line fix
- Doesn't affect local development
- Standard Vite pattern for subpath deployment

**Cons**:

- None significant

**Risk**: Low

### Option B: Restore OnlineFormFactor

**Approach**: Re-add the OnlineFormFactor sections removed in commit 4ca8a39

**Files to change**:

- `apps/word-addin/manifest.prod.xml`: Add OnlineFormFactor section
- `apps/word-addin/manifest.dev.xml`: Add OnlineFormFactor section

Can be done by cherry-picking the relevant changes from commit `15f3af5` or reverting the manifest changes from `4ca8a39`.

**Pros**:

- Restores Word Online specific configuration
- May fix icon loading issues
- Ensures proper Word Online support

**Cons**:

- Manifest needs to be re-uploaded to Microsoft 365 Admin Center after change

**Risk**: Low

### Recommendation

**Do both Option A and Option B**:

1. **Option A (Critical)**: Fix the Vite base path - this is the primary blocker preventing the app from loading
2. **Option B (Important)**: Restore OnlineFormFactor - ensures proper Word Online support and may fix icon issues

The fixes are independent and both should be applied.

---

## Testing Requirements

After fix is implemented, verify:

1. [ ] Production taskpane.html references `/word-addin/assets/...` paths
2. [ ] `curl https://legal-platform-gateway.onrender.com/word-addin/taskpane.html` shows correct asset paths
3. [ ] Asset files return 200 (not 404)
4. [ ] Word Online task pane loads and shows React app
5. [ ] Button icons load correctly (no "?" placeholders)
6. [ ] Word Desktop still works correctly

### Suggested Test Cases

Manual verification required (Office Add-ins require actual Office environment):

```bash
# Verify asset paths in built HTML
grep -o 'src="[^"]*"' apps/word-addin/dist/taskpane.html
# Expected: src="/word-addin/assets/taskpane-xxx.js"

# Verify OnlineFormFactor exists
grep -c "OnlineFormFactor" apps/word-addin/manifest.prod.xml
# Expected: 2 (opening and closing tags)
```

---

## Investigation Notes

### Files Examined

| File                                       | Purpose                   | Relevant Finding                    |
| ------------------------------------------ | ------------------------- | ----------------------------------- |
| `apps/word-addin/vite.config.ts`           | Build config              | Missing `base` property             |
| `apps/word-addin/manifest.prod.xml`        | Production manifest       | Missing OnlineFormFactor            |
| `apps/word-addin/manifest.online.xml`      | Online manifest (unused?) | Uses Cloudflare tunnel URLs         |
| `services/gateway/src/index.ts`            | Static file serving       | Correctly serves from `/word-addin` |
| `infrastructure/docker/Dockerfile.gateway` | Build process             | Correctly builds and copies files   |

### Git History

| Commit    | Description                                   | Impact                                    |
| --------- | --------------------------------------------- | ----------------------------------------- |
| `15f3af5` | feat(word-addin): add Word Online support     | Added OnlineFormFactor                    |
| `4ca8a39` | fix(web): wait for auth before querying cases | **Accidentally removed OnlineFormFactor** |

### Network Verification

```
Production taskpane.html: HTTP 200 OK
Production icon-64.png: HTTP 200 OK
/assets/taskpane-xxx.js: HTTP 404 (wrong path)
/word-addin/assets/taskpane-xxx.js: Should be 200 but different hash
```

---

## Handoff to Fix Phase

This investigation is complete. To implement the fix:

```
/debug word-online-empty
```

The debug phase will:

1. Read this investigation document
2. Add `base: '/word-addin/'` to Vite config
3. Restore OnlineFormFactor to manifest files
4. Verify the fix locally and in production
