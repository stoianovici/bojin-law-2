/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@apollo/client/react';
import {
  ArrowLeft,
  Briefcase,
  FileText,
  Users,
  Mail,
  CreditCard,
  Building2,
  UserCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input, TextArea } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { TagInput } from '@/components/cases/TagInput';
import { TeamMemberSelect, type TeamAssignment } from '@/components/cases/TeamMemberSelect';
import { CaseTypeSelect } from '@/components/cases/CaseTypeSelect';
import { useUpdateCase, type UpdateCaseInput } from '@/hooks/mobile/useUpdateCase';
import { GET_CASE, GET_CASE_TYPES } from '@/graphql/queries';
import { cn } from '@/lib/utils';

const BILLING_OPTIONS = [
  { value: 'HOURLY', label: 'Pe oră' },
  { value: 'FIXED', label: 'Sumă fixă' },
];

interface CaseTypeConfig {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  sortOrder: number;
}

interface CaseData {
  case: {
    id: string;
    caseNumber: string;
    title: string;
    status: string;
    type: string;
    description: string;
    openedDate: string;
    client: {
      id: string;
      name: string;
      contactInfo?: string;
      address?: string;
    };
    teamMembers: {
      id: string;
      role: string;
      user: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        role: string;
      };
    }[];
    billingType?: 'Hourly' | 'Fixed';
    fixedAmount?: number;
    hourlyRates?: {
      partner?: number;
      associate?: number;
      paralegal?: number;
    };
  };
}

interface FormSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

