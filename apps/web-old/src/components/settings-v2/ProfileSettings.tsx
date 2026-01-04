/**
 * Profile Settings Component
 * Personal information, avatar, and notification preferences
 * OPS-364: Settings Page Implementation
 */

'use client';

import * as React from 'react';
import { Bell, User, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

// ====================================================================
// Types
// ====================================================================

interface NotificationSetting {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

// ====================================================================
// Section Card Component
// ====================================================================

interface SectionCardProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

function SectionCard({ title, description, icon, children }: SectionCardProps) {
  return (
    <div className="rounded-xl border border-linear-border-subtle bg-linear-bg-secondary">
      <div className="border-b border-linear-border-subtle px-5 py-4">
        <div className="flex items-center gap-2">
          {icon && <span className="text-linear-text-tertiary">{icon}</span>}
          <div>
            <h3 className="text-sm font-medium text-linear-text-primary">{title}</h3>
            {description && <p className="text-xs text-linear-text-tertiary">{description}</p>}
          </div>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ====================================================================
// Form Field Component
// ====================================================================

interface FormFieldProps {
  label: string;
  value: string;
  disabled?: boolean;
  type?: string;
}

function FormField({ label, value, disabled = false, type = 'text' }: FormFieldProps) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-linear-text-secondary">{label}</label>
      <input
        type={type}
        value={value}
        disabled={disabled}
        readOnly={disabled}
        className={cn(
          'w-full rounded-lg border border-linear-border-subtle bg-linear-bg-tertiary px-3 py-2 text-sm text-linear-text-primary',
          'focus:border-linear-accent focus:outline-none focus:ring-1 focus:ring-linear-accent/30',
          disabled && 'cursor-not-allowed opacity-60'
        )}
      />
    </div>
  );
}

// ====================================================================
// Toggle Switch Component
// ====================================================================

interface ToggleSwitchProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label: string;
  description?: string;
}

function ToggleSwitch({ enabled, onChange, label, description }: ToggleSwitchProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <p className="text-sm font-medium text-linear-text-primary">{label}</p>
        {description && <p className="mt-0.5 text-xs text-linear-text-tertiary">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={cn(
          'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
          enabled ? 'bg-linear-accent' : 'bg-linear-bg-tertiary'
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
            enabled ? 'translate-x-4' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  );
}

// ====================================================================
// Avatar Section
// ====================================================================

interface AvatarSectionProps {
  user: { firstName: string; lastName: string; email: string } | null;
}

function AvatarSection({ user }: AvatarSectionProps) {
  const initials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    : 'U';

  return (
    <div className="flex items-center gap-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-linear-accent to-linear-accent/60 text-xl font-semibold text-white">
        {initials}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-linear-text-primary">
          {user ? `${user.firstName} ${user.lastName}` : 'Utilizator'}
        </p>
        <p className="text-xs text-linear-text-tertiary">{user?.email || 'email@example.com'}</p>
      </div>
      <button
        type="button"
        className="rounded-lg border border-linear-border-subtle bg-linear-bg-tertiary px-3 py-1.5 text-xs font-medium text-linear-text-secondary transition-colors hover:bg-linear-bg-secondary hover:text-linear-text-primary"
      >
        Schimbă imaginea
      </button>
    </div>
  );
}

// ====================================================================
// Main Component
// ====================================================================

export function ProfileSettings() {
  const { user } = useAuth();

  // Notification settings state
  const [notifications, setNotifications] = React.useState<NotificationSetting[]>([
    {
      id: 'email-tasks',
      label: 'Email-uri pentru sarcini',
      description: 'Primește notificări când ți se atribuie sarcini noi',
      enabled: true,
    },
    {
      id: 'email-deadlines',
      label: 'Email-uri pentru termene',
      description: 'Primește memento-uri pentru termene apropiate',
      enabled: true,
    },
    {
      id: 'email-documents',
      label: 'Email-uri pentru documente',
      description: 'Primește notificări când sunt încărcate documente noi',
      enabled: false,
    },
    {
      id: 'email-digest',
      label: 'Rezumat zilnic',
      description: 'Primește un rezumat al activității de la sfârșitul zilei',
      enabled: true,
    },
  ]);

  const handleNotificationChange = (id: string, enabled: boolean) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, enabled } : n)));
    // TODO: Persist to backend
  };

  // Map user role to Romanian display
  const getRoleDisplay = (role: string | undefined) => {
    switch (role) {
      case 'Partner':
        return 'Partener';
      case 'Associate':
        return 'Asociat';
      case 'Paralegal':
        return 'Asociat Jr.';
      default:
        return role || 'N/A';
    }
  };

  return (
    <div className="space-y-6">
      {/* Avatar and Basic Info */}
      <SectionCard
        title="Informații de bază"
        description="Imaginea și datele tale de profil"
        icon={<User className="h-4 w-4" />}
      >
        <div className="space-y-5">
          <AvatarSection user={user} />

          <div className="grid gap-4 pt-4 sm:grid-cols-2">
            <FormField label="Prenume" value={user?.firstName || ''} disabled />
            <FormField label="Nume" value={user?.lastName || ''} disabled />
            <FormField label="Email" value={user?.email || ''} type="email" disabled />
            <FormField label="Rol" value={getRoleDisplay(user?.role)} disabled />
          </div>

          <div className="rounded-lg bg-linear-accent/10 p-3 text-xs text-linear-accent">
            <p className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5" />
              <span>
                Informațiile de profil sunt gestionate prin Microsoft 365. Contactează
                administratorul pentru modificări.
              </span>
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Notification Preferences */}
      <SectionCard
        title="Preferințe notificări"
        description="Gestionează când și cum primești notificări"
        icon={<Bell className="h-4 w-4" />}
      >
        <div className="space-y-4">
          {notifications.map((notification) => (
            <ToggleSwitch
              key={notification.id}
              enabled={notification.enabled}
              onChange={(enabled) => handleNotificationChange(notification.id, enabled)}
              label={notification.label}
              description={notification.description}
            />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
