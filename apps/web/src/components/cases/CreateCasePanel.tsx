'use client';

import { useState } from 'react';
import { useQuery } from '@apollo/client/react';
import {
  Briefcase,
  FileText,
  Users,
  Mail,
  CreditCard,
  Building2,
  UserCircle,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, TextArea } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { TagInput } from '@/components/cases/TagInput';
import { TeamMemberSelect, type TeamAssignment } from '@/components/cases/TeamMemberSelect';
import { CaseTypeSelect } from '@/components/cases/CaseTypeSelect';
import { useCreateCase, type CreateCaseInput } from '@/hooks/mobile/useCreateCase';
import { GET_CASE_TYPES } from '@/graphql/queries';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface ClientInfo {
  id: string;
  name: string;
}

interface CreateCasePanelProps {
  client: ClientInfo;
  onCancel: () => void;
  onSuccess: (caseId: string) => void;
}

interface CaseTypeConfig {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  sortOrder: number;
}

const BILLING_OPTIONS = [
  { value: 'HOURLY', label: 'Pe oră' },
  { value: 'FIXED', label: 'Sumă fixă' },
];

// ============================================================================
// Helper Components
// ============================================================================

function FormSection({
  title,
  icon,
  children,
  className,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-xl border border-linear-border-subtle bg-linear-bg-secondary p-5',
        className
      )}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-7 h-7 rounded-lg bg-linear-accent/10 flex items-center justify-center">
          {icon}
        </div>
        <h3 className="text-sm font-semibold text-linear-text-primary">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-sm font-medium text-linear-text-secondary">
      {children}
      {required && <span className="text-linear-error ml-0.5">*</span>}
    </label>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CreateCasePanel({ client, onCancel, onSuccess }: CreateCasePanelProps) {
  const { createCase, loading: submitting, error: submitError, validate } = useCreateCase();

  // Fetch case types
  const { data: caseTypesData } = useQuery<{ caseTypeConfigs: CaseTypeConfig[] }>(GET_CASE_TYPES, {
    variables: { includeInactive: false },
  });

  // Form state
  const [title, setTitle] = useState('');
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');
  const [teamMembers, setTeamMembers] = useState<TeamAssignment[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [courtFileNumbers, setCourtFileNumbers] = useState<string[]>([]);
  const [billingType, setBillingType] = useState<'HOURLY' | 'FIXED'>('HOURLY');
  const [fixedAmount, setFixedAmount] = useState('');
  const [partnerRate, setPartnerRate] = useState('');
  const [associateRate, setAssociateRate] = useState('');
  const [paralegalRate, setParalegalRate] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');

  // Custom case types added during this session
  const [customCaseTypes, setCustomCaseTypes] = useState<{ value: string; label: string }[]>([]);

  // Validation
  const [showErrors, setShowErrors] = useState(false);

  // Build input for validation
  const formInput: Partial<CreateCaseInput> = {
    title: title.trim(),
    clientId: client.id,
    clientName: client.name,
    type,
    description: description.trim(),
    teamMembers: teamMembers.map((tm) => ({ userId: tm.userId, role: tm.role })),
    keywords,
    courtFileNumbers,
    billingType,
    fixedAmount: fixedAmount ? parseFloat(fixedAmount) : undefined,
    hourlyRates:
      billingType === 'HOURLY'
        ? {
            partner: partnerRate ? parseFloat(partnerRate) : undefined,
            associate: associateRate ? parseFloat(associateRate) : undefined,
            paralegal: paralegalRate ? parseFloat(paralegalRate) : undefined,
          }
        : undefined,
    estimatedValue: estimatedValue ? parseFloat(estimatedValue) : undefined,
  };

  const errors = validate(formInput);
  // Remove clientId error since we have it from props
  delete errors.clientId;
  const hasErrors = Object.keys(errors).length > 0;

  // Build case type options
  const backendCaseTypes = caseTypesData?.caseTypeConfigs?.length
    ? caseTypesData.caseTypeConfigs
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((ct) => ({ value: ct.code, label: ct.name }))
    : [];
  const caseTypeOptions = [...backendCaseTypes, ...customCaseTypes];

  const handleAddCaseType = (newType: { value: string; label: string }) => {
    if (!caseTypeOptions.some((opt) => opt.value === newType.value)) {
      setCustomCaseTypes((prev) => [...prev, newType]);
    }
  };

  const handleSubmit = async () => {
    setShowErrors(true);
    if (hasErrors || submitting) return;

    try {
      const result = await createCase(formInput as CreateCaseInput);
      if (result?.id) {
        onSuccess(result.id);
      }
    } catch (err) {
      console.error('Failed to create case:', err);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-linear-bg-primary">
      {/* Header */}
      <div className="px-6 py-4 border-b border-linear-border-subtle flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-linear-text-primary">Dosar Nou</h2>
            <p className="text-xs text-linear-text-tertiary mt-0.5">pentru {client.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-5">
          {/* Client Info (read-only) */}
          <div className="p-3 rounded-lg bg-linear-accent/5 border border-linear-accent/20 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-linear-accent/20 flex items-center justify-center">
              <UserCircle className="w-4 h-4 text-linear-accent" />
            </div>
            <div>
              <p className="text-xs text-linear-text-tertiary">Client</p>
              <p className="text-sm font-medium text-linear-text-primary">{client.name}</p>
            </div>
          </div>

          {/* Basic Info */}
          <FormSection
            title="Informații de bază"
            icon={<FileText className="w-4 h-4 text-linear-accent" />}
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <FieldLabel required>Titlu dosar</FieldLabel>
                <Input
                  size="md"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="ex: Smith v. Jones"
                  error={showErrors && !!errors.title}
                  errorMessage={showErrors ? errors.title : undefined}
                />
              </div>

              <div className="space-y-2">
                <FieldLabel required>Tip dosar</FieldLabel>
                <CaseTypeSelect
                  value={type}
                  onChange={setType}
                  options={caseTypeOptions}
                  onAddNew={handleAddCaseType}
                  placeholder="Selectează sau adaugă tip"
                  error={showErrors && !type}
                  errorMessage={
                    showErrors && !type ? 'Tipul dosarului este obligatoriu' : undefined
                  }
                />
              </div>

              <div className="space-y-2">
                <FieldLabel required>Descriere</FieldLabel>
                <TextArea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descrieți pe scurt obiectul dosarului..."
                  rows={3}
                  error={showErrors && !!errors.description}
                  errorMessage={showErrors ? errors.description : undefined}
                />
              </div>
            </div>
          </FormSection>

          {/* Team */}
          <FormSection title="Echipă" icon={<Users className="w-4 h-4 text-linear-accent" />}>
            <TeamMemberSelect
              label="Membri echipă *"
              value={teamMembers}
              onChange={setTeamMembers}
              error={showErrors ? errors.teamMembers : undefined}
            />
          </FormSection>

          {/* Court Info */}
          <FormSection
            title="Informații instanță"
            icon={<Building2 className="w-4 h-4 text-linear-accent" />}
          >
            <TagInput
              label="Numere dosar instanță"
              placeholder="ex: 1234/3/2024"
              value={courtFileNumbers}
              onChange={setCourtFileNumbers}
            />
          </FormSection>

          {/* Email Classification */}
          <FormSection
            title="Clasificare Email"
            icon={<Mail className="w-4 h-4 text-linear-accent" />}
          >
            <TagInput
              label="Cuvinte cheie email"
              placeholder="Adaugă cuvânt cheie..."
              value={keywords}
              onChange={setKeywords}
            />
          </FormSection>

          {/* Billing */}
          <FormSection
            title="Facturare"
            icon={<CreditCard className="w-4 h-4 text-linear-accent" />}
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <FieldLabel required>Tip facturare</FieldLabel>
                <div className="grid grid-cols-2 gap-2">
                  {BILLING_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setBillingType(opt.value as 'HOURLY' | 'FIXED')}
                      className={cn(
                        'px-3 py-2 rounded-lg border text-sm font-medium transition-all',
                        billingType === opt.value
                          ? 'border-linear-accent bg-linear-accent/10 text-linear-accent'
                          : 'border-linear-border-subtle bg-linear-bg-tertiary text-linear-text-tertiary hover:bg-linear-bg-hover'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {billingType === 'FIXED' && (
                <div className="space-y-2">
                  <FieldLabel required>Sumă fixă (EUR)</FieldLabel>
                  <Input
                    size="md"
                    type="number"
                    value={fixedAmount}
                    onChange={(e) => setFixedAmount(e.target.value)}
                    placeholder="ex: 5000"
                    error={showErrors && !!errors.fixedAmount}
                    errorMessage={showErrors ? errors.fixedAmount : undefined}
                  />
                </div>
              )}

              {billingType === 'HOURLY' && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <FieldLabel>Tarif partener (EUR/oră)</FieldLabel>
                    <Input
                      size="md"
                      type="number"
                      value={partnerRate}
                      onChange={(e) => setPartnerRate(e.target.value)}
                      placeholder="ex: 500"
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Tarif asociat (EUR/oră)</FieldLabel>
                    <Input
                      size="md"
                      type="number"
                      value={associateRate}
                      onChange={(e) => setAssociateRate(e.target.value)}
                      placeholder="ex: 300"
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Tarif paralegal (EUR/oră)</FieldLabel>
                    <Input
                      size="md"
                      type="number"
                      value={paralegalRate}
                      onChange={(e) => setParalegalRate(e.target.value)}
                      placeholder="ex: 150"
                    />
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-linear-border-subtle">
                <div className="space-y-2">
                  <FieldLabel>Valoare estimată (EUR)</FieldLabel>
                  <Input
                    size="md"
                    type="number"
                    value={estimatedValue}
                    onChange={(e) => setEstimatedValue(e.target.value)}
                    placeholder="ex: 50000"
                  />
                </div>
              </div>
            </div>
          </FormSection>

          {/* Error Message */}
          {submitError && (
            <div className="p-3 rounded-lg bg-linear-error/10 border border-linear-error/20">
              <p className="text-sm text-linear-error">
                Nu s-a putut crea dosarul. Încercați din nou.
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer Actions */}
      <div className="px-6 py-4 border-t border-linear-border-subtle flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="md" onClick={onCancel} className="flex-1">
            Anulează
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSubmit}
            disabled={submitting}
            leftIcon={<Briefcase className="w-4 h-4" />}
            className="flex-1"
          >
            {submitting ? 'Se creează...' : 'Creează Dosar'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default CreateCasePanel;
