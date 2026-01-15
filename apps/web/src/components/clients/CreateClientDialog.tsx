'use client';

import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { type FetchResult } from '@apollo/client';
import { UserPlus, Mail, Phone, MapPin } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { CREATE_CLIENT } from '@/graphql/mutations';
import {
  CompanyDetailsForm,
  validateCompanyDetails,
  type CompanyDetails,
} from './CompanyDetailsForm';

// ============================================================================
// Types
// ============================================================================

interface CreateClientInput {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  clientType?: string;
  companyType?: string;
  cui?: string;
  registrationNumber?: string;
  administrators?: { id?: string; name: string; role: string; email?: string; phone?: string }[];
  contacts?: { id?: string; name: string; role: string; email?: string; phone?: string }[];
}

interface CreateClientResponse {
  createClient: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    caseCount: number;
    activeCaseCount: number;
  };
}

interface CreateClientDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Callback when creation succeeds */
  onSuccess?: (clientId: string) => void;
}

// ============================================================================
// Default Values
// ============================================================================

const defaultCompanyDetails: CompanyDetails = {
  clientType: 'company',
  administrators: [],
  contacts: [],
};

// ============================================================================
// Component
// ============================================================================

export function CreateClientDialog({ open, onOpenChange, onSuccess }: CreateClientDialogProps) {
  const [createClient, { loading }] = useMutation<CreateClientResponse>(CREATE_CLIENT);
  const [localError, setLocalError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [companyDetails, setCompanyDetails] = useState<CompanyDetails>(defaultCompanyDetails);
  const [showErrors, setShowErrors] = useState(false);

  // Validation
  const errors: Record<string, string> = {};
  if (!name.trim()) {
    errors.name = 'Numele este obligatoriu';
  }
  const companyErrors = validateCompanyDetails(companyDetails);
  const allErrors = { ...errors, ...companyErrors };
  const hasErrors = Object.keys(allErrors).length > 0;

  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setAddress('');
    setCompanyDetails(defaultCompanyDetails);
    setShowErrors(false);
    setLocalError(null);
  };

  const handleCreate = async () => {
    setShowErrors(true);
    setLocalError(null);

    if (hasErrors) {
      return;
    }

    try {
      const input: CreateClientInput = {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        clientType: companyDetails.clientType,
        companyType: companyDetails.companyType || undefined,
        cui: companyDetails.cui || undefined,
        registrationNumber: companyDetails.registrationNumber || undefined,
        administrators:
          companyDetails.administrators.length > 0
            ? companyDetails.administrators.map((a) => ({
                name: a.name,
                role: a.role,
                email: a.email || undefined,
                phone: a.phone || undefined,
              }))
            : undefined,
        contacts:
          companyDetails.contacts.length > 0
            ? companyDetails.contacts.map((c) => ({
                name: c.name,
                role: c.role,
                email: c.email || undefined,
                phone: c.phone || undefined,
              }))
            : undefined,
      };

      const result = (await createClient({
        variables: { input },
        refetchQueries: ['GetClients'],
      })) as FetchResult<CreateClientResponse>;

      // Check if mutation succeeded
      if (result.errors && result.errors.length > 0) {
        console.error('[CreateClientDialog] GraphQL errors:', result.errors);
        setLocalError(result.errors[0].message);
        return;
      }

      if (!result.data?.createClient) {
        setLocalError('Nu s-a putut crea clientul. Încercați din nou.');
        return;
      }

      // Success
      resetForm();
      onOpenChange(false);
      onSuccess?.(result.data.createClient.id);
    } catch (err) {
      console.error('[CreateClientDialog] Failed to create client:', err);
      if (err instanceof Error) {
        setLocalError(err.message);
      } else {
        setLocalError('Nu s-a putut crea clientul. Încercați din nou.');
      }
    }
  };

  const handleCancel = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-linear-accent/10 flex items-center justify-center">
              <UserPlus className="h-5 w-5 text-linear-accent" />
            </div>
            <DialogTitle>Client nou</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            Completează detaliile pentru a crea un client nou.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="px-6 py-4 space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              {/* Name - Required */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-linear-text-secondary">
                  Nume client <span className="text-linear-error">*</span>
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ex: SC Exemplu SRL sau Ion Popescu"
                  disabled={loading}
                  error={showErrors && !!allErrors.name}
                  errorMessage={showErrors ? allErrors.name : undefined}
                />
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-linear-text-secondary">Email</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contact@exemplu.ro"
                    disabled={loading}
                    leftAddon={<Mail className="w-4 h-4" />}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-linear-text-secondary">Telefon</label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+40 700 000 000"
                    disabled={loading}
                    leftAddon={<Phone className="w-4 h-4" />}
                  />
                </div>
              </div>

              {/* Address */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-linear-text-secondary">Adresă</label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Str. Exemplu nr. 1, București"
                  disabled={loading}
                  leftAddon={<MapPin className="w-4 h-4" />}
                />
              </div>
            </div>

            {/* Company Details */}
            <div className="pt-4 border-t border-linear-border-subtle">
              <CompanyDetailsForm
                value={companyDetails}
                onChange={setCompanyDetails}
                disabled={loading}
                errors={showErrors ? allErrors : undefined}
              />
            </div>

            {/* Error message */}
            {localError && (
              <div className="p-3 rounded-md bg-linear-error/10 border border-linear-error/20">
                <p className="text-sm text-linear-error">{localError}</p>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="secondary" onClick={handleCancel} disabled={loading}>
            Anulează
          </Button>
          <Button
            variant="primary"
            onClick={handleCreate}
            loading={loading}
            leftIcon={<UserPlus className="h-4 w-4" />}
          >
            Creează client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

CreateClientDialog.displayName = 'CreateClientDialog';

export default CreateClientDialog;
