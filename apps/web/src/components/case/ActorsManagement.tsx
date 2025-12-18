/**
 * Case Actors Management Component
 * Story 2.8: Case CRUD Operations UI - Task 13
 * OPS-038: Added emailDomains support, Romanian translations
 *
 * Manages case actors (external parties) with add/edit/remove functionality
 */

'use client';

import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { Cross2Icon, PlusIcon, TrashIcon, Pencil1Icon } from '@radix-ui/react-icons';
import { useActorAdd, type AddCaseActorInput } from '../../hooks/useActorAdd';
import { useActorUpdate, type UpdateCaseActorInput } from '../../hooks/useActorUpdate';
import { useActorRemove } from '../../hooks/useActorRemove';
import type { CaseActor, CaseActorRole } from '@legal-platform/types';

interface ActorsManagementProps {
  caseId: string;
  actors: CaseActor[];
}

/**
 * Get actor role display name (Romanian)
 */
function getActorRoleDisplay(role: CaseActorRole): string {
  const roleMap: Record<CaseActorRole, string> = {
    Client: 'Client',
    OpposingParty: 'Parte adversă',
    OpposingCounsel: 'Avocat parte adversă',
    Witness: 'Martor',
    Expert: 'Expert',
  };
  return roleMap[role];
}

/**
 * Get role color classes
 */
function getRoleColorClasses(role: CaseActorRole): string {
  const colorMap: Record<CaseActorRole, string> = {
    Client: 'bg-blue-100 text-blue-800',
    OpposingParty: 'bg-red-100 text-red-800',
    OpposingCounsel: 'bg-orange-100 text-orange-800',
    Witness: 'bg-green-100 text-green-800',
    Expert: 'bg-purple-100 text-purple-800',
  };
  return colorMap[role];
}

/**
 * Add/Edit Actor Form Modal Component
 * OPS-038: Added emailDomains support
 */
