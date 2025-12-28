'use client';

/**
 * CaseDetailsSection Component
 * OPS-210: Case details with inline editing
 *
 * Displays case details (title, description, type, value, openedAt) with
 * inline editing for users with edit permissions. Uses InlineEditField
 * for per-field saves via useCaseUpdate.
 */

import React, { useMemo, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { clsx } from 'clsx';
import Link from 'next/link';
import { InlineEditField } from '../InlineEditField';
import { FinancialData } from '../../auth/FinancialData';
import { useCaseTypes } from '../../../hooks/useCaseTypes';
import { useCaseUpdate } from '../../../hooks/useCaseUpdate';
import { useAuth } from '../../../contexts/AuthContext';
import { useNotificationStore } from '../../../stores/notificationStore';

// ============================================================================
// Types
// ============================================================================

export interface CaseDetailsSectionProps {
  /** Case ID for updates */
  caseId: string;
  /** Case data to display */
  caseData: {
    title: string;
    caseNumber?: string | null;
    description: string | null;
    type: string;
    clientId?: string;
    clientName?: string;
    value?: number | null;
    openedDate: Date | string;
  };
  /** Whether user can edit case details */
  editable: boolean;
  /** Whether user can edit financial data (Partners only) */
  canEditFinancials: boolean;
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Card Component (local)
// ============================================================================

interface CardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

function Card({ title, children, className }: CardProps) {
  return (
    <div className={clsx('bg-linear-bg-secondary rounded-lg border border-linear-border-subtle shadow-sm', className)}>
      <div className="px-5 py-4 border-b border-linear-border-subtle">
        <h3 className="text-base font-semibold text-linear-text-primary">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function CaseDetailsSection({
  caseId,
  caseData,
  editable,
  canEditFinancials,
  className,
}: CaseDetailsSectionProps) {
  const { caseTypes, loading: typesLoading, createCaseType, createLoading } = useCaseTypes();
  const { updateCase } = useCaseUpdate();
  const { user } = useAuth();
  const { addNotification } = useNotificationStore();

  const isPartner = user?.role === 'Partner';

  // New type form state
  const [showAddType, setShowAddType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeCode, setNewTypeCode] = useState('');

  // Helper to generate code from name
  const generateCodeFromName = (name: string) =>
    name
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);

  const handleTypeNameChange = (name: string) => {
    setNewTypeName(name);
    if (name) {
      setNewTypeCode(generateCodeFromName(name));
    }
  };

  // Handle create new type
  const handleCreateType = useCallback(async () => {
    if (!newTypeName.trim() || !newTypeCode.trim()) return;

    const result = await createCaseType(newTypeName.trim(), newTypeCode.trim());
    if (result.success) {
      addNotification({
        type: 'success',
        title: 'Tip dosar creat',
        message: `Tipul "${newTypeName}" a fost adăugat cu succes.`,
      });
      // Auto-select the new type for this case
      if (result.caseType) {
        await updateCase(caseId, { type: result.caseType.code });
      }
      setShowAddType(false);
      setNewTypeName('');
      setNewTypeCode('');
    } else {
      addNotification({
        type: 'error',
        title: 'Eroare',
        message: result.error || 'Nu s-a putut crea tipul de dosar.',
      });
    }
  }, [newTypeName, newTypeCode, createCaseType, addNotification, updateCase, caseId]);

  // Convert case types to select options
  const typeOptions = useMemo(() => {
    return caseTypes.map((ct) => ({
      value: ct.code,
      label: ct.name,
    }));
  }, [caseTypes]);

  // Find the display name for current type
  const currentTypeName = useMemo(() => {
    const found = caseTypes.find((ct) => ct.code === caseData.type);
    return found?.name || caseData.type;
  }, [caseTypes, caseData.type]);

  // Format opened date
  const formattedOpenedDate = useMemo(() => {
    const date =
      typeof caseData.openedDate === 'string' ? new Date(caseData.openedDate) : caseData.openedDate;
    return format(date, 'd MMMM yyyy', { locale: ro });
  }, [caseData.openedDate]);

  // Format value display
  const formatValue = (v: string | number | null | undefined): React.ReactNode => {
    if (v === null || v === undefined || v === '') return '-';
    const num = typeof v === 'string' ? parseFloat(v) : v;
    if (isNaN(num)) return '-';
    return `${num.toLocaleString('ro-RO')} RON`;
  };

  return (
    <Card title="Detalii Dosar" className={className}>
      <div className="divide-y divide-linear-border-subtle">
        {/* Title */}
        <InlineEditField
          caseId={caseId}
          fieldName="title"
          value={caseData.title}
          label="Titlu"
          editable={editable}
          placeholder="Fără titlu"
        />

        {/* Internal Case Number */}
        <InlineEditField
          caseId={caseId}
          fieldName="caseNumber"
          value={caseData.caseNumber}
          label="Număr Intern"
          editable={editable}
          placeholder="ex: BL-2024-001"
        />

        {/* Description */}
        <InlineEditField
          caseId={caseId}
          fieldName="description"
          value={caseData.description}
          label="Descriere"
          fieldType="textarea"
          editable={editable}
          placeholder="Fără descriere"
        />

        {/* Type - with Add New button for Partners */}
        <div className="py-3">
          <dt className="text-sm font-medium text-linear-text-tertiary mb-1">Tip dosar</dt>
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <InlineEditField
                caseId={caseId}
                fieldName="type"
                value={caseData.type}
                label=""
                fieldType="select"
                options={typeOptions}
                editable={editable && !typesLoading}
                formatDisplay={() => currentTypeName}
              />
            </div>
            {editable && isPartner && (
              <button
                type="button"
                onClick={() => setShowAddType(!showAddType)}
                className="mt-1 px-2 py-1 text-xs font-medium text-linear-accent border border-linear-accent/30 rounded hover:bg-linear-accent/10 focus:outline-none focus:ring-2 focus:ring-linear-accent transition-colors whitespace-nowrap"
              >
                + Tip nou
              </button>
            )}
          </div>

          {/* Add New Type Form */}
          {showAddType && isPartner && (
            <div className="mt-3 p-3 bg-linear-bg-tertiary border border-linear-border-subtle rounded-md space-y-3">
              <div>
                <label className="block text-xs font-medium text-linear-text-secondary mb-1">Nume tip nou</label>
                <input
                  type="text"
                  value={newTypeName}
                  onChange={(e) => handleTypeNameChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-linear-border rounded-md bg-linear-bg-secondary text-linear-text-primary focus:outline-none focus:ring-2 focus:ring-linear-accent"
                  placeholder="ex: Insolvență"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-linear-text-secondary mb-1">
                  Cod (generat automat)
                </label>
                <input
                  type="text"
                  value={newTypeCode}
                  onChange={(e) =>
                    setNewTypeCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))
                  }
                  className="w-full px-3 py-2 text-sm border border-linear-border rounded-md bg-linear-bg-tertiary text-linear-text-primary focus:outline-none focus:ring-2 focus:ring-linear-accent"
                  placeholder="INSOLVENTA"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddType(false);
                    setNewTypeName('');
                    setNewTypeCode('');
                  }}
                  className="px-3 py-1.5 text-sm text-linear-text-secondary hover:text-linear-text-primary"
                >
                  Anulează
                </button>
                <button
                  type="button"
                  disabled={!newTypeName.trim() || !newTypeCode.trim() || createLoading}
                  onClick={handleCreateType}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-linear-accent rounded-md hover:bg-linear-accent-hover focus:outline-none focus:ring-2 focus:ring-linear-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  {createLoading && (
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
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
                  Salvează
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Client (read-only - links to client profile) */}
        {caseData.clientName && (
          <div className="py-3">
            <dt className="text-sm font-medium text-linear-text-tertiary mb-1">Client</dt>
            <dd className="text-base text-linear-text-primary">
              {caseData.clientId ? (
                <Link
                  href={`/clients/${caseData.clientId}`}
                  className="text-linear-accent hover:text-linear-accent-hover hover:underline"
                >
                  {caseData.clientName}
                </Link>
              ) : (
                caseData.clientName
              )}
            </dd>
          </div>
        )}

        {/* Opened Date (read-only) */}
        <div className="py-3">
          <dt className="text-sm font-medium text-linear-text-tertiary mb-1">Data deschidere</dt>
          <dd className="text-base text-linear-text-primary">{formattedOpenedDate}</dd>
        </div>

        {/* Value (financial - wrapped in FinancialData) */}
        <FinancialData>
          <InlineEditField
            caseId={caseId}
            fieldName="value"
            value={caseData.value}
            label="Valoare dosar"
            fieldType="number"
            editable={canEditFinancials}
            placeholder="-"
            formatDisplay={formatValue}
          />
        </FinancialData>
      </div>
    </Card>
  );
}

CaseDetailsSection.displayName = 'CaseDetailsSection';
