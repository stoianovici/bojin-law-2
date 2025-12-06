'use client';

/**
 * User Skills Manager Component
 * Story 4.5: Team Workload Management
 *
 * AC: 3 - AI suggests optimal task assignments based on skills and capacity
 */

import { useState } from 'react';
import {
  Award,
  Plus,
  Trash2,
  CheckCircle,
  Loader2,
  Star,
  Save,
} from 'lucide-react';
import type { UserSkill, SkillType } from '@legal-platform/types';

interface UserSkillsManagerProps {
  skills: UserSkill[];
  onUpdateSkills: (skills: Array<{ skillType: SkillType; proficiency: number }>) => Promise<void>;
  onVerifySkill?: (skillId: string) => Promise<void>;
  isPartner?: boolean;
  isLoading?: boolean;
}

const ALL_SKILLS: Array<{ type: SkillType; label: string; description: string }> = [
  {
    type: 'Litigation',
    label: 'Litigation',
    description: 'Court representation and dispute resolution',
  },
  {
    type: 'ContractDrafting',
    label: 'Contract Drafting',
    description: 'Creating and reviewing legal contracts',
  },
  {
    type: 'LegalResearch',
    label: 'Legal Research',
    description: 'Case law and statutory research',
  },
  {
    type: 'ClientCommunication',
    label: 'Client Communication',
    description: 'Client relations and consultation',
  },
  {
    type: 'CourtProcedures',
    label: 'Court Procedures',
    description: 'Filing and procedural compliance',
  },
  {
    type: 'DocumentReview',
    label: 'Document Review',
    description: 'Legal document analysis and review',
  },
  {
    type: 'Negotiation',
    label: 'Negotiation',
    description: 'Settlement and deal negotiation',
  },
  {
    type: 'DueDiligence',
    label: 'Due Diligence',
    description: 'Transaction and M&A due diligence',
  },
  {
    type: 'RegulatoryCompliance',
    label: 'Regulatory Compliance',
    description: 'Regulatory and compliance matters',
  },
  {
    type: 'IntellectualProperty',
    label: 'Intellectual Property',
    description: 'IP protection and licensing',
  },
];

function ProficiencySlider({
  value,
  onChange,
  disabled = false,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const levels = [1, 2, 3, 4, 5];
  const labels = ['Beginner', 'Basic', 'Intermediate', 'Advanced', 'Expert'];

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        {levels.map((level) => (
          <button
            key={level}
            onClick={() => !disabled && onChange(level)}
            disabled={disabled}
            className={`h-2 flex-1 rounded-full transition-colors ${
              level <= value
                ? 'bg-blue-500'
                : 'bg-gray-200'
            } ${disabled ? 'cursor-default' : 'hover:bg-blue-400'}`}
            aria-label={`Set proficiency to ${labels[level - 1]}`}
          />
        ))}
      </div>
      <div className="text-xs text-gray-500 text-right">{labels[value - 1]}</div>
    </div>
  );
}

