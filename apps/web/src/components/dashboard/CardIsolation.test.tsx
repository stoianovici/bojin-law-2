/**
 * Card Isolation Test - Test Card import directly from source
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { Card } from '../../../../../packages/ui/src/atoms/Card';

describe('Card from @legal-platform/ui', () => {
  it('renders Card with simple children', () => {
    render(<Card>Test content</Card>);

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('renders Card with header', () => {
    render(<Card header={<h3>Test Header</h3>}>Test content</Card>);

    expect(screen.getByText('Test Header')).toBeInTheDocument();
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });
});
