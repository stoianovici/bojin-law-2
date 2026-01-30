'use client';

import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Check, X, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InlineFieldEditorProps {
  fieldKey: string;
  value: string;
  onSave: (fieldKey: string, newValue: string) => Promise<void>;
  className?: string;
  children: React.ReactNode;
}

export function InlineFieldEditor({
  fieldKey,
  value,
  onSave,
  className,
  children,
}: InlineFieldEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditValue(value);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue(value);
  };

  const handleSave = async () => {
    if (isSaving) return;
    if (editValue.trim() === value.trim()) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(fieldKey, editValue.trim());
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save field:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <span className={cn('inline-flex items-center gap-1.5', className)}>
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // Small delay to allow button clicks to register
            setTimeout(() => {
              if (!isSaving) handleCancel();
            }, 150);
          }}
          disabled={isSaving}
          className="px-2 py-0.5 text-sm bg-linear-bg-primary border border-linear-accent rounded focus:outline-none focus:ring-1 focus:ring-linear-accent min-w-[120px]"
        />
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="p-1 rounded hover:bg-linear-accent/10 text-linear-accent transition-colors"
          title="Salveaza (Enter)"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleCancel}
          disabled={isSaving}
          className="p-1 rounded hover:bg-linear-bg-hover text-linear-text-tertiary transition-colors"
          title="Anuleaza (Esc)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 group cursor-pointer rounded -mx-1 px-1 transition-colors',
        isHovered && 'bg-linear-accent/5',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleStartEdit}
      title="Click pentru editare"
    >
      {children}
      <Pencil
        className={cn(
          'w-3 h-3 text-linear-text-quaternary transition-opacity',
          isHovered ? 'opacity-100' : 'opacity-0'
        )}
      />
    </span>
  );
}

export default InlineFieldEditor;
