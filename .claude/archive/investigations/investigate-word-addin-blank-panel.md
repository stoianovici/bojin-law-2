# Investigation: Word Add-in Panel Blank in Word Online

**Slug**: word-addin-blank-panel
**Date**: 2026-01-10
**Status**: Investigation Complete
**Severity**: High
**Next step**: Manual steps required (see below)

---

## Bug Summary

**Reported symptom**: Word add-in panel opens but displays nothing inside - completely blank. No login screen, no UI at all.

**Reproduction steps**:

1. Open a document from the app in Word Online
2. Click on the Legal AI tab in the ribbon
3. Panel opens but is completely blank

**Expected behavior**: The add-in should show either a login screen or the main UI with tabs (Draft, Suggest, Explain, Improve).

**Actual behavior**: Empty white panel with no content.

**Frequency**: Always (100% reproducible)

---

## Root Cause Analysis

### The Bug

**Root cause**: JavaScript and CSS files return 404 because the deployed build has incorrect asset paths.

**Evidence from browser console**:

```
Failed to load resource: 404 - /assets/word-api-CY4ib3cc.js
Failed to load resource: 404 - /assets/taskpane-RRqNBB8Z.js
Failed to load resource: 404 - /assets/taskpane-Dxs4oxtY.css
```

The paths should be `/word-addin/assets/...` but are `/assets/...`.

**Location**: Build configuration issue - `apps/word-addin/vite.config.ts:13`

**Code path**:

```
Word Online loads manifest → manifest points to taskpane.html
→ taskpane.html loads JS/CSS with wrong paths → 404 errors
→ React never initializes → Office.onReady() never called → blank panel
```

**Type**: Build/Deployment configuration bug

### Why It Happens

The Vite config sets `base` based on `NODE_ENV`:

```typescript
// apps/word-addin/vite.config.ts:13
base: process.env.NODE_ENV === 'production' ? '/word-addin/' : '/',
```

There are two potential issues:

1. **Stale cache in Word Online/Microsoft 365**: Word Online may be caching an old version of the manifest or add-in files. Microsoft's add-in infrastructure aggressively caches manifests.

2. **Build didn't run with NODE_ENV=production**: The Dockerfile builds the add-in but may not have had `NODE_ENV=production` set when loading the Vite config. However, when I curl'd production, the files HAD the correct path, suggesting this was fixed but the cache is stale.

### Cache Evidence

| Source                                 | JS Filename Hash       | Base Path                       |
| -------------------------------------- | ---------------------- | ------------------------------- |
| Browser error (what Word Online loads) | `CY4ib3cc`, `RRqNBB8Z` | `/assets/` (wrong)              |
| curl production server                 | `COcbur30`, `CnYdpfM2` | `/word-addin/assets/` (correct) |

The hash mismatch proves Word Online is loading an older cached version.

---

## Impact Assessment

**Affected functionality**:

- All Word add-in features (Draft, Suggest, Explain, Improve)
- Word Online integration is completely broken

**Blast radius**: Wide - affects all users trying to use the add-in in Word Online

**Risk of similar bugs**: Medium - any future add-in deployment needs cache invalidation

---

## Fix Required

### This is NOT a code fix - it's a cache/deployment issue

The code is correct. The production gateway is serving the correct files. The issue is that **Word Online/Microsoft 365 is caching an old version**.

### Steps to Fix

#### Option A: Force Microsoft to refresh the manifest (Recommended)

1. **Update the manifest version number**:
   - Open `apps/word-addin/manifest.prod.xml`
   - Change line 27 from `<Version>1.0.0.0</Version>` to `<Version>1.0.1.0</Version>`

2. **Redeploy the gateway** to get the updated manifest:

   ```bash
   pnpm deploy:production gateway
   ```

3. **Re-upload the manifest in Microsoft 365 Admin Center**:
   - Go to admin.microsoft.com → Settings → Integrated apps
   - Find "Legal AI Assistant" and remove it
   - Upload the new `manifest.prod.xml` with version 1.0.1.0
   - Assign to users/groups

4. **Clear Office cache** (for testing):
   - Close all Office apps
   - Users may need to clear their Office cache or wait for cache expiry

#### Option B: Change the add-in ID (Nuclear option)

If Option A doesn't work, generate a new add-in ID to force a fresh registration:

1. Generate new UUID for `<Id>` in manifest.prod.xml
2. This treats it as a completely new add-in
3. Will lose any user permissions/assignments

### Azure AD Configuration Check

While investigating, verify Azure AD is configured correctly (required for SSO):

1. Go to Azure Portal → App Registrations → find app with ID `0ac0c3a6-6482-4ff4-81a6-c2f96c506cfd`
2. Verify **Application ID URI** is set to: `api://legal-platform-gateway.onrender.com/0ac0c3a6-6482-4ff4-81a6-c2f96c506cfd`
3. Verify **Exposed API** has scope `access_as_user`
4. Verify **Authorized client applications** includes Office client IDs:
   - `ea5a67f6-b6f3-4338-b240-c655ddc3cc8e` (Office desktop)
   - `57fb890c-0dab-4253-a5e0-7188c88b2bb4` (Office Online)
   - `08e18876-6177-487e-b8b5-cf950c1e598c` (Office for web)
   - `bc59ab01-8403-45c6-8796-ac3ef710b3e3` (Outlook)

---

## Testing Requirements

After fix is implemented, verify:

1. [ ] Open document in Word Online
2. [ ] Click add-in button - panel should show loading spinner
3. [ ] Add-in should show login screen or main UI
4. [ ] Browser console should NOT have 404 errors
5. [ ] All tabs (Draft, Suggest, Explain, Improve) should work

---

## Investigation Notes

### Files Examined

| File                                       | Purpose             | Finding                                   |
| ------------------------------------------ | ------------------- | ----------------------------------------- |
| `apps/word-addin/vite.config.ts`           | Build config        | `base` path logic is correct              |
| `apps/word-addin/manifest.prod.xml`        | Office manifest     | URLs are correct, points to gateway       |
| `infrastructure/docker/Dockerfile.gateway` | Gateway build       | Builds and copies word-addin correctly    |
| `services/gateway/src/index.ts`            | Serves static files | Correctly serves `/word-addin/`           |
| Production `taskpane.html`                 | Deployed HTML       | Has CORRECT paths (`/word-addin/assets/`) |

### Key Discovery

The production gateway IS serving correct files (verified via curl). The issue is 100% a Microsoft 365/Word Online caching problem where it's loading an old version of the add-in.

---

## Handoff to Fix Phase

This investigation is complete. **No code changes required**.

Manual steps needed:

1. Increment manifest version
2. Redeploy gateway
3. Re-upload manifest to Microsoft 365 Admin Center
4. Verify Azure AD configuration

Run `/debug word-addin-blank-panel` if you need help with the manual steps or if the issue persists after cache refresh.
