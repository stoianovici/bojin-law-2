'use client';

import { useState } from 'react';
import { Plus, Mail, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePersonalContacts } from '@/hooks/useSettings';

export function PersonalEmailList() {
  const {
    data: emails,
    loading,
    addContact,
    removeContact,
    mutationLoading,
    mutationError,
  } = usePersonalContacts();
  const [newEmail, setNewEmail] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    if (!newEmail.trim()) return;
    try {
      await addContact(newEmail.trim());
      setNewEmail('');
      setIsAdding(false);
    } catch (err) {
      console.error('Failed to add email:', err);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await removeContact(id);
    } catch (err) {
      console.error('Failed to remove email:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-linear-text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Info text */}
      <p className="text-sm text-linear-text-secondary">
        Emailurile de la aceste adrese sunt ascunse din cronologia cazurilor
      </p>

      {/* Error message */}
      {mutationError && <p className="text-sm text-red-500">{mutationError.message}</p>}

      {/* Email list */}
      {emails && emails.length > 0 ? (
        <div className="space-y-2">
          {emails.map((contact) => (
            <div
              key={contact.id}
              className="flex items-center justify-between p-3 bg-linear-bg-tertiary rounded-lg"
            >
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-linear-text-muted" />
                <span className="text-sm text-linear-text-primary">{contact.email}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(contact.id)}
                disabled={mutationLoading}
              >
                <Trash2 className="h-4 w-4 text-linear-text-muted hover:text-red-500" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-linear-text-muted">
          <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Nu există adrese de email personale marcate</p>
        </div>
      )}

      {/* Add form */}
      {isAdding ? (
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="email@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            disabled={mutationLoading}
            autoFocus
          />
          <Button onClick={handleAdd} disabled={mutationLoading || !newEmail.trim()}>
            {mutationLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Adaugă'}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setIsAdding(false);
              setNewEmail('');
            }}
          >
            Anulează
          </Button>
        </div>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setIsAdding(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Adaugă adresă
        </Button>
      )}
    </div>
  );
}
