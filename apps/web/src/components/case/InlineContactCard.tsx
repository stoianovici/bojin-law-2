/**
 * Inline Contact Card Component
 * OPS-211: Part of Expandable Case Workspace Epic
 * OPS-223: Dynamic actor types support
 *
 * Displays a contact/actor card with inline editing capability.
 * Used within ContactsSection for add/edit/view of case actors.
 */

'use client';

import React, { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { Pencil1Icon, TrashIcon, Cross2Icon, CheckIcon } from '@radix-ui/react-icons';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useActorAdd, type AddCaseActorInput } from '../../hooks/useActorAdd';
import { useActorUpdate, type UpdateCaseActorInput } from '../../hooks/useActorUpdate';
import { useActorRemove } from '../../hooks/useActorRemove';
import type { CaseActor, CaseActorRole } from '@legal-platform/types';
import type { ActorTypeOption } from '../../hooks/useActorTypes';

// ============================================================================
// Types
// ============================================================================

export interface InlineContactCardProps {
  /** Existing actor data (undefined for new actor) */
  actor?: CaseActor;
  /** Case ID for mutations */
  caseId: string;
  /** Whether this is a new actor being added */
  isNew?: boolean;
  /** Whether this actor is currently in edit mode */
  isEditing?: boolean;
  /** Callback when edit button is clicked */
  onEdit?: () => void;
  /** Callback after successful save */
  onSave: () => void;
  /** Callback when cancel is clicked */
  onCancel: () => void;
  /** Whether the card is editable */
  editable: boolean;
  /** Dynamic actor type options (OPS-223) - if not provided, uses fallback labels */
  actorTypeOptions?: ActorTypeOption[];
}

interface FormData {
  role: CaseActorRole;
  customRoleCode: string | null; // OPS-223: For custom actor types
  name: string;
  email: string;
  organization: string;
  phone: string;
}

// ============================================================================
// Constants
// ============================================================================

// OPS-219: Expanded actor roles for Romanian legal practice
const ROLE_LABELS: Record<CaseActorRole, string> = {
  Client: 'Client',
  OpposingParty: 'Parte Adversă',
  OpposingCounsel: 'Avocat Parte Adversă',
  Witness: 'Martor',
  Expert: 'Expert',
  Intervenient: 'Intervenient',
  Mandatar: 'Mandatar',
  Court: 'Instanță',
  Prosecutor: 'Procuror',
  Bailiff: 'Executor Judecătoresc',
  Notary: 'Notar',
  LegalRepresentative: 'Reprezentant Legal',
  Other: 'Altele',
};

const ROLE_COLORS: Record<CaseActorRole, string> = {
  Client: 'bg-blue-100 text-blue-800',
  OpposingParty: 'bg-red-100 text-red-800',
  OpposingCounsel: 'bg-orange-100 text-orange-800',
  Witness: 'bg-green-100 text-green-800',
  Expert: 'bg-purple-100 text-purple-800',
  Intervenient: 'bg-cyan-100 text-cyan-800',
  Mandatar: 'bg-indigo-100 text-indigo-800',
  Court: 'bg-amber-100 text-amber-800',
  Prosecutor: 'bg-rose-100 text-rose-800',
  Bailiff: 'bg-slate-100 text-slate-800',
  Notary: 'bg-emerald-100 text-emerald-800',
  LegalRepresentative: 'bg-violet-100 text-violet-800',
  Other: 'bg-gray-100 text-gray-800',
};

// ============================================================================
// Delete Confirmation Dialog
// ============================================================================

