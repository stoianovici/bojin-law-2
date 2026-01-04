'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Briefcase, Calendar, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { id: 'acasa', label: 'Acasa', icon: Home, href: '/m' },
  { id: 'dosare', label: 'Dosare', icon: Briefcase, href: '/m/cases' },
  { id: 'calendar', label: 'Calendar', icon: Calendar, href: '/m/calendar' },
  { id: 'cauta', label: 'Cauta', icon: Search, href: '/m/search' },
] as const;

export function BottomTabBar() {
  const pathname = usePathname();

  const getActiveTab = () => {
    if (pathname === '/m') return 'acasa';
    if (pathname.startsWith('/m/cases')) return 'dosare';
    if (pathname.startsWith('/m/calendar')) return 'calendar';
    if (pathname.startsWith('/m/search')) return 'cauta';
    return 'acasa';
  };

  const activeTab = getActiveTab();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-mobile-bg-elevated border-t border-mobile-border pb-safe">
      <div className="flex items-center justify-around h-16">
        {tabs.map(({ id, label, icon: Icon, href }) => {
          const isActive = activeTab === id;
          return (
            <Link
              key={id}
              href={href}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full',
                'transition-colors duration-150',
                isActive ? 'text-mobile-text-primary' : 'text-mobile-text-tertiary'
              )}
            >
              <Icon className="w-[22px] h-[22px] mb-1" strokeWidth={2} />
              <span className="text-[10px] font-normal">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
