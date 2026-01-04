/**
 * AI Assistant Panel Component
 * Provides AI-powered suggestions, similar documents, and templates
 */

'use client';

import React from 'react';
import * as Tabs from '@radix-ui/react-tabs';

export interface AIAssistantPanelProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

// Mock data for AI suggestions
const MOCK_SUGGESTIONS = [
  {
    id: '1',
    text: 'În conformitate cu prevederile art. 1270 și următoarele din Codul Civil, părțile convin asupra următoarelor clauze...',
    confidence: 92,
  },
  {
    id: '2',
    text: 'ARTICOLUL 8 - FORȚĂ MAJORĂ\n\n8.1. Părțile nu sunt responsabile pentru neexecutarea obligațiilor contractuale dacă aceasta se datorează unui eveniment de forță majoră.',
    confidence: 88,
  },
  {
    id: '3',
    text: 'Prezentul contract constituie înțelegerea integrală între părți și înlocuiește orice alte acorduri anterioare, scrise sau verbale.',
    confidence: 85,
  },
  {
    id: '4',
    text: 'Pentru orice informații suplimentare, părțile pot contacta la adresele menționate în preambulul contractului.',
    confidence: 80,
  },
];

// Mock data for similar documents
const MOCK_SIMILAR_DOCUMENTS = [
  {
    id: '1',
    title: 'Contract de Consultanță Juridică - Tech Innovations SRL',
    snippet:
      'Contract similar privind servicii de consultanță juridică pentru companie tech, durata 24 luni...',
    date: '2024-10-15',
    similarity: 94,
  },
  {
    id: '2',
    title: 'Contract Servicii Juridice - Digital Media Group',
    snippet: 'Acord de prestări servicii juridice cu clauze de confidențialitate și GDPR...',
    date: '2024-09-20',
    similarity: 89,
  },
  {
    id: '3',
    title: 'Contract Consultanță - StartUp Hub SRL',
    snippet: 'Contract consultanță pentru startup, include clauze IP și consultanță societară...',
    date: '2024-08-10',
    similarity: 87,
  },
  {
    id: '4',
    title: 'Acord Servicii Juridice - Innovation Labs',
    snippet: 'Servicii juridice recurente, focus pe protecție date și contracte comerciale...',
    date: '2024-07-05',
    similarity: 82,
  },
  {
    id: '5',
    title: 'Contract Prestări Servicii - Corporate Solutions',
    snippet: 'Contract anual servicii juridice cu opțiune de prelungire automată...',
    date: '2024-06-15',
    similarity: 78,
  },
];

// Mock data for templates
const MOCK_TEMPLATES = [
  {
    id: '1',
    name: 'Contract Prestări Servicii Standard',
    category: 'Contracte',
    description: 'Template standard pentru contract de prestări servicii',
  },
  {
    id: '2',
    name: 'Acord de Confidențialitate (NDA)',
    category: 'Contracte',
    description: 'Acord bilateral de confidențialitate',
  },
  {
    id: '3',
    name: 'Contract de Muncă',
    category: 'Resurse Umane',
    description: 'Contract individual de muncă conform Codului Muncii',
  },
  {
    id: '4',
    name: 'Memoriu de Apărare',
    category: 'Litigii',
    description: 'Template pentru memoriu de apărare în instanță',
  },
  {
    id: '5',
    name: 'Cerere de Chemare în Judecată',
    category: 'Litigii',
    description: 'Cerere introductivă civilă',
  },
  {
    id: '6',
    name: 'Acord de Asociere',
    category: 'Corporate',
    description: 'Contract de asociere între societăți',
  },
];

