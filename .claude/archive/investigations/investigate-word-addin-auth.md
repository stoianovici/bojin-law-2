# Investigation: Word Add-in Authentication Broken

**Slug**: word-addin-auth
**Date**: 2026-01-18
**Status**: Investigation Complete
**Severity**: Critical
**Next step**: `/debug word-addin-auth` to implement fix

---

## Bug Summary

**Reported symptom**: Word Add-in authentication doesn't work in Word Online with staging and prod manifests. Previously reverted to Jan 11th solution which worked, then broke again without apparent code changes.

**Reproduction steps**:

1. Load Word Online
2. Sideload the staging or prod manifest
3. Click "Bojin AI" button to open taskpane
4. Click "Login" button
5. Authentication fails

**Expected behavior**: User authenticates and sees their account info
**Actual behavior**: Authentication fails (exact error unknown - needs verification)
**Frequency**: Always

---

## Root Cause Analysis

### The Bug

**Root cause**: Domain migration broke Office SSO configuration. The manifest's `WebApplicationInfo.Resource` now specifies `api://dev.bojin-law.com/...` or `api://api.bojin-law.com/...`, but Azure AD app registration likely still has Application ID URI set to `api://legal-platform-gateway.onrender.com/...`.

**Location**: Azure AD App Registration (portal.azure.com) + `manifest.staging.xml:116` + `manifest.prod.xml:117`

**Code path**:

```
User clicks Login → auth.ts login() → MSAL loginPopup() → Azure AD → Token request fails
```

OR (for Office SSO approach):

```
User clicks Login → auth.ts login() → Office.auth.getAccessToken() → Azure AD validates Resource URI → Mismatch → Error 13004 (Invalid Resource)
```

**Type**: Configuration/Environment bug

### Timeline of Changes

| Date   | Commit        | What Changed                                                            |
| ------ | ------------- | ----------------------------------------------------------------------- |
| Jan 11 | `88d2c04`     | Office SSO working with `api://legal-platform-gateway.onrender.com/...` |
| Jan 17 | `c62baa4`     | Domain migrated to `bojin-law.com` - manifest Resource changed          |
| Jan 17 | `88cf696`     | Attempted Office Dialog API approach                                    |
| Jan 17 | `bf48c88`     | Attempted browser popup + server-side token storage                     |
| Jan 18 | (uncommitted) | Reverted to simple MSAL popup                                           |

### Why It Happens

1. **On Jan 11th**: The working solution used **Office SSO** (`Office.auth.getAccessToken()`) with manifest Resource URI `api://legal-platform-gateway.onrender.com/0ac0c3a6-6482-4ff4-81a6-c2f96c506cfd`. Azure AD was configured with this Application ID URI.

2. **On Jan 17th**: Domain migration (`c62baa4`) changed manifest Resource to:
   - Staging: `api://dev.bojin-law.com/0ac0c3a6-6482-4ff4-81a6-c2f96c506cfd`
   - Prod: `api://api.bojin-law.com/0ac0c3a6-6482-4ff4-81a6-c2f96c506cfd`

3. **But**: Azure AD app registration was NOT updated to add these as valid Application ID URIs.

4. **Result**: When Office SSO requests a token for `api://dev.bojin-law.com/...`, Azure AD doesn't recognize it and returns an error (likely 13004 "Invalid Resource").

5. **The "revert"**: The current uncommitted code uses MSAL `loginPopup` instead of Office SSO. This bypasses the Resource URI check BUT:
   - MSAL popup is blocked/unreliable in Word Online iframes
   - The redirect URI may also be misconfigured for the new domains

### Why It Wasn't Caught

- Domain migration was done without updating Azure AD app registration
- No verification step after manifest changes
- Office SSO error messages are vague (13xxx codes) and not immediately obvious

---

## Impact Assessment

**Affected functionality**:

- All Word Add-in authentication (staging + prod)
- Users cannot use any AI features in Word

**Blast radius**: Complete - All Word Add-in users affected

**Related code**:

- `apps/word-addin/manifest.staging.xml`: WebApplicationInfo section
- `apps/word-addin/manifest.prod.xml`: WebApplicationInfo section
- `apps/word-addin/src/services/auth.ts`: Auth logic (currently broken with MSAL popup approach)

**Risk of similar bugs**: High - Any domain/URL changes require Azure AD app registration updates

---

## Proposed Fix Approaches

### Option A: Update Azure AD App Registration (Recommended)

**Approach**: Update the Azure AD app registration to add the new domain(s) as valid Application ID URIs.

**Steps**:

1. Go to Azure Portal → App Registrations → `0ac0c3a6-6482-4ff4-81a6-c2f96c506cfd`
2. Go to "Expose an API" section
3. Add new Application ID URIs:
   - `api://dev.bojin-law.com/0ac0c3a6-6482-4ff4-81a6-c2f96c506cfd`
   - `api://api.bojin-law.com/0ac0c3a6-6482-4ff4-81a6-c2f96c506cfd`
