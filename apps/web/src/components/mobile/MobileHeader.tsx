/**
 * MobileHeader Component
 * Top bar for mobile view with hamburger menu and user avatar
 */

'use client';

import React from 'react';
import { Menu, Search } from 'lucide-react';
import { useNavigationStore } from '../../stores/navigation.store';
import { useAuth } from '../../contexts/AuthContext';

interface MobileHeaderProps {
  onMenuToggle: () => void;
}

export function MobileHeader({ onMenuToggle }: MobileHeaderProps) {
  const { openCommandPalette } = useNavigationStore();
  const { user } = useAuth();

  const initials = user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase()
    : 'U';

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between h-14 px-4 bg-linear-bg-secondary border-b border-linear-border-subtle">
      {/* Left: Hamburger menu */}
      <button
        onClick={onMenuToggle}
        className="w-11 h-11 -ml-2 rounded-lg flex items-center justify-center hover:bg-linear-bg-hover active:bg-linear-bg-tertiary focus:outline-none focus:ring-2 focus:ring-linear-accent transition-colors"
        aria-label="Deschide meniu"
      >
        <Menu className="w-6 h-6 text-linear-text-secondary" />
      </button>

      {/* Center: Logo/Brand */}
      <div className="flex-1 text-center">
        <span className="text-lg font-semibold text-linear-text-primary">Bojin Law</span>
      </div>

      {/* Right: Search + Avatar */}
      <div className="flex items-center gap-1">
        <button
          onClick={openCommandPalette}
          className="w-11 h-11 rounded-lg flex items-center justify-center hover:bg-linear-bg-hover active:bg-linear-bg-tertiary focus:outline-none focus:ring-2 focus:ring-linear-accent transition-colors"
          aria-label="Cauta"
        >
          <Search className="w-5 h-5 text-linear-text-secondary" />
        </button>

        <button
          onClick={onMenuToggle}
          className="w-11 h-11 rounded-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-linear-accent focus:ring-offset-2 focus:ring-offset-linear-bg-secondary active:scale-95 transition-transform"
          style={{
            background: 'linear-gradient(135deg, #5E6AD2, #6B76DC)',
          }}
          aria-label="Meniu utilizator"
        >
          <span className="text-white text-sm font-medium">{initials}</span>
        </button>
      </div>
    </header>
  );
}
