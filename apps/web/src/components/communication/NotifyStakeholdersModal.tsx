'use client';

/**
 * NotifyStakeholdersModal Component
 * OPS-011: Phase 3 Communication Tools
 *
 * Allows users to quickly notify stakeholders (thread participants or case actors)
 * about important updates from an email thread.
 */

import { useState, useCallback, useMemo } from 'react';
import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { X, Save, Loader2, Users, Mail, Sparkles } from 'lucide-react';
import { useNotificationStore } from '../../stores/notificationStore';
import type { CommunicationThread, CommunicationMessage } from '@legal-platform/types';

// GraphQL mutation for sending email
const SEND_NEW_EMAIL = gql`
  mutation SendNewEmail($input: SendEmailInput!) {
    sendNewEmail(input: $input) {
      success
      messageId
      error
    }
  }
`;

interface SendEmailResult {
  sendNewEmail: {
    success: boolean;
    messageId?: string;
    error?: string;
  };
}

interface NotifyStakeholdersModalProps {
  thread: CommunicationThread;
  onClose: () => void;
}

export function NotifyStakeholdersModal({ thread, onClose }: NotifyStakeholdersModalProps) {
  const { addNotification } = useNotificationStore();
  const [sendNewEmail, { loading: sending }] = useMutation<SendEmailResult>(SEND_NEW_EMAIL);

  // Extract unique participants from thread (excluding current user would require auth context)
  const participants = useMemo(() => {
    const emails = new Map<string, { email: string; name: string }>();

    thread.participants?.forEach((p) => {
      if (p.email && !emails.has(p.email)) {
        emails.set(p.email, { email: p.email, name: p.name || p.email });
      }
    });

    // Also extract from messages
    thread.messages?.forEach((msg: CommunicationMessage) => {
      if (msg.senderEmail && !emails.has(msg.senderEmail)) {
        emails.set(msg.senderEmail, {
          email: msg.senderEmail,
          name: msg.senderName || msg.senderEmail,
        });
      }
    });

    return Array.from(emails.values());
  }, [thread]);

  // State
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState(`Actualizare: ${thread.subject}`);
  const [body, setBody] = useState('');
  const [customRecipient, setCustomRecipient] = useState('');

  // Toggle recipient selection
  const toggleRecipient = useCallback((email: string) => {
    setSelectedRecipients((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(email)) {
        newSet.delete(email);
      } else {
        newSet.add(email);
      }
      return newSet;
    });
  }, []);

  // Add custom recipient
  const addCustomRecipient = useCallback(() => {
    const email = customRecipient.trim().toLowerCase();
    if (email && email.includes('@')) {
      setSelectedRecipients((prev) => new Set(prev).add(email));
      setCustomRecipient('');
    }
  }, [customRecipient]);

  // Generate suggested message
  const generateSuggestedMessage = useCallback(() => {
    const latestMessage = thread.messages?.[thread.messages.length - 1];
    const preview = latestMessage?.body?.substring(0, 200) || '';

    setBody(
      `Bună ziua,

Vă informăm despre o actualizare importantă în legătură cu:

"${thread.subject}"

${preview ? `Rezumat: ${preview}...` : ''}

Pentru detalii suplimentare, vă rugăm să ne contactați.

Cu stimă`
    );
  }, [thread]);

  // Handle send
  const handleSend = useCallback(async () => {
    if (selectedRecipients.size === 0) {
      addNotification({
        type: 'error',
        title: 'Eroare',
        message: 'Selectați cel puțin un destinatar',
      });
      return;
    }

    if (!body.trim()) {
      addNotification({
        type: 'error',
        title: 'Eroare',
        message: 'Introduceți mesajul',
      });
      return;
    }

    try {
      const result = await sendNewEmail({
        variables: {
          input: {
            to: Array.from(selectedRecipients),
            subject,
            body,
          },
        },
      });

      if (result.data?.sendNewEmail?.success) {
        addNotification({
          type: 'success',
          title: 'Notificare trimisă',
          message: `Email trimis către ${selectedRecipients.size} destinatar${selectedRecipients.size > 1 ? 'i' : ''}`,
        });
        onClose();
      } else {
        addNotification({
          type: 'error',
          title: 'Eroare',
          message: result.data?.sendNewEmail?.error || 'Nu s-a putut trimite notificarea',
        });
      }
    } catch (error) {
      console.error('[NotifyStakeholders] Error:', error);
      addNotification({
        type: 'error',
        title: 'Eroare',
        message: 'Eroare la trimiterea notificării',
      });
    }
  }, [selectedRecipients, subject, body, sendNewEmail, addNotification, onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Notifică părțile interesate
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Închide"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Thread context */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Conversație:</span> {thread.subject}
            </p>
            {thread.caseName && (
              <p className="text-sm text-gray-600 mt-1">
                <span className="font-medium">Dosar:</span> {thread.caseName}
              </p>
            )}
          </div>

          {/* Recipients */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Destinatari</label>

            {/* Participant checkboxes */}
            {participants.length > 0 && (
              <div className="space-y-2 mb-3">
                {participants.map((p) => (
                  <label
                    key={p.email}
                    className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRecipients.has(p.email)}
                      onChange={() => toggleRecipient(p.email)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <Mail className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-900">{p.name}</span>
                    {p.name !== p.email && (
                      <span className="text-gray-500 text-xs">({p.email})</span>
                    )}
                  </label>
                ))}
              </div>
            )}

            {/* Custom recipient input */}
            <div className="flex gap-2">
              <input
                type="email"
                value={customRecipient}
                onChange={(e) => setCustomRecipient(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomRecipient()}
                placeholder="Adaugă alt destinatar..."
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={addCustomRecipient}
                disabled={!customRecipient.includes('@')}
                className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Adaugă
              </button>
            </div>

            {/* Selected custom recipients */}
            {Array.from(selectedRecipients).filter((e) => !participants.find((p) => p.email === e))
              .length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {Array.from(selectedRecipients)
                  .filter((e) => !participants.find((p) => p.email === e))
                  .map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                    >
                      {email}
                      <button
                        onClick={() => toggleRecipient(email)}
                        className="hover:text-blue-900"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
              </div>
            )}
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subiect</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Message body */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Mesaj</label>
              <button
                onClick={generateSuggestedMessage}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Sparkles className="h-3 w-3" />
                Sugerează mesaj
              </button>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              placeholder="Scrieți mesajul de notificare..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <p className="text-sm text-gray-500">
            {selectedRecipients.size} destinatar{selectedRecipients.size !== 1 ? 'i' : ''} selectat
            {selectedRecipients.size !== 1 ? 'i' : ''}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
            >
              Anulează
            </button>
            <button
              onClick={handleSend}
              disabled={sending || selectedRecipients.size === 0 || !body.trim()}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Se salvează...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Salvează în Ciorne
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NotifyStakeholdersModal;
