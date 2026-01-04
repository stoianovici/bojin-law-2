/**
 * 403 Forbidden Page
 * Shown when user attempts to access a resource they don't have permission for
 * Story 2.4.1: Partner User Management
 */

'use client';

import Link from 'next/link';

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <h1 className="text-6xl font-bold text-gray-900 mb-2">403</h1>
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">Acces Interzis</h2>
          <p className="text-gray-600">
            Nu aveți permisiunea de a accesa această resursă. Vă rugăm să contactați administratorul
            dacă credeți că aceasta este o eroare.
          </p>
        </div>
        <Link
          href="/"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Înapoi la Tablou de Bord
        </Link>
      </div>
    </div>
  );
}
