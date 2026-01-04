/**
 * Billing Settings Component
 * Hourly rates, tax settings, and payment terms (admin only)
 * OPS-364: Settings Page Implementation
 */

'use client';

import * as React from 'react';
import { Euro, Receipt, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { useUpdateDefaultRates } from '@/hooks/useDefaultRates';
import { useNotificationStore } from '@/stores/notificationStore';

// ====================================================================
// GraphQL Query
// ====================================================================

const GET_DEFAULT_RATES = gql`
  query GetDefaultRates {
    defaultRates {
      partnerRate
      associateRate
      paralegalRate
    }
  }
`;

interface DefaultRates {
  partnerRate: number;
  associateRate: number;
  paralegalRate: number;
}

// ====================================================================
// Types
// ====================================================================

interface RateSetting {
  id: string;
  role: string;
  roleLabel: string;
  rate: number;
}

// ====================================================================
// Section Card Component
// ====================================================================

interface SectionCardProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

function SectionCard({ title, description, icon, children }: SectionCardProps) {
  return (
    <div className="rounded-xl border border-linear-border-subtle bg-linear-bg-secondary">
      <div className="border-b border-linear-border-subtle px-5 py-4">
        <div className="flex items-center gap-2">
          {icon && <span className="text-linear-text-tertiary">{icon}</span>}
          <div>
            <h3 className="text-sm font-medium text-linear-text-primary">{title}</h3>
            {description && <p className="text-xs text-linear-text-tertiary">{description}</p>}
          </div>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ====================================================================
// Rate Input Component
// ====================================================================

interface RateInputProps {
  label: string;
  description: string;
  value: number;
  onChange: (value: number) => void;
}

function RateInput({ label, description, value, onChange }: RateInputProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex-1">
        <p className="text-sm font-medium text-linear-text-primary">{label}</p>
        <p className="text-xs text-linear-text-tertiary">{description}</p>
      </div>
      <div className="relative w-32">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-linear-text-tertiary">
          €
        </span>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          min="0"
          step="0.01"
          className={cn(
            'w-full rounded-lg border border-linear-border-subtle bg-linear-bg-tertiary py-2 pl-7 pr-10 text-right text-sm text-linear-text-primary',
            'focus:border-linear-accent focus:outline-none focus:ring-1 focus:ring-linear-accent/30'
          )}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-linear-text-muted">
          /oră
        </span>
      </div>
    </div>
  );
}

// ====================================================================
// Form Field Component
// ====================================================================

interface FormFieldProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  suffix?: string;
}

function FormField({ label, value, onChange, type = 'text', placeholder, suffix }: FormFieldProps) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-linear-text-secondary">{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            'w-full rounded-lg border border-linear-border-subtle bg-linear-bg-tertiary px-3 py-2 text-sm text-linear-text-primary',
            'placeholder:text-linear-text-muted',
            'focus:border-linear-accent focus:outline-none focus:ring-1 focus:ring-linear-accent/30',
            suffix && 'pr-12'
          )}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-linear-text-muted">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

// ====================================================================
// Loading Component
// ====================================================================

function RatesLoading() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center justify-between py-3">
          <div className="space-y-2">
            <div className="h-4 w-24 animate-pulse rounded bg-linear-bg-tertiary" />
            <div className="h-3 w-40 animate-pulse rounded bg-linear-bg-tertiary" />
          </div>
          <div className="h-9 w-32 animate-pulse rounded-lg bg-linear-bg-tertiary" />
        </div>
      ))}
    </div>
  );
}

// ====================================================================
// Utility Functions
// ====================================================================

function centsToDollars(cents: number): number {
  return cents / 100;
}

function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

// ====================================================================
// Main Component
// ====================================================================

