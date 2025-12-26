/**
 * AI Ops Admin Layout
 * OPS-242: AI Ops Dashboard Layout & Overview
 *
 * Provides Partner-only admin layout with sidebar navigation for AI operations.
 */

'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  ToggleLeft,
  DollarSign,
  History,
  PiggyBank,
  ChevronLeft,
  type LucideIcon,
} from 'lucide-react';

// ============================================================================
// Navigation Configuration
// ============================================================================

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { href: '/admin/ai-ops', label: 'Prezentare generală', icon: LayoutDashboard },
  { href: '/admin/ai-ops/features', label: 'Funcționalități', icon: ToggleLeft },
  { href: '/admin/ai-ops/costs', label: 'Costuri', icon: DollarSign },
  { href: '/admin/ai-ops/history', label: 'Istoric', icon: History },
  { href: '/admin/ai-ops/budget', label: 'Buget', icon: PiggyBank },
];

// ============================================================================
// Admin Sidebar Component
// ============================================================================

function AdminSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/admin/ai-ops') {
      return pathname === '/admin/ai-ops';
    }
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <Link
          href="/"
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="text-sm">Înapoi la aplicație</span>
        </Link>
      </div>

      {/* Title */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Operațiuni AI</h2>
        <p className="text-sm text-gray-500 mt-1">Monitorizare și configurare</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`
                    flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                    transition-colors duration-150
                    ${
                      active
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <p className="text-xs text-gray-400">Doar pentru Parteneri</p>
      </div>
    </aside>
  );
}

// ============================================================================
// Layout Component
// ============================================================================

export default function AIAdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // Redirect non-Partners
  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'Partner')) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  // Don't render if not authorized (redirect will happen)
  if (!user || user.role !== 'Partner') {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