function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  actorName,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  actorName: string;
  loading: boolean;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-fadeIn" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 w-full max-w-md focus:outline-none">
          <AlertDialog.Title className="text-lg font-semibold text-gray-900 mb-2">
            Ștergere contact
          </AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-gray-600 mb-6">
            Sigur doriți să ștergeți <strong>{actorName}</strong>? Această acțiune nu poate fi
            anulată.
          </AlertDialog.Description>

          <div className="flex gap-3 justify-end">
            <AlertDialog.Cancel asChild>
              <button
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={loading}
              >
                Anulează
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                onClick={onConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Se șterge...' : 'Șterge'}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function InlineContactCard({
  actor,
  caseId,
  isNew = false,
  isEditing = false,
  onEdit,
  onSave,
  onCancel,
  editable,
  actorTypeOptions,
}: InlineContactCardProps) {
  const { addActor, loading: adding } = useActorAdd();
  const { updateActor, loading: updating } = useActorUpdate();
  const { removeActor, loading: removing } = useActorRemove();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [form, setForm] = useState<FormData>({
    role: actor?.role || 'Client',
    customRoleCode: actor?.customRoleCode || null,
    name: actor?.name || '',
    email: actor?.email || '',
    organization: actor?.organization || '',
    phone: actor?.phone || '',
  });

  const isEditMode = isNew || isEditing;
  const loading = adding || updating;

  // -------------------------------------------------------------------------
  // Dynamic Role Display (OPS-223)
  // -------------------------------------------------------------------------

  // Get role label: check custom role first, then dynamic options, then fallback to static
  const getRoleLabel = useMemo(() => {
    return (role: CaseActorRole, customCode: string | null) => {
      // If custom role code exists, look it up in options
      if (customCode && actorTypeOptions) {
        const customType = actorTypeOptions.find((t) => t.value === customCode && !t.isBuiltIn);
        if (customType) return customType.label;
      }
      // Otherwise, check dynamic options for built-in types
      if (actorTypeOptions) {
        const builtInType = actorTypeOptions.find((t) => t.value === role && t.isBuiltIn);
        if (builtInType) return builtInType.label;
      }
      // Fallback to static labels
      return ROLE_LABELS[role] || role;
    };
  }, [actorTypeOptions]);

  // Get role color: custom roles get neutral styling, built-in use predefined colors
  const getRoleColor = useMemo(() => {
    return (role: CaseActorRole, customCode: string | null) => {
      // Custom roles get neutral styling
      if (customCode) return 'bg-gray-100 text-gray-800';
      // Built-in roles use predefined colors
      return ROLE_COLORS[role] || 'bg-gray-100 text-gray-800';
    };
  }, []);

  // Options for role dropdown in edit mode
  const roleOptions = useMemo(() => {
    if (actorTypeOptions && actorTypeOptions.length > 0) {
      return actorTypeOptions;
    }
    // Fallback to static options if dynamic types not available
    return Object.entries(ROLE_LABELS).map(([value, label]) => ({
      value,
      label,
      isBuiltIn: true,
    }));
  }, [actorTypeOptions]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleSave = async () => {
    if (!form.name.trim()) return;

    try {
      if (isNew) {
        const input: AddCaseActorInput = {
          caseId,
          role: form.role,
          customRoleCode: form.customRoleCode || undefined, // OPS-223
          name: form.name.trim(),
          email: form.email.trim() || undefined,
          organization: form.organization.trim() || undefined,
          phone: form.phone.trim() || undefined,
        };
        await addActor(input);
      } else if (actor) {
        const input: UpdateCaseActorInput = {
          name: form.name.trim(),
          email: form.email.trim() || undefined,
          organization: form.organization.trim() || undefined,
          phone: form.phone.trim() || undefined,
        };
        await updateActor(actor.id, input);
      }
      onSave();
    } catch {
      // Error handled by hooks
    }
  };

  const handleDelete = async () => {
    if (!actor) return;

    try {
      await removeActor(actor.id);
      setDeleteDialogOpen(false);
      onSave();
    } catch {
      // Error handled by hook
    }
  };

  const handleCancel = () => {
    // Reset form to original values
    setForm({
      role: actor?.role || 'Client',
      customRoleCode: actor?.customRoleCode || null,
      name: actor?.name || '',
      email: actor?.email || '',
      organization: actor?.organization || '',
      phone: actor?.phone || '',
    });
    onCancel();
  };

  // Handle role selection - determine if built-in or custom
  const handleRoleChange = (value: string) => {
    const selectedOption = roleOptions.find((opt) => opt.value === value);
    if (selectedOption?.isBuiltIn) {
      // Built-in type: use role enum, clear customRoleCode
      setForm({ ...form, role: value as CaseActorRole, customRoleCode: null });
    } else {
      // Custom type: use 'Other' enum, set customRoleCode
      setForm({ ...form, role: 'Other', customRoleCode: value });
    }
  };

  // -------------------------------------------------------------------------
  // View Mode
  // -------------------------------------------------------------------------

  if (!isEditMode && actor) {
    return (
      <>
        <div className="border border-gray-200 rounded-lg p-3 bg-white hover:border-gray-300 transition-colors">
          <div className="flex justify-between items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={clsx(
                    'inline-block px-2 py-0.5 text-xs font-medium rounded',
                    getRoleColor(actor.role, actor.customRoleCode || null)
                  )}
                >
                  {getRoleLabel(actor.role, actor.customRoleCode || null)}
                </span>
                <span className="font-medium text-gray-900 truncate">{actor.name}</span>
              </div>
              {actor.email && (
                <div className="text-sm text-gray-500 mt-1 truncate">
                  <a href={`mailto:${actor.email}`} className="hover:text-blue-600">
                    {actor.email}
                  </a>
                </div>
              )}
              {actor.organization && (
                <div className="text-sm text-gray-500 truncate">{actor.organization}</div>
              )}
              {actor.phone && (
                <div className="text-sm text-gray-500 truncate">
                  <a href={`tel:${actor.phone}`} className="hover:text-blue-600">
                    {actor.phone}
                  </a>
                </div>
              )}
            </div>
            {editable && (
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={onEdit}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title="Editează"
                >
                  <Pencil1Icon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setDeleteDialogOpen(true)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Șterge"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        <DeleteConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={handleDelete}
          actorName={actor.name}
          loading={removing}
        />
      </>
    );
  }

  // -------------------------------------------------------------------------
  // Edit Mode
  // -------------------------------------------------------------------------

  return (
    <div className="border-2 border-blue-500 rounded-lg p-3 bg-blue-50/30 space-y-3">
      {/* Role Selection (only for new actors) - OPS-223: Dynamic actor types */}
      {isNew && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Rol</label>
          <select
            value={form.customRoleCode || form.role}
            onChange={(e) => handleRoleChange(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            disabled={loading}
          >
            {roleOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Name */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Nume <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Nume complet"
          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={loading}
          autoFocus
        />
      </div>

      {/* Email */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="email@exemplu.ro"
          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={loading}
        />
      </div>

      {/* Organization */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Organizație</label>
        <input
          type="text"
          value={form.organization}
          onChange={(e) => setForm({ ...form, organization: e.target.value })}
          placeholder="Numele firmei sau organizației"
          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={loading}
        />
      </div>

      {/* Phone */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Telefon</label>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder="+40 721 123 456"
          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={loading}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={handleCancel}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          disabled={loading}
        >
          <Cross2Icon className="h-3.5 w-3.5" />
          Anulează
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
          disabled={loading || !form.name.trim()}
        >
          <CheckIcon className="h-3.5 w-3.5" />
          {loading ? 'Se salvează...' : 'Salvează'}
        </button>
      </div>
    </div>
  );
}

InlineContactCard.displayName = 'InlineContactCard';
