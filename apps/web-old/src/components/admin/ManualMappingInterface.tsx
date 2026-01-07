/**
 * Manual Mapping Interface Component
 * Story 2.12.1 - Task 7: Admin Dashboard - Manual mapping interface
 *
 * Allows administrators to manually map document types to skills
 */

'use client';

import React, { useEffect, useState } from 'react';
import { clsx } from 'clsx';

interface DocumentType {
  id: string;
  discoveredTypeOriginal: string;
  discoveredTypeNormalized: string;
  discoveredTypeEnglish: string | null;
  primaryLanguage: string;
  mappedSkillId: string | null;
  totalOccurrences: number;
  priorityScore: number;
  mappingStatus: string;
  confidence: number | null;
  estimatedMonthlySavings: string;
}

interface MappingFormData {
  typeId: string;
  targetSkill: string;
  confidence: number;
  reviewedBy: string;
  decisionBasis: string;
}

const AVAILABLE_SKILLS = [
  { id: 'document-drafting', name: 'Document Drafting', description: 'Draft legal documents' },
  {
    id: 'contract-analysis',
    name: 'Contract Analysis',
    description: 'Analyze contracts and agreements',
  },
  {
    id: 'legal-research',
    name: 'Legal Research',
    description: 'Research legal precedents and opinions',
  },
  { id: 'compliance-check', name: 'Compliance Check', description: 'Check regulatory compliance' },
  { id: 'due-diligence', name: 'Due Diligence', description: 'Perform due diligence reviews' },
];

