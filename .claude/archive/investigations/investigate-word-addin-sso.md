# Investigation: Word Add-in SSO Login Fails in Word Online

**Slug**: word-addin-sso
**Date**: 2026-01-10
**Status**: Investigation Complete
**Severity**: High
**Next step**: `/debug word-addin-sso` to implement fix

---

## Bug Summary

**Reported symptom**: When creating a new document in the app and opening it in Word Online, clicking "Sign in with Microsoft" in the add-in does nothing.

**Reproduction steps**:

1. Create a new document in the web app
2. Click button to open in Word Online
3. Word Online opens and the add-in loads showing the login screen
4. Click "Sign in with Microsoft"
5. Nothing happens - no popup, no error visible in UI

**Expected behavior**: Either an SSO login should complete automatically, or a Microsoft login popup dialog should appear.

**Actual behavior**: Nothing happens. The button appears to do nothing. Console shows domain mismatch error.

**Frequency**: Always (100% reproducible with new documents in Word Online)

---

## Root Cause Analysis

### The Bug

**Root cause**: The Azure AD Application ID URI is misconfigured - it uses the simple format `api://0ac0c3a6-6482-4ff4-81a6-c2f96c506cfd` but Office Add-in SSO requires the domain-qualified format `api://legal-platform-gateway.onrender.com/0ac0c3a6-6482-4ff4-81a6-c2f96c506cfd`.

**Location**:

- Azure Portal: App Registration > Expose an API > Application ID URI
- `apps/word-addin/manifest.prod.xml:280` (Resource element)
- `apps/word-addin/src/services/auth.ts:232-242` (missing fallback for non-13003 errors)

**Console error**:

```
SSO Resource "api://0ac0c3a6-6482-4ff4-81a6-c2f96c506cfd" cannot be used from "https://legal-platform-gateway.onrender.com" origin due to domain mismatch.
```

**Code path**:

```
User clicks "Sign in with Microsoft"
  → login() in auth.ts:188
  → Office.auth.getAccessToken() in auth.ts:212
  → FAILS with domain mismatch (not error code 13003)
  → Caught at auth.ts:232, but NOT code 13003
  → Falls to else branch at auth.ts:237-242
  → Sets error state but doesn't show error or fall back to dialog
  → Button appears to do nothing
```

**Type**: Configuration bug + Error handling bug

### Why It Happens

The Office Add-in SSO feature requires the Azure AD Application ID URI to include the domain where the add-in is hosted. According to [Microsoft documentation](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/sso-in-office-add-ins):

> The domain part of this URI must match the domain, including any subdomains, used in the URLs in the `<Resources>` section of the add-in's manifest.

The current configuration:

- **Application ID URI in Azure AD**: `api://0ac0c3a6-6482-4ff4-81a6-c2f96c506cfd`
- **Add-in hosted at**: `https://legal-platform-gateway.onrender.com`
- **Required format**: `api://legal-platform-gateway.onrender.com/0ac0c3a6-6482-4ff4-81a6-c2f96c506cfd`

When Office.auth.getAccessToken() is called, it validates that the add-in's origin matches the domain in the Application ID URI. Since `legal-platform-gateway.onrender.com` doesn't appear in `api://0ac0c3a6-6482-4ff4-81a6-c2f96c506cfd`, the SSO request is rejected before it even reaches Azure AD.

**Secondary issue**: The error handling in `auth.ts` only falls back to dialog login when error code is 13003 (user not signed in). Other SSO errors silently fail and set an error state that isn't displayed to the user, making the button appear to do nothing.

### Why It Wasn't Caught

1. **Desktop Word may work differently**: SSO configuration requirements differ between Word Online and desktop Word
2. **Dev mode bypasses auth**: The code uses mock authentication in dev mode (`import.meta.env.DEV`), so this issue wouldn't appear during local development
3. **Silent failure**: The error is caught but not displayed to the user, making debugging difficult
4. **No integration tests**: No tests verify SSO flow in production environment

---

## Impact Assessment

**Affected functionality**:

- All Word Online users cannot use the add-in
- AI-powered document drafting, suggestions, explanations, and improvements are inaccessible in Word Online
- Users may think the add-in is broken

**Blast radius**: High - All users accessing via Word Online

**Related code**:

- `apps/word-addin/manifest.prod.xml`: Contains the SSO WebApplicationInfo configuration
- `apps/word-addin/src/services/auth.ts`: Authentication logic and fallback handling

**Risk of similar bugs**: Medium - Other Microsoft integrations may have similar configuration requirements

---

## Proposed Fix Approaches

### Option A: Fix Azure AD Configuration + Manifest (Recommended)

**Approach**: Update the Application ID URI in Azure AD and the manifest to include the domain.

**Azure Portal Changes** (manual):

