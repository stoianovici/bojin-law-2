/**
 * User Management Page - Linear Design System
 * OPS-367: User management with table, role badges, invite/edit modals
 */

'use client';

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Plus, MoreHorizontal, Mail, UserX, Edit2, Users } from 'lucide-react';
import { PageLayout, PageHeader, PageContent } from '@/components/linear/PageLayout';
import { StatusToggle } from '@/components/linear/StatusToggle';
import { SearchBox } from '@/components/linear/FilterChips';
import { MinimalTable, TitleSubtitleCell, ActionsCell } from '@/components/linear/MinimalTable';
import { StatusDot, StatusBadge } from '@/components/linear/StatusDot';
import { FormModal, FormGroup } from '@/components/linear/FormModal';
import { ConfirmDialog } from '@/components/linear/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useRequireRole } from '@/hooks/useAuthorization';
import { useAuth } from '@/lib/hooks/useAuth';
import {
  getPendingUsers,
  getActiveUsers,
  activateUser,
  updateUserRole,
  deactivateUser,
} from '@/lib/services/userManagementApi';
import type { User, UserRole } from '@legal-platform/types';
import type { ColumnDef } from '@/components/linear/MinimalTable';

// ============================================================================
// Types
// ============================================================================

import type { UserStatus } from '@legal-platform/types';

type StatusFilter = 'all' | UserStatus;

// ============================================================================
// Constants
// ============================================================================

const ROLE_LABELS: Record<UserRole, string> = {
  Partner: 'Partener',
  Associate: 'Asociat',
  Paralegal: 'Asociat Jr.',
  BusinessOwner: 'Proprietar',
};

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'Paralegal', label: 'Asociat Jr.' },
  { value: 'Associate', label: 'Asociat' },
  { value: 'Partner', label: 'Partener' },
];

// ============================================================================
// Helper Functions
// ============================================================================

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('ro-RO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getRoleBadgeVariant(role: UserRole): 'medium' | 'high' | 'urgent' {
  switch (role) {
    case 'Partner':
    case 'BusinessOwner':
      return 'urgent';
    case 'Associate':
      return 'high';
    case 'Paralegal':
    default:
      return 'medium';
  }
}

function getStatusDotStatus(status: UserStatus): 'active' | 'pending' | 'neutral' {
  switch (status) {
    case 'Active':
      return 'active';
    case 'Pending':
      return 'pending';
    case 'Inactive':
      return 'neutral';
  }
}

function getStatusLabel(status: UserStatus): string {
  switch (status) {
    case 'Active':
      return 'Activ';
    case 'Pending':
      return 'Invitat';
    case 'Inactive':
      return 'Dezactivat';
  }
}

// ============================================================================
// User Row Actions Dropdown
// ============================================================================

interface UserActionsProps {
  user: User;
  currentUserId?: string;
  onActivate: (user: User) => void;
  onEdit: (user: User) => void;
  onDeactivate: (user: User) => void;
}

function UserActions({ user, currentUserId, onActivate, onEdit, onDeactivate }: UserActionsProps) {
  const [open, setOpen] = useState(false);
  const isCurrentUser = user.id === currentUserId;

  if (isCurrentUser) {
    return <span className="text-xs text-linear-text-muted">Tu</span>;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'w-7 h-7 flex items-center justify-center rounded-md',
          'text-linear-text-tertiary hover:text-linear-text-primary hover:bg-linear-bg-hover',
          'transition-colors'
        )}
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className={cn(
              'absolute right-0 top-full mt-1 z-20',
              'min-w-[160px] py-1',
              'bg-linear-bg-secondary border border-linear-border-subtle rounded-lg shadow-lg'
            )}
          >
            {user.status === 'Pending' ? (
              <button
                onClick={() => {
                  setOpen(false);
                  onActivate(user);
                }}
                className={cn(
                  'w-full px-3 py-2 flex items-center gap-2',
                  'text-sm text-linear-text-primary hover:bg-linear-bg-hover',
                  'transition-colors text-left'
                )}
              >
                <Users className="w-4 h-4" />
                Activează
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    setOpen(false);
                    onEdit(user);
                  }}
                  className={cn(
                    'w-full px-3 py-2 flex items-center gap-2',
                    'text-sm text-linear-text-primary hover:bg-linear-bg-hover',
                    'transition-colors text-left'
                  )}
                >
                  <Edit2 className="w-4 h-4" />
                  Editează rol
                </button>
                <button
                  onClick={() => {
                    setOpen(false);
                    onDeactivate(user);
                  }}
                  className={cn(
                    'w-full px-3 py-2 flex items-center gap-2',
                    'text-sm text-linear-error hover:bg-linear-bg-hover',
                    'transition-colors text-left'
                  )}
                >
                  <UserX className="w-4 h-4" />
                  Dezactivează
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Invite User Modal
// ============================================================================

