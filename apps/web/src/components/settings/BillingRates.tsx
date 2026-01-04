'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useDefaultRates } from '@/hooks/useSettings';

export function BillingRates() {
  const { data, loading, updateRates, updateLoading, updateError } = useDefaultRates();
  const [rates, setRates] = useState({
    partnerRate: '',
    associateRate: '',
    paralegalRate: '',
  });
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize rates from data
  useEffect(() => {
    if (data) {
      setRates({
        partnerRate: data.partnerRate?.toString() || '',
        associateRate: data.associateRate?.toString() || '',
        paralegalRate: data.paralegalRate?.toString() || '',
      });
    }
  }, [data]);

  const handleChange = (field: keyof typeof rates, value: string) => {
    const newRates = { ...rates, [field]: value };
    setRates(newRates);

    // Check if changed from original
    if (data) {
      const changed =
        newRates.partnerRate !== (data.partnerRate?.toString() || '') ||
        newRates.associateRate !== (data.associateRate?.toString() || '') ||
        newRates.paralegalRate !== (data.paralegalRate?.toString() || '');
      setHasChanges(changed);
    }
  };

  const handleSave = async () => {
    try {
      await updateRates({
        partnerRate: parseFloat(rates.partnerRate) || 0,
        associateRate: parseFloat(rates.associateRate) || 0,
        paralegalRate: parseFloat(rates.paralegalRate) || 0,
      });
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to save rates:', err);
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
        Tarifele orare implicite folosite la crearea cazurilor noi
      </p>

      {/* Error message */}
      {updateError && <p className="text-sm text-red-500">{updateError.message}</p>}

      {/* Rate inputs */}
      <div className="grid gap-4">
        <div>
          <label className="text-sm text-linear-text-secondary mb-1.5 block">
            Tarif Partener ($/oră)
          </label>
          <Input
            type="number"
            leftAddon="$"
            placeholder="0.00"
            value={rates.partnerRate}
            onChange={(e) => handleChange('partnerRate', e.target.value)}
            disabled={updateLoading}
          />
        </div>
        <div>
          <label className="text-sm text-linear-text-secondary mb-1.5 block">
            Tarif Avocat ($/oră)
          </label>
          <Input
            type="number"
            leftAddon="$"
            placeholder="0.00"
            value={rates.associateRate}
            onChange={(e) => handleChange('associateRate', e.target.value)}
            disabled={updateLoading}
          />
        </div>
        <div>
          <label className="text-sm text-linear-text-secondary mb-1.5 block">
            Tarif Paralegal ($/oră)
          </label>
          <Input
            type="number"
            leftAddon="$"
            placeholder="0.00"
            value={rates.paralegalRate}
            onChange={(e) => handleChange('paralegalRate', e.target.value)}
            disabled={updateLoading}
          />
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
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
