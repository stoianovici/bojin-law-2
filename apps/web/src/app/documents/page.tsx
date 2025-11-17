/**
 * Documents List Page - Placeholder
 * Lists all documents with link to editor
 */

'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';

export default function DocumentsPage() {
  // Set document title
  useEffect(() => {
    document.title = 'Documente';
  }, []);
  // Mock documents data
  const mockDocuments = [
    {
      id: 'doc-1',
      title: 'Contract de Prestări Servicii Juridice',
      type: 'Contract',
      status: 'Draft',
      lastModified: '2024-11-15',
      author: 'Mihai Bojin',
    },
    {
      id: 'doc-2',
      title: 'Memoriu de Apărare - Dosar 1234/2024',
      type: 'Memoriu',
      status: 'Review',
      lastModified: '2024-11-14',
      author: 'Ana Ionescu',
    },
    {
      id: 'doc-3',
      title: 'Acord de Confidențialitate (NDA)',
      type: 'Contract',
      status: 'Approved',
      lastModified: '2024-11-13',
      author: 'Elena Popescu',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Documents List */}
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Toate Documentele
            </h2>
          </div>
          <div className="divide-y divide-gray-200">
            {mockDocuments.map((doc) => (
              <div
                key={doc.id}
                className="px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-gray-900">
                      {doc.title}
                    </h3>
                    <div className="mt-1 flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {doc.type}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          doc.status === 'Draft'
                            ? 'bg-gray-100 text-gray-800'
                            : doc.status === 'Review'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {doc.status}
                      </span>
                      <span>Modificat: {doc.lastModified}</span>
                      <span>Autor: {doc.author}</span>
                    </div>
                  </div>
                  <Link
                    href={`/documents/${doc.id}/edit`}
                    className="ml-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Editează
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
