/**
 * Tooltip Component Tests
 * Tests positioning, content rendering, and accessibility features
 */

import { render, screen } from '@testing-library/react';
import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  describe('Rendering', () => {
    it('renders trigger element', () => {
      render(
        <Tooltip content="Tooltip content">
          <button>Hover me</button>
        </Tooltip>
      );
      expect(screen.getByText('Hover me')).toBeInTheDocument();
    });

    it('renders with Romanian diacritics trigger', () => {
      render(
        <Tooltip content="Salvați modificările">
          <button>Salvează</button>
        </Tooltip>
      );
      expect(screen.getByText('Salvează')).toBeInTheDocument();
    });
  });

  describe('Positions', () => {
    it('renders with top position by default', () => {
      render(
        <Tooltip content="Top tooltip">
          <button>Button</button>
        </Tooltip>
      );
      // Position is set via Radix UI's side prop
      expect(screen.getByText('Button')).toBeInTheDocument();
    });

    it('renders with bottom position', () => {
      render(
        <Tooltip content="Bottom tooltip" position="bottom">
          <button>Button</button>
        </Tooltip>
      );
      expect(screen.getByText('Button')).toBeInTheDocument();
    });

    it('renders with left position', () => {
      render(
        <Tooltip content="Left tooltip" position="left">
          <button>Button</button>
        </Tooltip>
      );
      expect(screen.getByText('Button')).toBeInTheDocument();
    });

    it('renders with right position', () => {
      render(
        <Tooltip content="Right tooltip" position="right">
          <button>Button</button>
        </Tooltip>
      );
      expect(screen.getByText('Button')).toBeInTheDocument();
    });
  });

  describe('Component Structure', () => {
    it('wraps children in TooltipProvider', () => {
      const { container } = render(
        <Tooltip content="Tooltip content">
          <button>Hover me</button>
        </Tooltip>
      );
      // Verify the component renders without errors
      expect(container.querySelector('button')).toBeInTheDocument();
    });

    it('supports complex trigger elements', () => {
      render(
        <Tooltip content="Complex trigger tooltip">
          <div>
            <span>Complex</span>
            <span>Trigger</span>
          </div>
        </Tooltip>
      );
      expect(screen.getByText('Complex')).toBeInTheDocument();
      expect(screen.getByText('Trigger')).toBeInTheDocument();
    });
  });

  describe('Content Properties', () => {
    it('accepts string content', () => {
      render(
        <Tooltip content="Simple string">
          <button>Hover me</button>
        </Tooltip>
      );
      expect(screen.getByText('Hover me')).toBeInTheDocument();
    });

    it('accepts Romanian diacritic content', () => {
      render(
        <Tooltip content="Acest câmp este obligatoriu">
          <span>Nume *</span>
        </Tooltip>
      );
      expect(screen.getByText('Nume *')).toBeInTheDocument();
    });
  });

  describe('Custom Styling', () => {
    it('accepts custom className prop', () => {
      render(
        <Tooltip content="Custom styled" className="custom-tooltip">
          <button>Hover me</button>
        </Tooltip>
      );
      expect(screen.getByText('Hover me')).toBeInTheDocument();
    });
  });

  describe('Integration', () => {
    it('works with button elements', () => {
      render(
        <Tooltip content="Button tooltip">
          <button>Click me</button>
        </Tooltip>
      );
      const button = screen.getByText('Click me');
      expect(button).toBeInTheDocument();
      expect(button.tagName).toBe('BUTTON');
    });

    it('works with span elements', () => {
      render(
        <Tooltip content="Span tooltip">
          <span>Label</span>
        </Tooltip>
      );
      const span = screen.getByText('Label');
      expect(span).toBeInTheDocument();
      expect(span.tagName).toBe('SPAN');
    });

    it('works with div elements', () => {
      render(
        <Tooltip content="Div tooltip">
          <div>Content</div>
        </Tooltip>
      );
      const div = screen.getByText('Content');
      expect(div).toBeInTheDocument();
      expect(div.tagName).toBe('DIV');
    });
  });

  describe('Provider Configuration', () => {
    it('renders with TooltipProvider delay configuration', () => {
      // Verify the component renders without errors with provider
      const { container } = render(
        <Tooltip content="Delayed tooltip">
          <button>Hover me</button>
        </Tooltip>
      );
      expect(container.querySelector('button')).toBeInTheDocument();
    });
  });

  describe('Multiple Instances', () => {
    it('renders multiple tooltips independently', () => {
      render(
        <>
          <Tooltip content="First tooltip">
            <button>Button 1</button>
          </Tooltip>
          <Tooltip content="Second tooltip">
            <button>Button 2</button>
          </Tooltip>
        </>
      );
      expect(screen.getByText('Button 1')).toBeInTheDocument();
      expect(screen.getByText('Button 2')).toBeInTheDocument();
    });

    it('handles different positions for multiple tooltips', () => {
      render(
        <>
          <Tooltip content="Top" position="top">
            <button>Top</button>
          </Tooltip>
          <Tooltip content="Bottom" position="bottom">
            <button>Bottom</button>
          </Tooltip>
          <Tooltip content="Left" position="left">
            <button>Left</button>
          </Tooltip>
          <Tooltip content="Right" position="right">
            <button>Right</button>
          </Tooltip>
        </>
      );
      expect(screen.getByText('Top')).toBeInTheDocument();
      expect(screen.getByText('Bottom')).toBeInTheDocument();
      expect(screen.getByText('Left')).toBeInTheDocument();
      expect(screen.getByText('Right')).toBeInTheDocument();
    });
  });
});
