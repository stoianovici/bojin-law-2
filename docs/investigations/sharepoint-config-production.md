# Investigation: SharePoint Document Creation Failure in Production

**Date:** 2025-01-10
**Symptom:** `SharePoint not configured. Set SHAREPOINT_SITE_ID and SHAREPOINT_DRIVE_ID environment variables.`
**Status:** Investigation complete - Configuration issue

---

## Summary

Document creation in production fails because **SharePoint environment variables are missing from the Render deployment**. These variables are NOT documented in `render.yaml` and must be manually set in the Render dashboard.

---

## Root Cause

The `render.yaml` file does NOT include `SHAREPOINT_SITE_ID` or `SHAREPOINT_DRIVE_ID` for the gateway service (lines 73-129). These variables need to be manually added in the Render dashboard.

**Error source:** `services/gateway/src/services/sharepoint.service.ts:144-153`

---

## Fix Required

### Step 1: Add to Render Dashboard

Go to Render Dashboard → `legal-platform-gateway` → Environment → Add:

```
SHAREPOINT_SITE_ID=<your-site-id>
SHAREPOINT_DRIVE_ID=<your-drive-id>
```

### Step 2: Get the Values (if you don't have them)

Use Microsoft Graph Explorer (https://developer.microsoft.com/graph/graph-explorer):

1. **Get SHAREPOINT_SITE_ID:**

   ```
   GET https://graph.microsoft.com/v1.0/sites/bojinlucian.sharepoint.com:/sites/<site-name>
   ```

   Copy the `id` field (format: `hostname,site-guid,web-guid`)

2. **Get SHAREPOINT_DRIVE_ID:**
   ```
   GET https://graph.microsoft.com/v1.0/sites/{site-id}/drive
   ```
   Copy the `id` field (format: `b!xxxxxxxxxxxx`)

### Step 3: Redeploy Gateway

After adding the environment variables, manually redeploy the gateway service.

---

## Why It Stopped Working

Possible causes:

1. Environment variables were accidentally deleted from Render dashboard
2. Service was recreated without copying over custom env vars
3. Variables were never added (feature was tested locally only)

**Note:** Since `render.yaml` marks these as NOT synced (`sync: false` entries are missing entirely), they must be managed manually in the Render dashboard. There's no backup in the codebase.

---

## Recommendation: Add to render.yaml

To prevent this in the future, add documentation to `render.yaml` under gateway envVars:

```yaml
# SharePoint Configuration (set in Render dashboard)
- key: SHAREPOINT_SITE_ID
  sync: false
- key: SHAREPOINT_DRIVE_ID
  sync: false
```

This serves as documentation that these variables exist and need to be set manually.

---

## Affected Features

All document operations are blocked:

- Document upload to SharePoint
- Document download/preview
- Email attachment sync
- Document templates
