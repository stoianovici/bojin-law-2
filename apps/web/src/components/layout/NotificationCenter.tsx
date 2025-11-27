/**
 * Notification Center Component
 * Story 2.8.2: Case Approval Workflow - Task 19
 *
 * Displays in-app notifications with bell icon and badge count
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useNotifications, useUnreadNotificationCount, useMarkNotificationAsRead } from '@/hooks/useNotifications';
import type { Notification } from '@legal-platform/types';

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, refetch } = useNotifications({ limit: 10 });
  const { unreadCount } = useUnreadNotificationCount();
  const { markNotificationAsRead } = useMarkNotificationAsRead();

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markNotificationAsRead(notification.id);
      refetch();
    }
    setIsOpen(false);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'CasePendingApproval':
        return '📋';
      case 'CaseApproved':
        return '✅';
      case 'CaseRejected':
        return '❌';
      default:
        return '🔔';
    }
  };

  const getTimeAgo = (date: Date | string) => {
    const now = new Date();
    const notificationDate = new Date(date);
    const diffInMs = now.getTime() - notificationDate.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return notificationDate.toLocaleDateString();
  };

  return (
    <div className="relative">
      {/* Bell Icon with Badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none"
        aria-label="Notifications"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center w-5 h-5 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Notification Dropdown */}
          <div className="absolute right-0 z-20 w-96 mt-2 bg-white rounded-lg shadow-xl ring-1 ring-black ring-opacity-5 max-h-[600px] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Notifications
              </h3>
            </div>

            {/* Notifications List */}
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  <p>No notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                        !notification.read ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      {notification.link ? (
                        <Link href={notification.link} className="block">
                          <NotificationItem notification={notification} getNotificationIcon={getNotificationIcon} getTimeAgo={getTimeAgo} />
                        </Link>
                      ) : (
                        <NotificationItem notification={notification} getNotificationIcon={getNotificationIcon} getTimeAgo={getTimeAgo} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
                <Link
                  href="/notifications"
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  onClick={() => setIsOpen(false)}
                >
                  View all notifications
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Notification Item Component
function NotificationItem({
  notification,
  getNotificationIcon,
  getTimeAgo,
}: {
  notification: Notification;
  getNotificationIcon: (type: string) => string;
  getTimeAgo: (date: Date | string) => string;
}) {
  return (
    <div className="flex items-start space-x-3">
      <div className="flex-shrink-0 text-2xl">
        {getNotificationIcon(notification.type)}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium text-gray-900 ${!notification.read ? 'font-semibold' : ''}`}>
          {notification.title}
        </p>
        <p className="text-sm text-gray-600 mt-1">
          {notification.message}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {getTimeAgo(notification.createdAt)}
        </p>
      </div>
      {!notification.read && (
        <div className="flex-shrink-0">
          <span className="inline-block w-2 h-2 bg-blue-600 rounded-full"></span>
        </div>
      )}
    </div>
  );
}
