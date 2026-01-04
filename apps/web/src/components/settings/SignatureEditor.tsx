'use client';

import { useState, useEffect } from 'react';
import { Info, Loader2 } from 'lucide-react';
import { TextArea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useUserPreferences } from '@/hooks/useSettings';

export function SignatureEditor() {
  const { data, loading, updatePreferences, updateLoading, updateError } = useUserPreferences();
  const [signature, setSignature] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize signature from data
  useEffect(() => {
    if (data?.emailSignature !== undefined) {
      setSignature(data.emailSignature || '');
    }
  }, [data?.emailSignature]);

  const handleSave = async () => {
    try {
      await updatePreferences({ emailSignature: signature || null });
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to save signature:', err);
    }
  };

  const handleChange = (value: string) => {
    setSignature(value);
    setHasChanges(value !== (data?.emailSignature || ''));
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
      {/* Info banner */}
      <div className="flex items-center gap-3 rounded-md bg-linear-bg-tertiary px-4 py-3 text-sm text-linear-text-secondary">
        <Info className="h-4 w-4 shrink-0 text-linear-accent" />
        <span>Semnătura de email va fi adăugată la mesajele trimise din această aplicație</span>
      </div>

      {/* TextArea */}
      <TextArea
        placeholder="Introdu semnătura HTML..."
        rows={6}
        value={signature}
        onChange={(e) => handleChange(e.target.value)}
        disabled={updateLoading}
      />

      {/* Error message */}
      {updateError && <p className="text-sm text-red-500">{updateError.message}</p>}

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
