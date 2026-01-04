/**
 * Email Import Wizard Component
 * OPS-022: Email-to-Case Timeline Integration
 * OPS-030: Email Import with Classification
 *
 * Multi-step wizard for importing emails into a case by contact addresses:
 * 1. Enter contact email addresses
 * 2. Preview emails found and date range
 * 3. [Optional] Classify emails for multi-case clients
 * 4. Assign roles to discovered contacts
 * 5. Execute import and show results
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
    // OPS-030: Classification
    hasMultipleCases,
    classificationPreview,
    classificationOverrides,
    excludedEmailIds,
    classificationLoading,
    loadClassificationPreview,
    setClassificationOverride,
    setEmailExcluded,
    goToAssignFromClassification,
    executeClassifiedImport,
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
          <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-linear-accent bg-linear-accent/15 border border-linear-accent/30 rounded-md hover:bg-linear-accent/20 focus:outline-none focus:ring-2 focus:ring-linear-accent transition-colors">
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
          className="fixed z-50 bg-linear-bg-secondary shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 overflow-hidden
            inset-0 md:inset-auto
            md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2
            md:w-full md:max-w-4xl md:max-h-[90vh] md:rounded-lg
            flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-linear-border-subtle">
            <div>
              <Dialog.Title className="text-xl font-semibold text-linear-text-primary">
                Importă Emailuri în Dosar
              </Dialog.Title>
              {caseTitle && <p className="text-sm text-linear-text-tertiary mt-1">{caseTitle}</p>}
            </div>
            <Dialog.Close
              onClick={handleClose}
              className="text-linear-text-muted hover:text-linear-text-secondary focus:outline-none focus:ring-2 focus:ring-linear-accent rounded p-1"
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
          <div className="px-6 py-4 border-b border-linear-border-subtle bg-linear-bg-tertiary">
            {(() => {
              // OPS-030: Dynamic steps based on whether classification is needed
              // Show 5 steps if client has multiple cases (even before classification is loaded)
              const showClassificationStep = hasMultipleCases;
              const steps = showClassificationStep
                ? ['input', 'preview', 'classify', 'assign', 'complete']
                : ['input', 'preview', 'assign', 'complete'];
              const labels = showClassificationStep
                ? ['Adrese', 'Previzualizare', 'Clasificare', 'Roluri', 'Finalizare']
                : ['Adrese', 'Previzualizare', 'Roluri', 'Finalizare'];
              const currentIdx = steps.indexOf(step as string);

              return (
                <>
                  <div className="flex items-center justify-between">
                    {steps.map((s, idx) => (
                      <div key={s} className="flex items-center">
                        <div
                          className={clsx(
                            'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                            step === s
                              ? 'bg-linear-accent text-white'
                              : step === 'complete' || idx < currentIdx
                                ? 'bg-linear-success text-white'
                                : 'bg-linear-bg-tertiary text-linear-text-tertiary'
                          )}
                        >
                          {idx + 1}
                        </div>
                        {idx < steps.length - 1 && (
                          <div
                            className={clsx(
                              'w-12 h-0.5 mx-1',
                              idx < currentIdx ? 'bg-linear-success' : 'bg-linear-bg-tertiary'
                            )}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-linear-text-tertiary">
                    {labels.map((label, idx) => (
                      <span key={idx}>{label}</span>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Step 1: Enter Email Addresses */}
            {step === 'input' && (
              <div className="space-y-4">
                <p className="text-sm text-linear-text-secondary">
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
                    className="flex-1 px-3 py-2 border border-linear-border rounded-md focus:outline-none focus:ring-2 focus:ring-linear-accent"
                  />
                  <button
                    type="button"
                    onClick={handleAddEmail}
                    disabled={!emailInput.trim()}
                    className="px-4 py-2 bg-linear-accent text-white rounded-md hover:bg-linear-accent-hover focus:outline-none focus:ring-2 focus:ring-linear-accent disabled:opacity-50 disabled:cursor-not-allowed"
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
                        className="inline-flex items-center gap-1 px-3 py-1 bg-linear-accent/15 text-linear-accent rounded-full text-sm"
                      >
                        {email}
                        <button
                          type="button"
                          onClick={() => handleRemoveEmail(email)}
                          className="text-linear-accent/60 hover:text-linear-accent"
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
                  <div className="p-3 bg-linear-error/15 border border-linear-error/30 rounded-md text-sm text-linear-error">
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
                  <div className="p-4 bg-linear-accent/15 rounded-lg text-center">
                    <div className="text-2xl font-bold text-linear-accent">
                      {preview.emailCount}
                    </div>
                    <div className="text-xs text-linear-accent/80">Emailuri găsite</div>
                  </div>
                  <div className="p-4 bg-linear-success/15 rounded-lg text-center">
                    <div className="text-2xl font-bold text-linear-success">
                      {preview.threadCount}
                    </div>
                    <div className="text-xs text-linear-success/80">Conversații</div>
                  </div>
                  <div className="p-4 bg-purple-500/15 rounded-lg text-center">
                    <div className="text-2xl font-bold text-purple-500">
                      {preview.contacts.length}
                    </div>
                    <div className="text-xs text-purple-500/80">Contacte</div>
                  </div>
                  <div className="p-4 bg-linear-warning/15 rounded-lg text-center">
                    <div className="text-2xl font-bold text-linear-warning">
                      {preview.attachmentCount}
                    </div>
                    <div className="text-xs text-linear-warning/80">Atașamente</div>
                  </div>
                </div>

                {/* Date Range */}
                {preview.dateRange.start && (
                  <div className="p-4 bg-linear-bg-tertiary rounded-lg">
                    <div className="text-sm font-medium text-linear-text-secondary mb-1">
                      Interval de timp
                    </div>
                    <div className="text-sm text-linear-text-secondary">
                      {formatDate(preview.dateRange.start)} - {formatDate(preview.dateRange.end)}
                    </div>
                  </div>
                )}

                {/* Import Attachments Toggle */}
                <label className="flex items-center gap-3 p-4 bg-linear-bg-tertiary rounded-lg cursor-pointer hover:bg-linear-bg-hover transition-colors">
                  <input
                    type="checkbox"
                    checked={importAttachments}
                    onChange={(e) => setImportAttachments(e.target.checked)}
                    className="w-4 h-4 text-linear-accent border-linear-border rounded focus:ring-linear-accent"
                  />
                  <div>
                    <div className="font-medium text-linear-text-primary">Importă atașamentele</div>
                    <div className="text-sm text-linear-text-tertiary">
                      Atașamentele vor fi salvate ca documente în dosar
                    </div>
                  </div>
                </label>

                {/* No Emails Warning */}
                {!hasEmails && (
                  <div className="p-4 bg-linear-warning/15 border border-linear-warning/30 rounded-lg">
                    <div className="flex items-start gap-3">
                      <svg
                        className="w-5 h-5 text-linear-warning mt-0.5"
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
                        <div className="font-medium text-linear-warning">
                          Nu s-au găsit emailuri
                        </div>
                        <div className="text-sm text-linear-warning/80">
                          Nu există emailuri sincronizate pentru adresele specificate. Asigurați-vă
                          că emailurile au fost sincronizate din Microsoft 365.
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Classification (OPS-030) */}
            {step === 'classify' && classificationPreview && (
              <div className="space-y-6">
                <p className="text-sm text-linear-text-secondary">
                  Clientul are mai multe dosare active. Sistemul a clasificat automat emailurile.
                  Verificați și ajustați dacă este necesar.
                </p>

                {/* Summary by Case */}
                <div className="grid grid-cols-2 gap-3">
                  {classificationPreview.byCase.map((summary) => (
                    <div
                      key={summary.caseId}
                      className="p-3 bg-linear-accent/15 rounded-lg border border-linear-accent/30"
                    >
                      <div className="text-sm font-medium text-linear-accent truncate">
                        {summary.case.title}
                      </div>
                      <div className="text-2xl font-bold text-linear-accent mt-1">
                        {summary.emailCount}
                      </div>
                      <div className="text-xs text-linear-accent/80">
                        {summary.autoClassified} auto • {summary.needsReview} de verificat
                      </div>
                    </div>
                  ))}
                </div>

                {/* Needs Review Banner */}
                {classificationPreview.needsReview > 0 && (
                  <div className="p-3 bg-linear-warning/15 border border-linear-warning/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-5 h-5 text-linear-warning"
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
                      <span className="text-sm text-linear-warning">
                        {classificationPreview.needsReview} emailuri necesită verificare manuală
                      </span>
                    </div>
                  </div>
                )}

                {/* Email List with Classification */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {classificationPreview.classifications.map((classification) => {
                    const isExcluded = excludedEmailIds.includes(classification.emailId);
                    const override = classificationOverrides.find(
                      (o) => o.emailId === classification.emailId
                    );
                    const targetCaseId = override?.caseId || classification.suggestedCaseId;

                    return (
                      <div
                        key={classification.emailId}
                        className={clsx(
                          'p-3 rounded-lg border',
                          isExcluded
                            ? 'bg-linear-bg-tertiary border-linear-border-subtle opacity-60'
                            : classification.needsHumanReview
                              ? 'bg-linear-warning/15 border-linear-warning/30'
                              : 'bg-linear-bg-secondary border-linear-border-subtle'
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {/* Exclude Checkbox */}
                            <input
                              type="checkbox"
                              checked={!isExcluded}
                              onChange={(e) =>
                                setEmailExcluded(classification.emailId, !e.target.checked)
                              }
                              className="mt-1 w-4 h-4 text-linear-accent border-linear-border rounded focus:ring-linear-accent"
                            />

                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-linear-text-primary truncate">
                                {classification.email?.subject || '(fără subiect)'}
                              </div>
                              <div className="text-xs text-linear-text-tertiary truncate">
                                De la:{' '}
                                {classification.email?.fromName || classification.email?.from}
                              </div>
                              {classification.needsHumanReview && (
                                <div className="text-xs text-linear-warning mt-1">
                                  ⚠️ {classification.reviewReason}
                                </div>
                              )}
                              {classification.isGlobalSource && (
                                <div className="text-xs text-linear-accent mt-1">
                                  📧 {classification.globalSourceName}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Case Selection */}
                          <select
                            value={targetCaseId || ''}
                            onChange={(e) => {
                              const newCaseId = e.target.value || null;
                              setClassificationOverride(classification.emailId, newCaseId);
                            }}
                            disabled={isExcluded}
                            className="px-2 py-1 text-xs border border-linear-border rounded focus:outline-none focus:ring-2 focus:ring-linear-accent max-w-[150px]"
                          >
                            <option value="">Fără dosar</option>
                            {classificationPreview.byCase.map((summary) => (
                              <option key={summary.caseId} value={summary.caseId}>
                                {summary.case.title}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Confidence Badge */}
                        <div className="mt-2 flex items-center gap-2">
                          <div
                            className={clsx(
                              'text-xs px-2 py-0.5 rounded-full',
                              classification.confidence >= 0.85
                                ? 'bg-linear-success/15 text-linear-success'
                                : classification.confidence >= 0.5
                                  ? 'bg-linear-warning/15 text-linear-warning'
                                  : 'bg-linear-error/15 text-linear-error'
                            )}
                          >
                            {Math.round(classification.confidence * 100)}% încredere
                          </div>
                          {classification.reasons.length > 0 && (
                            <div className="text-xs text-linear-text-tertiary truncate">
                              {classification.reasons[0]}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Excluded Count */}
                {excludedEmailIds.length > 0 && (
                  <div className="text-sm text-linear-text-tertiary text-center">
                    {excludedEmailIds.length} emailuri excluse din import
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Assign Roles */}
            {step === 'assign' && preview && (
              <div className="space-y-4">
                <p className="text-sm text-linear-text-secondary mb-4">
                  Selectați rolul pentru fiecare contact descoperit. Contactele fără rol nu vor fi
                  adăugate.
                </p>

                {preview.contacts.length === 0 ? (
                  <div className="p-4 bg-linear-bg-tertiary rounded-lg text-center text-linear-text-tertiary">
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
                          className="flex items-center justify-between p-4 bg-linear-bg-tertiary rounded-lg"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-linear-text-primary truncate">
                              {contact.name || contact.email}
                            </div>
                            {contact.name && (
                              <div className="text-sm text-linear-text-tertiary truncate">
                                {contact.email}
                              </div>
                            )}
                            <div className="text-xs text-linear-text-muted mt-1">
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
                            className="ml-4 px-3 py-2 border border-linear-border rounded-md focus:outline-none focus:ring-2 focus:ring-linear-accent text-sm"
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
                    <div className="w-12 h-12 border-4 border-linear-accent/30 border-t-linear-accent rounded-full animate-spin mb-4" />
                    <div className="text-lg font-medium text-linear-text-primary">
                      Se importă emailurile...
                    </div>
                    <div className="text-sm text-linear-text-tertiary mt-2">Vă rugăm așteptați</div>
                  </div>
                )}

                {step === 'complete' && result && (
                  <div className="space-y-6">
                    {/* Success/Error Banner */}
                    <div
                      className={clsx(
                        'p-4 rounded-lg',
                        result.success
                          ? 'bg-linear-success/15 border border-linear-success/30'
                          : 'bg-linear-error/15 border border-linear-error/30'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {result.success ? (
                          <svg
                            className="w-6 h-6 text-linear-success"
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
                            className="w-6 h-6 text-linear-error"
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
                              result.success ? 'text-linear-success' : 'text-linear-error'
                            )}
                          >
                            {result.success ? 'Import finalizat cu succes!' : 'Eroare la import'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Results Summary */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-4 bg-linear-accent/15 rounded-lg text-center">
                        <div className="text-2xl font-bold text-linear-accent">
                          {result.emailsLinked}
                        </div>
                        <div className="text-xs text-linear-accent/80">Emailuri importate</div>
                      </div>
                      <div className="p-4 bg-linear-success/15 rounded-lg text-center">
                        <div className="text-2xl font-bold text-linear-success">
                          {result.contactsCreated}
                        </div>
                        <div className="text-xs text-linear-success/80">Contacte create</div>
                      </div>
                      <div className="p-4 bg-purple-500/15 rounded-lg text-center">
                        <div className="text-2xl font-bold text-purple-500">
                          {result.attachmentsImported}
                        </div>
                        <div className="text-xs text-purple-500/80">Atașamente</div>
                      </div>
                    </div>

                    {/* Errors */}
                    {result.errors.length > 0 && (
                      <div className="p-4 bg-linear-warning/15 border border-linear-warning/30 rounded-lg">
                        <div className="font-medium text-linear-warning mb-2">Avertismente:</div>
                        <ul className="text-sm text-linear-warning/80 space-y-1">
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
          <div className="flex justify-between items-center p-6 border-t border-linear-border-subtle bg-linear-bg-tertiary">
            <div>
              {step !== 'input' && step !== 'importing' && step !== 'complete' && (
                <button
                  type="button"
                  onClick={goBack}
                  className="px-4 py-2 text-sm font-medium text-linear-text-secondary hover:text-linear-text-primary"
                >
                  ← Înapoi
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-linear-text-secondary bg-linear-bg-secondary border border-linear-border rounded-md hover:bg-linear-bg-hover focus:outline-none focus:ring-2 focus:ring-linear-accent"
              >
                {step === 'complete' ? 'Închide' : 'Anulează'}
              </button>

              {step === 'input' && (
                <button
                  type="button"
                  onClick={loadPreview}
                  disabled={!canLoadPreview || previewLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-linear-accent rounded-md hover:bg-linear-accent-hover focus:outline-none focus:ring-2 focus:ring-linear-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                  onClick={() => {
                    // OPS-030: Check for classification if multi-case client
                    if (hasMultipleCases) {
                      loadClassificationPreview();
                    } else {
                      goToAssignStep();
                    }
                  }}
                  disabled={!hasEmails || classificationLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-linear-accent rounded-md hover:bg-linear-accent-hover focus:outline-none focus:ring-2 focus:ring-linear-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {classificationLoading && (
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
                  Continuă
                </button>
              )}

              {step === 'classify' && (
                <button
                  type="button"
                  onClick={goToAssignFromClassification}
                  className="px-4 py-2 text-sm font-medium text-white bg-linear-accent rounded-md hover:bg-linear-accent-hover focus:outline-none focus:ring-2 focus:ring-linear-accent"
                >
                  Continuă la Roluri
                </button>
              )}

              {step === 'assign' && (
                <button
                  type="button"
                  onClick={() => {
                    // OPS-030: Use classified import if we went through classification
                    if (classificationPreview) {
                      executeClassifiedImport();
                    } else {
                      executeImport();
                    }
                  }}
                  disabled={importLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-linear-accent rounded-md hover:bg-linear-accent-hover focus:outline-none focus:ring-2 focus:ring-linear-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                  className="px-4 py-2 text-sm font-medium text-white bg-linear-success rounded-md hover:bg-linear-success/80 focus:outline-none focus:ring-2 focus:ring-linear-success"
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
