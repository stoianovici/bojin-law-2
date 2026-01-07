'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Scale, FileText, CheckSquare, Mail } from 'lucide-react';
import { clsx } from 'clsx';

const tabs = [
  { id: 'cases', label: 'Dosare', href: '/cases', icon: Scale },
  { id: 'documents', label: 'Documente', href: '/documents', icon: FileText },
  { id: 'tasks', label: 'Sarcini', href: '/tasks', icon: CheckSquare },
  { id: 'communications', label: 'Mesaje', href: '/communications', icon: Mail },
];

export function MobileTabBar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname?.startsWith(href);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-linear-bg-secondary border-t border-linear-border-subtle"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={clsx(
                'flex flex-col items-center justify-center flex-1 h-full min-w-[64px] py-1',
                'transition-colors duration-150',
                'active:scale-95',
                active
                  ? 'text-linear-accent'
                  : 'text-linear-text-tertiary hover:text-linear-text-secondary'
              )}
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs mt-0.5 font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
