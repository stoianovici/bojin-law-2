/**
 * Personalization Page - Redirect
 * Story 5.6: Now part of unified Settings page
 */

import { redirect } from 'next/navigation';

export default function PersonalizationPage() {
  redirect('/settings/billing?tab=ai');
}
