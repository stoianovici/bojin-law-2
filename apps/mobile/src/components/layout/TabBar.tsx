'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { clsx } from 'clsx';
import { Home, Briefcase, CheckSquare, Calendar, Search, type LucideIcon } from 'lucide-react';

// ============================================
// Types
// ============================================

interface TabItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Match exact path or prefix */
  exact?: boolean;
}

interface TabBarProps {
  className?: string;
}

// ============================================
// Tab Configuration
// ============================================

const tabs: TabItem[] = [
  { href: '/', label: 'Acasă', icon: Home, exact: true },
  { href: '/cases', label: 'Dosare', icon: Briefcase },
  { href: '/tasks', label: 'Sarcini', icon: CheckSquare },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/search', label: 'Căutare', icon: Search },
];

// ============================================
// Component
// ============================================

export function TabBar({ className }: TabBarProps) {
  const pathname = usePathname();

  const isActive = (tab: TabItem) => {
    if (tab.exact) {
      return pathname === tab.href;
    }
    return pathname.startsWith(tab.href);
  };

  return (
    <nav
      className={clsx(
        'fixed bottom-0 left-0 right-0 z-50',
        'bg-bg-elevated/95 backdrop-blur-md',
        'border-t border-border-subtle',
        className
      )}
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => {
          const active = isActive(tab);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={clsx(
                'flex flex-col items-center justify-center',
                'w-full h-full',
                'transition-colors duration-150',
                active ? 'text-accent' : 'text-text-tertiary',
                !active && 'active:text-text-secondary'
              )}
            >
              <Icon className={clsx('w-6 h-6', active && 'stroke-[2.5]')} />
              <span className="text-2xs mt-0.5 font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// ============================================
// TabBar Spacer
// ============================================

export function TabBarSpacer() {
  return (
    <div
      className="shrink-0"
      style={{
        height: 'calc(56px + env(safe-area-inset-bottom))',
      }}
      aria-hidden="true"
    />
  );
}