function FormSection({ title, icon, children, className }: FormSectionProps) {
  return (
    <section
      className={cn(
        'rounded-xl border border-linear-border-subtle bg-linear-bg-secondary p-6',
        className
      )}
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-linear-accent/10 flex items-center justify-center">
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

function LoadingState() {
  return (
    <div className="flex flex-col h-full w-full bg-linear-bg-primary items-center justify-center">
      <Loader2 className="w-8 h-8 text-linear-accent animate-spin mb-4" />
      <p className="text-sm text-linear-text-secondary">Se încarcă datele dosarului...</p>
    </div>
  );
}

function ErrorState({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div className="flex flex-col h-full w-full bg-linear-bg-primary items-center justify-center">
      <div className="text-center max-w-md">
        <p className="text-linear-error mb-4">{message}</p>
        <Button variant="secondary" onClick={onBack}>
          Înapoi la dosare
        </Button>
      </div>
    </div>
  );
}

export default function EditCasePage() {
  const router = useRouter();
  const params = useParams();
  const caseId = params.id as string;

  const { updateCase, loading: submitting, error: submitError, validate } = useUpdateCase();

  // Fetch existing case data
  const {
    data: caseData,
    loading: caseLoading,
    error: caseError,
  } = useQuery<CaseData>(GET_CASE, {
    variables: { id: caseId },
    skip: !caseId,
  });

  // Fetch case types
  const { data: caseTypesData } = useQuery<{ caseTypeConfigs: CaseTypeConfig[] }>(GET_CASE_TYPES, {
    variables: { includeInactive: false },
  });

  // Form state - Case
  const [title, setTitle] = useState('');
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');
  const [teamMembers, setTeamMembers] = useState<TeamAssignment[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [emailDomains, setEmailDomains] = useState<string[]>([]);
  const [courtFileNumbers, setCourtFileNumbers] = useState<string[]>([]);
  const [billingType, setBillingType] = useState<'HOURLY' | 'FIXED'>('HOURLY');
  const [fixedAmount, setFixedAmount] = useState('');
  const [partnerRate, setPartnerRate] = useState('');
  const [associateRate, setAssociateRate] = useState('');
  const [paralegalRate, setParalegalRate] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');

  // Custom case types added during this session
  const [customCaseTypes, setCustomCaseTypes] = useState<{ value: string; label: string }[]>([]);

  // Validation errors
  const [showErrors, setShowErrors] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize form with existing case data
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (caseData?.case && !isInitialized) {
      const existingCase = caseData.case;
      setTitle(existingCase.title || '');
      setType(existingCase.type || '');
      setDescription(existingCase.description || '');

      // Map team members to TeamAssignment format
      // Map 'Billing' role to 'Observer' as it's not in the frontend type
      const mapRole = (role: string): 'Lead' | 'Support' | 'Observer' => {
        if (role === 'Lead') return 'Lead';
        if (role === 'Support') return 'Support';
        return 'Observer'; // Map 'Billing' and other roles to 'Observer'
      };

      const mappedTeamMembers: TeamAssignment[] =
        existingCase.teamMembers?.map((tm) => ({
          userId: tm.user.id,
          role: mapRole(tm.role),
        })) || [];
      setTeamMembers(mappedTeamMembers);

      // Initialize billing fields from existing case data
      if (existingCase.billingType) {
        setBillingType(existingCase.billingType === 'Fixed' ? 'FIXED' : 'HOURLY');
      }
      if (existingCase.fixedAmount) {
        setFixedAmount(existingCase.fixedAmount.toString());
      }
      if (existingCase.hourlyRates) {
        if (existingCase.hourlyRates.partner) {
          setPartnerRate(existingCase.hourlyRates.partner.toString());
        }
        if (existingCase.hourlyRates.associate) {
          setAssociateRate(existingCase.hourlyRates.associate.toString());
        }
        if (existingCase.hourlyRates.paralegal) {
          setParalegalRate(existingCase.hourlyRates.paralegal.toString());
        }
      }

      setIsInitialized(true);
    }
  }, [caseData, isInitialized]);

  // Build input for validation
  const formInput: Partial<UpdateCaseInput> = {
    title: title.trim(),
    type,
    description: description.trim(),
    teamMembers: teamMembers.map((tm) => ({ userId: tm.userId, role: tm.role })),
    keywords,
    emailDomains,
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
  const hasErrors = Object.keys(errors).length > 0;

  // Build options from fetched types
  const backendCaseTypes = caseTypesData?.caseTypeConfigs?.length
    ? caseTypesData.caseTypeConfigs
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((ct) => ({ value: ct.code, label: ct.name }))
    : [];

  // Combine backend types with custom types added this session
  const caseTypeOptions = [...backendCaseTypes, ...customCaseTypes];

  // Handler for adding new case type
  const handleAddCaseType = (newType: { value: string; label: string }) => {
    if (!caseTypeOptions.some((opt) => opt.value === newType.value)) {
      setCustomCaseTypes((prev) => [...prev, newType]);
    }
  };

  const handleSubmit = async () => {
    setShowErrors(true);

    if (hasErrors) {
      return;
    }

    if (submitting) return;

    try {
      const result = await updateCase(caseId, formInput as UpdateCaseInput);

      if (result) {
        router.push(`/cases`);
      }
    } catch (err) {
      console.error('Failed to update case:', err);
    }
  };

  // Domain validation for email domains
  const validateDomain = (domain: string): boolean => {
    return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}$/.test(domain);
  };

  // Loading state
  if (caseLoading) {
    return <LoadingState />;
  }

  // Error state
  if (caseError || !caseData?.case) {
    return (
      <ErrorState
        message={caseError?.message || 'Dosarul nu a fost găsit'}
        onBack={() => router.push('/cases')}
      />
    );
  }

  const existingCase = caseData.case;

  return (
    <div className="flex flex-col h-full w-full bg-linear-bg-primary">
      {/* Header */}
      <div className="px-8 py-5 border-b border-linear-border-subtle flex-shrink-0 bg-linear-bg-primary/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 -ml-2 rounded-lg hover:bg-linear-bg-hover transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-linear-text-secondary" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-linear-text-primary">Editează Dosar</h1>
              <p className="text-xs text-linear-text-tertiary">
                {existingCase.caseNumber} - {existingCase.client.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="md" onClick={() => router.back()}>
              Anulează
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSubmit}
              disabled={submitting}
              leftIcon={
                submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Briefcase className="w-4 h-4" />
                )
              }
            >
              {submitting ? 'Se salvează...' : 'Salvează Modificări'}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 w-full">
        <div className="px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Main Info */}
            <div className="space-y-6">
              {/* Client Info */}
              <div className="p-4 rounded-xl bg-linear-accent/5 border border-linear-accent/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-linear-accent/20 flex items-center justify-center">
                    <UserCircle className="w-5 h-5 text-linear-accent" />
                  </div>
                  <div>
                    <p className="text-xs text-linear-text-tertiary">Client</p>
                    <p className="text-sm font-semibold text-linear-text-primary">
                      {existingCase.client.name}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/clients/${existingCase.client.id}`}
                  className="flex items-center gap-1.5 text-xs text-linear-accent px-3 py-1.5 bg-linear-accent/10 rounded-lg hover:bg-linear-accent/20 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Editează client
                </Link>
              </div>

              {/* Basic Info Section */}
              <FormSection
                title="Informații de bază"
                icon={<FileText className="w-4 h-4 text-linear-accent" />}
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <FieldLabel required>Titlu dosar</FieldLabel>
                    <Input
                      size="lg"
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
                      rows={4}
                      error={showErrors && !!errors.description}
                      errorMessage={showErrors ? errors.description : undefined}
                    />
                  </div>
                </div>
              </FormSection>

              {/* Team Section */}
              <FormSection title="Echipă" icon={<Users className="w-4 h-4 text-linear-accent" />}>
                <TeamMemberSelect
                  label="Membri echipă *"
                  value={teamMembers}
                  onChange={setTeamMembers}
                  error={showErrors ? errors.teamMembers : undefined}
                />
              </FormSection>

              {/* Court Info Section */}
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
            </div>

            {/* Right Column - Additional Info */}
            <div className="space-y-6">
              {/* Email Classification Section */}
              <FormSection
                title="Clasificare Email"
                icon={<Mail className="w-4 h-4 text-linear-accent" />}
              >
                <div className="space-y-4">
                  <TagInput
                    label="Cuvinte cheie email"
                    placeholder="Adaugă cuvânt cheie..."
                    value={keywords}
                    onChange={setKeywords}
                  />
                  <TagInput
                    label="Domenii email"
                    placeholder="ex: client.ro"
                    value={emailDomains}
                    onChange={setEmailDomains}
                    validate={validateDomain}
                    error={
                      emailDomains.length > 0 && emailDomains.some((d) => !validateDomain(d))
                        ? 'Format invalid pentru domeniu'
                        : undefined
                    }
                  />
                </div>
              </FormSection>

              {/* Billing Section */}
              <FormSection
                title="Facturare"
                icon={<CreditCard className="w-4 h-4 text-linear-accent" />}
              >
                <div className="space-y-4">
                  {/* Billing Type Toggle */}
                  <div className="space-y-2">
                    <FieldLabel required>Tip facturare</FieldLabel>
                    <div className="grid grid-cols-2 gap-2">
                      {BILLING_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setBillingType(opt.value as 'HOURLY' | 'FIXED')}
                          className={cn(
                            'px-4 py-2.5 rounded-lg border text-sm font-medium transition-all',
                            billingType === opt.value
                              ? 'border-linear-accent bg-linear-accent/10 text-linear-accent'
                              : 'border-linear-border-subtle bg-linear-bg-tertiary text-linear-text-tertiary hover:bg-linear-bg-hover hover:text-linear-text-secondary'
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
                        size="lg"
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
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <FieldLabel>Tarif partener (EUR/oră)</FieldLabel>
                        <Input
                          size="lg"
                          type="number"
                          value={partnerRate}
                          onChange={(e) => setPartnerRate(e.target.value)}
                          placeholder="ex: 500"
                        />
                      </div>
                      <div className="space-y-2">
                        <FieldLabel>Tarif asociat (EUR/oră)</FieldLabel>
                        <Input
                          size="lg"
                          type="number"
                          value={associateRate}
                          onChange={(e) => setAssociateRate(e.target.value)}
                          placeholder="ex: 300"
                        />
                      </div>
                      <div className="space-y-2">
                        <FieldLabel>Tarif paralegal (EUR/oră)</FieldLabel>
                        <Input
                          size="lg"
                          type="number"
                          value={paralegalRate}
                          onChange={(e) => setParalegalRate(e.target.value)}
                          placeholder="ex: 150"
                        />
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-linear-border-subtle">
                    <div className="space-y-2">
                      <FieldLabel>Valoare estimată (EUR)</FieldLabel>
                      <Input
                        size="lg"
                        type="number"
                        value={estimatedValue}
                        onChange={(e) => setEstimatedValue(e.target.value)}
                        placeholder="ex: 50000"
                      />
                    </div>
                  </div>
                </div>
              </FormSection>
            </div>
          </div>

          {/* Error Message */}
          {submitError && (
            <div className="mt-6 p-4 rounded-xl bg-linear-error/10 border border-linear-error/20">
              <p className="text-sm text-linear-error">
                Nu s-a putut actualiza dosarul. Încercați din nou.
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
