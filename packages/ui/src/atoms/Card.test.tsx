/**
 * Card Component Tests
 * Tests all variants, composition, and accessibility features
 */

import { render, screen } from '@testing-library/react';
import { Card } from './Card';

describe('Card', () => {
  describe('Rendering', () => {
    it('renders with children content', () => {
      render(<Card>Card content here</Card>);
      expect(screen.getByText('Card content here')).toBeInTheDocument();
    });

    it('renders with Romanian diacritics', () => {
      render(<Card>Șeful a vândut o sticlă în oraș și țară</Card>);
      expect(screen.getByText(/Șeful a vândut/)).toBeInTheDocument();
    });

    it('has article role for accessibility', () => {
      render(<Card>Content</Card>);
      expect(screen.getByRole('article')).toBeInTheDocument();
    });
  });

  describe('Variants', () => {
    it('renders default variant', () => {
      render(
        <Card variant="default" data-testid="card-default">
          Default
        </Card>
      );
      const card = screen.getByTestId('card-default');
      expect(card).toHaveClass('border border-neutral-200');
    });

    it('renders elevated variant', () => {
      render(
        <Card variant="elevated" data-testid="card-elevated">
          Elevated
        </Card>
      );
      const card = screen.getByTestId('card-elevated');
      expect(card).toHaveClass('shadow-lg');
    });

    it('renders outlined variant', () => {
      render(
        <Card variant="outlined" data-testid="card-outlined">
          Outlined
        </Card>
      );
      const card = screen.getByTestId('card-outlined');
      expect(card).toHaveClass('border-2 border-neutral-300');
    });
  });

  describe('Composition', () => {
    it('renders with header only', () => {
      render(<Card header={<h3>Card Header</h3>}>Body content</Card>);
      expect(screen.getByText('Card Header')).toBeInTheDocument();
      expect(screen.getByText('Body content')).toBeInTheDocument();
    });

    it('renders with footer only', () => {
      render(<Card footer={<button>Action</button>}>Body content</Card>);
      expect(screen.getByText('Action')).toBeInTheDocument();
      expect(screen.getByText('Body content')).toBeInTheDocument();
    });

    it('renders with header and footer', () => {
      render(
        <Card header={<h3>Title</h3>} footer={<button>Save</button>}>
          Body content
        </Card>
      );
      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Body content')).toBeInTheDocument();
      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    it('renders without header and footer', () => {
      render(<Card>Just body content</Card>);
      expect(screen.getByText('Just body content')).toBeInTheDocument();
    });

    it('renders header with Romanian diacritics', () => {
      render(<Card header={<h3>Configurație</h3>}>Content</Card>);
      expect(screen.getByText('Configurație')).toBeInTheDocument();
    });
  });

  describe('Custom Styling', () => {
    it('applies custom className to card container', () => {
      render(
        <Card className="custom-card" data-testid="card-custom">
          Content
        </Card>
      );
      const card = screen.getByTestId('card-custom');
      expect(card).toHaveClass('custom-card');
    });

    it('applies custom headerClassName', () => {
      const { container } = render(
        <Card header={<h3>Header</h3>} headerClassName="custom-header">
          Content
        </Card>
      );
      const header = container.querySelector('.custom-header');
      expect(header).toBeInTheDocument();
      expect(header).toHaveTextContent('Header');
    });

    it('applies custom bodyClassName', () => {
      const { container } = render(<Card bodyClassName="custom-body">Content</Card>);
      const body = container.querySelector('.custom-body');
      expect(body).toBeInTheDocument();
      expect(body).toHaveTextContent('Content');
    });

    it('applies custom footerClassName', () => {
      const { container } = render(
        <Card footer={<button>Footer</button>} footerClassName="custom-footer">
          Content
        </Card>
      );
      const footer = container.querySelector('.custom-footer');
      expect(footer).toBeInTheDocument();
      expect(footer).toHaveTextContent('Footer');
    });
  });

  describe('Structure', () => {
    it('renders header with bottom border when present', () => {
      const { container } = render(<Card header={<h3>Header</h3>}>Content</Card>);
      const header = container.querySelector('.border-b');
      expect(header).toBeInTheDocument();
    });

    it('renders footer with top border when present', () => {
      const { container } = render(<Card footer={<button>Footer</button>}>Content</Card>);
      const footer = container.querySelector('.border-t');
      expect(footer).toBeInTheDocument();
    });

    it('body always has padding', () => {
      const { container } = render(<Card>Content</Card>);
      const body = container.querySelector('.px-6.py-4');
      expect(body).toBeInTheDocument();
    });
  });

  describe('Complex Content', () => {
    it('renders complex header with multiple elements', () => {
      render(
        <Card
          header={
            <div>
              <h3>Title</h3>
              <span>Subtitle</span>
            </div>
          }
        >
          Content
        </Card>
      );
      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Subtitle')).toBeInTheDocument();
    });

    it('renders complex footer with multiple buttons', () => {
      render(
        <Card
          footer={
            <div>
              <button>Cancel</button>
              <button>Save</button>
            </div>
          }
        >
          Content
        </Card>
      );
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    it('renders complex body with nested elements', () => {
      render(
        <Card>
          <p>Paragraph 1</p>
          <p>Paragraph 2</p>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
          </ul>
        </Card>
      );
      expect(screen.getByText('Paragraph 1')).toBeInTheDocument();
      expect(screen.getByText('Paragraph 2')).toBeInTheDocument();
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
    });
  });
});
