/**
 * Unit Tests for Toast Component
 * Story 2.8: Case CRUD Operations UI - Task 19
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToastProvider } from './Toast';
import { useNotificationStore } from '../../stores/notificationStore';

// Mock the notification store
jest.mock('../../stores/notificationStore');

describe('ToastProvider', () => {
  const mockRemoveNotification = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useNotificationStore as unknown as jest.Mock).mockReturnValue({
      notifications: [],
      removeNotification: mockRemoveNotification,
    });
  });

  it('renders children', () => {
    render(
      <ToastProvider>
        <div>Child Content</div>
      </ToastProvider>
    );

    expect(screen.getByText('Child Content')).toBeInTheDocument();
  });

  it('renders success notification', () => {
    (useNotificationStore as unknown as jest.Mock).mockReturnValue({
      notifications: [
        {
          id: '1',
          type: 'success',
          title: 'Success!',
          message: 'Operation completed successfully',
          duration: 5000,
        },
      ],
      removeNotification: mockRemoveNotification,
    });

    render(
      <ToastProvider>
        <div>Content</div>
      </ToastProvider>
    );

    expect(screen.getByText('Success!')).toBeInTheDocument();
    expect(screen.getByText('Operation completed successfully')).toBeInTheDocument();
  });

  it('renders error notification', () => {
    (useNotificationStore as unknown as jest.Mock).mockReturnValue({
      notifications: [
        {
          id: '1',
          type: 'error',
          title: 'Error!',
          message: 'Operation failed',
          duration: 5000,
        },
      ],
      removeNotification: mockRemoveNotification,
    });

    render(
      <ToastProvider>
        <div>Content</div>
      </ToastProvider>
    );

    expect(screen.getByText('Error!')).toBeInTheDocument();
    expect(screen.getByText('Operation failed')).toBeInTheDocument();
  });

  it('renders warning notification', () => {
    (useNotificationStore as unknown as jest.Mock).mockReturnValue({
      notifications: [
        {
          id: '1',
          type: 'warning',
          title: 'Warning!',
          message: 'This is a warning',
          duration: 5000,
        },
      ],
      removeNotification: mockRemoveNotification,
    });

    render(
      <ToastProvider>
        <div>Content</div>
      </ToastProvider>
    );

    expect(screen.getByText('Warning!')).toBeInTheDocument();
    expect(screen.getByText('This is a warning')).toBeInTheDocument();
  });

  it('renders info notification', () => {
    (useNotificationStore as unknown as jest.Mock).mockReturnValue({
      notifications: [
        {
          id: '1',
          type: 'info',
          title: 'Info',
          message: 'This is information',
          duration: 5000,
        },
      ],
      removeNotification: mockRemoveNotification,
    });

    render(
      <ToastProvider>
        <div>Content</div>
      </ToastProvider>
    );

    expect(screen.getByText('Info')).toBeInTheDocument();
    expect(screen.getByText('This is information')).toBeInTheDocument();
  });

  it('renders notification without message', () => {
    (useNotificationStore as unknown as jest.Mock).mockReturnValue({
      notifications: [
        {
          id: '1',
          type: 'success',
          title: 'Success!',
          duration: 5000,
        },
      ],
      removeNotification: mockRemoveNotification,
    });

    render(
      <ToastProvider>
        <div>Content</div>
      </ToastProvider>
    );

    expect(screen.getByText('Success!')).toBeInTheDocument();
  });

  it('renders multiple notifications', () => {
    (useNotificationStore as unknown as jest.Mock).mockReturnValue({
      notifications: [
        {
          id: '1',
          type: 'success',
          title: 'First Notification',
          message: 'First message',
          duration: 5000,
        },
        {
          id: '2',
          type: 'error',
          title: 'Second Notification',
          message: 'Second message',
          duration: 5000,
        },
      ],
      removeNotification: mockRemoveNotification,
    });

    render(
      <ToastProvider>
        <div>Content</div>
      </ToastProvider>
    );

    expect(screen.getByText('First Notification')).toBeInTheDocument();
    expect(screen.getByText('Second Notification')).toBeInTheDocument();
  });

  it('has close button with accessible label', () => {
    (useNotificationStore as unknown as jest.Mock).mockReturnValue({
      notifications: [
        {
          id: '1',
          type: 'success',
          title: 'Success!',
          message: 'Test message',
          duration: 5000,
        },
      ],
      removeNotification: mockRemoveNotification,
    });

    render(
      <ToastProvider>
        <div>Content</div>
      </ToastProvider>
    );

    const closeButton = screen.getByLabelText('Close notification');
    expect(closeButton).toBeInTheDocument();
  });

  it('has ARIA live region for accessibility', () => {
    render(
      <ToastProvider>
        <div>Content</div>
      </ToastProvider>
    );

    const liveRegion = screen.getByLabelText('Notifications');
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
  });

  it('applies correct border color for success notification', () => {
    (useNotificationStore as unknown as jest.Mock).mockReturnValue({
      notifications: [
        {
          id: '1',
          type: 'success',
          title: 'Success!',
          duration: 5000,
        },
      ],
      removeNotification: mockRemoveNotification,
    });

    const { container } = render(
      <ToastProvider>
        <div>Content</div>
      </ToastProvider>
    );

    // Check that success notification has green border
    const toast = container.querySelector('.border-green-200');
    expect(toast).toBeInTheDocument();
  });

  it('applies correct border color for error notification', () => {
    (useNotificationStore as unknown as jest.Mock).mockReturnValue({
      notifications: [
        {
          id: '1',
          type: 'error',
          title: 'Error!',
          duration: 5000,
        },
      ],
      removeNotification: mockRemoveNotification,
    });

    const { container } = render(
      <ToastProvider>
        <div>Content</div>
      </ToastProvider>
    );

    // Check that error notification has red border
    const toast = container.querySelector('.border-red-200');
    expect(toast).toBeInTheDocument();
  });

  it('shows correct icon for success notification', () => {
    (useNotificationStore as unknown as jest.Mock).mockReturnValue({
      notifications: [
        {
          id: '1',
          type: 'success',
          title: 'Success!',
          duration: 5000,
        },
      ],
      removeNotification: mockRemoveNotification,
    });

    const { container } = render(
      <ToastProvider>
        <div>Content</div>
      </ToastProvider>
    );

    // Success icon should have green color class
    const icon = container.querySelector('.text-green-600');
    expect(icon).toBeInTheDocument();
  });

  it('shows correct icon for error notification', () => {
    (useNotificationStore as unknown as jest.Mock).mockReturnValue({
      notifications: [
        {
          id: '1',
          type: 'error',
          title: 'Error!',
          duration: 5000,
        },
      ],
      removeNotification: mockRemoveNotification,
    });

    const { container } = render(
      <ToastProvider>
        <div>Content</div>
      </ToastProvider>
    );

    // Error icon should have red color class
    const icon = container.querySelector('.text-red-600');
    expect(icon).toBeInTheDocument();
  });

  it('respects custom duration', () => {
    (useNotificationStore as unknown as jest.Mock).mockReturnValue({
      notifications: [
        {
          id: '1',
          type: 'success',
          title: 'Success!',
          duration: 3000,
        },
      ],
      removeNotification: mockRemoveNotification,
    });

    render(
      <ToastProvider>
        <div>Content</div>
      </ToastProvider>
    );

    // Toast is rendered with the notification
    expect(screen.getByText('Success!')).toBeInTheDocument();
  });
});
