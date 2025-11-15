/**
 * Version Comparison Component
 * Side-by-side diff view for document versions with semantic change highlighting
 */

'use client';

import React from 'react';

export interface VersionInfo {
  versionNumber: number;
  date: string;
  author: string;
}

export interface SemanticChange {
  type: 'added' | 'removed' | 'modified';
  lineNumber: number;
  description: string;
}

export interface VersionComparisonProps {
  previousVersion: {
    info: VersionInfo;
    content: string;
  };
  currentVersion: {
    info: VersionInfo;
    content: string;
  };
  semanticChanges?: SemanticChange[];
  onAcceptChanges?: () => void;
  onRejectChanges?: () => void;
}

// Mock previous version content
const MOCK_PREVIOUS_CONTENT = `CONTRACT DE PRESTĂRI SERVICII JURIDICE

Număr: 2024/123
Data: 10 noiembrie 2024

ARTICOLUL 1 - OBIECTUL CONTRACTULUI

1.1. Prestatorul se obligă să furnizeze Beneficiarului servicii de consultanță juridică în următoarele domenii:
   a) Drept comercial și societar
   b) Drept al muncii
   c) Contracte comerciale

ARTICOLUL 2 - DURATA CONTRACTULUI

2.1. Prezentul contract intră în vigoare la data de 1 decembrie 2024 și este valabil pe o perioadă de 12 (douăsprezece) luni.

ARTICOLUL 3 - ONORARIUL ȘI MODALITATEA DE PLATĂ

3.1. Pentru serviciile prestate, Beneficiarul se obligă să plătească Prestatorului un onorariu lunar de 4.500 EUR (patru mii cinci sute euro), plătibil până la data de 10 a fiecărei luni.

3.2. Onorariul nu include taxele judiciare, taxele de timbru.

ARTICOLUL 4 - CONFIDENȚIALITATE

4.1. Prestatorul se obligă să păstreze confidențialitatea asupra tuturor informațiilor primite de la Beneficiar.`;

// Mock current version content
const MOCK_CURRENT_CONTENT = `CONTRACT DE PRESTĂRI SERVICII JURIDICE

Număr: 2024/123
Data: 15 noiembrie 2024

ARTICOLUL 1 - OBIECTUL CONTRACTULUI

1.1. Prestatorul se obligă să furnizeze Beneficiarului servicii de consultanță juridică în următoarele domenii:
   a) Drept comercial și societar
   b) Drept al muncii
   c) Protecția datelor cu caracter personal (GDPR)
   d) Contracte și litigii comerciale

ARTICOLUL 2 - DURATA CONTRACTULUI

2.1. Prezentul contract intră în vigoare la data de 1 decembrie 2024 și este valabil pe o perioadă de 12 (douăsprezece) luni.

2.2. Contractul se prelungește automat cu perioade succesive de 12 luni, cu excepția cazului în care una dintre părți notifică în scris intenția de reziliere cu cel puțin 60 de zile înainte de expirarea perioadei curente.

ARTICOLUL 3 - ONORARIUL ȘI MODALITATEA DE PLATĂ

3.1. Pentru serviciile prestate, Beneficiarul se obligă să plătească Prestatorului un onorariu lunar de 5.000 EUR (cinci mii euro), plătibil până la data de 5 a fiecărei luni.

3.2. Onorariul nu include taxele judiciare, taxele de timbru, cheltuielile de deplasare sau alte cheltuieli necesare pentru îndeplinirea serviciilor, care vor fi facturate separat.

3.3. În cazul nerespectării termenului de plată, Beneficiarul datorează penalități de întârziere calculate conform art. 3 din OUG 13/2011.

ARTICOLUL 4 - CONFIDENȚIALITATE

4.1. Prestatorul se obligă să păstreze confidențialitatea asupra tuturor informațiilor primite de la Beneficiar în cadrul executării prezentului contract.

4.2. Obligația de confidențialitate rămâne în vigoare și după încetarea contractului, pe o perioadă de 5 (cinci) ani.`;

// Mock semantic changes
const MOCK_SEMANTIC_CHANGES: SemanticChange[] = [
  {
    type: 'added',
    lineNumber: 10,
    description: 'Adăugat serviciu: Protecția datelor (GDPR)',
  },
  {
    type: 'modified',
    lineNumber: 11,
    description: 'Extins domeniu contracte: adăugat "litigii comerciale"',
  },
  {
    type: 'added',
    lineNumber: 17,
    description: 'Adăugată clauză: Prelungire automată contract',
  },
  {
    type: 'modified',
    lineNumber: 21,
    description: 'Modificat onorariu: 4.500 EUR → 5.000 EUR',
  },
  {
    type: 'modified',
    lineNumber: 22,
    description: 'Modificat termen plată: ziua 10 → ziua 5',
  },
  {
    type: 'added',
    lineNumber: 24,
    description: 'Adăugată clauză: Cheltuieli suplimentare',
  },
  {
    type: 'added',
    lineNumber: 26,
    description: 'Adăugată clauză: Penalități întârziere plată',
  },
  {
    type: 'added',
    lineNumber: 32,
    description: 'Adăugată clauză: Durata confidențialitate (5 ani)',
  },
];