export function AIAssistantPanel({ isCollapsed = false, onToggleCollapse }: AIAssistantPanelProps) {
  const [activeTab, setActiveTab] = React.useState('suggestions');

  if (isCollapsed) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 border-l border-gray-200">
        <button
          onClick={onToggleCollapse}
          className="flex flex-col items-center gap-2 p-4 text-gray-600 hover:text-gray-900 transition-colors"
          aria-label="Deschide panoul AI"
          title="Deschide panoul AI"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          <span className="text-xs writing-mode-vertical transform rotate-180">Asistent AI</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h2 className="text-sm font-semibold text-gray-900">Asistent AI</h2>
        <button
          onClick={onToggleCollapse}
          className="p-1 rounded hover:bg-gray-200 transition-colors"
          aria-label="Închide panoul AI"
          title="Închide panoul AI"
        >
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <Tabs.Root
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col flex-1 overflow-hidden"
      >
        <Tabs.List className="flex border-b border-gray-200 bg-gray-50 px-2">
          <Tabs.Trigger
            value="suggestions"
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 transition-colors"
          >
            Sugestii
          </Tabs.Trigger>
          <Tabs.Trigger
            value="documents"
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 transition-colors"
          >
            Documente
          </Tabs.Trigger>
          <Tabs.Trigger
            value="templates"
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 transition-colors"
          >
            Șabloane
          </Tabs.Trigger>
        </Tabs.List>

        {/* Suggestions Tab */}
        <Tabs.Content value="suggestions" className="flex-1 overflow-y-auto p-4 space-y-3">
          {MOCK_SUGGESTIONS.length > 0 ? (
            MOCK_SUGGESTIONS.map((suggestion) => (
              <div
                key={suggestion.id}
                className="p-3 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-xs font-medium text-blue-600">
                    {suggestion.confidence}% potrivire
                  </span>
                  <button
                    className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
                    onClick={() => {
                      // Mock insert functionality
                      console.log('Insert suggestion:', suggestion.id);
                    }}
                  >
                    Inserează
                  </button>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{suggestion.text}</p>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <svg
                className="w-16 h-16 text-gray-300 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              <h3 className="text-sm font-medium text-gray-900 mb-1">
                Nu există sugestii disponibile
              </h3>
              <p className="text-xs text-gray-500">Începe să scrii pentru a primi sugestii AI</p>
            </div>
          )}
        </Tabs.Content>

        {/* Similar Documents Tab */}
        <Tabs.Content value="documents" className="flex-1 overflow-y-auto p-4 space-y-3">
          {MOCK_SIMILAR_DOCUMENTS.length > 0 ? (
            MOCK_SIMILAR_DOCUMENTS.map((doc) => (
              <div
                key={doc.id}
                className="p-3 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  // Mock open document functionality
                  console.log('Open document:', doc.id);
                }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-gray-900 flex-1">{doc.title}</h3>
                  <span className="text-xs font-medium text-green-600 whitespace-nowrap">
                    {doc.similarity}% asemănare
                  </span>
                </div>
                <p className="text-xs text-gray-600 mb-2">{doc.snippet}</p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>{doc.date}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <svg
                className="w-16 h-16 text-gray-300 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="text-sm font-medium text-gray-900 mb-1">
                Nu s-au găsit documente similare
              </h3>
              <p className="text-xs text-gray-500">Documentele similare vor apărea aici</p>
            </div>
          )}
        </Tabs.Content>

        {/* Templates Tab */}
        <Tabs.Content value="templates" className="flex-1 overflow-y-auto p-4">
          {MOCK_TEMPLATES.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {MOCK_TEMPLATES.map((template) => (
                <div
                  key={template.id}
                  className="p-3 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => {
                    // Mock use template functionality
                    console.log('Use template:', template.id);
                  }}
                >
                  <div className="flex items-center justify-center w-full h-20 bg-gradient-to-br from-blue-50 to-blue-100 rounded mb-2">
                    <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xs font-semibold text-gray-900 mb-1 line-clamp-2">
                    {template.name}
                  </h3>
                  <p className="text-xs text-gray-500 mb-1">{template.category}</p>
                  <p className="text-xs text-gray-600 line-clamp-2">{template.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <svg
                className="w-16 h-16 text-gray-300 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                />
              </svg>
              <h3 className="text-sm font-medium text-gray-900 mb-1">
                Nu există șabloane disponibile
              </h3>
              <p className="text-xs text-gray-500">Șabloanele de documente vor apărea aici</p>
            </div>
          )}
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
