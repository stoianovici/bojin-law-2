/**
 * Contacts Section Component
 * OPS-211: Part of Expandable Case Workspace Epic
 * OPS-223: Dynamic actor types support
 *
 * Card-based contact list with inline editing for case actors.
 * Supports add, edit, and remove operations with role-based access.
 */

'use client';

import React, { useState } from 'react';
import { clsx } from 'clsx';
import { PlusIcon } from '@radix-ui/react-icons';
import { InlineContactCard } from '../InlineContactCard';
import { useActorTypes } from '../../../hooks/useActorTypes';
import type { CaseActor } from '@legal-platform/types';

// ============================================================================
// Types
// ============================================================================

export interface ContactsSectionProps {
  /** Case ID for mutations */
  caseId: string;
  /** List of case actors */
  actors: CaseActor[];
  /** Whether the section is editable */
  editable: boolean;
  /** Optional additional class names */
  className?: string;
}

// ============================================================================
// Card Wrapper Component
// ============================================================================

interface CardProps {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

function Card({ title, children, action, className }: CardProps) {
  return (
    <div className={clsx('bg-linear-bg-secondary rounded-lg border border-linear-border-subtle shadow-sm', className)}>
      <div className="px-5 py-4 border-b border-linear-border-subtle flex items-center justify-between">
        <h3 className="text-base font-semibold text-linear-text-primary">{title}</h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ContactsSection({ caseId, actors, editable, className }: ContactsSectionProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // OPS-223: Fetch dynamic actor types
  const { actorTypeOptions } = useActorTypes();

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleStartAdd = () => {
    // Cancel any ongoing edit before adding
    setEditingId(null);
    setIsAdding(true);
  };

  const handleSaveNew = () => {
    setIsAdding(false);
  };

  const handleCancelNew = () => {
    setIsAdding(false);
  };

  const handleStartEdit = (actorId: string) => {
    // Cancel adding if in progress
    setIsAdding(false);
    setEditingId(actorId);
  };

  const handleSaveEdit = () => {
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Card
      title="Contacte & Părți"
      className={className}
      action={
        editable && !isAdding ? (
          <button
            onClick={handleStartAdd}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-linear-accent hover:text-linear-accent-hover hover:bg-linear-accent/10 rounded-lg transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            Adaugă
          </button>
        ) : null
      }
    >
      <div className="space-y-3">
        {/* New Actor Form (at the top when adding) */}
        {isAdding && (
          <InlineContactCard
            caseId={caseId}
            isNew
            onSave={handleSaveNew}
            onCancel={handleCancelNew}
            editable={true}
            actorTypeOptions={actorTypeOptions}
          />
        )}

        {/* Existing Actors */}
        {actors.length > 0 ? (
          actors.map((actor) => (
            <InlineContactCard
              key={actor.id}
              actor={actor}
              caseId={caseId}
              isEditing={editingId === actor.id}
              onEdit={() => handleStartEdit(actor.id)}
              onSave={handleSaveEdit}
              onCancel={handleCancelEdit}
              editable={editable}
              actorTypeOptions={actorTypeOptions}
            />
          ))
        ) : !isAdding ? (
          <p className="text-sm text-linear-text-tertiary text-center py-4">
            Nu au fost adăugate persoane de contact.
          </p>
        ) : null}
      </div>
    </Card>
  );
}

ContactsSection.displayName = 'ContactsSection';
