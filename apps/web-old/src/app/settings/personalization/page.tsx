/**
 * Personalization Page - Redirect
 * OPS-364: Redirects to new /setari page
 */

import { redirect } from 'next/navigation';

export default function PersonalizationPage() {
  redirect('/setari?section=profile');
}
