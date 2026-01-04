/**
 * Editor Toolbar Component
 * Provides formatting controls for the document editor
 */

'use client';

import React from 'react';
import * as Toolbar from '@radix-ui/react-toolbar';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

export interface EditorToolbarProps {
  onFormatClick?: (format: 'bold' | 'italic' | 'underline' | 'strikethrough') => void;
  onAlignClick?: (alignment: 'left' | 'center' | 'right' | 'justify') => void;
  onHeadingChange?: (heading: 'h1' | 'h2' | 'h3' | 'normal') => void;
  onInsertClick?: (type: 'table' | 'image' | 'link' | 'signature') => void;
  onVersionHistoryClick?: () => void;
}

export function EditorToolbar({
  onFormatClick,
  onAlignClick,
  onHeadingChange,
  onInsertClick,
  onVersionHistoryClick,
}: EditorToolbarProps) {
  const [selectedHeading, setSelectedHeading] = React.useState<string>('Normal');

  const handleHeadingChange = (value: 'h1' | 'h2' | 'h3' | 'normal') => {
    const labels = {
      h1: 'Titlu 1',
      h2: 'Titlu 2',
      h3: 'Titlu 3',
      normal: 'Normal',
    };
    setSelectedHeading(labels[value]);
    onHeadingChange?.(value);
  };

  return (
    <div className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
      <Toolbar.Root
        className="flex flex-wrap items-center gap-2 px-4 py-2"
        aria-label="Opțiuni formatare document"
      >
        {/* Formatting Buttons Group */}
        <Toolbar.ToggleGroup
          type="multiple"
          className="flex items-center gap-1 bg-white border border-gray-300 rounded-lg p-1"
          aria-label="Formatare text"
        >
          <Toolbar.ToggleItem
            value="bold"
            className="flex items-center justify-center w-8 h-8 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 data-[state=on]:bg-blue-100 data-[state=on]:text-blue-700"
            aria-label="Aldină"
            title="Aldină (Ctrl+B)"
            onClick={() => onFormatClick?.('bold')}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M11.49 3.17c-.38-.31-.85-.47-1.33-.47H4.67c-.27 0-.49.22-.49.49v13.4c0 .28.22.49.49.49h5.99c.64 0 1.23-.22 1.67-.63.45-.42.7-1 .7-1.61 0-.65-.23-1.26-.65-1.69.43-.41.68-1 .68-1.63 0-.58-.21-1.11-.57-1.52.37-.42.59-.97.59-1.57 0-.64-.24-1.22-.67-1.63.44-.41.69-1 .69-1.62 0-.64-.24-1.22-.67-1.63zM6.96 5.1h2.5c.28 0 .5.23.5.5s-.22.5-.5.5h-2.5c-.28 0-.5-.23-.5-.5s.22-.5.5-.5zm3.5 9.5h-3.5c-.28 0-.5-.23-.5-.5s.22-.5.5-.5h3.5c.28 0 .5.23.5.5s-.22.5-.5.5zm.5-3.5h-4c-.28 0-.5-.23-.5-.5s.22-.5.5-.5h4c.28 0 .5.23.5.5s-.22.5-.5.5z" />
            </svg>
          </Toolbar.ToggleItem>

          <Toolbar.ToggleItem
            value="italic"
            className="flex items-center justify-center w-8 h-8 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 data-[state=on]:bg-blue-100 data-[state=on]:text-blue-700"
            aria-label="Cursiv"
            title="Cursiv (Ctrl+I)"
            onClick={() => onFormatClick?.('italic')}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.537 3.5h3.8c.275 0 .5.225.5.5s-.225.5-.5.5h-1.163l-2.537 11h1.163c.275 0 .5.225.5.5s-.225.5-.5.5h-3.8c-.275 0-.5-.225-.5-.5s.225-.5.5-.5h1.163l2.537-11H10.537c-.275 0-.5-.225-.5-.5s.225-.5.5-.5z" />
            </svg>
          </Toolbar.ToggleItem>

          <Toolbar.ToggleItem
            value="underline"
            className="flex items-center justify-center w-8 h-8 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 data-[state=on]:bg-blue-100 data-[state=on]:text-blue-700"
            aria-label="Subliniat"
            title="Subliniat (Ctrl+U)"
            onClick={() => onFormatClick?.('underline')}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 3c-2.21 0-4 1.79-4 4v6c0 2.21 1.79 4 4 4s4-1.79 4-4V7c0-2.21-1.79-4-4-4zm2 10c0 1.1-.9 2-2 2s-2-.9-2-2V7c0-1.1.9-2 2-2s2 .9 2 2v6zm-6 3h8c.28 0 .5.22.5.5s-.22.5-.5.5H6c-.28 0-.5-.22-.5-.5s.22-.5.5-.5z" />
            </svg>
          </Toolbar.ToggleItem>

          <Toolbar.ToggleItem
            value="strikethrough"
            className="flex items-center justify-center w-8 h-8 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 data-[state=on]:bg-blue-100 data-[state=on]:text-blue-700"
            aria-label="Tăiat"
            title="Tăiat"
            onClick={() => onFormatClick?.('strikethrough')}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 3c-2.76 0-5 2.24-5 5 0 .28.22.5.5.5s.5-.22.5-.5c0-2.21 1.79-4 4-4s4 1.79 4 4c0 1.11-.45 2.11-1.18 2.83-.32.32-.69.57-1.07.77H15c.28 0 .5.22.5.5s-.22.5-.5.5H5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5h3.25c-.38-.2-.75-.45-1.07-.77C6.45 10.11 6 9.11 6 8c0-2.76 2.24-5 5-5zm-4 11c0 2.21 1.79 4 4 4s4-1.79 4-4h-1c0 1.66-1.34 3-3 3s-3-1.34-3-3H6z" />
            </svg>
          </Toolbar.ToggleItem>
        </Toolbar.ToggleGroup>

        <Toolbar.Separator className="w-px h-6 bg-gray-300" />

        {/* Text Alignment Group */}
        <Toolbar.ToggleGroup
          type="single"
          className="flex items-center gap-1 bg-white border border-gray-300 rounded-lg p-1"
          aria-label="Aliniere text"
        >
          <Toolbar.ToggleItem
            value="left"
            className="flex items-center justify-center w-8 h-8 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 data-[state=on]:bg-blue-100 data-[state=on]:text-blue-700"
            aria-label="Aliniere stânga"
            title="Aliniere stânga"
            onClick={() => onAlignClick?.('left')}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 4h14c.28 0 .5.22.5.5s-.22.5-.5.5H3c-.28 0-.5-.22-.5-.5s.22-.5.5-.5zm0 3h10c.28 0 .5.22.5.5s-.22.5-.5.5H3c-.28 0-.5-.22-.5-.5s.22-.5.5-.5zm0 3h14c.28 0 .5.22.5.5s-.22.5-.5.5H3c-.28 0-.5-.22-.5-.5s.22-.5.5-.5zm0 3h10c.28 0 .5.22.5.5s-.22.5-.5.5H3c-.28 0-.5-.22-.5-.5s.22-.5.5-.5z" />
            </svg>
          </Toolbar.ToggleItem>

          <Toolbar.ToggleItem
            value="center"
            className="flex items-center justify-center w-8 h-8 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 data-[state=on]:bg-blue-100 data-[state=on]:text-blue-700"
            aria-label="Aliniere centru"
            title="Aliniere centru"
            onClick={() => onAlignClick?.('center')}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 4h14c.28 0 .5.22.5.5s-.22.5-.5.5H3c-.28 0-.5-.22-.5-.5s.22-.5.5-.5zm2 3h10c.28 0 .5.22.5.5s-.22.5-.5.5H5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5zm-2 3h14c.28 0 .5.22.5.5s-.22.5-.5.5H3c-.28 0-.5-.22-.5-.5s.22-.5.5-.5zm2 3h10c.28 0 .5.22.5.5s-.22.5-.5.5H5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5z" />
            </svg>
          </Toolbar.ToggleItem>

          <Toolbar.ToggleItem
            value="right"
            className="flex items-center justify-center w-8 h-8 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 data-[state=on]:bg-blue-100 data-[state=on]:text-blue-700"
            aria-label="Aliniere dreapta"
            title="Aliniere dreapta"
            onClick={() => onAlignClick?.('right')}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 4h14c.28 0 .5.22.5.5s-.22.5-.5.5H3c-.28 0-.5-.22-.5-.5s.22-.5.5-.5zm4 3h10c.28 0 .5.22.5.5s-.22.5-.5.5H7c-.28 0-.5-.22-.5-.5s.22-.5.5-.5zm-4 3h14c.28 0 .5.22.5.5s-.22.5-.5.5H3c-.28 0-.5-.22-.5-.5s.22-.5.5-.5zm4 3h10c.28 0 .5.22.5.5s-.22.5-.5.5H7c-.28 0-.5-.22-.5-.5s.22-.5.5-.5z" />
            </svg>
          </Toolbar.ToggleItem>

          <Toolbar.ToggleItem
            value="justify"
            className="flex items-center justify-center w-8 h-8 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 data-[state=on]:bg-blue-100 data-[state=on]:text-blue-700"
            aria-label="Aliniere stânga-dreapta"
            title="Aliniere stânga-dreapta"
            onClick={() => onAlignClick?.('justify')}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 4h14c.28 0 .5.22.5.5s-.22.5-.5.5H3c-.28 0-.5-.22-.5-.5s.22-.5.5-.5zm0 3h14c.28 0 .5.22.5.5s-.22.5-.5.5H3c-.28 0-.5-.22-.5-.5s.22-.5.5-.5zm0 3h14c.28 0 .5.22.5.5s-.22.5-.5.5H3c-.28 0-.5-.22-.5-.5s.22-.5.5-.5zm0 3h14c.28 0 .5.22.5.5s-.22.5-.5.5H3c-.28 0-.5-.22-.5-.5s.22-.5.5-.5z" />
            </svg>
          </Toolbar.ToggleItem>
        </Toolbar.ToggleGroup>

        <Toolbar.Separator className="w-px h-6 bg-gray-300" />

        {/* Heading Dropdown */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Toolbar.Button
              className="flex items-center gap-2 px-3 h-8 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium text-gray-700"
              aria-label="Selectează nivel titlu"
            >
              {selectedHeading}
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </Toolbar.Button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="min-w-[160px] bg-white rounded-lg border border-gray-200 shadow-lg p-1 z-50"
              sideOffset={5}
            >
              <DropdownMenu.Item
                className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded cursor-pointer outline-none"
                onSelect={() => handleHeadingChange('normal')}
              >
                Normal
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="flex items-center px-3 py-2 text-lg font-bold text-gray-700 hover:bg-gray-100 rounded cursor-pointer outline-none"
                onSelect={() => handleHeadingChange('h1')}
              >
                Titlu 1
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="flex items-center px-3 py-2 text-base font-bold text-gray-700 hover:bg-gray-100 rounded cursor-pointer outline-none"
                onSelect={() => handleHeadingChange('h2')}
              >
                Titlu 2
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="flex items-center px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100 rounded cursor-pointer outline-none"
                onSelect={() => handleHeadingChange('h3')}
              >
                Titlu 3
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <Toolbar.Separator className="w-px h-6 bg-gray-300" />

        {/* Insert Menu */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Toolbar.Button
              className="flex items-center gap-2 px-3 h-8 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium text-gray-700"
              aria-label="Inserează element"
            >
              Inserează
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </Toolbar.Button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="min-w-[180px] bg-white rounded-lg border border-gray-200 shadow-lg p-1 z-50"
              sideOffset={5}
            >
              <DropdownMenu.Item
                className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded cursor-pointer outline-none"
                onSelect={() => onInsertClick?.('table')}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 4c0-.55.45-1 1-1h12c.55 0 1 .45 1 1v12c0 .55-.45 1-1 1H4c-.55 0-1-.45-1-1V4zm2 0v4h4V4H5zm5 0v4h5V4h-5zM5 9v3h4V9H5zm5 0v3h5V9h-5zM5 13v3h4v-3H5zm5 0v3h5v-3h-5z" />
                </svg>
                Tabel
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded cursor-pointer outline-none"
                onSelect={() => onInsertClick?.('image')}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                    clipRule="evenodd"
                  />
                </svg>
                Imagine
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded cursor-pointer outline-none"
                onSelect={() => onInsertClick?.('link')}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z"
                    clipRule="evenodd"
                  />
                </svg>
                Link
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="h-px bg-gray-200 my-1" />
              <DropdownMenu.Item
                className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded cursor-pointer outline-none"
                onSelect={() => onInsertClick?.('signature')}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
                Bloc semnătură
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <Toolbar.Separator className="w-px h-6 bg-gray-300" />

        {/* Version History Button */}
        <Toolbar.Button
          className="flex items-center gap-2 px-3 h-8 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium text-gray-700"
          onClick={onVersionHistoryClick}
          aria-label="Istoric versiuni"
          title="Istoric versiuni"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
              clipRule="evenodd"
            />
          </svg>
          <span className="hidden sm:inline">Istoric</span>
        </Toolbar.Button>
      </Toolbar.Root>
    </div>
  );
}