interface InviteUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvite: (email: string, role: UserRole) => Promise<void>;
}

function InviteUserModal({ open, onOpenChange, onInvite }: InviteUserModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('Paralegal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Email-ul este obligatoriu');
      return;
    }

    if (!email.includes('@')) {
      setError('Email-ul nu este valid');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onInvite(email, role);
      setEmail('');
      setRole('Paralegal');
      onOpenChange(false);
    } catch {
      setError('Nu s-a putut trimite invitația. Încercați din nou.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Invită utilizator"
      submitLabel="Trimite invitație"
      onSubmit={handleSubmit}
      loading={loading}
    >
      <FormGroup label="Email">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="exemplu@domeniu.ro"
          className={cn(
            'w-full px-3 py-2 rounded-lg',
            'bg-linear-bg-tertiary border border-linear-border-subtle',
            'text-sm text-linear-text-primary placeholder:text-linear-text-muted',
            'focus:outline-none focus:border-linear-accent focus:ring-2 focus:ring-linear-accent/20',
            'transition-colors'
          )}
        />
      </FormGroup>

      <FormGroup label="Rol">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          className={cn(
            'w-full px-3 py-2 rounded-lg',
            'bg-linear-bg-tertiary border border-linear-border-subtle',
            'text-sm text-linear-text-primary',
            'focus:outline-none focus:border-linear-accent focus:ring-2 focus:ring-linear-accent/20',
            'transition-colors cursor-pointer'
          )}
        >
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </FormGroup>

      {error && <div className="text-sm text-linear-error mt-2">{error}</div>}
    </FormModal>
  );
}

// ============================================================================
// Edit User Modal
// ============================================================================

interface EditUserModalProps {
  open: boolean;
  user: User | null;
  onOpenChange: (open: boolean) => void;
  onSave: (userId: string, role: UserRole) => Promise<void>;
}

