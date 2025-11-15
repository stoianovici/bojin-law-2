// useTimeSimulation Hook
// Provides realistic time display and simulation for demo purposes

import { useState, useEffect, useMemo } from 'react';

export interface TimeSimulationOptions {
  /**
   * Base date to simulate from (defaults to current date)
   */
  baseDate?: Date;

  /**
   * Time speed multiplier (1 = real time, 2 = 2x speed, etc.)
   */
  speedMultiplier?: number;

  /**
   * Whether to enable time simulation
   */
  enabled?: boolean;
}

export interface TimeSimulationResult {
  /**
   * Current simulated date/time
   */
  currentTime: Date;

  /**
   * Format a date relative to current simulated time
   */
  formatRelativeTime: (date: Date) => string;

  /**
   * Format a date as absolute time
   */
  formatAbsoluteTime: (date: Date) => string;

  /**
   * Check if a date is in the past relative to simulated time
   */
  isPast: (date: Date) => boolean;

  /**
   * Get time until a future date
   */
  timeUntil: (date: Date) => {
    days: number;
    hours: number;
    minutes: number;
    isOverdue: boolean;
  };
}

/**
 * Hook for simulating realistic time progression in demo mode
 * Provides consistent time display and relative time calculations
 */
export function useTimeSimulation({
  baseDate,
  speedMultiplier = 1,
  enabled = true,
}: TimeSimulationOptions = {}): TimeSimulationResult {
  const [currentTime, setCurrentTime] = useState(() => baseDate || new Date());

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      setCurrentTime(prevTime => {
        const newTime = new Date(prevTime);
        // Advance time by speed multiplier (in demo mode, time moves faster)
        newTime.setSeconds(newTime.getSeconds() + speedMultiplier);
        return newTime;
      });
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, [speedMultiplier, enabled]);

  const formatRelativeTime = useMemo(() => (date: Date): string => {
    const diffMs = currentTime.getTime() - date.getTime();
    const diffMinutes = Math.floor(Math.abs(diffMs) / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMs < 0) {
      // Future date
      if (diffMinutes < 1) return 'în curând';
      if (diffMinutes < 60) return `peste ${diffMinutes} min`;
      if (diffHours < 24) return `peste ${diffHours} ore`;
      return `peste ${diffDays} zile`;
    }

    // Past date
    if (diffMinutes < 1) return 'acum';
    if (diffMinutes < 60) return `acum ${diffMinutes} min`;
    if (diffHours < 24) return `acum ${diffHours} ore`;
    return `acum ${diffDays} zile`;
  }, [currentTime]);

  const formatAbsoluteTime = (date: Date): string => {
    return date.toLocaleString('ro-RO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isPast = (date: Date): boolean => {
    return date.getTime() < currentTime.getTime();
  };

  const timeUntil = (date: Date) => {
    const diffMs = date.getTime() - currentTime.getTime();
    const isOverdue = diffMs < 0;
    const absDiffMs = Math.abs(diffMs);

    const minutes = Math.floor(absDiffMs / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    return {
      days,
      hours: hours % 24,
      minutes: minutes % 60,
      isOverdue,
    };
  };

  return {
    currentTime,
    formatRelativeTime,
    formatAbsoluteTime,
    isPast,
    timeUntil,
  };
}

// Convenience hook for demo mode with accelerated time
export function useDemoTime() {
  return useTimeSimulation({
    speedMultiplier: 60, // 1 minute of real time = 1 hour of demo time
    enabled: true,
  });
}

// Hook for displaying current time in header
export function useCurrentTimeDisplay() {
  const { currentTime, formatAbsoluteTime } = useTimeSimulation({
    enabled: true,
  });

  return {
    currentTimeDisplay: formatAbsoluteTime(currentTime),
    currentTime,
  };
}