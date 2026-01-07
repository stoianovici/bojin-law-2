'use client';

import { cn } from '@/lib/utils';
import type { MapaCompletionStatus } from '@/types/mapa';

interface MapaCompletionRingProps {
  completion: MapaCompletionStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: { size: 32, strokeWidth: 3, fontSize: 'text-xs', radius: 12 },
  md: { size: 48, strokeWidth: 4, fontSize: 'text-sm', radius: 18 },
  lg: { size: 64, strokeWidth: 4, fontSize: 'text-lg', radius: 28 },
};

export function MapaCompletionRing({
  completion,
  size = 'md',
  showLabel = true,
  className,
}: MapaCompletionRingProps) {
  const config = sizeConfig[size];
  const circumference = 2 * Math.PI * config.radius;
  const strokeDashoffset = circumference - (completion.percentComplete / 100) * circumference;

  // Determine color based on completion status
  let strokeColor = '#F59E0B'; // warning/yellow - partial
  if (completion.isComplete) {
    strokeColor = '#22C55E'; // success/green - complete
  } else if (completion.missingRequired.length > 0) {
    strokeColor = '#F59E0B'; // warning - has missing required
  }

  // If 0%, show a faded ring
  if (completion.percentComplete === 0) {
    strokeColor = '#71717A'; // muted gray
  }

  return (
    <div className={cn('relative', className)} style={{ width: config.size, height: config.size }}>
      <svg
        className="transform -rotate-90"
        viewBox={`0 0 ${config.size} ${config.size}`}
        width={config.size}
        height={config.size}
      >
        {/* Background circle */}
        <circle
          cx={config.size / 2}
          cy={config.size / 2}
          r={config.radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth={config.strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={config.size / 2}
          cy={config.size / 2}
          r={config.radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-300"
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('font-semibold text-linear-text-primary', config.fontSize)}>
            {completion.percentComplete}%
          </span>
        </div>
      )}
    </div>
  );
}

// Smaller indicator dot used in sidebar mapa list
interface MapaStatusDotProps {
  completion: MapaCompletionStatus;
  className?: string;
}

export function MapaStatusDot({ completion, className }: MapaStatusDotProps) {
  let bgColor = 'bg-linear-warning'; // partial
  if (completion.isComplete) {
    bgColor = 'bg-linear-success';
  } else if (completion.percentComplete === 0) {
    bgColor = 'bg-linear-text-muted';
  }

  return <div className={cn('w-1.5 h-1.5 rounded-full', bgColor, className)} />;
}
