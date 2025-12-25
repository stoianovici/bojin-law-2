/**
 * Personal Contacts Section Component
 * OPS-193: Personal Contacts Profile Page
 *
 * Displays and manages the user's personal contacts blocklist.
 * Emails from these addresses won't be synced.
 */

'use client';

import React, { useState, useCallback } from 'react';
import { UserX, RefreshCcw, Mail, Trash2, AlertCircle, Inbox } from 'lucide-react';
import { usePersonalContacts, type PersonalContact } from '../../hooks/usePersonalContacts';
import { useNotificationStore } from '../../stores/notificationStore';

// ============================================================================
// Contact Item Component
// ============================================================================

interface ContactItemProps {
  contact: PersonalContact;
  onRemove: (email: string) => void;
  removing: boolean;
}

function ContactItem({ contact, onRemove, removing }: ContactItemProps) {
  const [confirmRemove, setConfirmRemove] = useState(false);

  const handleRemoveClick = useCallback(() => {
    if (confirmRemove) {
      onRemove(contact.email);
      setConfirmRemove(false);
    } else {
      setConfirmRemove(true);
    }
  }, [confirmRemove, contact.email, onRemove]);

  const handleCancel = useCallback(() => {
    setConfirmRemove(false);
  }, []);

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white rounded-full border border-gray-200">
          <Mail className="h-4 w-4 text-gray-500" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">{contact.email}</p>
          <p className="text-xs text-gray-500">
            Adăugat: {new Date(contact.createdAt).toLocaleDateString('ro-RO')}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {confirmRemove ? (
          <>
            <button
              onClick={handleRemoveClick}
              disabled={removing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {removing ? (
                <RefreshCcw className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
              Confirmă
            </button>
            <button
              onClick={handleCancel}
              disabled={removing}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 transition-colors"
            >
              Anulează
            </button>
          </>
        ) : (
          <button
            onClick={handleRemoveClick}
            disabled={removing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 disabled:opacity-50 transition-colors"
            title="Reclasifică - emailurile viitoare vor fi sincronizate"
          >
            <RefreshCcw className="h-3 w-3" />
            Reclasifică
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Skeleton Loading Component
// ============================================================================

function ContactsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 animate-pulse"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-200 rounded-full h-8 w-8" />
            <div className="space-y-2">
              <div className="h-4 w-48 bg-gray-200 rounded" />
              <div className="h-3 w-32 bg-gray-200 rounded" />
            </div>
          </div>
          <div className="h-7 w-24 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Empty State Component
// ============================================================================

function EmptyState() {
  return (
    <div className="text-center py-8">
      <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full mb-4">
        <Inbox className="h-6 w-6 text-gray-400" />
      </div>
      <h3 className="text-sm font-medium text-gray-900 mb-1">Nicio adresă de email personală</h3>
      <p className="text-sm text-gray-500 max-w-xs mx-auto">
        Puteți marca expeditorii ca &quot;Personal&quot; din pagina de comunicări pentru a opri
        sincronizarea emailurilor de la aceștia.
      </p>
    </div>
  );
}

// ============================================================================
// Error State Component
// ============================================================================

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="rounded-lg bg-red-50 border border-red-200 p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-red-800">Eroare la încărcarea contactelor</h3>
          <p className="text-sm text-red-700 mt-1">{message}</p>
          <button
            onClick={onRetry}
            className="mt-2 text-sm font-medium text-red-600 hover:text-red-800"
          >
            Încearcă din nou
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PersonalContactsSection() {
  const { contacts, loading, error, removing, removeContact, refetch } = usePersonalContacts();
  const { addNotification } = useNotificationStore();

  const handleRemove = useCallback(
    async (email: string) => {
      try {
        await removeContact(email);
        addNotification({
          type: 'success',
          title: 'Contact reclasificat',
          message: `Emailurile de la ${email} vor fi sincronizate din nou.`,
        });
      } catch (err) {
        addNotification({
          type: 'error',
          title: 'Eroare',
          message: 'Nu s-a putut reclasifica contactul. Încercați din nou.',
        });
      }
    },
    [removeContact, addNotification]
  );

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-100 rounded-lg">
            <UserX className="h-5 w-5 text-gray-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Contacte personale</h2>
            <p className="text-sm text-gray-600">
              Emailurile de la aceste adrese nu vor fi sincronizate
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {loading && <ContactsSkeleton />}

        {error && <ErrorState message={error.message} onRetry={refetch} />}

        {!loading && !error && contacts.length === 0 && <EmptyState />}

        {!loading && !error && contacts.length > 0 && (
          <div className="space-y-3">
            {contacts.map((contact) => (
              <ContactItem
                key={contact.id}
                contact={contact}
                onRemove={handleRemove}
                removing={removing}
              />
            ))}
          </div>
        )}
      </div>

      {/* Info box */}
      {!loading && !error && contacts.length > 0 && (
        <div className="px-6 pb-6">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
              <div className="text-sm text-amber-700">
                <p className="font-medium">Despre reclasificare</p>
                <p className="mt-1">
                  Când reclasificați un contact, emailurile viitoare de la această adresă vor fi
                  sincronizate din nou. Emailurile vechi nu vor fi recuperate automat.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

PersonalContactsSection.displayName = 'PersonalContactsSection';
