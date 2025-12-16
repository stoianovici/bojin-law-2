/**
 * Modal Component Tests
 * Tests open/close states, sizes, and accessibility features
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';

describe('Modal', () => {
  describe('Rendering', () => {
    it('does not render when closed', () => {
      render(
        <Modal open={false} onOpenChange={() => {}} title="Test Modal">
          Content
        </Modal>
      );
      expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
    });

    it('renders when open', () => {
      render(
        <Modal open={true} onOpenChange={() => {}} title="Test Modal">
          Content
        </Modal>
      );
      expect(screen.getByText('Test Modal')).toBeInTheDocument();
    });

    it('renders with Romanian diacritics in title', () => {
      render(
        <Modal open={true} onOpenChange={() => {}} title="Confirmați acțiunea">
          Content
        </Modal>
      );
      expect(screen.getByText('Confirmați acțiunea')).toBeInTheDocument();
    });

    it('renders with description', () => {
      render(
        <Modal
          open={true}
          onOpenChange={() => {}}
          title="Delete Item"
          description="Are you sure you want to delete this item?"
        >
          Content
        </Modal>
      );
      expect(screen.getByText('Are you sure you want to delete this item?')).toBeInTheDocument();
    });

    it('renders children content', () => {
      render(
        <Modal open={true} onOpenChange={() => {}} title="Modal">
          <p>Modal body content</p>
        </Modal>
      );
      expect(screen.getByText('Modal body content')).toBeInTheDocument();
    });
  });

  describe('Sizes', () => {
    it('renders small size', () => {
      render(
        <Modal open={true} onOpenChange={() => {}} title="Small Modal" size="sm">
          Content
        </Modal>
      );
      const content = document.querySelector('.max-w-sm');
      expect(content).toBeInTheDocument();
    });

    it('renders medium size (default)', () => {
      render(
        <Modal open={true} onOpenChange={() => {}} title="Medium Modal" size="md">
          Content
        </Modal>
      );
      const content = document.querySelector('.max-w-md');
      expect(content).toBeInTheDocument();
    });

    it('renders large size', () => {
      render(
        <Modal open={true} onOpenChange={() => {}} title="Large Modal" size="lg">
          Content
        </Modal>
      );
      const content = document.querySelector('.max-w-lg');
      expect(content).toBeInTheDocument();
    });

    it('renders extra large size', () => {
      render(
        <Modal open={true} onOpenChange={() => {}} title="XL Modal" size="xl">
          Content
        </Modal>
      );
      const content = document.querySelector('.max-w-xl');
      expect(content).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('calls onOpenChange when close button is clicked', async () => {
      const handleOpenChange = jest.fn();
      const user = userEvent.setup();

      render(
        <Modal open={true} onOpenChange={handleOpenChange} title="Modal">
          Content
        </Modal>
      );

      const closeButton = screen.getByLabelText('Închide modalul');
      await user.click(closeButton);

      expect(handleOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Accessibility', () => {
    it('has correct ARIA attributes with description', () => {
      render(
        <Modal open={true} onOpenChange={() => {}} title="Modal" description="Modal description">
          Content
        </Modal>
      );
      const content = document.querySelector('[aria-describedby="modal-description"]');
      expect(content).toBeInTheDocument();
    });

    it('close button has aria-label', () => {
      render(
        <Modal open={true} onOpenChange={() => {}} title="Modal">
          Content
        </Modal>
      );
      const closeButton = screen.getByLabelText('Închide modalul');
      expect(closeButton).toBeInTheDocument();
    });

    it('renders backdrop with aria-hidden', () => {
      render(
        <Modal open={true} onOpenChange={() => {}} title="Modal">
          Content
        </Modal>
      );
      const overlay = document.querySelector('[aria-hidden="true"]');
      expect(overlay).toBeInTheDocument();
    });

    it('close button is keyboard accessible', async () => {
      const handleOpenChange = jest.fn();
      const user = userEvent.setup();

      render(
        <Modal open={true} onOpenChange={handleOpenChange} title="Modal">
          Content
        </Modal>
      );

      const closeButton = screen.getByLabelText('Închide modalul');
      closeButton.focus();

      expect(closeButton).toHaveFocus();

      await user.keyboard('{Enter}');

      expect(handleOpenChange).toHaveBeenCalled();
    });
  });

  describe('Custom Styling', () => {
    it('applies custom className', () => {
      render(
        <Modal open={true} onOpenChange={() => {}} title="Modal" className="custom-modal">
          Content
        </Modal>
      );
      const content = document.querySelector('.custom-modal');
      expect(content).toBeInTheDocument();
    });
  });

  describe('Close Button', () => {
    it('renders close icon', () => {
      render(
        <Modal open={true} onOpenChange={() => {}} title="Modal">
          Content
        </Modal>
      );
      const closeButton = screen.getByLabelText('Închide modalul');
      const svg = closeButton.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });

    it('close button has correct positioning', () => {
      render(
        <Modal open={true} onOpenChange={() => {}} title="Modal">
          Content
        </Modal>
      );
      const closeButton = screen.getByLabelText('Închide modalul');
      expect(closeButton).toHaveClass('absolute', 'right-4', 'top-4');
    });
  });

  describe('Content Layout', () => {
    it('renders title with correct styling', () => {
      render(
        <Modal open={true} onOpenChange={() => {}} title="Modal Title">
          Content
        </Modal>
      );
      const title = screen.getByText('Modal Title');
      expect(title).toHaveClass('text-xl', 'font-semibold');
    });

    it('renders description with correct styling', () => {
      render(
        <Modal open={true} onOpenChange={() => {}} title="Modal" description="Description text">
          Content
        </Modal>
      );
      const description = screen.getByText('Description text');
      expect(description).toHaveClass('text-sm', 'text-neutral-600');
    });

    it('renders Romanian diacritics in description', () => {
      render(
        <Modal
          open={true}
          onOpenChange={() => {}}
          title="Modal"
          description="Sunteți sigur că doriți să continuați?"
        >
          Content
        </Modal>
      );
      expect(screen.getByText('Sunteți sigur că doriți să continuați?')).toBeInTheDocument();
    });
  });
});