export function BillingSettings() {
  const { data, loading, error } = useQuery<{ defaultRates: DefaultRates | null }>(
    GET_DEFAULT_RATES
  );
  const { updateDefaultRates, loading: saving } = useUpdateDefaultRates();
  const { addNotification } = useNotificationStore();

  // Local state for rates
  const [rates, setRates] = React.useState<RateSetting[]>([
    { id: 'partner', role: 'Partner', roleLabel: 'Partener', rate: 0 },
    { id: 'associate', role: 'Associate', roleLabel: 'Asociat', rate: 0 },
    { id: 'paralegal', role: 'Paralegal', roleLabel: 'Asociat Jr.', rate: 0 },
  ]);

  // Tax settings state
  const [taxRate, setTaxRate] = React.useState('19');
  const [paymentTerms, setPaymentTerms] = React.useState('30');

  // Track if rates have been modified
  const [isDirty, setIsDirty] = React.useState(false);

  // Update local state when data is loaded
  React.useEffect(() => {
    if (data?.defaultRates) {
      setRates([
        {
          id: 'partner',
          role: 'Partner',
          roleLabel: 'Partener',
          rate: centsToDollars(data.defaultRates.partnerRate),
        },
        {
          id: 'associate',
          role: 'Associate',
          roleLabel: 'Asociat',
          rate: centsToDollars(data.defaultRates.associateRate),
        },
        {
          id: 'paralegal',
          role: 'Paralegal',
          roleLabel: 'Asociat Jr.',
          rate: centsToDollars(data.defaultRates.paralegalRate),
        },
      ]);
    }
  }, [data]);

  const handleRateChange = (id: string, newRate: number) => {
    setRates((prev) => prev.map((r) => (r.id === id ? { ...r, rate: newRate } : r)));
    setIsDirty(true);
  };

  const handleSaveRates = async () => {
    const partnerRate = rates.find((r) => r.id === 'partner')?.rate || 0;
    const associateRate = rates.find((r) => r.id === 'associate')?.rate || 0;
    const paralegalRate = rates.find((r) => r.id === 'paralegal')?.rate || 0;

    const result = await updateDefaultRates({
      partnerRate: dollarsToCents(partnerRate),
      associateRate: dollarsToCents(associateRate),
      paralegalRate: dollarsToCents(paralegalRate),
    });

    if (result.success) {
      addNotification({
        type: 'success',
        title: 'Tarife salvate',
        message: 'Tarifele implicite au fost actualizate cu succes.',
      });
      setIsDirty(false);
    } else {
      addNotification({
        type: 'error',
        title: 'Eroare',
        message: result.error || 'Nu s-au putut salva tarifele.',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Default Hourly Rates */}
      <SectionCard
        title="Tarife orare implicite"
        description="Tarifele folosite pentru dosarele noi"
        icon={<Euro className="h-4 w-4" />}
      >
        {loading ? (
          <RatesLoading />
        ) : error ? (
          <div className="rounded-lg bg-red-500/10 p-4 text-sm text-red-400">
            Eroare la încărcarea tarifelor: {error.message}
          </div>
        ) : (
          <>
            <div className="divide-y divide-linear-border-subtle">
              {rates.map((rate) => (
                <RateInput
                  key={rate.id}
                  label={rate.roleLabel}
                  description={`Tarif orar implicit pentru ${rate.roleLabel.toLowerCase()}`}
                  value={rate.rate}
                  onChange={(value) => handleRateChange(rate.id, value)}
                />
              ))}
            </div>

            {isDirty && (
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveRates}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-linear-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-linear-accent/90 disabled:opacity-50"
                >
                  {saving && (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  )}
                  Salvează tarifele
                </button>
              </div>
            )}
          </>
        )}
      </SectionCard>

      {/* Tax Settings */}
      <SectionCard
        title="Setări fiscale"
        description="Configurări pentru facturare"
        icon={<Receipt className="h-4 w-4" />}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Rată TVA"
            value={taxRate}
            onChange={setTaxRate}
            type="number"
            placeholder="19"
            suffix="%"
          />
          <FormField
            label="Termen de plată"
            value={paymentTerms}
            onChange={setPaymentTerms}
            type="number"
            placeholder="30"
            suffix="zile"
          />
        </div>
      </SectionCard>

      {/* Info Box */}
      <div className="rounded-lg bg-linear-accent/10 p-4 text-xs text-linear-accent">
        <div className="flex items-start gap-2">
          <FileText className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-medium">Despre tarife</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-linear-text-secondary">
              <li>Tarifele sunt exprimate în EUR pe oră</li>
              <li>Dosarele noi moștenesc automat aceste tarife</li>
              <li>Puteți suprascrie tarifele individual pentru fiecare dosar</li>
              <li>Modificările de tarif sunt urmărite în istoricul dosarului</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
