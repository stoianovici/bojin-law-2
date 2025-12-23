/**
 * Firm Settings Page - Redirect
 * OPS-028: Now part of unified Settings page
 */

import { redirect } from 'next/navigation';

export default function FirmSettingsPage() {
  redirect('/settings/billing?tab=firm');
}
