'use client';

/**
 * Header Component with User Display and Logout
 */

import { LogOut, User, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePathname } from 'next/navigation';

export function Header() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const pathname = usePathname();

  // Don't show user info on login page
  const isLoginPage = pathname === '/login';

  const handleLogout = async () => {
    await logout();
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <svg
            className="h-8 w-8 text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Import Documente Vechi</h1>
            <p className="text-sm text-gray-500">Pregătirea datelor pentru antrenament AI</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Se încarcă...</span>
            </div>
          ) : isAuthenticated && user && !isLoginPage ? (
            <div className="flex items-center gap-4">
              {/* User Info */}
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600">
                  <User className="h-4 w-4" />
                </div>
                <div className="text-sm">
                  <p className="font-medium text-gray-900">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-gray-500 text-xs">{user.role}</p>
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Deconectare
              </button>
            </div>
          ) : !isLoginPage ? (
            <span className="text-sm text-gray-600">Portal Partener</span>
          ) : null}
        </div>
      </div>
    </header>
  );
}