export function ManualMappingInterface() {
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<DocumentType | null>(null);
  const [formData, setFormData] = useState<MappingFormData>({
    typeId: '',
    targetSkill: '',
    confidence: 0.8,
    reviewedBy: '',
    decisionBasis: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchDocumentTypes();
  }, []);

  const fetchDocumentTypes = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/discovery/status?detailed=true&sortBy=occurrences');
      if (!response.ok) {
        throw new Error('Failed to fetch document types');
      }
      const data = await response.json();
      setDocumentTypes(data.documentTypes || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectType = (type: DocumentType) => {
    setSelectedType(type);
    setFormData({
      typeId: type.id,
      targetSkill: type.mappedSkillId || '',
      confidence: type.confidence || 0.8,
      reviewedBy: '',
      decisionBasis: '',
    });
    setSuccessMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.reviewedBy.trim()) {
      alert('Please enter your name as reviewer');
      return;
    }

    if (!formData.targetSkill) {
      alert('Please select a target skill');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch('/api/admin/discovery/map', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to map document type');
      }

      setSuccessMessage('Document type mapped successfully!');
      setSelectedType(null);
      setFormData({
        typeId: '',
        targetSkill: '',
        confidence: 0.8,
        reviewedBy: '',
        decisionBasis: '',
      });

      // Refresh the list
      await fetchDocumentTypes();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to map document type');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-linear-accent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-linear-error/10 border border-linear-error/30 rounded-lg p-4">
        <p className="text-linear-error">Error: {error}</p>
        <button
          onClick={fetchDocumentTypes}
          className="mt-2 text-sm text-linear-error hover:text-linear-error underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column: Document Types List */}
      <div className="bg-linear-bg-secondary rounded-lg border border-linear-border-subtle p-6">
        <h2 className="text-lg font-semibold text-linear-text-primary mb-4">
          Document Types ({documentTypes.length})
        </h2>

        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {documentTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => handleSelectType(type)}
              className={clsx(
                'w-full text-left p-4 rounded-lg border transition-all',
                selectedType?.id === type.id
                  ? 'bg-linear-accent/10 border-linear-accent/30 shadow-md'
                  : 'bg-linear-bg-tertiary border-linear-border-subtle hover:bg-linear-bg-hover'
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-medium text-linear-text-primary">
                    {type.discoveredTypeOriginal}
                  </div>
                  {type.discoveredTypeEnglish && (
                    <div className="text-sm text-linear-text-secondary mt-1">
                      {type.discoveredTypeEnglish}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-linear-text-tertiary">
                    <span>{type.totalOccurrences} occurrences</span>
                    <span>•</span>
                    <span>{type.primaryLanguage.toUpperCase()}</span>
                    <span>•</span>
                    <span>{type.estimatedMonthlySavings}</span>
                  </div>
                </div>
                <div className="ml-4">
                  {type.mappedSkillId ? (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-linear-success/15 text-linear-success">
                      Mapped
                    </span>
                  ) : type.mappingStatus === 'pending_review' ? (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-linear-warning/15 text-linear-warning">
                      Pending
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-linear-bg-tertiary text-linear-text-secondary">
                      Unmapped
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right Column: Mapping Form */}
      <div className="bg-linear-bg-secondary rounded-lg border border-linear-border-subtle p-6">
        <h2 className="text-lg font-semibold text-linear-text-primary mb-4">Manual Mapping</h2>

        {successMessage && (
          <div className="mb-4 p-3 bg-linear-success/10 border border-linear-success/30 rounded-lg">
            <p className="text-linear-success text-sm">{successMessage}</p>
          </div>
        )}

        {!selectedType ? (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-linear-text-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
              />
            </svg>
            <p className="mt-4 text-linear-text-secondary">
              Select a document type from the list to begin mapping
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Selected Document Type Info */}
            <div className="bg-linear-bg-tertiary rounded-lg p-4 border border-linear-border-subtle">
              <div className="text-sm font-medium text-linear-text-secondary mb-1">
                Selected Document Type
              </div>
              <div className="font-semibold text-linear-text-primary">
                {selectedType.discoveredTypeOriginal}
              </div>
              {selectedType.discoveredTypeEnglish && (
                <div className="text-sm text-linear-text-secondary mt-1">
                  {selectedType.discoveredTypeEnglish}
                </div>
              )}
              <div className="mt-2 flex gap-4 text-xs text-linear-text-secondary">
                <span>{selectedType.totalOccurrences} occurrences</span>
                <span>{selectedType.estimatedMonthlySavings}</span>
              </div>
            </div>

            {/* Target Skill Selection */}
            <div>
              <label className="block text-sm font-medium text-linear-text-secondary mb-2">
                Target Skill *
              </label>
              <div className="space-y-2">
                {AVAILABLE_SKILLS.map((skill) => (
                  <label
                    key={skill.id}
                    className={clsx(
                      'flex items-start p-3 border rounded-lg cursor-pointer transition-colors',
                      formData.targetSkill === skill.id
                        ? 'bg-linear-accent/10 border-linear-accent/30'
                        : 'bg-linear-bg-secondary border-linear-border-subtle hover:bg-linear-bg-hover'
                    )}
                  >
                    <input
                      type="radio"
                      name="targetSkill"
                      value={skill.id}
                      checked={formData.targetSkill === skill.id}
                      onChange={(e) => setFormData({ ...formData, targetSkill: e.target.value })}
                      className="mt-1"
                    />
                    <div className="ml-3">
                      <div className="font-medium text-linear-text-primary">{skill.name}</div>
                      <div className="text-sm text-linear-text-secondary">{skill.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Confidence Slider */}
            <div>
              <label className="block text-sm font-medium text-linear-text-secondary mb-2">
                Confidence Score: {(formData.confidence * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={formData.confidence}
                onChange={(e) =>
                  setFormData({ ...formData, confidence: parseFloat(e.target.value) })
                }
                className="w-full"
              />
              <div className="flex justify-between text-xs text-linear-text-tertiary mt-1">
                <span>Low Confidence</span>
                <span>High Confidence</span>
              </div>
            </div>

            {/* Reviewer Name */}
            <div>
              <label className="block text-sm font-medium text-linear-text-secondary mb-2">
                Your Name (Reviewer) *
              </label>
              <input
                type="text"
                value={formData.reviewedBy}
                onChange={(e) => setFormData({ ...formData, reviewedBy: e.target.value })}
                placeholder="Enter your name"
                className="w-full px-3 py-2 border border-linear-border rounded-lg focus:outline-none focus:ring-2 focus:ring-linear-accent"
                required
              />
            </div>

            {/* Decision Basis */}
            <div>
              <label className="block text-sm font-medium text-linear-text-secondary mb-2">
                Decision Basis (Optional)
              </label>
              <textarea
                value={formData.decisionBasis}
                onChange={(e) => setFormData({ ...formData, decisionBasis: e.target.value })}
                placeholder="Explain why this mapping was chosen..."
                rows={3}
                className="w-full px-3 py-2 border border-linear-border rounded-lg focus:outline-none focus:ring-2 focus:ring-linear-accent"
              />
            </div>

            {/* Submit Button */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className={clsx(
                  'flex-1 px-4 py-2 rounded-lg text-white font-medium transition-colors',
                  submitting
                    ? 'bg-linear-text-muted cursor-not-allowed'
                    : 'bg-linear-accent hover:bg-linear-accent-hover'
                )}
              >
                {submitting ? 'Mapping...' : 'Map Document Type'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedType(null);
                  setSuccessMessage(null);
                }}
                className="px-4 py-2 border border-linear-border rounded-lg text-linear-text-secondary font-medium hover:bg-linear-bg-hover transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
