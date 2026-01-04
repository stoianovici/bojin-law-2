'use client';

import { FileText, Mail, FileImage, FileSpreadsheet, File } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface DocumentQuickViewProps {
  id: string;
  name: string;
  type: 'document' | 'email';
  mimeType?: string;
  className?: string;
  onClick?: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getDocumentIcon(type: 'document' | 'email', mimeType?: string) {
  if (type === 'email') {
    return Mail;
  }

  if (!mimeType) {
    return FileText;
  }

  // Image files
  if (mimeType.startsWith('image/')) {
    return FileImage;
  }

  // Spreadsheet files
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv') {
    return FileSpreadsheet;
  }

  // PDF and text files
  if (mimeType === 'application/pdf' || mimeType.startsWith('text/')) {
    return FileText;
  }

  // Default
  return File;
}

function getIconColorClass(type: 'document' | 'email'): string {
  return type === 'email' ? 'text-blue-500' : 'text-emerald-500';
}

// ============================================================================
// Component
// ============================================================================

export function DocumentQuickView({
  id,
  name,
  type,
  mimeType,
  className,
  onClick,
}: DocumentQuickViewProps) {
  const Icon = getDocumentIcon(type, mimeType);
  const iconColorClass = getIconColorClass(type);

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // Default behavior: could navigate to document or open preview
      console.log('Document clicked:', id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2',
        'bg-linear-bg-tertiary rounded-md',
        'hover:bg-linear-bg-secondary cursor-pointer',
        'transition-colors duration-150',
        className
      )}
    >
      <Icon className={cn('w-4 h-4 shrink-0', iconColorClass)} />
      <span className="text-sm text-linear-text-primary truncate">{name}</span>
    </div>
  );
}
