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
import { useNavigationStore } from '@/stores/navigation.store';
import { QuickActions } from './QuickActions';
import type { NavigationItem, NavigationSection } from '@legal-platform/types';

/**
 * Navigation items configuration
 * Icons are simple emoji placeholders - will be replaced with proper icon library
 */
const navigationItems: NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: '📊',
    href: '/',
    section: 'dashboard',
    roles: ['Partner', 'Associate', 'Paralegal'],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: '📈',
    href: '/analytics',
    section: 'analytics',
    roles: ['Partner'], // Partner only
  },
  {
    id: 'cases',
    label: 'Cazuri',
    icon: '⚖️',
    href: '/cases',
    section: 'cases',
    roles: ['Partner', 'Associate', 'Paralegal'],
  },
  {
    id: 'documents',
    label: 'Documente',
    icon: '📄',
    href: '/documents',
    section: 'documents',
    roles: ['Partner', 'Associate', 'Paralegal'],
  },
  {
    id: 'tasks',
    label: 'Sarcini',
    icon: '✓',
    href: '/tasks',
    section: 'tasks',
    roles: ['Partner', 'Associate', 'Paralegal'],
  },
  {
    id: 'communications',
    label: 'Comunicări',
    icon: '✉️',
    href: '/communications',
    section: 'communications',
    roles: ['Partner', 'Associate', 'Paralegal'],
  },
  {
    id: 'time-tracking',
    label: 'Pontaj',
    icon: '⏱️',
    href: '/time-tracking',
    section: 'time-tracking',
    roles: ['Partner', 'Associate', 'Paralegal'],
  },
  {
    id: 'reports',
    label: 'Rapoarte',
    icon: '📈',
    href: '/reports',
    section: 'reports',
    roles: ['Partner', 'Associate'],
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
  const {
    currentRole,
    currentSection,
    isSidebarCollapsed,
    setCurrentSection,
  } = useNavigationStore();

  // Filter navigation items by current role
  const visibleItems = navigationItems.filter((item) =>
    item.roles.includes(currentRole)
  );

  // Determine if a navigation item is active
  const isActive = (item: NavigationItem): boolean => {
    if (item.href === '/' && pathname === '/') return true;
    if (item.href !== '/' && pathname.startsWith(item.href)) return true;
    return item.section === currentSection;
  };

  // Handle navigation item click
  const handleItemClick = (section: NavigationSection) => {
    setCurrentSection(section);
  };

  return (
    <aside
      className={`
        ${className}
        flex flex-col
        bg-white border-r border-gray-200
        transition-all duration-300 ease-in-out
        ${isSidebarCollapsed ? 'w-16' : 'w-64'}
        h-screen sticky top-0
        overflow-y-auto
      `}
      aria-label="Main navigation"
    >
      <div className="flex-1 p-4">
        <NavigationMenu.Root
          orientation="vertical"
          className="flex flex-col gap-2"
        >
          <NavigationMenu.List className="flex flex-col gap-2">
            {visibleItems.map((item) => {
              const active = isActive(item);
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
                      <span
                        className="text-xl flex-shrink-0"
                        aria-hidden="true"
                      >
                        {item.icon}
                      </span>
                      {!isSidebarCollapsed && (
                        <span className="truncate">{item.label}</span>
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
  );
}
