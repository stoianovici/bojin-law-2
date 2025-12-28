/**
 * SubtaskBuilder Component
 * OPS-264: Local-state subtask builder for task creation
 *
 * Unlike SubtaskPanel which requires a parentTaskId for GraphQL mutations,
 * this component manages subtasks in local state for use before task creation.
 */

'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Plus, X } from 'lucide-react';
import clsx from 'clsx';

// ============================================================================
// Types
// ============================================================================

export interface SubtaskDraft {
  tempId: string;
  title: string;
}

export interface SubtaskBuilderProps {
  subtasks: SubtaskDraft[];
  onChange: (subtasks: SubtaskDraft[]) => void;
  disabled?: boolean;
}

// ============================================================================
// SubtaskBuilder Component
// ============================================================================

export function SubtaskBuilder({ subtasks, onChange, disabled = false }: SubtaskBuilderProps) {
  const [showInput, setShowInput] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAddSubtask = useCallback(() => {
    const title = inputValue.trim();
    if (!title) {
      setShowInput(false);
      return;
    }

    const newSubtask: SubtaskDraft = {
      tempId: crypto.randomUUID(),
      title,
    };

    onChange([...subtasks, newSubtask]);
    setInputValue('');
    // Keep input open for quick sequential adds
    inputRef.current?.focus();
  }, [inputValue, subtasks, onChange]);

  const handleRemoveSubtask = useCallback(
    (tempId: string) => {
      onChange(subtasks.filter((s) => s.tempId !== tempId));
    },
    [subtasks, onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddSubtask();
      } else if (e.key === 'Escape') {
        setShowInput(false);
        setInputValue('');
      }
    },
    [handleAddSubtask]
  );

  const handleBlur = useCallback(() => {
    // Add subtask if there's text, otherwise hide input
    if (inputValue.trim()) {
      handleAddSubtask();
    } else {
      setShowInput(false);
    }
  }, [inputValue, handleAddSubtask]);

  const handleShowInput = useCallback(() => {
    setShowInput(true);
    // Focus after render
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  return (
    <div className="space-y-2">
      {/* Subtask List */}
      {subtasks.length > 0 && (
        <ul className="space-y-1">
          {subtasks.map((subtask) => (
            <li
              key={subtask.tempId}
              className="flex items-center gap-2 px-3 py-2 bg-linear-bg-tertiary rounded-lg group"
            >
              <span className="flex-1 text-sm text-linear-text-secondary">{subtask.title}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemoveSubtask(subtask.tempId)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-linear-text-muted hover:text-linear-error transition-opacity"
                  aria-label="Șterge sub-sarcină"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Add Subtask Input */}
      {showInput ? (
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder="Titlu sub-sarcină"
            disabled={disabled}
            className={clsx(
              'flex-1 px-3 py-2 text-sm border border-linear-border rounded-lg',
              'focus:ring-2 focus:ring-linear-accent focus:border-transparent',
              'disabled:bg-linear-bg-tertiary disabled:cursor-not-allowed'
            )}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={handleShowInput}
          disabled={disabled}
          className={clsx(
            'w-full py-2 border-2 border-dashed border-linear-border-subtle rounded-lg',
            'text-sm text-linear-text-tertiary flex items-center justify-center gap-1',
            'hover:text-linear-accent hover:border-linear-accent/50 transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-linear-text-tertiary disabled:hover:border-linear-border-subtle'
          )}
        >
          <Plus className="w-4 h-4" />
          Adaugă sub-sarcină
        </button>
      )}
    </div>
  );
}

export default SubtaskBuilder;
