/**
 * Email Import Wizard Component
 * OPS-022: Email-to-Case Timeline Integration
 *
 * Multi-step wizard for importing emails into a case by contact addresses:
 * 1. Enter contact email addresses
 * 2. Preview emails found and date range
 * 3. Assign roles to discovered contacts
 * 4. Execute import and show results
 */

'use client';

import { useState, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { clsx } from 'clsx';
import { useEmailImport, type ContactRoleAssignment } from '../../hooks/useEmailImport';

// ============================================================================
// Types
// ============================================================================

interface EmailImportWizardProps {
  caseId: string;
  caseTitle?: string;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

const ROLE_OPTIONS: Array<{ value: ContactRoleAssignment['role']; label: string }> = [
  { value: 'Client', label: 'Client' },
  { value: 'OpposingParty', label: 'Parte Adversă' },
  { value: 'OpposingCounsel', label: 'Avocat Parte Adversă' },
  { value: 'Witness', label: 'Martor' },
  { value: 'Expert', label: 'Expert' },
];

// ============================================================================
// Component
// ============================================================================

export function EmailImportWizard({
  caseId,
  caseTitle,
  trigger,
  onSuccess,
}: EmailImportWizardProps) {
  const [open, setOpen] = useState(false);
  const [emailInput, setEmailInput] = useState('');

  const {
    step,
    emailAddresses,
    preview,
    contactAssignments,
    importAttachments,
    result,
    previewLoading,
    importLoading,
    previewError,
    setEmailAddresses,
    loadPreview,
    updateContactAssignment,
    setImportAttachments,
    goToAssignStep,
    executeImport,
    reset,
    goBack,
    canLoadPreview,
    hasEmails,
  } = useEmailImport(caseId);

  // Handle adding email address
  const handleAddEmail = useCallback(() => {
    const trimmed = emailInput.trim().toLowerCase();
    if (trimmed && !emailAddresses.includes(trimmed)) {
      // Basic email validation
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        setEmailAddresses([...emailAddresses, trimmed]);
        setEmailInput('');
      }
    }
  }, [emailInput, emailAddresses, setEmailAddresses]);

  // Handle removing email address
  const handleRemoveEmail = useCallback(
    (email: string) => {
      setEmailAddresses(emailAddresses.filter((e) => e !== email));
    },
    [emailAddresses, setEmailAddresses]
  );

  // Handle close
  const handleClose = () => {
    setOpen(false);
    reset();
    setEmailInput('');
  };

  // Handle success and close
  const handleComplete = () => {
    handleClose();
    onSuccess?.();
  };

  // Format date for display
  const formatDate = (date: Date | string | null) => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('ro-RO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        {trigger || (
          <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            Importă din Email
          </button>
        )}
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 z-50" />

        <Dialog.Content
          className="fixed z-50 bg-white shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 overflow-hidden
            inset-0 md:inset-auto
            md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2
            md:w-full md:max-w-2xl md:max-h-[90vh] md:rounded-lg
            flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <Dialog.Title className="text-xl font-semibold text-gray-900">
                Importă Emailuri în Dosar
              </Dialog.Title>
              {caseTitle && <p className="text-sm text-gray-500 mt-1">{caseTitle}</p>}
            </div>
            <Dialog.Close
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-1"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </Dialog.Close>
          </div>

          {/* Progress Steps */}
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between">
              {['input', 'preview', 'assign', 'complete'].map((s, idx) => (
                <div key={s} className="flex items-center">
                  <div
                    className={clsx(
                      'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                      step === s
                        ? 'bg-blue-600 text-white'
                        : ['complete'].includes(step) ||
                            idx < ['input', 'preview', 'assign', 'complete'].indexOf(step)
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-200 text-gray-500'
                    )}
                  >
                    {idx + 1}
                  </div>
                  {idx < 3 && (
                    <div
                      className={clsx(
                        'w-16 h-0.5 mx-2',
                        idx < ['input', 'preview', 'assign', 'complete'].indexOf(step)
                          ? 'bg-green-500'
                          : 'bg-gray-200'
                      )}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>Adrese</span>
              <span>Previzualizare</span>
              <span>Roluri</span>
              <span>Finalizare</span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Step 1: Enter Email Addresses */}
            {step === 'input' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Introduceți adresele de email ale contactelor pentru care doriți să importați
                  corespondența.
                </p>

                {/* Email Input */}
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddEmail();
                      }
                    }}
                    placeholder="exemplu@email.com"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddEmail}
                    disabled={!emailInput.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Adaugă
                  </button>
                </div>

                {/* Email List */}
                {emailAddresses.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {emailAddresses.map((email) => (
                      <span
                        key={email}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                      >
                        {email}
                        <button
                          type="button"
                          onClick={() => handleRemoveEmail(email)}
                          className="text-blue-400 hover:text-blue-600"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Error */}
                {previewError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                    {previewError.message}
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Preview */}
            {step === 'preview' && preview && (
              <div className="space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-700">{preview.emailCount}</div>
                    <div className="text-xs text-blue-600">Emailuri găsite</div>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-700">{preview.threadCount}</div>
                    <div className="text-xs text-green-600">Conversații</div>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-purple-700">
                      {preview.contacts.length}
                    </div>
                    <div className="text-xs text-purple-600">Contacte</div>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-orange-700">
                      {preview.attachmentCount}
                    </div>
                    <div className="text-xs text-orange-600">Atașamente</div>
                  </div>
                </div>

                {/* Date Range */}
                {preview.dateRange.start && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm font-medium text-gray-700 mb-1">Interval de timp</div>
                    <div className="text-sm text-gray-600">
                      {formatDate(preview.dateRange.start)} - {formatDate(preview.dateRange.end)}
                    </div>
                  </div>
                )}

                {/* Import Attachments Toggle */}
                <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={importAttachments}
                    onChange={(e) => setImportAttachments(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Importă atașamentele</div>
                    <div className="text-sm text-gray-500">
                      Atașamentele vor fi salvate ca documente în dosar
                    </div>
                  </div>
                </label>

                {/* No Emails Warning */}
                {!hasEmails && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <svg
                        className="w-5 h-5 text-yellow-600 mt-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                      <div>
                        <div className="font-medium text-yellow-800">Nu s-au găsit emailuri</div>
                        <div className="text-sm text-yellow-700">
                          Nu există emailuri sincronizate pentru adresele specificate. Asigurați-vă
                          că emailurile au fost sincronizate din Microsoft 365.
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Assign Roles */}
            {step === 'assign' && preview && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 mb-4">
                  Selectați rolul pentru fiecare contact descoperit. Contactele fără rol nu vor fi
                  adăugate.
                </p>

                {preview.contacts.length === 0 ? (
                  <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500">
                    Nu s-au descoperit contacte noi din emailuri.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {preview.contacts.map((contact) => {
                      const assignment = contactAssignments.find(
                        (ca) => ca.email === contact.email
                      );
                      return (
                        <div
                          key={contact.email}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 truncate">
                              {contact.name || contact.email}
                            </div>
                            {contact.name && (
                              <div className="text-sm text-gray-500 truncate">{contact.email}</div>
                            )}
                            <div className="text-xs text-gray-400 mt-1">
                              {contact.occurrences}{' '}
                              {contact.occurrences === 1 ? 'email' : 'emailuri'}
                            </div>
                          </div>
                          <select
                            value={assignment?.role || ''}
                            onChange={(e) => {
                              const value = e.target.value as ContactRoleAssignment['role'] | '';
                              updateContactAssignment(contact.email, value || null);
                            }}
                            className="ml-4 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          >
                            <option value="">Fără rol</option>
                            {ROLE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Importing / Complete */}
            {(step === 'importing' || step === 'complete') && (
              <div className="space-y-6">
                {step === 'importing' && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
                    <div className="text-lg font-medium text-gray-900">
                      Se importă emailurile...
                    </div>
                    <div className="text-sm text-gray-500 mt-2">Vă rugăm așteptați</div>
                  </div>
                )}

                {step === 'complete' && result && (
                  <div className="space-y-6">
                    {/* Success/Error Banner */}
                    <div
                      className={clsx(
                        'p-4 rounded-lg',
                        result.success
                          ? 'bg-green-50 border border-green-200'
                          : 'bg-red-50 border border-red-200'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {result.success ? (
                          <svg
                            className="w-6 h-6 text-green-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-6 h-6 text-red-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        )}
                        <div>
                          <div
                            className={clsx(
                              'font-medium',
                              result.success ? 'text-green-800' : 'text-red-800'
                            )}
                          >
                            {result.success ? 'Import finalizat cu succes!' : 'Eroare la import'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Results Summary */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-4 bg-blue-50 rounded-lg text-center">
                        <div className="text-2xl font-bold text-blue-700">
                          {result.emailsLinked}
                        </div>
                        <div className="text-xs text-blue-600">Emailuri importate</div>
                      </div>
                      <div className="p-4 bg-green-50 rounded-lg text-center">
                        <div className="text-2xl font-bold text-green-700">
                          {result.contactsCreated}
                        </div>
                        <div className="text-xs text-green-600">Contacte create</div>
                      </div>
                      <div className="p-4 bg-purple-50 rounded-lg text-center">
                        <div className="text-2xl font-bold text-purple-700">
                          {result.attachmentsImported}
                        </div>
                        <div className="text-xs text-purple-600">Atașamente</div>
                      </div>
                    </div>

                    {/* Errors */}
                    {result.errors.length > 0 && (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="font-medium text-yellow-800 mb-2">Avertismente:</div>
                        <ul className="text-sm text-yellow-700 space-y-1">
                          {result.errors.map((err, idx) => (
                            <li key={idx}>• {err}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center p-6 border-t border-gray-200 bg-gray-50">
            <div>
              {step !== 'input' && step !== 'importing' && step !== 'complete' && (
                <button
                  type="button"
                  onClick={goBack}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  ← Înapoi
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {step === 'complete' ? 'Închide' : 'Anulează'}
              </button>

              {step === 'input' && (
                <button
                  type="button"
                  onClick={loadPreview}
                  disabled={!canLoadPreview || previewLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {previewLoading && (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  )}
                  Caută emailuri
                </button>
              )}

              {step === 'preview' && (
                <button
                  type="button"
                  onClick={goToAssignStep}
                  disabled={!hasEmails}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continuă
                </button>
              )}

              {step === 'assign' && (
                <button
                  type="button"
                  onClick={executeImport}
                  disabled={importLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {importLoading && (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  )}
                  Importă
                </button>
              )}

              {step === 'complete' && result?.success && (
                <button
                  type="button"
                  onClick={handleComplete}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  Finalizare
                </button>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

EmailImportWizard.displayName = 'EmailImportWizard';
