/**
 * MobileDrawer Component
 * Slide-in navigation drawer for mobile view
 */

'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, LogOut, Settings, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSwipeGesture } from '../../hooks/useSwipeGesture';
import {
  LayoutDashboard,
  TrendingUp,
  Scale,
  FileText,
  CheckSquare,
  Mail,
  Clock,
  UserCog,
  Briefcase,
  type LucideIcon,
} from 'lucide-react';
import { useNavigationStore } from '../../stores/navigation.store';
import { useAuth } from '../../contexts/AuthContext';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  roles: string[];
}

const navigationItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Tablou de Bord',
    icon: LayoutDashboard,
    href: '/',
    roles: ['Partner', 'Associate', 'Paralegal'],
  },
  {
    id: 'analytics',
    label: 'Analiză',
    icon: TrendingUp,
    href: '/analytics',
    roles: ['Partner', 'BusinessOwner'],
  },
  {
    id: 'cases',
    label: 'Cazuri',
    icon: Scale,
    href: '/cases',
    roles: ['Partner', 'Paralegal'],
  },
  {
    id: 'my-cases',
    label: 'Cazurile Mele',
    icon: Briefcase,
    href: '/cases/my-cases',
    roles: ['Associate'],
  },
  {
    id: 'documents',
    label: 'Documente',
    icon: FileText,
    href: '/documents',
    roles: ['Partner', 'Associate', 'Paralegal'],
  },
  {
    id: 'tasks',
    label: 'Sarcini',
    icon: CheckSquare,
    href: '/tasks',
    roles: ['Partner', 'Associate', 'Paralegal'],
  },
  {
    id: 'communications',
    label: 'Comunicări',
    icon: Mail,
    href: '/communications',
    roles: ['Partner', 'Associate', 'Paralegal'],
  },
  {
    id: 'time-tracking',
    label: 'Pontaj',
    icon: Clock,
    href: '/time-tracking',
    roles: ['Partner', 'Associate', 'Paralegal'],
  },
  {
    id: 'team-activity',
    label: 'Activitate Echipă',
    icon: UserCog,
    href: '/activitate-echipa',
    roles: ['Partner', 'BusinessOwner'],
  },
];

export function MobileDrawer({ isOpen, onClose }: MobileDrawerProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { setCurrentSection } = useNavigationStore();
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Only render theme toggle after mounting to avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Refs for swipe gesture detection
  const backdropRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  // Swipe left to close drawer
  const { bindToElement } = useSwipeGesture({
    onSwipeLeft: onClose,
    enabled: isOpen,
    threshold: 50,
  });

  // Bind swipe gesture to backdrop and drawer
  useEffect(() => {
    if (!isOpen) return;

    const cleanupBackdrop = bindToElement(backdropRef.current);
    const cleanupDrawer = bindToElement(drawerRef.current);

    return () => {
      cleanupBackdrop?.();
      cleanupDrawer?.();
    };
  }, [isOpen, bindToElement]);

  const userRole = user?.role || 'Associate';
  const userName = user ? `${user.firstName} ${user.lastName}` : 'Utilizator';
  const initials = user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase()
    : 'U';

  const visibleItems = navigationItems.filter((item) => item.roles.includes(userRole));

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const isActive = (href: string): boolean => {
    if (href === '/' && pathname === '/') return true;
    if (href !== '/' && pathname?.startsWith(href)) return true;
    return false;
  };

  const handleNavClick = (item: NavItem) => {
    setCurrentSection(
      item.id as
        | 'dashboard'
        | 'cases'
        | 'documents'
        | 'tasks'
        | 'communications'
        | 'time-tracking'
        | 'analytics'
        | 'team-activity'
    );
    onClose();
  };

  const handleLogout = () => {
    onClose();
    logout();
  };

  const getRoleLabel = (role: string): string => {
    const labels: Record<string, string> = {
      Partner: 'Partener',
      Associate: 'Asociat',
      Paralegal: 'Asociat Jr.',
      BusinessOwner: 'Antreprenor',
    };
    return labels[role] || role;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            ref={backdropRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer */}
          <motion.aside
            ref={drawerRef}
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{
              type: 'spring',
              damping: 30,
              stiffness: 300,
            }}
            className="fixed top-0 left-0 h-full w-72 bg-linear-bg-secondary z-50 flex flex-col shadow-xl"
            aria-label="Meniu navigare"
          >
            {/* Header with user info */}
            <div className="flex items-center justify-between p-4 border-b border-linear-border-subtle">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, #5E6AD2, #6B76DC)',
                  }}
                >
                  <span className="text-white text-sm font-medium">{initials}</span>
                </div>
                <div>
                  <div className="font-medium text-linear-text-primary">{userName}</div>
                  <div className="text-sm text-linear-text-tertiary">{getRoleLabel(userRole)}</div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-11 h-11 rounded-lg flex items-center justify-center hover:bg-linear-bg-hover active:bg-linear-bg-tertiary focus:outline-none focus:ring-2 focus:ring-linear-accent transition-colors"
                aria-label="Închide meniu"
              >
                <X className="w-5 h-5 text-linear-text-tertiary" />
              </button>
            </div>

            {/* Navigation items */}
            <nav className="flex-1 overflow-y-auto p-4">
              <ul className="space-y-1">
                {visibleItems.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        onClick={() => handleNavClick(item)}
                        className={`
                          flex items-center gap-3 px-3 py-3 min-h-[44px] rounded-lg
                          transition-colors duration-150 active:scale-[0.98]
                          ${
                            active
                              ? 'bg-linear-accent-muted text-linear-accent font-medium'
                              : 'text-linear-text-secondary hover:bg-linear-bg-hover active:bg-linear-bg-tertiary'
                          }
                        `}
                      >
                        <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* Footer actions */}
            <div className="border-t border-linear-border-subtle p-4 space-y-1">
              {/* Theme toggle */}
              {mounted && (
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-linear-text-secondary">Temă</span>
                  <button
                    onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                    className="p-2 rounded-lg hover:bg-linear-bg-hover transition-colors"
                    aria-label={
                      resolvedTheme === 'dark'
                        ? 'Schimbă la tema luminoasă'
                        : 'Schimbă la tema întunecată'
                    }
                  >
                    {resolvedTheme === 'dark' ? (
                      <Moon className="w-5 h-5 text-linear-text-tertiary" />
                    ) : (
                      <Sun className="w-5 h-5 text-linear-text-tertiary" />
                    )}
                  </button>
                </div>
              )}
              <Link
                href="/settings/billing"
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-3 min-h-[44px] rounded-lg text-linear-text-secondary hover:bg-linear-bg-hover active:bg-linear-bg-tertiary active:scale-[0.98] transition-all"
              >
                <Settings className="w-5 h-5" aria-hidden="true" />
                <span>Setări</span>
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-3 min-h-[44px] rounded-lg text-linear-error hover:bg-linear-error/10 active:bg-linear-error/15 active:scale-[0.98] transition-all"
              >
                <LogOut className="w-5 h-5" aria-hidden="true" />
                <span>Deconectare</span>
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
