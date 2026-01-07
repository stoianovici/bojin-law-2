/**
 * Firm Settings Component
 * Firm name, logo, address, and invoice format settings (admin only)
 * OPS-364: Settings Page Implementation
 */

'use client';

import * as React from 'react';
import { Building2, FileText, MapPin, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

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
// Form Components
// ====================================================================

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}

function FormField({ label, value, onChange, placeholder, type = 'text' }: FormFieldProps) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-linear-text-secondary">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full rounded-lg border border-linear-border-subtle bg-linear-bg-tertiary px-3 py-2 text-sm text-linear-text-primary',
          'placeholder:text-linear-text-muted',
          'focus:border-linear-accent focus:outline-none focus:ring-1 focus:ring-linear-accent/30'
        )}
      />
    </div>
  );
}

interface TextareaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

function TextareaField({ label, value, onChange, placeholder, rows = 3 }: TextareaFieldProps) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-linear-text-secondary">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={cn(
          'w-full resize-none rounded-lg border border-linear-border-subtle bg-linear-bg-tertiary px-3 py-2 text-sm text-linear-text-primary',
          'placeholder:text-linear-text-muted',
          'focus:border-linear-accent focus:outline-none focus:ring-1 focus:ring-linear-accent/30'
        )}
      />
    </div>
  );
}

// ====================================================================
// Logo Upload Component
// ====================================================================

function LogoUpload() {
  const [isDragging, setIsDragging] = React.useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    // TODO: Handle file upload
  };

  return (
    <div className="flex items-center gap-4">
      {/* Current Logo Preview */}
      <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-lg border border-linear-border-subtle bg-linear-bg-tertiary">
        <Building2 className="h-8 w-8 text-linear-text-muted" />
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'flex flex-1 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 transition-colors',
          isDragging
            ? 'border-linear-accent bg-linear-accent/5'
            : 'border-linear-border-subtle hover:border-linear-text-muted'
        )}
      >
        <Upload className="mb-2 h-5 w-5 text-linear-text-tertiary" />
        <p className="text-center text-xs text-linear-text-secondary">
          <span className="font-medium text-linear-accent">Click pentru încărcare</span>
          {' sau drag and drop'}
        </p>
        <p className="mt-1 text-center text-xs text-linear-text-muted">
          PNG, JPG sau SVG (max 2MB)
        </p>
      </div>
    </div>
  );
}

// ====================================================================
// Main Component
// ====================================================================

export function FirmSettings() {
  // Form state
  const [firmName, setFirmName] = React.useState('Bojin Law Office');
  const [address, setAddress] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [invoicePrefix, setInvoicePrefix] = React.useState('BLO');
  const [invoiceNotes, setInvoiceNotes] = React.useState('');
  const [isDirty, setIsDirty] = React.useState(false);

  // Track if form has changes
  React.useEffect(() => {
    // Simple dirty tracking - in production would compare with initial values
    setIsDirty(true);
  }, [firmName, address, phone, email, invoicePrefix, invoiceNotes]);

  const handleSave = () => {
    // TODO: Persist to backend
    setIsDirty(false);
  };

  return (
    <div className="space-y-6">
      {/* Company Information */}
      <SectionCard
        title="Informații firmă"
        description="Datele de identificare ale firmei"
        icon={<Building2 className="h-4 w-4" />}
      >
        <div className="space-y-5">
          <div className="space-y-4">
            <FormField
              label="Numele firmei"
              value={firmName}
              onChange={setFirmName}
              placeholder="Ex: Cabinet de Avocatură S.R.L."
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-linear-text-secondary">
              Logo firmă
            </label>
            <LogoUpload />
          </div>
        </div>
      </SectionCard>

      {/* Contact & Address */}
      <SectionCard
        title="Contact și adresă"
        description="Informațiile de contact afișate pe documente"
        icon={<MapPin className="h-4 w-4" />}
      >
        <div className="space-y-4">
          <TextareaField
            label="Adresa"
            value={address}
            onChange={setAddress}
            placeholder="Ex: Strada Victoriei nr. 10, București, Sector 1"
            rows={2}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Telefon"
              value={phone}
              onChange={setPhone}
              placeholder="+40 21 123 4567"
              type="tel"
            />
            <FormField
              label="Email"
              value={email}
              onChange={setEmail}
              placeholder="contact@firma.ro"
              type="email"
            />
          </div>
        </div>
      </SectionCard>

      {/* Invoice Settings */}
      <SectionCard
        title="Format factură"
        description="Configurări pentru generarea facturilor"
        icon={<FileText className="h-4 w-4" />}
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Prefix număr factură"
              value={invoicePrefix}
              onChange={setInvoicePrefix}
              placeholder="Ex: BLO"
            />
            <div>
              <label className="mb-1.5 block text-xs font-medium text-linear-text-secondary">
                Exemplu număr factură
              </label>
              <div className="flex h-9 items-center rounded-lg bg-linear-bg-tertiary px-3 text-sm text-linear-text-secondary">
                {invoicePrefix}-2024-0001
              </div>
            </div>
          </div>
          <TextareaField
            label="Note standard factură"
            value={invoiceNotes}
            onChange={setInvoiceNotes}
            placeholder="Text care apare pe toate facturile (ex: condiții de plată, date bancare)"
            rows={4}
          />
        </div>
      </SectionCard>

      {/* Save Button */}
      {isDirty && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-linear-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-linear-accent/90"
          >
            Salvează modificările
          </button>
        </div>
      )}
    </div>
  );
}