function EditUserModal({ open, user, onOpenChange, onSave }: EditUserModalProps) {
  const [role, setRole] = useState<UserRole>('Paralegal');
  const [loading, setLoading] = useState(false);

  // Update role when user changes
  useEffect(() => {
    if (user) {
      setRole(user.role);
    }
  }, [user]);

  const handleSubmit = async () => {
    if (!user) return;

    setLoading(true);
    try {
      await onSave(user.id, role);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Editează utilizator"
      submitLabel="Salvează"
      onSubmit={handleSubmit}
      loading={loading}
    >
      <div className="flex items-center gap-3 mb-5 pb-5 border-b border-linear-border-subtle">
        <Avatar size="lg">
          <AvatarFallback name={`${user.firstName} ${user.lastName}`}>
            {getInitials(user.firstName, user.lastName)}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="text-sm font-medium text-linear-text-primary">
            {user.firstName} {user.lastName}
          </div>
          <div className="text-xs text-linear-text-tertiary">{user.email}</div>
        </div>
      </div>

      <FormGroup label="Rol">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          className={cn(
            'w-full px-3 py-2 rounded-lg',
            'bg-linear-bg-tertiary border border-linear-border-subtle',
            'text-sm text-linear-text-primary',
            'focus:outline-none focus:border-linear-accent focus:ring-2 focus:ring-linear-accent/20',
            'transition-colors cursor-pointer'
          )}
        >
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </FormGroup>
    </FormModal>
  );
}

// ============================================================================
// Activate User Modal
// ============================================================================

interface ActivateUserModalProps {
  open: boolean;
  user: User | null;
  onOpenChange: (open: boolean) => void;
  onActivate: (userId: string, role: UserRole) => Promise<void>;
}

function ActivateUserModal({ open, user, onOpenChange, onActivate }: ActivateUserModalProps) {
  const [role, setRole] = useState<UserRole>('Paralegal');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!user) return;

    setLoading(true);
    try {
      await onActivate(user.id, role);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Activează utilizator"
      submitLabel="Activează"
      onSubmit={handleSubmit}
      loading={loading}
    >
      <div className="flex items-center gap-3 mb-5 pb-5 border-b border-linear-border-subtle">
        <Avatar size="lg">
          <AvatarFallback name={`${user.firstName} ${user.lastName}`}>
            {getInitials(user.firstName, user.lastName)}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="text-sm font-medium text-linear-text-primary">
            {user.firstName} {user.lastName}
          </div>
          <div className="text-xs text-linear-text-tertiary">{user.email}</div>
        </div>
      </div>

      <FormGroup label="Atribuie rol">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          className={cn(
            'w-full px-3 py-2 rounded-lg',
            'bg-linear-bg-tertiary border border-linear-border-subtle',
            'text-sm text-linear-text-primary',
            'focus:outline-none focus:border-linear-accent focus:ring-2 focus:ring-linear-accent/20',
            'transition-colors cursor-pointer'
          )}
        >
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </FormGroup>

      <p className="text-xs text-linear-text-tertiary mt-4">
        Utilizatorul va primi acces la platformă cu rolul selectat.
      </p>
    </FormModal>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function UserManagementPage() {
  const { authorized, isLoading: authLoading } = useRequireRole('Partner');
  const { user: currentUser } = useAuth();

  // Data state
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [activateModalOpen, setActivateModalOpen] = useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // ====================================================================
  // Data Fetching
  // ====================================================================

  useEffect(() => {
    if (authorized && currentUser) {
      loadUsers();
    }
  }, [authorized, currentUser]);

  async function loadUsers() {
    try {
      setLoading(true);
      setError(null);

      const [pendingData, activeData] = await Promise.all([
        getPendingUsers(),
        getActiveUsers(currentUser?.firmId || undefined),
      ]);

      // Combine users - they already have status property
      const allUsers: User[] = [...pendingData, ...activeData];

      // Sort: pending first, then by name
      allUsers.sort((a, b) => {
        if (a.status === 'Pending' && b.status !== 'Pending') return -1;
        if (a.status !== 'Pending' && b.status === 'Pending') return 1;
        return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
      });

      setUsers(allUsers);
    } catch (err) {
      console.error('Failed to load users:', err);
      setError('Nu s-au putut încărca utilizatorii. Încercați din nou.');
    } finally {
      setLoading(false);
    }
  }

  // ====================================================================
  // Toast Helper
  // ====================================================================

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  // ====================================================================
  // Action Handlers
  // ====================================================================

  const handleInvite = async (_email: string, _role: UserRole) => {
    // TODO: Implement invite API
    showToast('Funcție în curs de implementare', 'error');
  };

  const handleActivate = async (userId: string, role: UserRole) => {
    if (!currentUser?.firmId) return;
    try {
      await activateUser(userId, currentUser.firmId, role);
      showToast('Utilizatorul a fost activat cu succes.', 'success');
      await loadUsers();
    } catch {
      showToast('Nu s-a putut activa utilizatorul.', 'error');
    }
  };

  const handleUpdateRole = async (userId: string, role: UserRole) => {
    try {
      await updateUserRole(userId, role);
      showToast('Rolul a fost actualizat cu succes.', 'success');
      await loadUsers();
    } catch {
      showToast('Nu s-a putut actualiza rolul.', 'error');
    }
  };

  const handleDeactivate = async () => {
    if (!selectedUser) return;
    try {
      await deactivateUser(selectedUser.id);
      showToast('Utilizatorul a fost dezactivat.', 'success');
      setDeactivateDialogOpen(false);
      setSelectedUser(null);
      await loadUsers();
    } catch {
      showToast('Nu s-a putut dezactiva utilizatorul.', 'error');
    }
  };

  // ====================================================================
  // Filtered Data
  // ====================================================================

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      // Status filter
      if (statusFilter !== 'all' && user.status !== statusFilter) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
        const email = user.email.toLowerCase();
        return fullName.includes(query) || email.includes(query);
      }

      return true;
    });
  }, [users, statusFilter, searchQuery]);

  const statusCounts = useMemo(() => {
    return {
      all: users.length,
      Active: users.filter((u) => u.status === 'Active').length,
      Pending: users.filter((u) => u.status === 'Pending').length,
      Inactive: users.filter((u) => u.status === 'Inactive').length,
    };
  }, [users]);

  // ====================================================================
  // Table Columns
  // ====================================================================

  const columns: ColumnDef<User>[] = [
    {
      id: 'name',
      header: 'Utilizator',
      accessor: (user) => (
        <div className="flex items-center gap-3">
          <Avatar size="sm">
            <AvatarFallback name={`${user.firstName} ${user.lastName}`}>
              {getInitials(user.firstName, user.lastName)}
            </AvatarFallback>
          </Avatar>
          <TitleSubtitleCell title={`${user.firstName} ${user.lastName}`} subtitle={user.email} />
        </div>
      ),
    },
    {
      id: 'role',
      header: 'Rol',
      width: '120px',
      accessor: (user) =>
        user.status === 'Pending' ? (
          <span className="text-linear-text-muted">—</span>
        ) : (
          <StatusBadge variant={getRoleBadgeVariant(user.role)}>
            {ROLE_LABELS[user.role]}
          </StatusBadge>
        ),
    },
    {
      id: 'status',
      header: 'Stare',
      width: '100px',
      accessor: (user) => (
        <StatusDot status={getStatusDotStatus(user.status)} label={getStatusLabel(user.status)} />
      ),
    },
    {
      id: 'lastActive',
      header: 'Ultima activitate',
      width: '140px',
      accessor: (user) => (
        <span className="text-sm text-linear-text-tertiary">
          {user.lastActive ? formatDate(user.lastActive) : '—'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      width: '48px',
      align: 'right',
      accessor: (user) => (
        <ActionsCell>
          <UserActions
            user={user}
            currentUserId={currentUser?.id}
            onActivate={(u) => {
              setSelectedUser(u);
              setActivateModalOpen(true);
            }}
            onEdit={(u) => {
              setSelectedUser(u);
              setEditModalOpen(true);
            }}
            onDeactivate={(u) => {
              setSelectedUser(u);
              setDeactivateDialogOpen(true);
            }}
          />
        </ActionsCell>
      ),
    },
  ];

  // ====================================================================
  // Loading State
  // ====================================================================

  if (authLoading || !authorized) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-linear-text-tertiary">Se încarcă...</div>
        </div>
      </PageLayout>
    );
  }

  // ====================================================================
  // Render
  // ====================================================================

  return (
    <PageLayout>
      <PageHeader
        title="Utilizatori"
        actions={
          <Button variant="primary" onClick={() => setInviteModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Invită utilizator
          </Button>
        }
      />

      <PageContent>
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <StatusToggle
            options={[
              { value: 'all' as const, label: `Toți (${statusCounts.all})` },
              { value: 'Active' as const, label: `Activi (${statusCounts.Active})` },
              { value: 'Pending' as const, label: `Invitați (${statusCounts.Pending})` },
            ]}
            value={statusFilter}
            onChange={(value) => setStatusFilter(value)}
          />

          <SearchBox
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Caută utilizator..."
          />
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-linear-error/10 border border-linear-error/20 rounded-lg text-sm text-linear-error">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-linear-bg-secondary border border-linear-border-subtle rounded-xl overflow-hidden">
          <MinimalTable
            columns={columns}
            data={filteredUsers}
            getRowKey={(user) => user.id}
            loading={loading}
            emptyState={
              <div className="text-center py-8">
                <Users className="w-12 h-12 mx-auto mb-3 text-linear-text-muted" />
                <p className="text-linear-text-secondary">
                  {searchQuery
                    ? 'Niciun utilizator găsit pentru căutarea dvs.'
                    : statusFilter === 'Pending'
                      ? 'Nu există utilizatori în așteptare.'
                      : 'Nu există utilizatori în firmă.'}
                </p>
                {statusFilter === 'all' && !searchQuery && (
                  <Button
                    variant="secondary"
                    className="mt-4"
                    onClick={() => setInviteModalOpen(true)}
                  >
                    <Mail className="w-4 h-4 mr-1.5" />
                    Invită primul utilizator
                  </Button>
                )}
              </div>
            }
          />
        </div>
      </PageContent>

      {/* Modals */}
      <InviteUserModal
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
        onInvite={handleInvite}
      />

      <EditUserModal
        open={editModalOpen}
        user={selectedUser}
        onOpenChange={setEditModalOpen}
        onSave={handleUpdateRole}
      />

      <ActivateUserModal
        open={activateModalOpen}
        user={selectedUser}
        onOpenChange={setActivateModalOpen}
        onActivate={handleActivate}
      />

      <ConfirmDialog
        open={deactivateDialogOpen}
        onOpenChange={setDeactivateDialogOpen}
        title="Dezactivează utilizator"
        description={
          selectedUser
            ? `Sunteți sigur că doriți să dezactivați ${selectedUser.firstName} ${selectedUser.lastName}? Acest utilizator va pierde accesul la platformă.`
            : ''
        }
        severity="danger"
        actionLabel="Dezactivează"
        onAction={handleDeactivate}
      />

      {/* Toast */}
      {toast && (
        <div
          className={cn(
            'fixed bottom-4 right-4 z-50',
            'px-4 py-3 rounded-lg shadow-lg',
            'text-sm font-medium text-white',
            'animate-in slide-in-from-bottom-4',
            toast.type === 'success' ? 'bg-linear-success' : 'bg-linear-error'
          )}
        >
          {toast.message}
        </div>
      )}
    </PageLayout>
  );
}