1. Go to Azure Portal > Microsoft Entra ID > App Registrations
2. Select the app with ID `0ac0c3a6-6482-4ff4-81a6-c2f96c506cfd`
3. Go to "Expose an API"
4. Edit the Application ID URI from:
   - `api://0ac0c3a6-6482-4ff4-81a6-c2f96c506cfd`
   - to: `api://legal-platform-gateway.onrender.com/0ac0c3a6-6482-4ff4-81a6-c2f96c506cfd`

**Files to change**:

- `apps/word-addin/manifest.prod.xml`: Update `<Resource>` element (line 280)

```xml
<!-- Before -->
<Resource>api://0ac0c3a6-6482-4ff4-81a6-c2f96c506cfd</Resource>

<!-- After -->
<Resource>api://legal-platform-gateway.onrender.com/0ac0c3a6-6482-4ff4-81a6-c2f96c506cfd</Resource>
```

**Pros**:

- Fixes the root cause
- Enables true SSO experience (seamless login)
- Microsoft-recommended approach

**Cons**:

- Requires Azure Portal access (manual step)
- May require re-deployment of the add-in manifest

**Risk**: Low

### Option B: Improve Error Handling + Always Use Dialog Fallback

**Approach**: Make the auth code more resilient by always falling back to dialog-based login when SSO fails, regardless of error code.

**Files to change**:

- `apps/word-addin/src/services/auth.ts`: Improve error handling in login()

```typescript
// In login() function, change error handling:
} catch (error) {
  console.error('[Auth] SSO login failed:', error);
  // Always try dialog fallback for any SSO error
  try {
    await dialogLogin();
  } catch (dialogError) {
    authState = {
      ...authState,
      loading: false,
      error: 'Login failed. Please try again.',
    };
  }
}
```

**Pros**:

- Works without Azure Portal changes
- Provides fallback for any future SSO issues
- Better user experience (always has a path to login)

**Cons**:

- Doesn't enable true SSO (users always see dialog)
- Masks underlying configuration issues
- Dialog may have additional requirements/issues

**Risk**: Medium

### Recommendation

**Use Option A (Azure AD + Manifest fix) as the primary fix**, combined with improved error handling from Option B as a safety net.

The Azure AD configuration must be fixed for proper SSO to work. However, adding robust fallback handling ensures users can still log in even if SSO encounters unexpected issues.

---

## Testing Requirements

After fix is implemented, verify:

1. [ ] Original bug no longer reproduces - clicking login in Word Online works
2. [ ] SSO works silently when user is already signed into Microsoft 365
3. [ ] Dialog fallback works when SSO is unavailable
4. [ ] Desktop Word still works correctly
5. [ ] Error messages are displayed when login truly fails

### Manual Test Steps

1. Create new document in web app
2. Open in Word Online
3. Verify add-in loads
4. Click "Sign in with Microsoft"
5. Verify either:
   - SSO logs in automatically (if user is signed into M365)
   - Microsoft login dialog appears
6. Complete login
7. Verify add-in shows authenticated state

---

## Investigation Notes

### Files Examined

| File                                        | Purpose             | Relevant Finding                                                       |
| ------------------------------------------- | ------------------- | ---------------------------------------------------------------------- |
| `apps/word-addin/src/services/auth.ts`      | Auth logic          | SSO uses `Office.auth.getAccessToken()`, fallback only for error 13003 |
| `apps/word-addin/src/taskpane/TaskPane.tsx` | Main UI             | Calls `login()` on button click                                        |
| `apps/word-addin/manifest.prod.xml`         | Production manifest | SSO configured with simple URI format                                  |
| `apps/word-addin/vite.config.ts`            | Build config        | Production base path is `/word-addin/`                                 |

### Git History

Recent relevant commits:

- `c190647` fix(word-addin): correct auth endpoint paths
- `5453258` fix(word-addin): add Azure AD client ID to production build
- `15f3af5` feat(word-addin): add Word Online support to manifests

### Questions Answered During Investigation

- Q: What happens when you click login?
- A: `Office.auth.getAccessToken()` is called, fails with domain mismatch, error is caught but not displayed

- Q: Why does nothing happen?
- A: The domain mismatch error isn't code 13003, so it falls into the else branch that sets error state but doesn't trigger dialog fallback or show error to user

### References

- [Enable SSO in Office Add-ins](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/sso-in-office-add-ins)
- [Register SSO Add-in with Azure AD](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/register-sso-add-in-aad-v2)

---

## Handoff to Fix Phase

This investigation is complete. To implement the fix:

```
/debug word-addin-sso
```

The debug phase will:

1. Read this investigation document
2. Guide through Azure Portal changes (manual)
3. Update the manifest.prod.xml
4. Optionally improve error handling in auth.ts
5. Test and verify the fix