export function VersionComparison({
  previousVersion = {
    info: {
      versionNumber: 1,
      date: '2024-11-10 14:30',
      author: 'Mihai Bojin',
    },
    content: MOCK_PREVIOUS_CONTENT,
  },
  currentVersion = {
    info: {
      versionNumber: 2,
      date: '2024-11-15 16:45',
      author: 'Mihai Bojin',
    },
    content: MOCK_CURRENT_CONTENT,
  },
  semanticChanges = MOCK_SEMANTIC_CHANGES,
  onAcceptChanges,
  onRejectChanges,
}: VersionComparisonProps) {
  const [currentDiffIndex, setCurrentDiffIndex] = React.useState(0);
  const leftPanelRef = React.useRef<HTMLDivElement>(null);
  const rightPanelRef = React.useRef<HTMLDivElement>(null);

  // Synchronize scroll between panels
  const handleScroll = (source: 'left' | 'right') => (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    if (source === 'left' && rightPanelRef.current) {
      rightPanelRef.current.scrollTop = scrollTop;
    } else if (source === 'right' && leftPanelRef.current) {
      leftPanelRef.current.scrollTop = scrollTop;
    }
  };

  // Navigate to next/previous diff
  const handlePreviousDiff = () => {
    if (currentDiffIndex > 0) {
      setCurrentDiffIndex(currentDiffIndex - 1);
    }
  };

  const handleNextDiff = () => {
    if (currentDiffIndex < semanticChanges.length - 1) {
      setCurrentDiffIndex(currentDiffIndex + 1);
    }
  };

  // Highlight differences in text
  const highlightDifferences = (content: string, version: 'previous' | 'current') => {
    const lines = content.split('\n');
    return lines.map((line, index) => {
      // Simple diff highlighting based on line content
      const lineNumber = index + 1;
      let className = 'px-4 py-1 leading-relaxed';
      let bgColor = '';

      // Check for changes in this line
      if (version === 'previous') {
        // Highlight removed/modified content in red
        if (line.includes('4.500 EUR') || line.includes('ziua 10') || line.includes('Data: 10 noiembrie')) {
          bgColor = 'bg-red-50';
          className += ' border-l-4 border-red-400';
        } else if (line.includes('c) Contracte comerciale')) {
          bgColor = 'bg-red-50';
          className += ' border-l-4 border-red-400';
        }
      } else {
        // Highlight added/modified content in green
        if (line.includes('5.000 EUR') || line.includes('ziua 5') || line.includes('Data: 15 noiembrie')) {
          bgColor = 'bg-green-50';
          className += ' border-l-4 border-green-400';
        } else if (line.includes('GDPR') || line.includes('litigii comerciale')) {
          bgColor = 'bg-green-50';
          className += ' border-l-4 border-green-400';
        } else if (line.includes('2.2.') || line.includes('3.3.') || line.includes('4.2.')) {
          bgColor = 'bg-green-50';
          className += ' border-l-4 border-green-400';
        } else if (line.includes('cheltuielile de deplasare')) {
          bgColor = 'bg-green-50';
          className += ' border-l-4 border-green-400';
        }
      }

      return (
        <div key={index} className={`${className} ${bgColor}`}>
          <span className="text-xs text-gray-400 select-none mr-4 inline-block w-8 text-right">
            {lineNumber}
          </span>
          <span className="text-sm">{line || '\u00A0'}</span>
        </div>
      );
    });
  };

  const getChangeIcon = (type: SemanticChange['type']) => {
    switch (type) {
      case 'added':
        return (
          <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'removed':
        return (
          <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'modified':
        return (
          <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z"
              clipRule="evenodd"
            />
          </svg>
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-900">Comparare Versiuni</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePreviousDiff}
              disabled={currentDiffIndex === 0}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Diferența anterioară"
              title="Diferența anterioară"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <span className="text-sm text-gray-600">
              {currentDiffIndex + 1} / {semanticChanges.length}
            </span>
            <button
              onClick={handleNextDiff}
              disabled={currentDiffIndex === semanticChanges.length - 1}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Diferența următoare"
              title="Diferența următoare"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRejectChanges}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Respinge
          </button>
          <button
            onClick={onAcceptChanges}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Acceptă modificările
          </button>
        </div>
      </div>

      {/* Current Semantic Change Display */}
      {semanticChanges.length > 0 && (
        <div className="px-6 py-3 bg-blue-50 border-b border-blue-200">
          <div className="flex items-start gap-3">
            {getChangeIcon(semanticChanges[currentDiffIndex].type)}
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-900">
                Linia {semanticChanges[currentDiffIndex].lineNumber}:
              </span>
              <span className="text-sm text-gray-700 ml-2">
                {semanticChanges[currentDiffIndex].description}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Side-by-side comparison */}
      <div className="flex flex-1 overflow-hidden">
        {/* Previous Version */}
        <div className="flex-1 flex flex-col border-r border-gray-200">
          <div className="px-6 py-3 bg-gray-100 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Versiunea {previousVersion.info.versionNumber}
                </h3>
                <p className="text-xs text-gray-600">
                  {previousVersion.info.date} • {previousVersion.info.author}
                </p>
              </div>
              <span className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-200 rounded">
                Anterioară
              </span>
            </div>
          </div>
          <div
            ref={leftPanelRef}
            onScroll={handleScroll('left')}
            className="flex-1 overflow-y-auto font-mono text-sm"
          >
            {highlightDifferences(previousVersion.content, 'previous')}
          </div>
        </div>

        {/* Current Version */}
        <div className="flex-1 flex flex-col">
          <div className="px-6 py-3 bg-green-50 border-b border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Versiunea {currentVersion.info.versionNumber}
                </h3>
                <p className="text-xs text-gray-600">
                  {currentVersion.info.date} • {currentVersion.info.author}
                </p>
              </div>
              <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-200 rounded">
                Curentă
              </span>
            </div>
          </div>
          <div
            ref={rightPanelRef}
            onScroll={handleScroll('right')}
            className="flex-1 overflow-y-auto font-mono text-sm"
          >
            {highlightDifferences(currentVersion.content, 'current')}
          </div>
        </div>
      </div>
    </div>
  );
}
