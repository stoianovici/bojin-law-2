/**
 * CaseSubscriptionSettings Component
 * Story 4.6: Task Collaboration and Updates (AC: 6)
 *
 * Settings panel for managing case notification subscriptions
 */

'use client';

import React from 'react';
import {
  useCaseSubscription,
  useSubscribeToCaseUpdates,
  useUpdateCaseSubscription,
  useUnsubscribeFromCaseUpdates,
} from '@/hooks/useCaseSubscription';

interface CaseSubscriptionSettingsProps {
  caseId: string;
  compact?: boolean;
}

export function CaseSubscriptionSettings({
  caseId,
  compact = false,
}: CaseSubscriptionSettingsProps) {
  const { data, loading } = useCaseSubscription(caseId);
  const [subscribe, { loading: subscribing }] = useSubscribeToCaseUpdates();
  const [updateSubscription, { loading: updating }] = useUpdateCaseSubscription();
  const [unsubscribe, { loading: unsubscribing }] = useUnsubscribeFromCaseUpdates();

  const subscription = data?.caseSubscription;
  const isSubscribed = !!subscription;
  const isBusy = loading || subscribing || updating || unsubscribing;

  const handleSubscribe = async () => {
    await subscribe({ variables: { caseId } });
  };

  const handleUnsubscribe = async () => {
    if (window.confirm('Sigur doriți să vă dezabonați de la notificările acestui dosar?')) {
      await unsubscribe({ variables: { caseId } });
    }
  };

  const handleToggle = async (field: string, value: boolean) => {
    await updateSubscription({
      variables: {
        caseId,
        input: { [field]: value },
      },
    });
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-32" />
      </div>
    );
  }

  // Compact view - just a subscribe/unsubscribe button
  if (compact) {
    return (
      <button
        onClick={isSubscribed ? handleUnsubscribe : handleSubscribe}
        disabled={isBusy}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
          isSubscribed
            ? 'bg-green-50 text-green-700 hover:bg-green-100'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        } disabled:opacity-50`}
      >
        {isSubscribed ? (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            Abonat
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            Abonează-te
          </>
        )}
      </button>
    );
  }

  // Full settings panel
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Setări Notificări</h3>
        {isSubscribed && (
          <button
            onClick={handleUnsubscribe}
            disabled={isBusy}
            className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
          >
            Dezabonează-te
          </button>
        )}
      </div>

      {!isSubscribed ? (
        <div className="text-center py-6 bg-gray-50 rounded-lg">
          <svg
            className="w-12 h-12 mx-auto text-gray-400 mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          <p className="text-gray-600 mb-3">Nu sunteți abonat la notificările acestui dosar.</p>
          <button
            onClick={handleSubscribe}
            disabled={isBusy}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Abonează-te acum
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <ToggleOption
            label="Rezumat zilnic"
            description="Primește un email zilnic cu rezumatul activității"
            checked={subscription.digestEnabled}
            onChange={(value) => handleToggle('digestEnabled', value)}
            disabled={isBusy}
          />

          <ToggleOption
            label="Notificări sarcini"
            description="Primește notificări pentru sarcini noi și actualizări"
            checked={subscription.notifyOnTask}
            onChange={(value) => handleToggle('notifyOnTask', value)}
            disabled={isBusy}
          />

          <ToggleOption
            label="Notificări documente"
            description="Primește notificări pentru documente noi și modificări"
            checked={subscription.notifyOnDocument}
            onChange={(value) => handleToggle('notifyOnDocument', value)}
            disabled={isBusy}
          />

          <ToggleOption
            label="Notificări comentarii"
            description="Primește notificări pentru comentarii și mențiuni"
            checked={subscription.notifyOnComment}
            onChange={(value) => handleToggle('notifyOnComment', value)}
            disabled={isBusy}
          />
        </div>
      )}
    </div>
  );
}

interface ToggleOptionProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

function ToggleOption({ label, description, checked, onChange, disabled }: ToggleOptionProps) {
  return (
    <div className="flex items-start justify-between gap-3 p-3 bg-gray-50 rounded-lg">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        disabled={disabled}
        className={`relative flex-shrink-0 w-10 h-6 rounded-full transition-colors ${
          checked ? 'bg-blue-600' : 'bg-gray-300'
        } disabled:opacity-50`}
      >
        <span
          className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

export default CaseSubscriptionSettings;
