'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  FileText,
  ChevronDown,
  ChevronUp,
  Download,
  Copy,
  CheckCircle,
  Layers,
  Tag,
  Type,
  Clock,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface TemplateSection {
  name: string;
  description: string;
  isRequired: boolean;
  order: number;
}

interface VariableField {
  name: string;
  description: string;
  fieldType: string;
  isRequired: boolean;
  exampleValue?: string;
}

interface StyleGuide {
  language: string;
  formality: string;
  commonPhrases: string[];
  formatting: string;
}

interface Template {
  id: string;
  name: string;
  sections: TemplateSection[];
  variableFields: VariableField[];
  boilerplateClauses: string[];
  styleGuide: StyleGuide;
  sourceDocumentCount: number;
  createdAt: string;
  cluster: {
    id: string;
    suggestedName: string;
    approvedName: string | null;
  };
}

interface TemplatesViewProps {
  sessionId: string;
  pipelineStatus?: string;
}

// ============================================================================
// Component
// ============================================================================

export function TemplatesView({ sessionId, pipelineStatus }: TemplatesViewProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch(`/api/templates?sessionId=${sessionId}`);
      if (!res.ok) throw new Error('Failed to fetch templates');
      const data = await res.json();
      setTemplates(data.templates);
    } catch (err) {
      console.error('Error fetching templates:', err);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Poll while extracting
  useEffect(() => {
    if (pipelineStatus === 'Extracting') {
      const interval = setInterval(fetchTemplates, 5000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [pipelineStatus, fetchTemplates]);

  // Copy template as JSON
  const copyAsJson = (template: Template) => {
    const jsonData = {
      name: template.name,
      sections: template.sections,
      variableFields: template.variableFields,
      boilerplateClauses: template.boilerplateClauses,
      styleGuide: template.styleGuide,
    };

    navigator.clipboard.writeText(JSON.stringify(jsonData, null, 2));
    setCopiedId(template.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Download all templates as JSON
  const downloadAll = () => {
    const data = templates.map((t) => ({
      name: t.name,
      sections: t.sections,
      variableFields: t.variableFields,
      boilerplateClauses: t.boilerplateClauses,
      styleGuide: t.styleGuide,
      sourceDocumentCount: t.sourceDocumentCount,
    }));

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `templates-${sessionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Show extracting state
  if (pipelineStatus === 'Extracting') {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
        <p className="text-blue-800 font-medium mb-2">Se extrag șabloanele...</p>
        <p className="text-sm text-blue-600">
          Procesul folosește Claude Sonnet și poate dura câteva minute.
        </p>
        {templates.length > 0 && (
          <p className="text-sm text-blue-600 mt-2">
            {templates.length} șabloane extrase până acum
          </p>
        )}
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 font-medium mb-2">Niciun șablon extras încă</p>
        <p className="text-sm text-gray-500">
          {pipelineStatus === 'ReadyForValidation'
            ? 'Validați toate grupurile pentru a începe extragerea automată a șabloanelor.'
            : 'Șabloanele vor fi extrase automat după validarea grupurilor.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-gray-500">Total șabloane:</span>{' '}
              <span className="font-medium">{templates.length}</span>
            </div>
            <div>
              <span className="text-gray-500">Secțiuni:</span>{' '}
              <span className="font-medium">
                {templates.reduce((sum, t) => sum + t.sections.length, 0)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Câmpuri variabile:</span>{' '}
              <span className="font-medium">
                {templates.reduce((sum, t) => sum + t.variableFields.length, 0)}
              </span>
            </div>
          </div>
          <button
            onClick={downloadAll}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Download className="h-4 w-4" />
            Descarcă toate (JSON)
          </button>
        </div>
      </div>

      {/* Template List */}
      <div className="space-y-3">
        {templates.map((template) => (
          <div key={template.id} className="bg-white rounded-lg border border-gray-200">
            {/* Header */}
            <div
              className="flex items-center justify-between p-4 cursor-pointer"
              onClick={() =>
                setExpandedTemplate(expandedTemplate === template.id ? null : template.id)
              }
            >
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="font-medium text-gray-900">{template.name}</h3>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      {template.sections.length} secțiuni
                    </span>
                    <span className="flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      {template.variableFields.length} câmpuri
                    </span>
                    <span className="flex items-center gap-1">
                      <Type className="h-3 w-3" />
                      {template.boilerplateClauses.length} clauze
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Din {template.sourceDocumentCount} documente
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copyAsJson(template);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  {copiedId === template.id ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Copiat!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      JSON
                    </>
                  )}
                </button>
                {expandedTemplate === template.id ? (
                  <ChevronUp className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                )}
              </div>
            </div>

            {/* Expanded Content */}
            {expandedTemplate === template.id && (
              <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-6">
                {/* Sections */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">
                    Secțiuni ({template.sections.length})
                  </h4>
                  <div className="space-y-2">
                    {template.sections
                      .sort((a, b) => a.order - b.order)
                      .map((section, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-3 p-3 bg-white rounded border border-gray-200"
                        >
                          <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">
                            {section.order}
                          </span>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{section.name}</span>
                              {section.isRequired && (
                                <span className="text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                                  Obligatoriu
                                </span>
                              )}
                            </div>
                            {section.description && (
                              <p className="text-sm text-gray-500 mt-1">{section.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Variable Fields */}
                {template.variableFields.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">
                      Câmpuri variabile ({template.variableFields.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {template.variableFields.map((field, idx) => (
                        <div
                          key={idx}
                          className="inline-flex items-center gap-2 px-3 py-2 bg-white rounded border border-gray-200"
                          title={field.description}
                        >
                          <code className="text-sm text-blue-600 font-mono">{field.name}</code>
                          <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                            {field.fieldType}
                          </span>
                          {field.isRequired && <span className="text-xs text-red-600">*</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Boilerplate Clauses */}
                {template.boilerplateClauses.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">
                      Clauze standard ({template.boilerplateClauses.length})
                    </h4>
                    <div className="space-y-2">
                      {template.boilerplateClauses.slice(0, 3).map((clause, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-white rounded border border-gray-200 text-sm text-gray-600 whitespace-pre-wrap"
                        >
                          {clause.substring(0, 300)}
                          {clause.length > 300 && '...'}
                        </div>
                      ))}
                      {template.boilerplateClauses.length > 3 && (
                        <p className="text-sm text-gray-500">
                          + {template.boilerplateClauses.length - 3} alte clauze
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Style Guide */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Ghid de stil</h4>
                  <div className="grid grid-cols-2 gap-4 p-4 bg-white rounded border border-gray-200">
                    <div>
                      <span className="text-sm text-gray-500">Limbă:</span>
                      <p className="font-medium text-gray-900">{template.styleGuide.language}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Registru:</span>
                      <p className="font-medium text-gray-900">{template.styleGuide.formality}</p>
                    </div>
                    {template.styleGuide.formatting && (
                      <div className="col-span-2">
                        <span className="text-sm text-gray-500">Formatare:</span>
                        <p className="text-sm text-gray-700">{template.styleGuide.formatting}</p>
                      </div>
                    )}
                    {template.styleGuide.commonPhrases.length > 0 && (
                      <div className="col-span-2">
                        <span className="text-sm text-gray-500">Expresii frecvente:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {template.styleGuide.commonPhrases.map((phrase, idx) => (
                            <span
                              key={idx}
                              className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                            >
                              {phrase}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