function SkillCard({
  skill,
  skillInfo,
  onUpdate,
  onRemove,
  onVerify,
  canVerify = false,
  disabled = false,
}: {
  skill: UserSkill;
  skillInfo?: { label: string; description: string };
  onUpdate: (proficiency: number) => void;
  onRemove: () => void;
  onVerify?: () => void;
  canVerify?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="p-4 border rounded-lg bg-white">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">
              {skillInfo?.label || skill.skillType}
            </span>
            {skill.verified && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                <CheckCircle className="h-3 w-3" />
                Verified
              </span>
            )}
          </div>
          {skillInfo?.description && (
            <p className="text-xs text-gray-500 mt-0.5">{skillInfo.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {canVerify && !skill.verified && onVerify && (
            <button
              onClick={onVerify}
              className="p-1.5 text-green-600 hover:bg-green-50 rounded"
              title="Verify skill"
            >
              <Award className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onRemove}
            disabled={disabled}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
            title="Remove skill"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3">
        <ProficiencySlider
          value={skill.proficiency}
          onChange={onUpdate}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

export function UserSkillsManager({
  skills,
  onUpdateSkills,
  onVerifySkill,
  isPartner = false,
  isLoading = false,
}: UserSkillsManagerProps) {
  const [localSkills, setLocalSkills] = useState<
    Array<{ skillType: SkillType; proficiency: number; verified: boolean; id?: string }>
  >(
    skills.map((s) => ({
      skillType: s.skillType,
      proficiency: s.proficiency,
      verified: s.verified,
      id: s.id,
    }))
  );
  const [isSaving, setIsSaving] = useState(false);
  const [showAddSkill, setShowAddSkill] = useState(false);

  const existingSkillTypes = new Set(localSkills.map((s) => s.skillType));
  const availableSkills = ALL_SKILLS.filter((s) => !existingSkillTypes.has(s.type));

  const handleAddSkill = (skillType: SkillType) => {
    setLocalSkills((prev) => [
      ...prev,
      { skillType, proficiency: 3, verified: false },
    ]);
    setShowAddSkill(false);
  };

  const handleUpdateSkill = (skillType: SkillType, proficiency: number) => {
    setLocalSkills((prev) =>
      prev.map((s) => (s.skillType === skillType ? { ...s, proficiency } : s))
    );
  };

  const handleRemoveSkill = (skillType: SkillType) => {
    setLocalSkills((prev) => prev.filter((s) => s.skillType !== skillType));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdateSkills(
        localSkills.map((s) => ({
          skillType: s.skillType,
          proficiency: s.proficiency,
        }))
      );
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges =
    JSON.stringify(localSkills.map((s) => ({ skillType: s.skillType, proficiency: s.proficiency }))) !==
    JSON.stringify(skills.map((s) => ({ skillType: s.skillType, proficiency: s.proficiency })));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-gray-500" />
          <h3 className="text-lg font-medium text-gray-900">Skills & Proficiencies</h3>
        </div>

        <div className="flex items-center gap-2">
          {availableSkills.length > 0 && (
            <button
              onClick={() => setShowAddSkill(!showAddSkill)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-md"
            >
              <Plus className="h-4 w-4" />
              Add Skill
            </button>
          )}

          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Add Skill Dropdown */}
      {showAddSkill && availableSkills.length > 0 && (
        <div className="p-4 bg-gray-50 rounded-lg border">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Select a skill to add:</h4>
          <div className="grid grid-cols-2 gap-2">
            {availableSkills.map((skill) => (
              <button
                key={skill.type}
                onClick={() => handleAddSkill(skill.type)}
                className="text-left p-3 bg-white rounded border hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <div className="font-medium text-sm text-gray-900">{skill.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{skill.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Skills List */}
      {localSkills.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Award className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="text-sm">No skills added yet</p>
          <p className="text-xs mt-1">Add skills to receive better task suggestions</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {localSkills.map((skill) => (
            <SkillCard
              key={skill.skillType}
              skill={{
                id: skill.id || '',
                userId: '',
                skillType: skill.skillType,
                proficiency: skill.proficiency,
                verified: skill.verified,
              }}
              skillInfo={ALL_SKILLS.find((s) => s.type === skill.skillType)}
              onUpdate={(proficiency) => handleUpdateSkill(skill.skillType, proficiency)}
              onRemove={() => handleRemoveSkill(skill.skillType)}
              onVerify={
                isPartner && skill.id && onVerifySkill
                  ? () => onVerifySkill(skill.id!)
                  : undefined
              }
              canVerify={isPartner}
            />
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="pt-4 border-t">
        <div className="text-xs text-gray-500">
          <span className="font-medium">Proficiency Levels:</span> Beginner → Basic → Intermediate → Advanced → Expert
        </div>
        {isPartner && (
          <div className="text-xs text-gray-500 mt-1">
            <span className="inline-flex items-center gap-1">
              <Award className="h-3 w-3 text-green-600" />
              As a Partner, you can verify team members&apos; skills
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
