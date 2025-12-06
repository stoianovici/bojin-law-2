'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle, CheckCircle, TrendingUp, Info, Edit2, Check, X } from 'lucide-react';
import type { TimeEstimationResponse } from '@legal-platform/types';

export interface TimeEstimationDisplayProps {
  estimation: TimeEstimationResponse | null;
  isLoading?: boolean;
  onOverride?: (newEstimate: number) => void;
  value?: number;
  onChange?: (value: number) => void;
}

export function TimeEstimationDisplay({
  estimation,
  isLoading = false,
  onOverride,
  value,
  onChange,
}: TimeEstimationDisplayProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState('');

  const currentValue = value ?? estimation?.estimatedHours ?? 0;

  const handleStartEdit = () => {
    setEditValue(currentValue.toString());
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    const parsed = parseFloat(editValue);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 999) {
      onChange?.(parsed);
      onOverride?.(parsed);
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditValue('');
  };

  // Confidence indicator
  const getConfidenceIndicator = () => {
    if (!estimation) return null;

    const { confidence } = estimation;

    if (confidence >= 0.8) {
      return {
        icon: <CheckCircle className="h-4 w-4 text-green-600" />,
        label: 'High Confidence',
        color: 'text-green-600',
      };
    } else if (confidence >= 0.5) {
      return {
        icon: <TrendingUp className="h-4 w-4 text-yellow-600" />,
        label: 'Medium Confidence',
        color: 'text-yellow-600',
      };
    } else {
      return {
        icon: <AlertCircle className="h-4 w-4 text-orange-600" />,
        label: 'Low Confidence',
        color: 'text-orange-600',
      };
    }
  };

  if (isLoading) {
    return (
      <div className="border rounded-md p-4 bg-blue-50">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-sm text-blue-700">Getting AI time estimation...</span>
        </div>
      </div>
    );
  }

  if (!estimation) {
    return null;
  }

  const confidenceIndicator = getConfidenceIndicator();

  return (
    <div className="border rounded-md p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-900">AI Time Estimation</h3>
          </div>
          {confidenceIndicator && (
            <div className={`flex items-center space-x-1 ${confidenceIndicator.color}`}>
              {confidenceIndicator.icon}
              <span className="text-xs font-medium">{confidenceIndicator.label}</span>
            </div>
          )}
        </div>

        {/* Estimated Hours Display */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {!isEditing ? (
              <>
                <div>
                  <p className="text-2xl font-bold text-blue-700">{currentValue.toFixed(2)}h</p>
                  {estimation.range && (
                    <p className="text-xs text-gray-600">
                      Range: {estimation.range.min.toFixed(1)}h - {estimation.range.max.toFixed(1)}
                      h
                    </p>
                  )}
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleStartEdit}
                        className="h-8 w-8 p-0"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Override estimate</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            ) : (
              <div className="flex items-center space-x-2">
                <Input
                  type="number"
                  step="0.25"
                  min="0.25"
                  max="999"
                  value={editValue}
                  onChange={(e: React.MouseEvent) => setEditValue(e.target.value)}
                  className="w-24"
                  autoFocus
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveEdit}
                  className="h-8 w-8 p-0"
                >
                  <Check className="h-4 w-4 text-green-600" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEdit}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Based On Similar Tasks */}
        {estimation.basedOnSimilarTasks > 0 && (
          <div className="flex items-center space-x-1 text-xs text-gray-600">
            <Info className="h-3 w-3" />
            <span>Based on {estimation.basedOnSimilarTasks} similar task(s)</span>
          </div>
        )}

        {/* Reasoning Tooltip */}
        {estimation.reasoning && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-start space-x-2 cursor-help">
                  <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-700 line-clamp-2">{estimation.reasoning}</p>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                <p className="text-sm">{estimation.reasoning}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Override Message */}
        {value !== undefined && value !== estimation.estimatedHours && (
          <div className="flex items-center space-x-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
            <Edit2 className="h-3 w-3 text-yellow-700" />
            <span className="text-xs text-yellow-700">
              You've overridden the AI estimate (was {estimation.estimatedHours.toFixed(2)}h)
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
