/**
 * MapaSlotItem Component
 * OPS-102: Mapa UI Components
 *
 * Individual slot row showing status and assigned document
 */

'use client';

import React from 'react';
import { clsx } from 'clsx';
import type { MapaSlot } from '../../hooks/useMapa';

export interface MapaSlotItemProps {
  slot: MapaSlot;
  onAssign: () => void;
  onUnassign: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isDragging?: boolean;
  className?: string;
}

/**
 * MapaSlotItem - displays a single slot with its status
 */
export function MapaSlotItem({
  slot,
  onAssign,
  onUnassign,
  onEdit,
  onDelete,
  isDragging,
  className,
}: MapaSlotItemProps) {
  const hasDocument = slot.document !== null;
  const isEmpty = !hasDocument;
  const isRequired = slot.required;

  // Determine status icon and colors
  const getStatusIcon = () => {
    if (hasDocument) {
      return (
        <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
          <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      );
    }

    if (isRequired) {
      return (
        <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
          <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      );
    }

    return (
      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-gray-400" />
      </div>
    );
  };

  const getFileTypeIcon = (fileType: string) => {
    const type = fileType.toLowerCase();
    if (type.includes('pdf')) {
      return (
        <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
            clipRule="evenodd"
          />
        </svg>
      );
    }
    if (type.includes('doc') || type.includes('word')) {
      return (
        <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
            clipRule="evenodd"
          />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
          clipRule="evenodd"
        />
      </svg>
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      className={clsx(
        'flex items-center gap-3 p-3 rounded-lg border',
        isDragging ? 'bg-blue-50 border-blue-300 shadow-lg' : 'bg-white border-gray-200',
        'hover:border-gray-300 transition-colors',
        className
      )}
    >
      {/* Drag Handle */}
      <div className="cursor-grab text-gray-400 hover:text-gray-600">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
        </svg>
      </div>

      {/* Status Icon */}
      {getStatusIcon()}

      {/* Slot Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 truncate">{slot.name}</span>
          {isEmpty && isRequired && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
              Lipsă
            </span>
          )}
          {isEmpty && !isRequired && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
              Opțional
            </span>
          )}
        </div>

        {slot.description && <p className="text-sm text-gray-500 truncate">{slot.description}</p>}

        {/* Document Info */}
        {hasDocument && slot.document && (
          <div className="flex items-center gap-2 mt-1">
            {getFileTypeIcon(slot.document.document.fileType)}
            <span className="text-sm text-gray-700 truncate">
              {slot.document.document.fileName}
            </span>
            <span className="text-xs text-gray-400">
              ({formatFileSize(slot.document.document.fileSize)})
            </span>
          </div>
        )}
      </div>

      {/* Category Badge */}
      {slot.category && (
        <span className="hidden sm:inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
          {slot.category}
        </span>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1">
        {isEmpty ? (
          <button
            onClick={onAssign}
            className={clsx(
              'inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium',
              'bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors'
            )}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span className="hidden sm:inline">Adaugă</span>
          </button>
        ) : (
          <>
            <button
              onClick={onAssign}
              className={clsx(
                'p-1.5 rounded-md text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors'
              )}
              title="Schimbă document"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
            <button
              onClick={onUnassign}
              className={clsx(
                'p-1.5 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors'
              )}
              title="Elimină document"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </>
        )}

        {/* Slot Actions Menu */}
        <div className="relative group">
          <button
            className={clsx(
              'p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors'
            )}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>
          <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
            <button
              onClick={onEdit}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Editează
            </button>
            <button
              onClick={onDelete}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              Șterge
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

MapaSlotItem.displayName = 'MapaSlotItem';
