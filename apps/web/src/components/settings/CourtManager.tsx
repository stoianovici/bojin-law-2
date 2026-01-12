'use client';

import { useState } from 'react';
import { Plus, Building2, Trash2, Loader2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCourts } from '@/hooks/useSettings';

export function CourtManager() {
  const {
    data: courts,
    loading,
    createCourt,
    updateCourt,
    deleteCourt,
    mutationLoading,
    mutationError,
  } = useCourts();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', addresses: '' });

  // Parse addresses input into domains and emails
  const parseAddresses = (input: string) => {
    const items = input
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const domains: string[] = [];
    const emails: string[] = [];

    for (const item of items) {
      if (item.includes('@')) {
        emails.push(item);
      } else {
        domains.push(item);
      }
    }

    return { domains, emails };
  };

  const handleAdd = async () => {
    if (!formData.name.trim()) return;
    try {
      const { domains, emails } = parseAddresses(formData.addresses);
      await createCourt({
        name: formData.name.trim(),
        domains,
        emails,
      });
      setFormData({ name: '', addresses: '' });
      setIsAdding(false);
    } catch (err) {
      console.error('Failed to create court:', err);
    }
  };

  const handleUpdate = async () => {
    if (!editingId || !formData.name.trim()) return;
    try {
      const { domains, emails } = parseAddresses(formData.addresses);
      await updateCourt(editingId, {
        name: formData.name.trim(),
        domains,
        emails,
      });
      setFormData({ name: '', addresses: '' });
      setEditingId(null);
    } catch (err) {
      console.error('Failed to update court:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sigur doriți să ștergeți această instanță?')) return;
    try {
      await deleteCourt(id);
    } catch (err) {
      console.error('Failed to delete court:', err);
    }
  };

  const startEdit = (court: (typeof courts)[0]) => {
    setEditingId(court.id);
    // Combine domains and emails into a single addresses string
    const allAddresses = [...(court.domains || []), ...(court.emails || [])];
    setFormData({
      name: court.name,
      addresses: allAddresses.join(', '),
    });
    setIsAdding(false);
  };

  const cancelForm = () => {
    setFormData({ name: '', addresses: '' });
    setIsAdding(false);
    setEditingId(null);
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
      {/* Error message */}
      {mutationError && <p className="text-sm text-red-500">{mutationError.message}</p>}

      {/* Table structure */}
      <div className="border border-linear-border-subtle rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-linear-bg-tertiary">
            <tr>
              <th className="text-left text-sm font-normal text-linear-text-secondary px-4 py-2">
                Nume
              </th>
              <th className="text-left text-sm font-normal text-linear-text-secondary px-4 py-2">
                Adrese Email
              </th>
              <th className="w-24"></th>
            </tr>
          </thead>
          <tbody>
            {courts && courts.length > 0 ? (
              courts.map((court) => (
                <tr key={court.id} className="border-t border-linear-border-subtle">
                  <td className="px-4 py-3 text-sm text-linear-text-primary">{court.name}</td>
                  <td className="px-4 py-3 text-sm text-linear-text-secondary">
                    {[...(court.domains || []), ...(court.emails || [])].join(', ') || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(court)}
                        disabled={mutationLoading}
                      >
                        <Pencil className="h-4 w-4 text-linear-text-muted" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(court.id)}
                        disabled={mutationLoading}
                      >
                        <Trash2 className="h-4 w-4 text-linear-text-muted hover:text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="text-center py-8 text-linear-text-muted">
                  <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nu există instanțe configurate</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit form */}
      {(isAdding || editingId) && (
        <div className="space-y-3 p-4 bg-linear-bg-tertiary rounded-lg">
          <Input
            placeholder="Nume instanță"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            disabled={mutationLoading}
          />
          <Input
            placeholder="Adrese sau domenii email (separate prin virgulă)"
            value={formData.addresses}
            onChange={(e) => setFormData({ ...formData, addresses: e.target.value })}
            disabled={mutationLoading}
          />
          <div className="flex gap-2">
            <Button
              onClick={editingId ? handleUpdate : handleAdd}
              disabled={mutationLoading || !formData.name.trim()}
            >
              {mutationLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingId ? (
                'Salvează'
              ) : (
                'Adaugă'
              )}
            </Button>
            <Button variant="ghost" onClick={cancelForm}>
              Anulează
            </Button>
          </div>
        </div>
      )}

      {/* Add button */}
      {!isAdding && !editingId && (
        <Button variant="secondary" size="sm" onClick={() => setIsAdding(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Adaugă Instanță
        </Button>
      )}
    </div>
  );
}
