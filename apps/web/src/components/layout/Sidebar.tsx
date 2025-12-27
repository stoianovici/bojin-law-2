/**
 * Sidebar Navigation Component
 * Provides main navigation with collapse/expand functionality
 * Supports Romanian diacritics and responsive behavior
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as NavigationMenu from '@radix-ui/react-navigation-menu';
// TODO: Revert to @ alias when Next.js/Turbopack path resolution is fixed
import { useNavigationStore } from '../../stores/navigation.store';
import { usePendingCases } from '../../hooks/usePendingCases';
import { useAuth } from '../../contexts/AuthContext';
import { QuickActions } from './QuickActions';
import type { NavigationItem, NavigationSection } from '@legal-platform/types';
import {
  LayoutDashboard,
  TrendingUp,
  Scale,
  FileText,
  CheckSquare,
  Mail,
  Clock,
  Users,
  Briefcase,
  UserCog,
  type LucideIcon,
} from 'lucide-react';

/**
 * Icon mapping for navigation items
 */
const iconMap: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  analytics: TrendingUp,
  cases: Scale,
  'my-cases': Briefcase,
  documents: FileText,
  tasks: CheckSquare,
  communications: Mail,
  'time-tracking': Clock,
  'team-activity': UserCog,
  'user-management': Users,
};

/**
 * Navigation items configuration with Lucide React icons
 */
const navigationItems: NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Tablou de Bord',
    icon: 'dashboard',
    href: '/',
    section: 'dashboard',
    roles: ['Partner', 'Associate', 'Paralegal'],
  },
  {
    id: 'analytics',
    label: 'Analiză',
    icon: 'analytics',
    href: '/analytics',
    section: 'analytics',
    roles: ['Partner', 'BusinessOwner'], // Partners and BusinessOwners - Story 2.11.4
  },
  {
    id: 'cases',
    label: 'Cazuri',
    icon: 'cases',
    href: '/cases',
    section: 'cases',
    roles: ['Partner', 'Paralegal'],
  },
  {
    id: 'my-cases',
    label: 'Cazurile Mele',
    icon: 'my-cases',
    href: '/cases/my-cases',
    section: 'cases',
    roles: ['Associate'], // Associates only - Story 2.8.2 Task 22
  },
  {
    id: 'documents',
    label: 'Documente',
    icon: 'documents',
    href: '/documents',
    section: 'documents',
    roles: ['Partner', 'Associate', 'Paralegal'],
  },
  {
    id: 'tasks',
    label: 'Sarcini',
    icon: 'tasks',
    href: '/tasks',
    section: 'tasks',
    roles: ['Partner', 'Associate', 'Paralegal'],
  },
  {
    id: 'communications',
    label: 'Comunicări',
    icon: 'communications',
    href: '/communications',
    section: 'communications',
    roles: ['Partner', 'Associate', 'Paralegal'],
  },
  {
    id: 'time-tracking',
    label: 'Pontaj',
    icon: 'time-tracking',
    href: '/time-tracking',
    section: 'time-tracking',
    roles: ['Partner', 'Associate', 'Paralegal'],
  },
  {
    id: 'team-activity',
    label: 'Activitate Echipă',
    icon: 'team-activity',
    href: '/activitate-echipa',
    section: 'team-activity',
    roles: ['Partner', 'BusinessOwner'], // OPS-271: Partners and BusinessOwners only
  },
];

export interface SidebarProps {
  /**
   * Optional CSS class name
   */
  className?: string;
}

/**
 * Sidebar component with navigation items
 * Features:
 * - Collapse/expand functionality
 * - Active state highlighting
 * - Responsive behavior
 * - Role-based item filtering
 * - Romanian diacritic support
 */
export function Sidebar({ className = '' }: SidebarProps) {
  const pathname = usePathname();
  const { currentSection, isSidebarCollapsed, setCurrentSection, toggleSidebar } =
    useNavigationStore();

  // Get the actual authenticated user's role for menu filtering
  const { user } = useAuth();
  const userRole = user?.role || 'Associate'; // Default to Associate (most restrictive) if not authenticated

  // Story 2.8.2 Task 22: Fetch pending cases count for badge (Partners only)
  // Always call hook (hooks must be unconditional), but skip query for non-Partners
  const skipPendingQuery = userRole !== 'Partner';
  const { cases: pendingCases = [] } = usePendingCases(skipPendingQuery);
  const pendingCount = pendingCases.length;

  // Filter navigation items by authenticated user's role (OPS-014)
  const visibleItems = navigationItems.filter((item) => item.roles.includes(userRole));

  // Determine if a navigation item is active
  const isActive = (item: NavigationItem): boolean => {
    if (item.href === '/' && pathname === '/') return true;
    if (item.href !== '/' && pathname.startsWith(item.href)) return true;
    return item.section === currentSection;
  };

  // Handle navigation item click
  const handleItemClick = (section: NavigationSection) => {
    setCurrentSection(section);
    // Auto-collapse sidebar when item is selected (if currently expanded)
    if (!isSidebarCollapsed) {
      toggleSidebar();
    }
  };

  return (
    <>
      {/* Backdrop overlay when sidebar is expanded */}
      {!isSidebarCollapsed && (
        <div
          className="fixed inset-0 bg-black/20 z-[55] transition-opacity duration-300"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          ${className}
          flex flex-col
          bg-white border-r border-gray-200
          transition-all duration-300 ease-in-out
          ${isSidebarCollapsed ? 'w-16' : 'w-64'}
          h-screen fixed top-0 left-0 z-[60]
          overflow-y-auto
        `}
        aria-label="Main navigation"
      >
        <div className="flex-1 p-4">
          <NavigationMenu.Root orientation="vertical" className="flex flex-col gap-2">
            <NavigationMenu.List className="flex flex-col gap-2">
              {visibleItems.map((item) => {
                const active = isActive(item);
                const IconComponent = iconMap[item.icon];
                return (
                  <NavigationMenu.Item key={item.id} value={item.id}>
                    <NavigationMenu.Link asChild>
                      <Link
                        href={item.href}
                        onClick={() => handleItemClick(item.section)}
                        data-active={active}
                        className={`
                        flex items-center gap-3 px-3 py-2 rounded-lg
                        transition-colors duration-200
                        ${
                          active
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'text-gray-700 hover:bg-gray-100'
                        }
                        ${isSidebarCollapsed ? 'justify-center' : ''}
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                      `}
                        aria-current={active ? 'page' : undefined}
                        title={isSidebarCollapsed ? item.label : undefined}
                      >
                        {IconComponent && (
                          <IconComponent className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                        )}
                        {!isSidebarCollapsed && (
                          <span className="truncate flex-1">{item.label}</span>
                        )}
                        {/* Show badge count for pending approvals on Cases link for Partners */}
                        {item.id === 'cases' &&
                          userRole === 'Partner' &&
                          pendingCount > 0 &&
                          !isSidebarCollapsed && (
                            <span className="ml-auto bg-blue-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                              {pendingCount}
                            </span>
                          )}
                      </Link>
                    </NavigationMenu.Link>
                  </NavigationMenu.Item>
                );
              })}
            </NavigationMenu.List>
          </NavigationMenu.Root>
        </div>

        {/* Quick Actions */}
        {!isSidebarCollapsed && (
          <div className="border-t border-gray-200 pb-4">
            <QuickActions mode="sidebar" />
          </div>
        )}
      </aside>
    </>
  );
}
