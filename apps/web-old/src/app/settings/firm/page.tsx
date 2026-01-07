/**
 * Firm Settings Page - Redirect
 * OPS-364: Redirects to new /setari page
 */

import { redirect } from 'next/navigation';

export default function FirmSettingsPage() {
  redirect('/setari?section=firm');
}
