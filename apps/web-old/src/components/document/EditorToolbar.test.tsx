/**
 * EditorToolbar Unit Tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditorToolbar } from './EditorToolbar';

describe('EditorToolbar', () => {
  const mockHandlers = {
    onFormatClick: jest.fn(),
    onAlignClick: jest.fn(),
    onHeadingChange: jest.fn(),
    onInsertClick: jest.fn(),
    onVersionHistoryClick: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders toolbar with all control groups', () => {
    render(<EditorToolbar {...mockHandlers} />);

    // Check toolbar is present
    expect(screen.getByLabelText('Opțiuni formatare document')).toBeInTheDocument();
  });

  describe('Format Buttons', () => {
    it('calls onFormatClick with "bold" when bold button is clicked', () => {
      render(<EditorToolbar {...mockHandlers} />);

      const boldButton = screen.getByLabelText('Aldină');
      fireEvent.click(boldButton);

      expect(mockHandlers.onFormatClick).toHaveBeenCalledWith('bold');
      expect(mockHandlers.onFormatClick).toHaveBeenCalledTimes(1);
    });

    it('calls onFormatClick with "italic" when italic button is clicked', () => {
      render(<EditorToolbar {...mockHandlers} />);

      const italicButton = screen.getByLabelText('Cursiv');
      fireEvent.click(italicButton);

      expect(mockHandlers.onFormatClick).toHaveBeenCalledWith('italic');
      expect(mockHandlers.onFormatClick).toHaveBeenCalledTimes(1);
    });

    it('calls onFormatClick with "underline" when underline button is clicked', () => {
      render(<EditorToolbar {...mockHandlers} />);

      const underlineButton = screen.getByLabelText('Subliniat');
      fireEvent.click(underlineButton);

      expect(mockHandlers.onFormatClick).toHaveBeenCalledWith('underline');
      expect(mockHandlers.onFormatClick).toHaveBeenCalledTimes(1);
    });

    it('calls onFormatClick with "strikethrough" when strikethrough button is clicked', () => {
      render(<EditorToolbar {...mockHandlers} />);

      const strikethroughButton = screen.getByLabelText('Tăiat');
      fireEvent.click(strikethroughButton);

      expect(mockHandlers.onFormatClick).toHaveBeenCalledWith('strikethrough');
      expect(mockHandlers.onFormatClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Alignment Buttons', () => {
    it('calls onAlignClick with "left" when left align button is clicked', () => {
      render(<EditorToolbar {...mockHandlers} />);

      const leftButton = screen.getByLabelText('Aliniere stânga');
      fireEvent.click(leftButton);

      expect(mockHandlers.onAlignClick).toHaveBeenCalledWith('left');
      expect(mockHandlers.onAlignClick).toHaveBeenCalledTimes(1);
    });

    it('calls onAlignClick with "center" when center align button is clicked', () => {
      render(<EditorToolbar {...mockHandlers} />);

      const centerButton = screen.getByLabelText('Aliniere centru');
      fireEvent.click(centerButton);

      expect(mockHandlers.onAlignClick).toHaveBeenCalledWith('center');
      expect(mockHandlers.onAlignClick).toHaveBeenCalledTimes(1);
    });

    it('calls onAlignClick with "right" when right align button is clicked', () => {
      render(<EditorToolbar {...mockHandlers} />);

      const rightButton = screen.getByLabelText('Aliniere dreapta');
      fireEvent.click(rightButton);

      expect(mockHandlers.onAlignClick).toHaveBeenCalledWith('right');
      expect(mockHandlers.onAlignClick).toHaveBeenCalledTimes(1);
    });

    it('calls onAlignClick with "justify" when justify button is clicked', () => {
      render(<EditorToolbar {...mockHandlers} />);

      const justifyButton = screen.getByLabelText('Aliniere stânga-dreapta');
      fireEvent.click(justifyButton);

      expect(mockHandlers.onAlignClick).toHaveBeenCalledWith('justify');
      expect(mockHandlers.onAlignClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Heading Dropdown', () => {
    it('renders heading dropdown with default "Normal" text', () => {
      render(<EditorToolbar {...mockHandlers} />);

      expect(screen.getByText('Normal')).toBeInTheDocument();
    });

    it('calls onHeadingChange when heading option is selected', () => {
      render(<EditorToolbar {...mockHandlers} />);

      // Click dropdown trigger
      const dropdownTrigger = screen.getByLabelText('Selectează nivel titlu');
      fireEvent.click(dropdownTrigger);

      // Click "Titlu 1" option
      const h1Option = screen.getByText('Titlu 1');
      fireEvent.click(h1Option);

      expect(mockHandlers.onHeadingChange).toHaveBeenCalledWith('h1');
    });
  });

  describe('Insert Menu', () => {
    it('renders insert menu button', () => {
      render(<EditorToolbar {...mockHandlers} />);

      expect(screen.getByLabelText('Inserează element')).toBeInTheDocument();
    });

    it('calls onInsertClick with "table" when table option is selected', () => {
      render(<EditorToolbar {...mockHandlers} />);

      // Click insert menu
      const insertButton = screen.getByLabelText('Inserează element');
      fireEvent.click(insertButton);

      // Click table option
      const tableOption = screen.getByText('Tabel');
      fireEvent.click(tableOption);

      expect(mockHandlers.onInsertClick).toHaveBeenCalledWith('table');
    });

    it('calls onInsertClick with "image" when image option is selected', () => {
      render(<EditorToolbar {...mockHandlers} />);

      const insertButton = screen.getByLabelText('Inserează element');
      fireEvent.click(insertButton);

      const imageOption = screen.getByText('Imagine');
      fireEvent.click(imageOption);

      expect(mockHandlers.onInsertClick).toHaveBeenCalledWith('image');
    });

    it('calls onInsertClick with "link" when link option is selected', () => {
      render(<EditorToolbar {...mockHandlers} />);

      const insertButton = screen.getByLabelText('Inserează element');
      fireEvent.click(insertButton);

      const linkOption = screen.getByText('Link');
      fireEvent.click(linkOption);

      expect(mockHandlers.onInsertClick).toHaveBeenCalledWith('link');
    });

    it('calls onInsertClick with "signature" when signature block option is selected', () => {
      render(<EditorToolbar {...mockHandlers} />);

      const insertButton = screen.getByLabelText('Inserează element');
      fireEvent.click(insertButton);

      const signatureOption = screen.getByText('Bloc semnătură');
      fireEvent.click(signatureOption);

      expect(mockHandlers.onInsertClick).toHaveBeenCalledWith('signature');
    });
  });

  describe('Version History Button', () => {
    it('renders version history button', () => {
      render(<EditorToolbar {...mockHandlers} />);

      expect(screen.getByLabelText('Istoric versiuni')).toBeInTheDocument();
    });

    it('calls onVersionHistoryClick when version history button is clicked', () => {
      render(<EditorToolbar {...mockHandlers} />);

      const historyButton = screen.getByLabelText('Istoric versiuni');
      fireEvent.click(historyButton);

      expect(mockHandlers.onVersionHistoryClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Romanian Diacritics', () => {
    it('renders Romanian text with diacritics correctly', () => {
      render(<EditorToolbar {...mockHandlers} />);

      // Check for Romanian diacritics in labels
      expect(screen.getByLabelText('Aldină')).toBeInTheDocument();
      expect(screen.getByLabelText('Aliniere stânga')).toBeInTheDocument();
      expect(screen.getByLabelText('Tăiat')).toBeInTheDocument();
      expect(screen.getByText('Inserează')).toBeInTheDocument();
      expect(screen.getByText('Bloc semnătură')).toBeInTheDocument();
    });
  });

  describe('Toolbar Stickiness', () => {
    it('has sticky positioning class', () => {
      const { container } = render(<EditorToolbar {...mockHandlers} />);

      const toolbar = container.querySelector('.sticky');
      expect(toolbar).toBeInTheDocument();
    });
  });
});
