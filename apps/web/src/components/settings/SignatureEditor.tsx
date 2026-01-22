'use client';

import { useState, useEffect } from 'react';
import { Info, Loader2, Wand2, Copy, Check } from 'lucide-react';
import { TextArea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useUserPreferences } from '@/hooks/useSettings';
import { useAuth } from '@/hooks/useAuth';
import { generateSignatureHtmlSimple } from '@/lib/signature-template';

export function SignatureEditor() {
  const { data, loading, error: queryError, updatePreferences, updateLoading, updateError } = useUserPreferences();
  const { user } = useAuth();

  const [signature, setSignature] = useState('');
  const [phone, setPhone] = useState('');
  const [title, setTitle] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [copied, setCopied] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Initialize from data only once
  useEffect(() => {
    if (data && !initialized && !loading) {
      setSignature(data.emailSignature || '');
      setPhone(data.signaturePhone || '');
      setTitle(data.signatureTitle || '');
      setInitialized(true);
    }
  }, [data, initialized, loading]);

  const handleSave = async () => {
    try {
      await updatePreferences({
        emailSignature: signature || null,
        signaturePhone: phone || null,
        signatureTitle: title || null,
      });
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to save signature:', err);
    }
  };

  const handleGenerateSignature = () => {
    if (!user || !phone || !title) return;

    // Parse name from user.name (format: "FirstName LastName")
    const nameParts = user.name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const html = generateSignatureHtmlSimple({
      firstName,
      lastName,
      title,
      phone,
      email: user.email,
    });

    setSignature(html);
    setHasChanges(true);
  };

  const handleCopySignature = async () => {
    if (!signature) return;
    try {
      await navigator.clipboard.writeText(signature);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleFieldChange = (field: 'signature' | 'phone' | 'title', value: string) => {
    if (field === 'signature') setSignature(value);
    if (field === 'phone') setPhone(value);
    if (field === 'title') setTitle(value);

    // Check for changes
    const newSignature = field === 'signature' ? value : signature;
    const newPhone = field === 'phone' ? value : phone;
    const newTitle = field === 'title' ? value : title;

    setHasChanges(
      newSignature !== (data?.emailSignature || '') ||
        newPhone !== (data?.signaturePhone || '') ||
        newTitle !== (data?.signatureTitle || '')
    );
  };

  const canGenerate = phone && title && user;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-linear-text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error banner if query or update failed */}
      {(queryError || updateError) && (
        <div className="flex items-center gap-3 rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-500">
          <span>Eroare: {queryError?.message || updateError?.message}</span>
        </div>
      )}

      {/* Info banner */}
      <div className="flex items-center gap-3 rounded-md bg-linear-bg-tertiary px-4 py-3 text-sm text-linear-text-secondary">
        <Info className="h-4 w-4 shrink-0 text-linear-accent" />
        <span>Semnătura va fi adăugată la emailurile trimise din aplicație</span>
      </div>

      {/* Profile fields for signature generation */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-linear-text-primary">Date pentru semnătură</h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm text-linear-text-secondary">Telefon</label>
            <input
              type="text"
              placeholder="+40-7XX-XXXXXX"
              value={phone}
              onChange={(e) => handleFieldChange('phone', e.target.value)}
              disabled={updateLoading}
              className="flex w-full rounded-md bg-linear-bg-elevated border border-linear-border-subtle text-linear-text-primary placeholder:text-linear-text-muted focus:outline-none focus:ring-2 focus:ring-linear-accent focus:border-transparent h-8 text-sm px-3"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-linear-text-secondary">Funcție</label>
            <input
              type="text"
              placeholder="Avocat - Partner"
              value={title}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              disabled={updateLoading}
              className="flex w-full rounded-md bg-linear-bg-elevated border border-linear-border-subtle text-linear-text-primary placeholder:text-linear-text-muted focus:outline-none focus:ring-2 focus:ring-linear-accent focus:border-transparent h-8 text-sm px-3"
            />
          </div>
        </div>

        <Button
          variant="secondary"
          onClick={handleGenerateSignature}
          disabled={!canGenerate || updateLoading}
          className="w-full md:w-auto"
        >
          <Wand2 className="h-4 w-4 mr-2" />
          Generează Semnătură
        </Button>
      </div>

      {/* Divider */}
      <div className="border-t border-linear-border" />

      {/* Signature HTML */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-linear-text-primary">Cod HTML</label>
          <Button variant="ghost" size="sm" onClick={handleCopySignature} disabled={!signature}>
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-1" />
                Copiat
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-1" />
                Copiază
              </>
            )}
          </Button>
        </div>
        <TextArea
          placeholder="Codul HTML al semnăturii..."
          rows={8}
          value={signature}
          onChange={(e) => handleFieldChange('signature', e.target.value)}
          disabled={updateLoading}
          className="font-mono text-xs"
        />
      </div>

      {/* Preview */}
      {signature && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-linear-text-primary">Previzualizare</label>
          <div
            className="rounded-md border border-linear-border bg-white p-4"
            dangerouslySetInnerHTML={{ __html: signature }}
          />
        </div>
      )}

      {/* Save button */}
      <div className="flex items-center justify-end">
        <Button onClick={handleSave} disabled={!hasChanges || updateLoading}>
          {updateLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Se salvează...
            </>
          ) : (
            'Salvează'
          )}
        </Button>
      </div>
    </div>
  );
}
