'use client';

import { clsx } from 'clsx';
import { type LucideIcon } from 'lucide-react';
import { Button } from './Button';

// ============================================
// Types
// ============================================

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

// ============================================
// Component
// ============================================

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center',
        'px-6 py-12 text-center',
        className
      )}
    >
      {Icon && (
        <div className="mb-4 p-4 rounded-full bg-bg-card">
          <Icon className="w-8 h-8 text-text-tertiary" />
        </div>
      )}

      <h3 className="text-base font-semibold text-text-primary">{title}</h3>

      {description && <p className="mt-2 text-sm text-text-secondary max-w-xs">{description}</p>}

      {action && (
        <Button variant="secondary" size="sm" onClick={action.onClick} className="mt-6">
          {action.label}
        </Button>
      )}
    </div>
  );
}

// ============================================
// Presets
// ============================================

export function EmptySearch({ query }: { query?: string }) {
  return (
    <EmptyState
      title="Niciun rezultat"
      description={
        query
          ? `Nu am găsit rezultate pentru "${query}". Încearcă să cauți altceva.`
          : 'Nu am găsit nimic. Încearcă să modifici căutarea.'
      }
    />
  );
}

export function EmptyList({
  itemName = 'element',
  onAdd,
}: {
  itemName?: string;
  onAdd?: () => void;
}) {
  return (
    <EmptyState
      title={`Niciun ${itemName}`}
      description={`Nu există ${itemName}e încă.`}
      action={onAdd ? { label: `Adaugă ${itemName}`, onClick: onAdd } : undefined}
    />
  );
}

export function ErrorState({
  message = 'A apărut o eroare',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      title="Eroare"
      description={message}
      action={onRetry ? { label: 'Încearcă din nou', onClick: onRetry } : undefined}
    />
  );
}

export function OfflineState({ onRetry }: { onRetry?: () => void }) {
  return (
    <EmptyState
      title="Fără conexiune"
      description="Verifică conexiunea la internet și încearcă din nou."
      action={onRetry ? { label: 'Încearcă din nou', onClick: onRetry } : undefined}
    />
  );
}
