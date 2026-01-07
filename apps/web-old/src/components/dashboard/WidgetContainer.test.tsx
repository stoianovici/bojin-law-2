/**
 * WidgetContainer Tests - Isolation Test
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { WidgetContainer } from './WidgetContainer';

describe('WidgetContainer', () => {
  it('renders without icon', () => {
    render(
      <WidgetContainer id="test-widget" title="Test Widget">
        <div>Widget content</div>
      </WidgetContainer>
    );

    expect(screen.getByText('Test Widget')).toBeInTheDocument();
    expect(screen.getByText('Widget content')).toBeInTheDocument();
  });

  it('renders with icon', () => {
    const icon = (
      <svg data-testid="test-icon" className="w-5 h-5">
        <path d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    );

    render(
      <WidgetContainer id="test-widget" title="Test Widget" icon={icon}>
        <div>Widget content</div>
      </WidgetContainer>
    );

    expect(screen.getByText('Test Widget')).toBeInTheDocument();
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });
});
