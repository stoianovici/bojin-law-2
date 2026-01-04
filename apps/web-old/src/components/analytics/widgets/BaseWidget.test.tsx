/**
 * BaseWidget Component Tests
 * Story 2.11.4: Financial Dashboard UI
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BaseWidget } from './BaseWidget';

describe('BaseWidget', () => {
  it('renders title correctly', () => {
    render(
      <BaseWidget title="Test Widget">
        <div>Content</div>
      </BaseWidget>
    );

    expect(screen.getByText('Test Widget')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('shows loading skeleton when isLoading is true', () => {
    render(
      <BaseWidget title="Test Widget" isLoading={true}>
        <div>Content</div>
      </BaseWidget>
    );

    expect(screen.getByTestId('widget-loading')).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('shows error state with retry button when error occurs', () => {
    const mockRetry = jest.fn();
    const testError = new Error('Test error message');

    render(
      <BaseWidget title="Test Widget" error={testError} onRetry={mockRetry}>
        <div>Content</div>
      </BaseWidget>
    );

    expect(screen.getByTestId('widget-error')).toBeInTheDocument();
    expect(screen.getByText('Eroare la încărcarea datelor')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: /reîncearcă/i });
    fireEvent.click(retryButton);
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it('shows empty state when isEmpty is true', () => {
    render(
      <BaseWidget title="Test Widget" isEmpty={true} emptyMessage="Nu există date disponibile">
        <div>Content</div>
      </BaseWidget>
    );

    expect(screen.getByTestId('widget-empty')).toBeInTheDocument();
    expect(screen.getByText('Nu există date disponibile')).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('renders content when not loading, no error, and not empty', () => {
    render(
      <BaseWidget title="Test Widget">
        <div data-testid="widget-content">Content</div>
      </BaseWidget>
    );

    expect(screen.getByTestId('widget-content')).toBeInTheDocument();
    expect(screen.queryByTestId('widget-loading')).not.toBeInTheDocument();
    expect(screen.queryByTestId('widget-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('widget-empty')).not.toBeInTheDocument();
  });

  it('renders header actions when provided', () => {
    render(
      <BaseWidget title="Test Widget" actions={<button data-testid="action-btn">Action</button>}>
        <div>Content</div>
      </BaseWidget>
    );

    expect(screen.getByTestId('action-btn')).toBeInTheDocument();
  });

  it('uses custom skeleton when provided', () => {
    render(
      <BaseWidget
        title="Test Widget"
        isLoading={true}
        skeleton={<div data-testid="custom-skeleton">Custom Loading</div>}
      >
        <div>Content</div>
      </BaseWidget>
    );

    expect(screen.getByTestId('custom-skeleton')).toBeInTheDocument();
    expect(screen.getByText('Custom Loading')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <BaseWidget title="Test Widget" className="custom-class">
        <div>Content</div>
      </BaseWidget>
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });
});
