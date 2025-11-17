'use client';

import { useState, useEffect } from 'react';
// TODO: Revert to @ alias when Next.js/Turbopack path resolution is fixed
import { useCommunicationStore } from '../../stores/communication.store';
import { X, Sparkles } from 'lucide-react';

export function ComposeInterface() {
  const {
    isComposeOpen,
    composeMode,
    composeThreadId,
    threads,
    draftBody,
    updateDraft,
    closeCompose,
  } = useCommunicationStore();

  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [includeOriginal, setIncludeOriginal] = useState(false);
  const [selectedTone, setSelectedTone] = useState<'formal' | 'professional' | 'brief'>(
    'professional'
  );
  const [showAIDraft, setShowAIDraft] = useState(false);

  // Get the thread for reply mode
  const thread = composeThreadId ? threads.find((t) => t.id === composeThreadId) : null;

  // Get the last message for reply context
  const originalMessage = thread?.messages[thread.messages.length - 1];

  // Mock AI draft based on tone (prototype only)
  const aiDrafts = {
    formal:
      'Stimate Domnule/Stimată Doamnă,\n\nVă mulțumesc pentru mesajul dumneavoastră. Am luat la cunoștință informațiile transmise și vă voi răspunde în cel mai scurt timp posibil.\n\nCu deosebită stimă,',
    professional:
      'Bună ziua,\n\nVă mulțumesc pentru mesaj. Am primit informațiile și voi reveni cu un răspuns în curând.\n\nCu stimă,',
    brief: 'Mulțumesc pentru mesaj. Voi răspunde în curând.\n\nCu stimă,',
  };

  // Auto-populate fields when in reply mode
  useEffect(() => {
    if (composeMode === 'reply' && originalMessage) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTo(originalMessage.senderEmail);

      setSubject(`Re: ${thread?.subject || originalMessage.subject}`);

      setShowAIDraft(true); // Show AI draft panel for replies
    } else {
      setTo('');

      setSubject('');

      setShowAIDraft(false);
    }
  }, [composeMode, originalMessage, thread]);

  // Build message body with optional quoted original
  // const getFullMessageBody = () => {
  //   let body = draftBody;
  //   if (includeOriginal && originalMessage) {
  //     body += `\n\n---\nDe la: ${originalMessage.senderName} <${originalMessage.senderEmail}>\nData: ${originalMessage.sentDate.toLocaleString('ro-RO')}\nSubiect: ${originalMessage.subject}\n\n${originalMessage.body}`;
  //   }
  //   return body;
  // };

  const handleUseAIDraft = () => {
    updateDraft(aiDrafts[selectedTone]);
  };

  if (!isComposeOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">
            {composeMode === 'new' && 'Mesaj nou'}
            {composeMode === 'reply' && 'Răspunde'}
            {composeMode === 'forward' && 'Redirecționează'}
          </h2>
          <button
            onClick={closeCompose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Închide"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Către:</label>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="Destinatar..."
              className="w-full border rounded px-3 py-2 text-sm"
              readOnly={composeMode === 'reply'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Subiect:</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subiect..."
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          {/* AI Draft Panel for replies */}
          {showAIDraft && composeMode === 'reply' && (
            <div className="p-3 bg-purple-50 rounded border border-purple-200">
              <div className="font-semibold mb-2 flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-purple-500" />
                Răspuns generat de AI
              </div>
              <div className="space-y-2">
                <div className="flex gap-2 items-center">
                  <label className="text-xs font-medium">Ton:</label>
                  <select
                    value={selectedTone}
                    onChange={(e) =>
                      setSelectedTone(e.target.value as 'formal' | 'professional' | 'brief')
                    }
                    className="text-xs border rounded px-2 py-1"
                  >
                    <option value="formal">Formal</option>
                    <option value="professional">Profesional</option>
                    <option value="brief">Scurt</option>
                  </select>
                  <button
                    onClick={handleUseAIDraft}
                    className="ml-auto px-3 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
                  >
                    Folosește draft AI
                  </button>
                </div>
                <div className="text-xs text-gray-600 bg-white p-2 rounded border max-h-32 overflow-y-auto whitespace-pre-wrap">
                  {aiDrafts[selectedTone]}
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Mesaj:</label>
            <textarea
              value={draftBody}
              onChange={(e) => updateDraft(e.target.value)}
              placeholder="Scrie mesajul..."
              className="w-full border rounded px-3 py-2 text-sm h-64"
            />
          </div>

          {/* Include original message toggle for replies */}
          {composeMode === 'reply' && originalMessage && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="includeOriginal"
                checked={includeOriginal}
                onChange={(e) => setIncludeOriginal(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="includeOriginal" className="text-sm text-gray-700 cursor-pointer">
                Include mesajul original în răspuns
              </label>
            </div>
          )}

          {/* Natural Language Enhancements Mockup */}
          {composeMode === 'new' && (
            <div className="p-3 bg-blue-50 rounded text-sm">
              <div className="font-semibold mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-500" />
                Sugestii inteligente
              </div>
              <div className="space-y-1 text-xs text-gray-600">
                <div>• Referință dosar detectată: Dosar #12345</div>
                <div>• Termen sugerat: 15 martie 2025</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex items-center justify-between">
          <button className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
            Trimite (Mockup)
          </button>
          <div className="flex gap-2">
            <button className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200">
              Salvează draft
            </button>
            <button
              onClick={closeCompose}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
            >
              Anulează
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
