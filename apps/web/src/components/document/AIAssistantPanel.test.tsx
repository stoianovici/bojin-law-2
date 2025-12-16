/**
 * Tests for AIAssistantPanel component
 */

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AIAssistantPanel } from './AIAssistantPanel';

describe('AIAssistantPanel', () => {
  describe('Collapsed State', () => {
    it('renders collapsed view when isCollapsed is true', () => {
      render(<AIAssistantPanel isCollapsed={true} />);

      expect(screen.getByText('Asistent AI')).toBeInTheDocument();
      expect(screen.getByLabelText('Deschide panoul AI')).toBeInTheDocument();
    });

    it('calls onToggleCollapse when expand button is clicked', () => {
      const handleToggle = jest.fn();
      render(<AIAssistantPanel isCollapsed={true} onToggleCollapse={handleToggle} />);

      const expandButton = screen.getByLabelText('Deschide panoul AI');
      fireEvent.click(expandButton);

      expect(handleToggle).toHaveBeenCalledTimes(1);
    });

    it('does not render tabs when collapsed', () => {
      render(<AIAssistantPanel isCollapsed={true} />);

      expect(screen.queryByText('Sugestii')).not.toBeInTheDocument();
      expect(screen.queryByText('Documente')).not.toBeInTheDocument();
      expect(screen.queryByText('Șabloane')).not.toBeInTheDocument();
    });
  });

  describe('Expanded State', () => {
    it('renders expanded view when isCollapsed is false', () => {
      render(<AIAssistantPanel isCollapsed={false} />);

      expect(screen.getByText('Asistent AI')).toBeInTheDocument();
      expect(screen.getByLabelText('Închide panoul AI')).toBeInTheDocument();
    });

    it('renders all three tabs', () => {
      render(<AIAssistantPanel />);

      expect(screen.getByText('Sugestii')).toBeInTheDocument();
      expect(screen.getByText('Documente')).toBeInTheDocument();
      expect(screen.getByText('Șabloane')).toBeInTheDocument();
    });

    it('calls onToggleCollapse when collapse button is clicked', () => {
      const handleToggle = jest.fn();
      render(<AIAssistantPanel isCollapsed={false} onToggleCollapse={handleToggle} />);

      const collapseButton = screen.getByLabelText('Închide panoul AI');
      fireEvent.click(collapseButton);

      expect(handleToggle).toHaveBeenCalledTimes(1);
    });

    it('shows suggestions tab by default', () => {
      render(<AIAssistantPanel />);

      // Check that suggestions content is visible
      expect(screen.getByText(/% potrivire/)).toBeInTheDocument();
      expect(screen.getAllByText('Inserează').length).toBeGreaterThan(0);
    });
  });

  describe('Tab Switching', () => {
    it('switches to documents tab when clicked', () => {
      render(<AIAssistantPanel />);

      const documentsTab = screen.getByText('Documente');
      fireEvent.click(documentsTab);

      // Check that similar documents are displayed
      expect(screen.getByText(/Contract de Consultanță Juridică/)).toBeInTheDocument();
      expect(screen.getByText(/% similar/)).toBeInTheDocument();
    });

    it('switches to templates tab when clicked', () => {
      render(<AIAssistantPanel />);

      const templatesTab = screen.getByText('Șabloane');
      fireEvent.click(templatesTab);

      // Check that templates are displayed
      expect(screen.getByText('Contract Prestări Servicii Standard')).toBeInTheDocument();
      expect(screen.getByText('Acord de Confidențialitate (NDA)')).toBeInTheDocument();
    });

    it('switches back to suggestions tab', () => {
      render(<AIAssistantPanel />);

      // Switch to documents
      fireEvent.click(screen.getByText('Documente'));

      // Switch back to suggestions
      fireEvent.click(screen.getByText('Sugestii'));

      // Check that suggestions content is visible again
      expect(screen.getByText(/% potrivire/)).toBeInTheDocument();
    });
  });

  describe('Suggestions Tab', () => {
    it('renders multiple AI suggestions', () => {
      render(<AIAssistantPanel />);

      const insertButtons = screen.getAllByText('Inserează');
      expect(insertButtons.length).toBeGreaterThan(0);
    });

    it('displays confidence scores for suggestions', () => {
      render(<AIAssistantPanel />);

      expect(screen.getByText('92% potrivire')).toBeInTheDocument();
      expect(screen.getByText('88% potrivire')).toBeInTheDocument();
    });

    it('displays suggestion text content', () => {
      render(<AIAssistantPanel />);

      expect(screen.getByText(/În conformitate cu prevederile art. 1270/)).toBeInTheDocument();
      expect(screen.getByText(/ARTICOLUL 8 - FORȚĂ MAJORĂ/)).toBeInTheDocument();
    });

    it('handles insert button clicks', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      render(<AIAssistantPanel />);

      const insertButtons = screen.getAllByText('Inserează');
      fireEvent.click(insertButtons[0]);

      expect(consoleSpy).toHaveBeenCalledWith('Insert suggestion:', '1');
      consoleSpy.mockRestore();
    });

    it('renders Romanian diacritics correctly in suggestions', () => {
      render(<AIAssistantPanel />);

      expect(screen.getByText(/următoarele/)).toBeInTheDocument();
      expect(screen.getByText(/părțile/)).toBeInTheDocument();
    });
  });

  describe('Similar Documents Tab', () => {
    it('renders multiple similar documents', () => {
      render(<AIAssistantPanel />);

      fireEvent.click(screen.getByText('Documente'));

      expect(
        screen.getByText('Contract de Consultanță Juridică - Tech Innovations SRL')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Contract Servicii Juridice - Digital Media Group')
      ).toBeInTheDocument();
    });

    it('displays similarity scores', () => {
      render(<AIAssistantPanel />);

      fireEvent.click(screen.getByText('Documente'));

      expect(screen.getByText('94% similar')).toBeInTheDocument();
      expect(screen.getByText('89% similar')).toBeInTheDocument();
    });

    it('displays document snippets and dates', () => {
      render(<AIAssistantPanel />);

      fireEvent.click(screen.getByText('Documente'));

      expect(
        screen.getByText(/Contract similar privind servicii de consultanță juridică/)
      ).toBeInTheDocument();
      expect(screen.getByText('2024-10-15')).toBeInTheDocument();
    });

    it('handles document click', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      render(<AIAssistantPanel />);

      fireEvent.click(screen.getByText('Documente'));

      const docCard = screen
        .getByText('Contract de Consultanță Juridică - Tech Innovations SRL')
        .closest('div');
      fireEvent.click(docCard!);

      expect(consoleSpy).toHaveBeenCalledWith('Open document:', '1');
      consoleSpy.mockRestore();
    });

    it('renders Romanian diacritics correctly in documents', () => {
      render(<AIAssistantPanel />);

      fireEvent.click(screen.getByText('Documente'));

      expect(screen.getByText(/Consultanță/)).toBeInTheDocument();
      expect(screen.getByText(/consultanță/)).toBeInTheDocument();
    });
  });

  describe('Templates Tab', () => {
    it('renders templates in grid layout', () => {
      render(<AIAssistantPanel />);

      fireEvent.click(screen.getByText('Șabloane'));

      expect(screen.getByText('Contract Prestări Servicii Standard')).toBeInTheDocument();
      expect(screen.getByText('Acord de Confidențialitate (NDA)')).toBeInTheDocument();
      expect(screen.getByText('Contract de Muncă')).toBeInTheDocument();
    });

    it('displays template categories', () => {
      render(<AIAssistantPanel />);

      fireEvent.click(screen.getByText('Șabloane'));

      expect(screen.getAllByText('Contracte').length).toBe(2);
      expect(screen.getByText('Resurse Umane')).toBeInTheDocument();
      expect(screen.getAllByText('Litigii').length).toBe(2);
    });

    it('displays template descriptions', () => {
      render(<AIAssistantPanel />);

      fireEvent.click(screen.getByText('Șabloane'));

      expect(
        screen.getByText('Template standard pentru contract de prestări servicii')
      ).toBeInTheDocument();
      expect(screen.getByText('Acord bilateral de confidențialitate')).toBeInTheDocument();
    });

    it('handles template click', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      render(<AIAssistantPanel />);

      fireEvent.click(screen.getByText('Șabloane'));

      const templateCard = screen.getByText('Contract Prestări Servicii Standard').closest('div');
      fireEvent.click(templateCard!);

      expect(consoleSpy).toHaveBeenCalledWith('Use template:', '1');
      consoleSpy.mockRestore();
    });

    it('renders Romanian diacritics correctly in templates', () => {
      render(<AIAssistantPanel />);

      fireEvent.click(screen.getByText('Șabloane'));

      expect(screen.getByText(/Prestări/)).toBeInTheDocument();
      expect(screen.getByText(/Șabloane/)).toBeInTheDocument();
      expect(screen.getByText(/Apărare/)).toBeInTheDocument();
    });

    it('renders 6 templates total', () => {
      render(<AIAssistantPanel />);

      fireEvent.click(screen.getByText('Șabloane'));

      // Count template cards - each has a unique name
      expect(screen.getByText('Contract Prestări Servicii Standard')).toBeInTheDocument();
      expect(screen.getByText('Acord de Confidențialitate (NDA)')).toBeInTheDocument();
      expect(screen.getByText('Contract de Muncă')).toBeInTheDocument();
      expect(screen.getByText('Memoriu de Apărare')).toBeInTheDocument();
      expect(screen.getByText('Cerere de Chemare în Judecată')).toBeInTheDocument();
      expect(screen.getByText('Acord de Asociere')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for collapse/expand buttons', () => {
      const { rerender } = render(<AIAssistantPanel isCollapsed={true} />);

      expect(screen.getByLabelText('Deschide panoul AI')).toBeInTheDocument();

      rerender(<AIAssistantPanel isCollapsed={false} />);

      expect(screen.getByLabelText('Închide panoul AI')).toBeInTheDocument();
    });

    it('has proper title attributes on buttons', () => {
      const { rerender } = render(<AIAssistantPanel isCollapsed={true} />);

      const expandButton = screen.getByLabelText('Deschide panoul AI');
      expect(expandButton).toHaveAttribute('title', 'Deschide panoul AI');

      rerender(<AIAssistantPanel isCollapsed={false} />);

      const collapseButton = screen.getByLabelText('Închide panoul AI');
      expect(collapseButton).toHaveAttribute('title', 'Închide panoul AI');
    });

    it('tabs are keyboard accessible', () => {
      render(<AIAssistantPanel />);

      const suggestionsTab = screen.getByText('Sugestii');
      const documentsTab = screen.getByText('Documente');

      // Simulate keyboard navigation
      documentsTab.focus();
      fireEvent.click(documentsTab);

      expect(screen.getByText(/% similar/)).toBeInTheDocument();
    });
  });

  describe('Props', () => {
    it('works without onToggleCollapse prop', () => {
      render(<AIAssistantPanel />);

      const collapseButton = screen.getByLabelText('Închide panoul AI');

      // Should not throw error
      expect(() => fireEvent.click(collapseButton)).not.toThrow();
    });

    it('defaults to expanded state', () => {
      render(<AIAssistantPanel />);

      expect(screen.getByText('Sugestii')).toBeInTheDocument();
      expect(screen.getByLabelText('Închide panoul AI')).toBeInTheDocument();
    });
  });
});
