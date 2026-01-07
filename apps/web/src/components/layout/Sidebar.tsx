'use client';

import { useState } from 'react';
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
  ChevronUp,
  Settings,
  LogOut,
  LayoutTemplate,
  Brain,
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

const adminItems = [
  { href: '/admin/templates', label: 'Șabloane', icon: LayoutTemplate },
  { href: '/admin/ai', label: 'AI Dashboard', icon: Brain },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, collapseSidebar } = useUIStore();
  const { user, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center px-4 border-b border-linear-border-subtle">
        {sidebarCollapsed ? (
          /* Outlined B mark with accent border */
          <div className="w-7 h-7 rounded-md border-2 border-linear-accent flex items-center justify-center">
            <span className="text-[13px] font-bold text-linear-accent">B</span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            {/* Outlined B mark with accent border */}
            <div className="w-7 h-7 rounded-md border-2 border-linear-accent flex items-center justify-center flex-shrink-0">
              <span className="text-[13px] font-bold text-linear-accent">B</span>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[15px] font-semibold text-linear-text-primary tracking-tight">
                Bojin Law
              </span>
              <span className="text-[10px] font-medium text-linear-text-muted tracking-[0.15em] uppercase mt-0.5">
                Avocatură
              </span>
            </div>
          </div>
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
          {/* Expandable menu items - appears ABOVE user info */}
          {userMenuOpen && (
            <div className="mb-1 space-y-0.5">
              {/* Personal Settings */}
              {(() => {
                const isActive = pathname === '/settings';
                const link = (
                  <Link
                    href="/settings"
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-linear-sm font-normal transition-colors',
                      isActive
                        ? 'bg-linear-accent/15 text-linear-accent'
                        : 'text-linear-text-secondary hover:bg-linear-bg-tertiary hover:text-linear-text-primary'
                    )}
                  >
                    <Settings className="h-4 w-4 flex-shrink-0" />
                    {!sidebarCollapsed && <span>Personal</span>}
                  </Link>
                );

                if (sidebarCollapsed) {
                  return (
                    <Tooltip>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">Personal</TooltipContent>
                    </Tooltip>
                  );
                }

                return link;
              })()}

              {/* Firm Settings - Admin only */}
              {user.role === 'ADMIN' &&
                (() => {
                  const isActive = pathname === '/settings?tab=firm';
                  const link = (
                    <Link
                      href="/settings?tab=firm"
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-linear-sm font-normal transition-colors',
                        isActive
                          ? 'bg-linear-accent/15 text-linear-accent'
                          : 'text-linear-text-secondary hover:bg-linear-bg-tertiary hover:text-linear-text-primary'
                      )}
                    >
                      <Settings className="h-4 w-4 flex-shrink-0" />
                      {!sidebarCollapsed && <span>Setări Firmă</span>}
                    </Link>
                  );

                  if (sidebarCollapsed) {
                    return (
                      <Tooltip>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right">Setări Firmă</TooltipContent>
                      </Tooltip>
                    );
                  }

                  return link;
                })()}

              {/* Logout */}
              {(() => {
                const logoutButton = (
                  <button
                    onClick={logout}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-linear-sm font-normal text-linear-text-secondary hover:bg-linear-bg-tertiary hover:text-linear-error transition-colors"
                  >
                    <LogOut className="h-4 w-4 flex-shrink-0" />
                    {!sidebarCollapsed && <span>Deconectare</span>}
                  </button>
                );

                if (sidebarCollapsed) {
                  return (
                    <Tooltip>
                      <TooltipTrigger asChild>{logoutButton}</TooltipTrigger>
                      <TooltipContent side="right">Deconectare</TooltipContent>
                    </Tooltip>
                  );
                }

                return logoutButton;
              })()}
            </div>
          )}

          {/* User info - clickable to expand menu (stays at bottom) */}
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className={cn(
              'flex w-full items-center gap-3 rounded-md px-3 py-2.5 hover:bg-linear-bg-tertiary transition-colors',
              sidebarCollapsed && 'justify-center'
            )}
          >
            <Avatar name={user.name} size="sm" />
            {!sidebarCollapsed && (
              <>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-linear-sm font-normal text-linear-text-primary truncate">
                    {user.name}
                  </p>
                  <p className="text-linear-xs text-linear-text-muted truncate">{user.email}</p>
                </div>
                <ChevronUp
                  className={cn(
                    'h-4 w-4 text-linear-text-muted transition-transform',
                    !userMenuOpen && 'rotate-180'
                  )}
                />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
