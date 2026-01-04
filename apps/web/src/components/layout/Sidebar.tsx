'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Briefcase,
  FileText,
  CheckSquare,
  Mail,
  Clock,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Settings,
  LayoutTemplate,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store/uiStore';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, Tooltip, TooltipContent, TooltipTrigger, Separator } from '@/components/ui';

const navItems = [
  { href: '/', label: 'Acasă', icon: Home },
  { href: '/cases', label: 'Cazuri', icon: Briefcase },
  { href: '/documents', label: 'Documente', icon: FileText },
  { href: '/tasks', label: 'Sarcini', icon: CheckSquare },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/email', label: 'Email', icon: Mail },
  { href: '/time', label: 'Pontaj', icon: Clock },
];

const adminItems = [{ href: '/admin/templates', label: 'Șabloane', icon: LayoutTemplate }];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, collapseSidebar } = useUIStore();
  const { user } = useAuth();

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center px-4 border-b border-linear-border-subtle">
        {!sidebarCollapsed && (
          <span className="text-linear-lg font-normal tracking-tight text-linear-text-primary">
            Legal Platform
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 pt-3">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

          const link = (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-linear-sm font-normal transition-colors',
                isActive
                  ? 'bg-linear-accent/15 text-linear-accent border-l-2 border-linear-accent -ml-0.5'
                  : 'text-linear-text-secondary hover:bg-linear-bg-tertiary hover:text-linear-text-primary'
              )}
            >
              <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </Link>
          );

          if (sidebarCollapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          }

          return link;
        })}

        {/* Settings - at the end of main nav */}
        {(() => {
          const isSettingsActive = pathname.startsWith('/settings');
          const settingsLink = (
            <Link
              href="/settings"
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-linear-sm font-normal transition-colors',
                isSettingsActive
                  ? 'bg-linear-accent/15 text-linear-accent border-l-2 border-linear-accent -ml-0.5'
                  : 'text-linear-text-secondary hover:bg-linear-bg-tertiary hover:text-linear-text-primary'
              )}
            >
              <Settings className="h-[18px] w-[18px] flex-shrink-0" />
              {!sidebarCollapsed && <span>Setări</span>}
            </Link>
          );

          if (sidebarCollapsed) {
            return (
              <Tooltip>
                <TooltipTrigger asChild>{settingsLink}</TooltipTrigger>
                <TooltipContent side="right">Setări</TooltipContent>
              </Tooltip>
            );
          }

          return settingsLink;
        })()}

        {/* Admin Section */}
        {user?.role === 'ADMIN' && (
          <>
            <div className="pt-4 pb-1 px-3">
              {!sidebarCollapsed && (
                <span className="text-linear-xs font-normal uppercase tracking-wider text-linear-text-muted">
                  Admin
                </span>
              )}
            </div>
            {adminItems.map((item) => {
              const isActive = pathname.startsWith(item.href);

              const link = (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2.5 text-linear-sm font-normal transition-colors',
                    isActive
                      ? 'bg-linear-accent/15 text-linear-accent border-l-2 border-linear-accent -ml-0.5'
                      : 'text-linear-text-secondary hover:bg-linear-bg-tertiary hover:text-linear-text-primary'
                  )}
                >
                  <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </Link>
              );

              if (sidebarCollapsed) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                );
              }

              return link;
            })}
          </>
        )}
      </nav>

      <Separator />

      {/* Collapse toggle */}
      <button
        onClick={() => collapseSidebar(!sidebarCollapsed)}
        className="flex items-center gap-3 px-4 py-3 text-linear-sm text-linear-text-muted hover:text-linear-text-primary"
      >
        {sidebarCollapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
        {!sidebarCollapsed && <span>Restrânge</span>}
      </button>

      {/* User menu */}
      {user && (
        <div className="border-t border-linear-border-subtle p-2">
          <div
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2.5',
              sidebarCollapsed && 'justify-center'
            )}
          >
            <Avatar name={user.name} size="sm" />
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-linear-sm font-normal text-linear-text-primary truncate">
                  {user.name}
                </p>
                <p className="text-linear-xs text-linear-text-muted truncate">{user.email}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
