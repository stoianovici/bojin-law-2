# Archived Scripts

This directory contains one-time repair scripts that were created to fix specific incidents.
These scripts are archived for reference but should not be run again.

## Scripts

### repair-solaria-links.ts

**Created:** 2026-02-04
**Purpose:** Repair missing EmailCaseLink entries for emails that had `caseId` set but no corresponding link records.

**Background:** After implementing the EmailCaseLink system for multi-case email support, some older emails had only the legacy `Email.caseId` field populated without corresponding `EmailCaseLink` records. This script created the missing links using AI routing to determine the correct case for emails involving the Solaria contact.

**Status:** Completed. All missing links were created.

### repair-wrong-reference-links.ts

**Created:** 2026-02-04
**Purpose:** Fix emails that were linked to the wrong case despite containing a reference number that pointed to a different case.

**Background:** Some emails containing court reference numbers (e.g., "5296/30/2025") were incorrectly routed due to thread continuity overriding the reference number signal. This script identified emails where the reference number pointed to a different case than what they were linked to, and corrected the links.

**Status:** Completed. This issue is now prevented by the updated classification logic where reference numbers take priority over thread continuity.

## Note

These scripts were specific to the Solaria contact case data. For general data integrity maintenance, use:

- `sync-email-caseids.ts` - Sync Email.caseId with primary EmailCaseLink (can be run periodically)

The underlying issues that required these scripts have been fixed:

1. Database trigger now automatically syncs `Email.caseId` with primary `EmailCaseLink`
2. Reference number matching now takes priority over thread continuity in classification
