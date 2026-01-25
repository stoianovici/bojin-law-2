'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, Pause, Play, X, CheckCircle, AlertCircle, FileArchive } from 'lucide-react';
import * as Progress from '@radix-ui/react-progress';
import { usePSTUpload, formatBytes, formatTime } from '@/hooks/usePSTUpload';

interface PSTUploaderProps {
  onUploadComplete: (sessionId: string, fileName: string) => void;
  onError?: (error: Error) => void;
}

export function PSTUploader({ onUploadComplete, onError }: PSTUploaderProps) {
  const { status, progress, error, startUpload, pauseUpload, resumeUpload, cancelUpload, reset } =
    usePSTUpload({
      onComplete: onUploadComplete,
      onError,
    });

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        startUpload(acceptedFiles[0]);
      }
    },
    [startUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.ms-outlook': ['.pst'],
    },
    maxFiles: 1,
    disabled: status === 'uploading' || status === 'paused',
  });

  // Idle state - show dropzone
  if (status === 'idle') {
    return (
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
          transition-all duration-200 ease-in-out
          ${
            isDragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
          }
        `}
      >
        <input {...getInputProps()} />
        <UploadCloud className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <p className="text-lg font-medium text-gray-700 mb-2">
          {isDragActive ? 'Plasează fișierul PST aici' : 'Trage și plasează fișierul PST aici'}
        </p>
        <p className="text-sm text-gray-500 mb-4">sau click pentru a naviga (max 60GB)</p>
        <button
          type="button"
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Selectează fișier PST
        </button>
      </div>
    );
  }

  // Uploading or Paused state
  if (status === 'uploading' || status === 'paused') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <FileArchive className="h-8 w-8 text-blue-600" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-gray-900 truncate">Se încarcă fișierul PST...</h3>
              <span className="text-sm font-medium text-blue-600">{progress.percentage}%</span>
            </div>

            <Progress.Root
              className="h-3 bg-gray-200 rounded-full overflow-hidden mb-3"
              value={progress.percentage}
            >
              <Progress.Indicator
                className={`h-full rounded-full transition-all duration-300 ${
                  status === 'paused' ? 'bg-amber-500' : 'bg-blue-600'
                }`}
                style={{ width: `${progress.percentage}%` }}
              />
            </Progress.Root>

            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>
                {formatBytes(progress.bytesUploaded)} / {formatBytes(progress.bytesTotal)}
              </span>
              <span>
                {status === 'paused' ? (
                  <span className="text-amber-600 font-medium">Întrerupt</span>
                ) : (
                  <>
                    {formatBytes(progress.uploadSpeed)}/s · {formatTime(progress.timeRemaining)}{' '}
                    rămas
                  </>
                )}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {status === 'uploading' ? (
              <button
                onClick={pauseUpload}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Întrerupe încărcarea"
              >
                <Pause className="h-5 w-5" />
              </button>
            ) : (
              <button
                onClick={resumeUpload}
                className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                title="Continuă încărcarea"
              >
                <Play className="h-5 w-5" />
              </button>
            )}
            <button
              onClick={cancelUpload}
              className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              title="Anulează încărcarea"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {status === 'paused' && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              Încărcare întreruptă. Poți continua oricând - progresul este salvat.
            </p>
          </div>
        )}
      </div>
    );
  }

  // Completed state
  if (status === 'completed') {
    return (
      <div className="bg-white rounded-xl border border-green-200 p-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-green-100 rounded-lg">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>

          <div className="flex-1">
            <h3 className="font-medium text-gray-900 mb-1">Încărcare finalizată!</h3>
            <p className="text-sm text-gray-500">
              {formatBytes(progress.bytesTotal)} încărcat cu succes. Se începe extragerea
              documentelor...
            </p>
          </div>

          <button
            onClick={reset}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors text-sm"
          >
            Încarcă altul
          </button>
        </div>
      </div>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-red-100 rounded-lg">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>

          <div className="flex-1">
            <h3 className="font-medium text-red-900 mb-1">Încărcare eșuată</h3>
            <p className="text-sm text-red-600">{error || 'A apărut o eroare neașteptată'}</p>
          </div>

          <button
            onClick={reset}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
          >
            Încearcă din nou
          </button>
        </div>
      </div>
    );
  }

  return null;
}
