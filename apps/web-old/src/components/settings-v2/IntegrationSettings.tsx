/**
 * Integration Settings Component
 * Microsoft 365 connection status and sync settings
 * OPS-364: Settings Page Implementation
 */

'use client';

import * as React from 'react';
import {
  Link2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Mail,
  Calendar,
  FileText,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

// ====================================================================
// Types
// ====================================================================

interface SyncSetting {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  lastSync?: string;
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
// Connection Status Component
// ====================================================================

interface ConnectionStatusProps {
  isConnected: boolean;
  email?: string;
  onReconnect: () => void;
  onDisconnect: () => void;
}

function ConnectionStatus({
  isConnected,
  email,
  onReconnect,
  onDisconnect,
}: ConnectionStatusProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-linear-border-subtle bg-linear-bg-tertiary p-4">
      <div className="flex items-center gap-3">
        {/* Microsoft Logo Placeholder */}
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#0078d4] to-[#00a4ef]">
          <svg viewBox="0 0 23 23" className="h-5 w-5">
            <rect fill="#f25022" width="11" height="11" x="0" y="0" />
            <rect fill="#7fba00" width="11" height="11" x="12" y="0" />
            <rect fill="#00a4ef" width="11" height="11" x="0" y="12" />
            <rect fill="#ffb900" width="11" height="11" x="12" y="12" />
          </svg>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-linear-text-primary">Microsoft 365</span>
            {isConnected ? (
              <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-400">
                <CheckCircle2 className="h-3 w-3" />
                Conectat
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400">
                <XCircle className="h-3 w-3" />
                Deconectat
              </span>
            )}
          </div>
          {isConnected && email && <p className="text-xs text-linear-text-tertiary">{email}</p>}
        </div>
      </div>

      <div className="flex gap-2">
        {isConnected ? (
          <>
            <button
              type="button"
              onClick={onReconnect}
              className="flex items-center gap-1.5 rounded-lg border border-linear-border-subtle bg-linear-bg-secondary px-3 py-1.5 text-xs font-medium text-linear-text-secondary transition-colors hover:bg-linear-bg-tertiary hover:text-linear-text-primary"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reconectează
            </button>
            <button
              type="button"
              onClick={onDisconnect}
              className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10"
            >
              Deconectează
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onReconnect}
            className="rounded-lg bg-linear-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-linear-accent/90"
          >
            Conectează
          </button>
        )}
      </div>
    </div>
  );
}

// ====================================================================
// Sync Setting Row Component
// ====================================================================

interface SyncSettingRowProps {
  setting: SyncSetting;
  onToggle: (id: string, enabled: boolean) => void;
}

function SyncSettingRow({ setting, onToggle }: SyncSettingRowProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <span className="text-linear-text-tertiary">{setting.icon}</span>
        <div>
          <p className="text-sm font-medium text-linear-text-primary">{setting.label}</p>
          <p className="text-xs text-linear-text-tertiary">{setting.description}</p>
          {setting.lastSync && setting.enabled && (
            <p className="mt-1 flex items-center gap-1 text-xs text-linear-text-muted">
              <Clock className="h-3 w-3" />
              Ultima sincronizare: {setting.lastSync}
            </p>
          )}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={setting.enabled}
        onClick={() => onToggle(setting.id, !setting.enabled)}
        className={cn(
          'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
          setting.enabled ? 'bg-linear-accent' : 'bg-linear-bg-tertiary'
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
            setting.enabled ? 'translate-x-4' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  );
}

// ====================================================================
// Main Component
// ====================================================================

export function IntegrationSettings() {
  const { hasMsalAccount, msalAccount, reconnectMicrosoft } = useAuth();

  // Sync settings state
  const [syncSettings, setSyncSettings] = React.useState<SyncSetting[]>([
    {
      id: 'sync-email',
      label: 'Sincronizare email',
      description: 'Sincronizează automat emailurile din Outlook',
      icon: <Mail className="h-4 w-4" />,
      enabled: true,
      lastSync: 'acum 5 minute',
    },
    {
      id: 'sync-calendar',
      label: 'Sincronizare calendar',
      description: 'Sincronizează evenimentele din calendar',
      icon: <Calendar className="h-4 w-4" />,
      enabled: true,
      lastSync: 'acum 10 minute',
    },
    {
      id: 'sync-files',
      label: 'Sincronizare fișiere',
      description: 'Sincronizează documentele din OneDrive/SharePoint',
      icon: <FileText className="h-4 w-4" />,
      enabled: false,
    },
  ]);

  const handleSyncToggle = (id: string, enabled: boolean) => {
    setSyncSettings((prev) => prev.map((s) => (s.id === id ? { ...s, enabled } : s)));
    // TODO: Persist to backend
  };

  const handleReconnect = async () => {
    try {
      await reconnectMicrosoft();
    } catch (error) {
      console.error('Failed to reconnect:', error);
    }
  };

  const handleDisconnect = () => {
    // TODO: Implement disconnect logic
    console.log('Disconnect clicked');
  };

  return (
    <div className="space-y-6">
      {/* Microsoft 365 Connection */}
      <SectionCard
        title="Microsoft 365"
        description="Conectează-ți contul pentru email, calendar și documente"
        icon={<Link2 className="h-4 w-4" />}
      >
        <ConnectionStatus
          isConnected={hasMsalAccount}
          email={msalAccount?.username}
          onReconnect={handleReconnect}
          onDisconnect={handleDisconnect}
        />
      </SectionCard>

      {/* Sync Settings */}
      {hasMsalAccount && (
        <SectionCard
          title="Setări sincronizare"
          description="Controlează ce date se sincronizează automat"
          icon={<RefreshCw className="h-4 w-4" />}
        >
          <div className="divide-y divide-linear-border-subtle">
            {syncSettings.map((setting) => (
              <SyncSettingRow key={setting.id} setting={setting} onToggle={handleSyncToggle} />
            ))}
          </div>
        </SectionCard>
      )}

      {/* Integration Info */}
      <div className="rounded-lg bg-linear-accent/10 p-4 text-xs text-linear-accent">
        <p className="font-medium">Despre integrări</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-linear-text-secondary">
          <li>Integrarea cu Microsoft 365 permite sincronizarea emailurilor și calendarului</li>
          <li>Documentele pot fi editate direct în Word/Excel online</li>
          <li>Toate datele sunt criptate și stocate securizat</li>
        </ul>
      </div>
    </div>
  );
}
