/**
 * Settings Page - Redirect
 * Redirects to new /setari page with appropriate section
 * OPS-364: Settings Page Migration
 */

import { redirect } from 'next/navigation';

export default function SettingsPage() {
  // Redirect to new settings page with billing section
  redirect('/setari?section=billing');
}