4. Verify `access_as_user` scope exists
5. Verify Office apps are pre-authorized:
   - `ea5a67f6-b6f3-4338-b240-c655ddc3cc8e` (all Office apps)
   - `93d53678-613d-4013-afc1-62e9e444a0a5` (Office on the web)
6. Revert `auth.ts` to the Office SSO approach from commit `88d2c04`

**Files to change**:

- `apps/word-addin/src/services/auth.ts`: Revert to Office SSO approach

**Pros**:

- Uses official Microsoft-recommended SSO approach
- No popups needed - seamless authentication
- Works reliably across all Office platforms

**Cons**:

- Requires Azure Portal access
- Need to update both staging and prod Application ID URIs

**Risk**: Low (configuration change, well-documented process)

### Option B: Fix MSAL Popup for Word Online

**Approach**: Make MSAL popup work in Word Online's iframe environment.

**Challenges**:

1. Popups are blocked in iframes
2. Cross-origin issues with redirect URIs
3. Need to handle `postMessage` communication

**Files to change**:

- `apps/word-addin/src/services/auth.ts`: Complex popup handling
- Potentially server-side token exchange endpoints

**Pros**:

- Doesn't require Azure Portal changes

**Cons**:

- Much more complex implementation
- Inherently unreliable in iframe environments
- Microsoft recommends Office SSO for add-ins, not MSAL popup

**Risk**: High (complex, unreliable)

### Option C: Use Auth Code Flow with Backend

**Approach**: Implement OAuth auth code flow where:

1. Add-in opens external browser window
2. User authenticates in browser
3. Backend receives code and exchanges for tokens
4. Add-in polls backend for tokens

**Pros**:

- Works around iframe restrictions
- Full control over auth flow

**Cons**:

- Most complex to implement
- Requires backend token storage
- Worse UX (external browser window)

**Risk**: Medium-High (complex implementation)

### Recommendation

**Option A is strongly recommended.** Office SSO is the Microsoft-recommended approach for Office Add-ins. The Jan 11th solution was working - we just need to update Azure AD to recognize the new domain(s).

The fix is purely a configuration change in Azure Portal, not a code change.

---

## Testing Requirements

After fix is implemented, verify:

1. [ ] Office SSO works in Word Online with staging manifest (`dev.bojin-law.com`)
2. [ ] Office SSO works in Word Online with prod manifest (`api.bojin-law.com`)
3. [ ] Office SSO works in Word Desktop (if available)
4. [ ] Token contains correct user info (id, email, name)
5. [ ] API calls work with the Office SSO token

### Verification Steps

1. In Word Online, sideload the staging manifest
2. Open the add-in taskpane
3. Check browser console for `[Auth]` log messages
4. Verify no 13xxx error codes appear
5. User info should display without clicking "Login" (auto-SSO)

---

## Investigation Notes

### Files Examined

| File                                   | Purpose          | Relevant Finding                                                         |
| -------------------------------------- | ---------------- | ------------------------------------------------------------------------ |
| `apps/word-addin/src/services/auth.ts` | Auth logic       | Current version uses broken MSAL popup; Jan 11th version used Office SSO |
| `apps/word-addin/manifest.staging.xml` | Staging manifest | Uses `api://dev.bojin-law.com/...` Resource URI                          |
| `apps/word-addin/manifest.prod.xml`    | Prod manifest    | Uses `api://api.bojin-law.com/...` Resource URI                          |
| Git history                            | Change timeline  | Domain migration on Jan 17 changed Resource URIs                         |

### Git History

Key commits:

- `88d2c04` (Jan 11): Working Office SSO with old domain
- `c62baa4` (Jan 17): Domain migration - broke SSO
- `88cf696`, `bf48c88` (Jan 17): Failed attempts to fix with other approaches

### Azure AD Requirements for Office SSO

From Microsoft docs:

1. Application ID URI must be `api://{domain}/{client-id}`
2. Must add `access_as_user` scope
3. Must pre-authorize Office app client IDs:
   - `ea5a67f6-b6f3-4338-b240-c655ddc3cc8e` (all Office apps)
   - `93d53678-613d-4013-afc1-62e9e444a0a5` (Office on the web)

### Questions Answered During Investigation

- Q: Why did it work on Jan 11th then break?
- A: Domain migration on Jan 17 changed manifest Resource URIs without updating Azure AD

- Q: Why doesn't MSAL popup work in Word Online?
- A: Word Online loads add-ins in iframes; popups are blocked/unreliable in iframes

---

## Handoff to Fix Phase

This investigation is complete. To implement the fix:

```
/debug word-addin-auth
```

The fix requires:

1. **Azure Portal changes** (user must do this):
   - Add new Application ID URIs for both domains
   - Verify scope and pre-authorized clients

2. **Code changes** (if reverting to Office SSO):
   - Revert `auth.ts` to the Office SSO approach from commit `88d2c04`
   - Discard uncommitted changes

---

## Sources

- [Troubleshoot SSO in Office Add-ins](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/troubleshoot-sso-in-office-add-ins)
- [Enable SSO in Office Add-ins](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/sso-in-office-add-ins)
- [Register SSO Add-in with Azure AD](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/register-sso-add-in-aad-v2)
