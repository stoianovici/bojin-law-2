/**
 * Case Actors Management Component
 * Story 2.8: Case CRUD Operations UI - Task 13
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
 * Get actor role display name
 */
function getActorRoleDisplay(role: CaseActorRole): string {
  const roleMap: Record<CaseActorRole, string> = {
    Client: 'Client',
    OpposingParty: 'Opposing Party',
    OpposingCounsel: 'Opposing Counsel',
    Witness: 'Witness',
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
    phone: actor?.phone || '',
    address: actor?.address || '',
    notes: actor?.notes || '',
  });

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
            {actor ? 'Edit Case Actor' : 'Add Case Actor'}
          </Dialog.Title>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role Selection (only for new actors) */}
            {!actor && (
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                  Role <span className="text-red-500">*</span>
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
                  <option value="OpposingParty">Opposing Party</option>
                  <option value="OpposingCounsel">Opposing Counsel</option>
                  <option value="Witness">Witness</option>
                  <option value="Expert">Expert</option>
                </select>
              </div>
            )}

            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter actor's full name"
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
                Organization
              </label>
              <input
                id="organization"
                type="text"
                value={formData.organization}
                onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                placeholder="Company or organization name"
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
                  placeholder="email@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Address */}
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Full address"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                disabled={loading}
              />
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes or information"
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
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading || !formData.name?.trim()}
              >
                {loading
                  ? actor
                    ? 'Updating...'
                    : 'Adding...'
                  : actor
                    ? 'Update Actor'
                    : 'Add Actor'}
              </button>
            </div>
          </form>

          <Dialog.Close asChild>
            <button
              className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
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
            Remove Case Actor
          </AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-gray-600 mb-6">
            Are you sure you want to remove <strong>{actorName}</strong>? This action cannot be
            undone.
          </AlertDialog.Description>

          <div className="flex gap-3 justify-end">
            <AlertDialog.Cancel asChild>
              <button
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                onClick={onConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? 'Removing...' : 'Remove'}
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
          Add Actor
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
                            aria-label={`Edit ${actor.name}`}
                            title={`Edit ${actor.name}`}
                          >
                            <Pencil1Icon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveClick(actor)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            aria-label={`Remove ${actor.name}`}
                            title={`Remove ${actor.name}`}
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
                            <dt className="text-gray-500">Phone</dt>
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
                            <dt className="text-gray-500">Address</dt>
                            <dd className="text-gray-900">{actor.address}</dd>
                          </div>
                        )}
                        {actor.notes && (
                          <div className="md:col-span-2">
                            <dt className="text-gray-500">Notes</dt>
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
        <p className="text-gray-500 text-sm text-center py-6">No case actors added yet.</p>
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
