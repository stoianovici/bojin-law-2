'use client';

import { useState, useCallback, useRef } from 'react';
import * as tus from 'tus-js-client';

export interface UploadProgress {
  bytesUploaded: number;
  bytesTotal: number;
  percentage: number;
  uploadSpeed: number; // bytes per second
  timeRemaining: number; // seconds
}

export interface UploadState {
  status: 'idle' | 'uploading' | 'paused' | 'completed' | 'error';
  progress: UploadProgress;
  sessionId: string | null;
  error: string | null;
}

export interface UsePSTUploadOptions {
  onComplete?: (sessionId: string, fileName: string) => void;
  onError?: (error: Error) => void;
  onProgress?: (progress: UploadProgress) => void;
}

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks for large file support
const MAX_FILE_SIZE = 60 * 1024 * 1024 * 1024; // 60GB max

export function usePSTUpload(options: UsePSTUploadOptions = {}) {
  const [state, setState] = useState<UploadState>({
    status: 'idle',
    progress: {
      bytesUploaded: 0,
      bytesTotal: 0,
      percentage: 0,
      uploadSpeed: 0,
      timeRemaining: 0,
    },
    sessionId: null,
    error: null,
  });

  const uploadRef = useRef<tus.Upload | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastBytesRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const calculateSpeed = useCallback((bytesUploaded: number) => {
    const now = Date.now();
    const timeDiff = (now - lastTimeRef.current) / 1000; // seconds

    if (timeDiff > 0) {
      const bytesDiff = bytesUploaded - lastBytesRef.current;
      const speed = bytesDiff / timeDiff;
      lastBytesRef.current = bytesUploaded;
      lastTimeRef.current = now;
      return speed;
    }

    return 0;
  }, []);

  const startUpload = useCallback(async (file: File) => {
    // Validate file
    if (!file.name.toLowerCase().endsWith('.pst')) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: 'Only PST files are allowed',
      }));
      options.onError?.(new Error('Only PST files are allowed'));
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: 'File size exceeds 60GB limit',
      }));
      options.onError?.(new Error('File size exceeds 60GB limit'));
      return;
    }

    // Initialize timing
    startTimeRef.current = Date.now();
    lastTimeRef.current = Date.now();
    lastBytesRef.current = 0;

    // Create tus upload
    const upload = new tus.Upload(file, {
      endpoint: '/api/upload-pst/tus',
      retryDelays: [0, 1000, 3000, 5000, 10000], // Retry delays in ms
      chunkSize: CHUNK_SIZE,
      metadata: {
        filename: file.name,
        filetype: 'application/vnd.ms-outlook',
        filesize: file.size.toString(),
      },

      onError: (error) => {
        console.error('Upload error:', error);
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: error.message || 'Upload failed',
        }));
        options.onError?.(error instanceof Error ? error : new Error(String(error)));
      },

      onProgress: (bytesUploaded, bytesTotal) => {
        const percentage = Math.round((bytesUploaded / bytesTotal) * 100);
        const speed = calculateSpeed(bytesUploaded);
        const remaining = bytesTotal - bytesUploaded;
        const timeRemaining = speed > 0 ? remaining / speed : 0;

        const progress: UploadProgress = {
          bytesUploaded,
          bytesTotal,
          percentage,
          uploadSpeed: speed,
          timeRemaining,
        };

        setState((prev) => ({
          ...prev,
          status: 'uploading',
          progress,
        }));

        options.onProgress?.(progress);
      },

      onSuccess: () => {
        // Extract session ID from upload URL
        const url = upload.url;
        const sessionId = url?.split('/').pop() || null;

        setState((prev) => ({
          ...prev,
          status: 'completed',
          sessionId,
          progress: {
            ...prev.progress,
            percentage: 100,
          },
        }));

        if (sessionId) {
          options.onComplete?.(sessionId, file.name);
        }
      },
    });

    uploadRef.current = upload;

    // Check for previous uploads
    const previousUploads = await upload.findPreviousUploads();
    if (previousUploads.length > 0) {
      // Resume from previous upload
      upload.resumeFromPreviousUpload(previousUploads[0]);
    }

    setState((prev) => ({
      ...prev,
      status: 'uploading',
      error: null,
      progress: {
        bytesUploaded: 0,
        bytesTotal: file.size,
        percentage: 0,
        uploadSpeed: 0,
        timeRemaining: 0,
      },
    }));

    // Start upload
    upload.start();
  }, [options, calculateSpeed]);

  const pauseUpload = useCallback(() => {
    if (uploadRef.current) {
      uploadRef.current.abort();
      setState((prev) => ({
        ...prev,
        status: 'paused',
      }));
    }
  }, []);

  const resumeUpload = useCallback(() => {
    if (uploadRef.current) {
      startTimeRef.current = Date.now();
      lastTimeRef.current = Date.now();
      uploadRef.current.start();
      setState((prev) => ({
        ...prev,
        status: 'uploading',
      }));
    }
  }, []);

  const cancelUpload = useCallback(() => {
    if (uploadRef.current) {
      uploadRef.current.abort();
      uploadRef.current = null;
    }
    setState({
      status: 'idle',
      progress: {
        bytesUploaded: 0,
        bytesTotal: 0,
        percentage: 0,
        uploadSpeed: 0,
        timeRemaining: 0,
      },
      sessionId: null,
      error: null,
    });
  }, []);

  const reset = useCallback(() => {
    cancelUpload();
  }, [cancelUpload]);

  return {
    ...state,
    startUpload,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    reset,
  };
}

// Utility function to format bytes
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Utility function to format time
export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '--';

  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);

  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${hours}h ${remainingMinutes}m`;
}
