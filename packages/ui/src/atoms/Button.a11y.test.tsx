/**
 * Button Component Accessibility Tests
 * Tests accessibility using jest-axe
 */

import React from 'react';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Button } from './Button';

describe('Button Accessibility', () => {
  it('should have no accessibility violations (default)', async () => {
    const { container } = render(<Button>Click me</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations (primary variant)', async () => {
    const { container } = render(<Button variant="primary">Primary Button</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations (secondary variant)', async () => {
    const { container } = render(<Button variant="secondary">Secondary Button</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations (ghost variant)', async () => {
    const { container } = render(<Button variant="ghost">Ghost Button</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations (disabled state)', async () => {
    const { container } = render(<Button disabled>Disabled Button</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations (with icon)', async () => {
    const { container } = render(
      <Button>
        <span aria-hidden="true">🔍</span>
        Search
      </Button>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations (icon-only with aria-label)', async () => {
    const { container } = render(
      <Button aria-label="Search">
        <span aria-hidden="true">🔍</span>
      </Button>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA attributes when loading', async () => {
    const { container } = render(
      <Button aria-busy="true" disabled>
        Loading...
      </Button>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations with Romanian text', async () => {
    const { container } = render(<Button>Căutare în documente</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
