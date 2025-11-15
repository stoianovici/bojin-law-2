'use client';

import { useState } from 'react';
// TODO: Revert to @ alias when Next.js/Turbopack path resolution is fixed
import { useCommunicationStore } from '../../stores/communication.store';
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

export function AIDraftResponsePanel() {
  const [tone, setTone] = useState<'formal' | 'professional' | 'brief'>('professional');
  const [isExpanded, setIsExpanded] = useState(false);
  const { getSelectedThread } = useCommunicationStore();
  const thread = getSelectedThread();

  if (!thread) return null;

  // TODO: Replace with actual AI draft service call
  const draft = {
    draftBody: 'Funcționalitatea de draft AI va fi implementată în versiunile viitoare.',
    confidence: 'Medium' as const
  };

  return (
    <div className="border-t bg-white">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 text-left text-sm font-semibold flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          Sugestie răspuns AI
        </span>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronUp className="h-4 w-4 text-gray-500" />
        )}
      </button>

      {isExpanded && (
        <div className="p-4 border-t space-y-3">
          {/* Tone selector */}
          <div className="flex gap-2">
            {(['formal', 'professional', 'brief'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTone(t)}
                className={`px-3 py-1 text-sm rounded ${
                  tone === t ? 'bg-blue-500 text-white' : 'bg-gray-100'
                }`}
              >
                {t === 'formal' ? 'Formal' : t === 'professional' ? 'Professional' : 'Scurt'}
              </button>
            ))}
          </div>

          {/* Draft content */}
          <div className="p-3 bg-gray-50 rounded text-sm whitespace-pre-wrap">
            {draft.draftBody}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
              Folosește draft
            </button>
            <button className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200">
              Regenerează
            </button>
          </div>

          <div className="text-xs text-gray-500">
            Încredere AI: {draft.confidence}
          </div>
        </div>
      )}
    </div>
  );
}