function ActorFormModal({
  open,
  onOpenChange,
  caseId,
  actor,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  actor?: CaseActor;
}) {
  const { addActor, loading: adding } = useActorAdd();
  const { updateActor, loading: updating } = useActorUpdate();
  const loading = adding || updating;

  const [formData, setFormData] = useState<Partial<AddCaseActorInput>>({
    caseId,
    role: actor?.role || 'Client',
    name: actor?.name || '',
    organization: actor?.organization || '',
    email: actor?.email || '',
    emailDomains: (actor as any)?.emailDomains || [],
    phone: actor?.phone || '',
    address: actor?.address || '',
    notes: actor?.notes || '',
  });

  // OPS-038: State for new email domain input
  const [newEmailDomain, setNewEmailDomain] = useState('');

  const handleAddEmailDomain = () => {
    const trimmed = newEmailDomain.trim();
    if (trimmed && !formData.emailDomains?.includes(trimmed)) {
      setFormData((prev) => ({
        ...prev,
        emailDomains: [...(prev.emailDomains || []), trimmed],
      }));
      setNewEmailDomain('');
    }
  };

  const handleRemoveEmailDomain = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      emailDomains: (prev.emailDomains || []).filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name?.trim()) {
      return;
    }

    try {
      if (actor) {
        // Update existing actor
        const updateData: UpdateCaseActorInput = {
          name: formData.name?.trim(),
          organization: formData.organization?.trim() || undefined,
          email: formData.email?.trim() || undefined,
          emailDomains: formData.emailDomains?.length ? formData.emailDomains : undefined,
          phone: formData.phone?.trim() || undefined,
          address: formData.address?.trim() || undefined,
          notes: formData.notes?.trim() || undefined,
        };
        await updateActor(actor.id, updateData);
      } else {
        // Add new actor
        const addData: AddCaseActorInput = {
          caseId,
          role: formData.role!,
          name: formData.name.trim(),
          organization: formData.organization?.trim() || undefined,
          email: formData.email?.trim() || undefined,
          emailDomains: formData.emailDomains?.length ? formData.emailDomains : undefined,
          phone: formData.phone?.trim() || undefined,
          address: formData.address?.trim() || undefined,
          notes: formData.notes?.trim() || undefined,
        };
        await addActor(addData);
      }

      // Reset form and close modal on success
      setFormData({
        caseId,
        role: 'Client',
        name: '',
        organization: '',
        email: '',
        phone: '',
        address: '',
        notes: '',
      });
      onOpenChange(false);
    } catch (err) {
      // Error handled by hook
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-fadeIn" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto focus:outline-none">
          <Dialog.Title className="text-xl font-semibold text-gray-900 mb-4">
            {actor ? 'Editare persoană contact' : 'Adăugare persoană contact'}
          </Dialog.Title>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role Selection (only for new actors) */}
            {!actor && (
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                  Rol <span className="text-red-500">*</span>
                </label>
                <select
                  id="role"
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value as CaseActorRole })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  disabled={loading}
                >
                  <option value="Client">Client</option>
                  <option value="OpposingParty">Parte adversă</option>
                  <option value="OpposingCounsel">Avocat parte adversă</option>
                  <option value="Witness">Martor</option>
                  <option value="Expert">Expert</option>
                </select>
              </div>
            )}

            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Nume <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nume complet"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                minLength={2}
                maxLength={200}
                disabled={loading}
              />
            </div>

            {/* Organization */}
            <div>
              <label
                htmlFor="organization"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Organizație
              </label>
              <input
                id="organization"
                type="text"
                value={formData.organization}
                onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                placeholder="Numele firmei sau organizației"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
            </div>

            {/* Email and Phone (2-column grid) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplu.ro"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Telefon
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+40 721 123 456"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>
            </div>

            {/* OPS-038: Additional Email Domains */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adrese email suplimentare
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Adaugă alte adrese de email pentru clasificarea automată a emailurilor
              </p>
              {formData.emailDomains && formData.emailDomains.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.emailDomains.map((email, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm"
                    >
                      {email}
                      <button
                        type="button"
                        onClick={() => handleRemoveEmailDomain(index)}
                        className="hover:text-blue-900"
                        disabled={loading}
                      >
                        <Cross2Icon className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newEmailDomain}
                  onChange={(e) => setNewEmailDomain(e.target.value)}
                  placeholder="alt.email@exemplu.ro"
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddEmailDomain();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddEmailDomain}
                  disabled={loading || !newEmailDomain.trim()}
                  className="px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                >
                  Adaugă
                </button>
              </div>
            </div>

            {/* Address */}
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                Adresă
              </label>
              <textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Adresa completă"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                disabled={loading}
              />
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                Note
              </label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Informații suplimentare"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                disabled={loading}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={loading}
                >
                  Anulează
                </button>
              </Dialog.Close>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading || !formData.name?.trim()}
              >
                {loading
                  ? actor
                    ? 'Se actualizează...'
                    : 'Se adaugă...'
                  : actor
                    ? 'Actualizează'
                    : 'Adaugă'}
              </button>
            </div>
          </form>

          <Dialog.Close asChild>
            <button
              className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Închide"
            >
              <Cross2Icon className="h-5 w-5" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Remove Actor Confirmation Dialog
 */
function RemoveConfirmDialog({
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
          <AlertDialog.Title className="text-xl font-semibold text-gray-900 mb-2">
            Ștergere persoană contact
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
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

/**
 * Main Actors Management Component
 */
export function ActorsManagement({ caseId, actors }: ActorsManagementProps) {
  const { removeActor, loading: removing } = useActorRemove();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [actorToEdit, setActorToEdit] = useState<CaseActor | null>(null);
  const [actorToRemove, setActorToRemove] = useState<CaseActor | null>(null);

  // Group actors by role
  const actorsByRole: Record<CaseActorRole, CaseActor[]> = {
    Client: [],
    OpposingParty: [],
    OpposingCounsel: [],
    Witness: [],
    Expert: [],
  };

  actors.forEach((actor) => {
    actorsByRole[actor.role].push(actor);
  });

  const handleEditClick = (actor: CaseActor) => {
    setActorToEdit(actor);
    setEditModalOpen(true);
  };

  const handleRemoveClick = (actor: CaseActor) => {
    setActorToRemove(actor);
    setRemoveDialogOpen(true);
  };

  const handleConfirmRemove = async () => {
    if (!actorToRemove) return;

    try {
      await removeActor(actorToRemove.id);
      setRemoveDialogOpen(false);
      setActorToRemove(null);
    } catch (err) {
      // Error handled by hook
    }
  };

  return (
    <div className="space-y-6">
      {/* Add Actor Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setAddModalOpen(true)}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="mr-2 h-4 w-4" />
          Adaugă contact
        </button>
      </div>

      {/* Actors grouped by role */}
      {actors && actors.length > 0 ? (
        <div className="space-y-6">
          {(Object.keys(actorsByRole) as CaseActorRole[]).map((role) => {
            const roleActors = actorsByRole[role];
            if (roleActors.length === 0) return null;

            return (
              <div key={role} className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  {getActorRoleDisplay(role)} ({roleActors.length})
                </h4>
                <div className="space-y-3">
                  {roleActors.map((actor) => (
                    <div
                      key={actor.id}
                      className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h5 className="font-medium text-gray-900">{actor.name}</h5>
                            <span
                              className={`inline-block px-2 py-1 text-xs font-medium rounded ${getRoleColorClasses(
                                actor.role
                              )}`}
                            >
                              {getActorRoleDisplay(actor.role)}
                            </span>
                          </div>
                          {actor.organization && (
                            <p className="text-sm text-gray-600">{actor.organization}</p>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditClick(actor)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            aria-label={`Editează ${actor.name}`}
                            title={`Editează ${actor.name}`}
                          >
                            <Pencil1Icon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveClick(actor)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            aria-label={`Șterge ${actor.name}`}
                            title={`Șterge ${actor.name}`}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Actor Details Grid */}
                      <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        {actor.email && (
                          <div>
                            <dt className="text-gray-500">Email</dt>
                            <dd className="text-gray-900">
                              <a
                                href={`mailto:${actor.email}`}
                                className="text-blue-600 hover:underline"
                              >
                                {actor.email}
                              </a>
                            </dd>
                          </div>
                        )}
                        {actor.phone && (
                          <div>
                            <dt className="text-gray-500">Telefon</dt>
                            <dd className="text-gray-900">
                              <a
                                href={`tel:${actor.phone}`}
                                className="text-blue-600 hover:underline"
                              >
                                {actor.phone}
                              </a>
                            </dd>
                          </div>
                        )}
                        {actor.address && (
                          <div className="md:col-span-2">
                            <dt className="text-gray-500">Adresă</dt>
                            <dd className="text-gray-900">{actor.address}</dd>
                          </div>
                        )}
                        {actor.notes && (
                          <div className="md:col-span-2">
                            <dt className="text-gray-500">Note</dt>
                            <dd className="text-gray-900">{actor.notes}</dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-gray-500 text-sm text-center py-6">
          Nu au fost adăugate persoane de contact.
        </p>
      )}

      {/* Add Actor Modal */}
      <ActorFormModal caseId={caseId} open={addModalOpen} onOpenChange={setAddModalOpen} />

      {/* Edit Actor Modal */}
      {actorToEdit && (
        <ActorFormModal
          caseId={caseId}
          actor={actorToEdit}
          open={editModalOpen}
          onOpenChange={(open) => {
            setEditModalOpen(open);
            if (!open) setActorToEdit(null);
          }}
        />
      )}

      {/* Remove Confirmation Dialog */}
      {actorToRemove && (
        <RemoveConfirmDialog
          open={removeDialogOpen}
          onOpenChange={setRemoveDialogOpen}
          onConfirm={handleConfirmRemove}
          actorName={actorToRemove.name}
          loading={removing}
        />
      )}
    </div>
  );
}
