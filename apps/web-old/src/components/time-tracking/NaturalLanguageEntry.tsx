/**
 * NaturalLanguageEntry Component
 * Natural language time entry parser for Romanian input
 */

'use client';

import React from 'react';
import { useTimeTrackingStore } from '../../stores/time-tracking.store';

const examples = [
  '2 ore cercetare juridică pentru dosarul Popescu',
  '30 min întâlnire client Ionescu',
  '1.5 ore redactare contract',
];

const taskTypeLabels: Record<string, string> = {
  Research: 'Cercetare',
  Drafting: 'Redactare',
  ClientMeeting: 'Întâlnire Client',
  CourtAppearance: 'Prezentare Instanță',
  Email: 'Email',
  PhoneCall: 'Apel Telefonic',
  Administrative: 'Administrativ',
  Other: 'Altele',
};

export function NaturalLanguageEntry() {
  const parseNaturalLanguage = useTimeTrackingStore((state) => state.parseNaturalLanguage);
  const lastParseResult = useTimeTrackingStore((state) => state.lastParseResult);
  const addTimeEntry = useTimeTrackingStore((state) => state.addTimeEntry);

  const [input, setInput] = React.useState('');
  const [showPreview, setShowPreview] = React.useState(false);

  const handleParse = () => {
    if (!input.trim()) return;
    parseNaturalLanguage(input);
    setShowPreview(true);
  };

  const handleConfirm = () => {
    if (!lastParseResult || !lastParseResult.success) return;

    const { parsedEntry } = lastParseResult;

    // TODO: Get userId and userName from auth context
    // TODO: Require caseId and caseName from parsing or selection
    addTimeEntry({
      userId: '', // Should come from auth context
      userName: '', // Should come from auth context
      caseId: parsedEntry.caseId || '', // Should be required, not fallback
      caseName: parsedEntry.caseName || '', // Should be required, not fallback
      taskType: parsedEntry.taskType || 'Other',
      date: new Date(),
      duration: parsedEntry.duration || 0,
      description: parsedEntry.description || input,
      isBillable: true,
    });

    // Reset
    setInput('');
    setShowPreview(false);
  };

  const handleEdit = () => {
    setShowPreview(false);
  };

  const formatMinutesToHours = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${String(mins).padStart(2, '0')}`;
  };

  const getConfidenceColor = (confidence: 'Low' | 'Medium' | 'High') => {
    switch (confidence) {
      case 'High':
        return 'text-green-600 bg-green-100';
      case 'Medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'Low':
        return 'text-red-600 bg-red-100';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Intrare Rapidă - Limbaj Natural</h2>

      {!showPreview ? (
        <div className="space-y-4">
          {/* Input */}
          <div>
            <label htmlFor="nl-input" className="block text-sm font-medium text-gray-700 mb-1">
              Descrie activitatea
            </label>
            <textarea
              id="nl-input"
              rows={3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                  handleParse();
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Ex: 2 ore cercetare juridică pentru dosarul Popescu"
            />
          </div>

          {/* Examples */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Exemple:</p>
            <div className="space-y-1">
              {examples.map((example, i) => (
                <button
                  key={i}
                  onClick={() => setInput(example)}
                  className="block text-xs text-blue-600 hover:text-blue-700 hover:underline"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          {/* Parse Button */}
          <button
            onClick={handleParse}
            disabled={!input.trim()}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Analizează (Ctrl+Enter)
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Parsed Result Preview */}
          {lastParseResult && (
            <>
              {/* Confidence Indicator */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Încredere:</span>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${getConfidenceColor(
                    lastParseResult.confidence
                  )}`}
                >
                  {lastParseResult.confidence === 'High'
                    ? 'Ridicată'
                    : lastParseResult.confidence === 'Medium'
                      ? 'Medie'
                      : 'Scăzută'}
                </span>
              </div>

              {/* Parsed Fields */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div>
                  <span className="text-sm font-medium text-gray-700">Durată:</span>
                  <span className="ml-2 text-sm text-gray-900">
                    {lastParseResult.parsedEntry.duration
                      ? formatMinutesToHours(lastParseResult.parsedEntry.duration)
                      : '—'}
                  </span>
                </div>

                <div>
                  <span className="text-sm font-medium text-gray-700">Tip Activitate:</span>
                  <span className="ml-2 text-sm text-gray-900">
                    {lastParseResult.parsedEntry.taskType
                      ? taskTypeLabels[lastParseResult.parsedEntry.taskType]
                      : '—'}
                  </span>
                </div>

                <div>
                  <span className="text-sm font-medium text-gray-700">Dosar:</span>
                  <span className="ml-2 text-sm text-gray-900">
                    {lastParseResult.parsedEntry.caseName || '(Nu a fost detectat)'}
                  </span>
                </div>

                <div>
                  <span className="text-sm font-medium text-gray-700">Descriere:</span>
                  <p className="mt-1 text-sm text-gray-900">
                    {lastParseResult.parsedEntry.description || lastParseResult.originalInput}
                  </p>
                </div>
              </div>

              {/* Errors */}
              {lastParseResult.errors && lastParseResult.errors.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-yellow-800 mb-1">Atenție:</p>
                  <ul className="text-sm text-yellow-700 list-disc list-inside">
                    {lastParseResult.errors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleConfirm}
                  disabled={!lastParseResult.success}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Confirmă & Salvează
                </button>
                <button
                  onClick={handleEdit}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  Editează
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
