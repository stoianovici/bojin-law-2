/**
 * ActionConfirmCard Component
 * OPS-071: AssistantPill Components
 *
 * Displays a proposed action from the AI assistant with confirm/reject buttons.
 * Uses the Card component from the UI package.
 */

'use client';

import React from 'react';
import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons';
import { Card } from '@legal-platform/ui';

// ============================================================================
// Types
// ============================================================================

export interface ActionConfirmCardProps {
  action: {
    type: string;
    displayText: string;
    confirmationPrompt?: string;
    entityPreview?: Record<string, unknown>;
  };
  onConfirm: () => void;
  onReject: () => void;
  isLoading: boolean;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Action confirmation card with preview and buttons
 */
export function ActionConfirmCard({
  action,
  onConfirm,
  onReject,
  isLoading,
}: ActionConfirmCardProps) {
  return (
    <Card
      data-testid="action-confirm-card"
      className="mb-4 border-primary/20 bg-primary/5"
      footer={
        <div className="flex gap-2">
          <button
            onClick={onReject}
            disabled={isLoading}
            data-testid="action-reject"
            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Cross2Icon className="h-4 w-4" />
            <span>Anulează</span>
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            data-testid="action-confirm"
            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <CheckIcon className="h-4 w-4" />
            <span>Confirmă</span>
          </button>
        </div>
      }
    >
      {/* Body content */}
      <p className="text-sm font-medium text-gray-900 mb-2">
        {action.confirmationPrompt || 'Confirmați această acțiune?'}
      </p>

      {/* Entity preview */}
      {action.entityPreview && (
        <div className="bg-white rounded-lg p-3 text-sm space-y-1">
          {Object.entries(action.entityPreview).map(([key, value]) => (
            <div key={key} className="flex justify-between">
              <span className="text-gray-500">{key}:</span>
              <span className="font-medium">{String(value)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

ActionConfirmCard.displayName = 'ActionConfirmCard';
