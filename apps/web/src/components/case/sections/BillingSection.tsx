/**
 * Billing Section Component
 * OPS-213: BillingSection Component
 *
 * Inline editing for billing configuration (type, rates, fixed amount).
 * Partners only - wrapped in FinancialData for access control.
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Pencil1Icon, CheckIcon, Cross2Icon } from '@radix-ui/react-icons';
import type { BillingType, CustomRates } from '@legal-platform/types';
import { FinancialData } from '../../auth/FinancialData';
import { InlineEditField } from '../InlineEditField';
import { useCaseUpdate } from '../../../hooks/useCaseUpdate';
import { useNotificationStore } from '../../../stores/notificationStore';

// ============================================================================
// Types
// ============================================================================

interface BillingSectionProps {
  caseId: string;
  billing: {
    type: BillingType;
    fixedAmount?: number | null;
    customRates?: CustomRates | null;
  };
  editable: boolean;
}

// ============================================================================
// Rate Field Component
// ============================================================================

interface RateFieldProps {
  label: string;
  value: number | null | undefined;
  editable: boolean;
  onSave: (value: number | null) => Promise<void>;
  loading: boolean;
}

function RateField({ label, value, editable, onSave, loading }: RateFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const displayValue = value != null ? `${value} RON/h` : 'Standard';

  const handleEdit = () => {
    if (!editable) return;
    setEditValue(value != null ? String(value) : '');
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue('');
  };

  const handleSave = async () => {
    const numValue = editValue === '' ? null : parseFloat(editValue);

    // Don't save if value hasn't changed
    if (numValue === value) {
      handleCancel();
      return;
    }

    try {
      await onSave(numValue);
      setIsEditing(false);
      setEditValue('');
    } catch {
      // Error handled by parent
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') handleCancel();
    else if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <div className="flex-1">
        <label className="text-sm font-medium text-gray-500 block mb-1">{label}</label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-3 py-1.5 pr-16 border border-blue-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 text-sm"
              placeholder="RON/oră"
              disabled={loading}
              step="1"
              min="0"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              RON/h
            </span>
          </div>
          <button
            onClick={handleSave}
            disabled={loading}
            className="p-1.5 text-green-600 hover:bg-green-50 rounded-md transition-colors disabled:opacity-50"
            title="Salvează"
            type="button"
          >
            <CheckIcon className="h-4 w-4" />
          </button>
          <button
            onClick={handleCancel}
            disabled={loading}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
            title="Anulează"
            type="button"
          >
            <Cross2Icon className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-500">Enter = salvează, ESC = anulează</p>
      </div>
    );
  }

  return (
    <div className={`flex-1 group ${editable ? 'cursor-pointer' : ''}`} onClick={handleEdit}>
      <div className="text-sm font-medium text-gray-500 mb-1 flex items-center justify-between">
        <span>{label}</span>
        {editable && (
          <Pencil1Icon className="h-3.5 w-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
      <div
        className={`text-sm font-semibold ${
          value != null ? 'text-gray-900' : 'text-gray-400 italic'
        } ${editable ? 'group-hover:text-blue-600 transition-colors' : ''}`}
      >
        {displayValue}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function BillingSection({ caseId, billing, editable }: BillingSectionProps) {
  const { updateCase, loading } = useCaseUpdate();
  const { addNotification } = useNotificationStore();

  // Format fixed amount for display (stored in cents, display in RON)
  const formatFixedAmount = (value: string | number | null | undefined) => {
    if (value == null || value === '') return '-';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    // Value is in cents, convert to RON
    const ronValue = numValue / 100;
    return `${ronValue.toLocaleString('ro-RO')} RON`;
  };

  // Handler to update a single rate while preserving others
  const handleRateSave = async (
    rateKey: 'partnerRate' | 'associateRate' | 'paralegalRate',
    value: number | null
  ) => {
    try {
      const currentRates = billing.customRates || {};
      const newRates: CustomRates = {
        ...currentRates,
        [rateKey]: value,
      };

      await updateCase(caseId, { customRates: newRates });

      addNotification({
        type: 'success',
        title: 'Succes',
        message: 'Rata a fost actualizată',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Eroare la actualizare';
      addNotification({
        type: 'error',
        title: 'Eroare',
        message: errorMessage,
      });
      throw error;
    }
  };

  return (
    <FinancialData>
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Facturare</h3>

        <div className="space-y-4">
          {/* Billing Type */}
          <InlineEditField
            caseId={caseId}
            fieldName="billingType"
            value={billing.type}
            label="Tip facturare"
            fieldType="select"
            options={[
              { value: 'Hourly', label: 'Pe oră' },
              { value: 'Fixed', label: 'Sumă fixă' },
            ]}
            editable={editable}
            formatDisplay={(v) => (v === 'Fixed' ? 'Sumă fixă' : 'Pe oră')}
          />

          {/* Fixed Amount (when type=Fixed) */}
          {billing.type === 'Fixed' && (
            <InlineEditField
              caseId={caseId}
              fieldName="fixedAmount"
              value={billing.fixedAmount}
              label="Sumă fixă"
              fieldType="number"
              editable={editable}
              formatDisplay={formatFixedAmount}
              placeholder="Introdu suma"
            />
          )}

          {/* Custom Rates (when type=Hourly) */}
          {billing.type === 'Hourly' && (
            <div className="pt-2">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Rate orare personalizate</h4>
              <div className="grid grid-cols-3 gap-4">
                <RateField
                  label="Partner"
                  value={billing.customRates?.partnerRate}
                  editable={editable}
                  onSave={(value) => handleRateSave('partnerRate', value)}
                  loading={loading}
                />
                <RateField
                  label="Asociat"
                  value={billing.customRates?.associateRate}
                  editable={editable}
                  onSave={(value) => handleRateSave('associateRate', value)}
                  loading={loading}
                />
                <RateField
                  label="Paralegal"
                  value={billing.customRates?.paralegalRate}
                  editable={editable}
                  onSave={(value) => handleRateSave('paralegalRate', value)}
                  loading={loading}
                />
              </div>
              {billing.customRates && (
                <p className="mt-3 text-xs text-gray-500">
                  {billing.customRates.partnerRate != null ||
                  billing.customRates.associateRate != null ||
                  billing.customRates.paralegalRate != null
                    ? '✓ Se folosesc rate personalizate pentru acest dosar'
                    : 'Se folosesc ratele standard ale firmei'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </FinancialData>
  );
}
