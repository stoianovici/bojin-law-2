'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Calendar, Check, X, Clock, User } from 'lucide-react';

export interface TaskDelegation {
  id: string;
  sourceTaskId: string;
  sourceTask: {
    id: string;
    title: string;
    type: string;
  };
  delegatedTaskId?: string;
  delegatedTask?: {
    id: string;
    title: string;
  };
  delegatedTo: string;
  delegatedBy: string;
  delegator: {
    id: string;
    firstName: string;
    lastName: string;
  };
  reason: string;
  startDate: Date;
  endDate: Date;
  status: 'Pending' | 'Accepted' | 'Declined';
  notes?: string;
  createdAt: Date;
}

export interface DelegationRequestCardProps {
  delegation: TaskDelegation;
  onAccept: (delegationId: string) => Promise<void>;
  onDecline: (delegationId: string, reason: string) => Promise<void>;
}

export function DelegationRequestCard({
  delegation,
  onAccept,
  onDecline,
}: DelegationRequestCardProps) {
  const [showDeclineForm, setShowDeclineForm] = React.useState(false);
  const [declineReason, setDeclineReason] = React.useState('');
  const [isProcessing, setIsProcessing] = React.useState(false);

  const handleAccept = async () => {
    setIsProcessing(true);
    try {
      await onAccept(delegation.id);
    } catch (error) {
      console.error('Failed to accept delegation:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!declineReason.trim()) {
      return;
    }

    setIsProcessing(true);
    try {
      await onDecline(delegation.id, declineReason);
      setShowDeclineForm(false);
      setDeclineReason('');
    } catch (error) {
      console.error('Failed to decline delegation:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = () => {
    switch (delegation.status) {
      case 'Accepted':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <Check className="w-3 h-3 mr-1" />
            Accepted
          </Badge>
        );
      case 'Declined':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <X className="w-3 h-3 mr-1" />
            Declined
          </Badge>
        );
      case 'Pending':
      default:
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            <Clock className="w-3 h-3 mr-1" />
            Pending Response
          </Badge>
        );
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-blue-600" />
          <div>
            <h4 className="font-semibold text-sm">
              Delegation Request from {delegation.delegator.firstName}{' '}
              {delegation.delegator.lastName}
            </h4>
            <p className="text-xs text-gray-500">
              Requested {formatDate(delegation.createdAt)}
            </p>
          </div>
        </div>
        {getStatusBadge()}
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span className="text-gray-600">
            {formatDate(delegation.startDate)} - {formatDate(delegation.endDate)}
          </span>
        </div>

        <div className="bg-gray-50 p-3 rounded-lg">
          <p className="text-sm font-medium mb-1">Business Trip:</p>
          <p className="text-sm text-gray-700">{delegation.sourceTask.title}</p>
          {delegation.reason && (
            <p className="text-xs text-gray-600 mt-1">Reason: {delegation.reason}</p>
          )}
        </div>

        {delegation.delegatedTask && (
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm font-medium mb-1">Delegated Task:</p>
            <p className="text-sm text-gray-700">{delegation.delegatedTask.title}</p>
          </div>
        )}

        {delegation.notes && (
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm font-medium mb-1">Notes:</p>
            <p className="text-sm text-gray-700">{delegation.notes}</p>
          </div>
        )}
      </div>

      {delegation.status === 'Pending' && (
        <div className="space-y-3">
          {!showDeclineForm ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAccept}
                disabled={isProcessing}
                className="flex-1"
              >
                <Check className="w-4 h-4 mr-1" />
                Accept Delegation
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowDeclineForm(true)}
                disabled={isProcessing}
                className="flex-1"
              >
                <X className="w-4 h-4 mr-1" />
                Decline
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                Reason for Declining <span className="text-red-500">*</span>
              </label>
              <Textarea
                value={declineReason}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDeclineReason(e.target.value)}
                placeholder="Please provide a reason for declining this delegation..."
                rows={3}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleDecline}
                  disabled={isProcessing || !declineReason.trim()}
                  className="flex-1"
                >
                  Confirm Decline
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowDeclineForm(false);
                    setDeclineReason('');
                  }}
                  disabled={isProcessing}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
