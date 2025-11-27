'use client';

/**
 * Login Page for Legacy Import App
 * Displays Azure AD login option for Partners and Assistants
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Shield, Users, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const { login, isAuthenticated, isLoading, error, clearError } = useAuth();
  const router = useRouter();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  const handleLogin = async () => {
    clearError();
    await login();
  };

  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Se verifică autentificarea...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-md">
        {/* Login Card */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Import Documente Vechi
            </h1>
            <p className="text-gray-600">
              Autentifică-te cu contul Microsoft pentru a accesa categorizarea documentelor
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Login Button */}
          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Se autentifică...
              </>
            ) : (
              <>
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 21 21"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                  <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                  <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                  <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
                </svg>
                Autentificare cu Microsoft
              </>
            )}
          </button>

          {/* Features */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
              Ce poți face:
            </h2>
            <ul className="space-y-3 text-sm text-gray-600">
              <li className="flex items-start gap-3">
                <Users className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Parteneri:</strong> Încarcă fișiere PST, unifică categorii, exportă în OneDrive
                </span>
              </li>
              <li className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Asistenți:</strong> Categorizează documente în loturile atribuite
                </span>
              </li>
              <li className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-purple-500 flex-shrink-0 mt-0.5" />
                <span>
                  Gestionare securizată cu curățare automată după export
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-6">
          Folosește contul Microsoft 365 al firmei pentru a te autentifica.
          <br />
          Contactează partenerul tău dacă nu ai acces.
        </p>
      </div>
    </div>
  );
}
