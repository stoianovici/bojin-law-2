/**
 * MentionAutocomplete Component
 * Story 4.6: Task Collaboration and Updates (AC: 1)
 *
 * Textarea with @mention autocomplete functionality
 */

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface MentionAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}

const SEARCH_USERS = gql`
  query SearchUsersForMention($query: String!) {
    searchUsersForMention(query: $query) {
      id
      firstName
      lastName
      email
    }
  }
`;

export function MentionAutocomplete({
  value,
  onChange,
  placeholder,
  autoFocus,
  disabled,
}: MentionAutocompleteProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { data } = useQuery<{ searchUsersForMention: User[] }>(SEARCH_USERS, {
    variables: { query: searchQuery },
    skip: searchQuery.length < 1,
  });

  const users = data?.searchUsersForMention || [];

  // Detect @mention typing
  const detectMention = useCallback((text: string, position: number) => {
    // Look backwards from cursor for @ symbol
    const beforeCursor = text.slice(0, position);
    const mentionMatch = beforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setSearchQuery(mentionMatch[1]);
      setShowDropdown(true);
      setSelectedIndex(0);
    } else {
      setShowDropdown(false);
      setSearchQuery('');
    }
  }, []);

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const position = e.target.selectionStart || 0;

    onChange(newValue);
    setCursorPosition(position);
    detectMention(newValue, position);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showDropdown || users.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % users.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + users.length) % users.length);
        break;
      case 'Enter':
      case 'Tab':
        if (showDropdown) {
          e.preventDefault();
          selectUser(users[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        break;
    }
  };

  // Select user from dropdown
  const selectUser = (user: User) => {
    const beforeCursor = value.slice(0, cursorPosition);
    const afterCursor = value.slice(cursorPosition);

    // Find the @ symbol position
    const mentionStart = beforeCursor.lastIndexOf('@');
    const beforeMention = value.slice(0, mentionStart);
    const username = `${user.firstName.toLowerCase()}.${user.lastName.toLowerCase()}`;

    // Replace the partial mention with the full username
    const newValue = `${beforeMention}@${username} ${afterCursor}`;
    onChange(newValue);

    setShowDropdown(false);
    setSearchQuery('');

    // Move cursor to after the mention
    const newPosition = mentionStart + username.length + 2; // +2 for @ and space
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = newPosition;
        textareaRef.current.selectionEnd = newPosition;
        textareaRef.current.focus();
      }
    }, 0);
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(80, textareaRef.current.scrollHeight)}px`;
    }
  }, [value]);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        rows={3}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:text-gray-500"
      />

      {/* Autocomplete dropdown */}
      {showDropdown && users.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto"
        >
          {users.map((user, index) => (
            <button
              key={user.id}
              type="button"
              onClick={() => selectUser(user)}
              className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-gray-50 ${
                index === selectedIndex ? 'bg-blue-50' : ''
              }`}
            >
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-medium">
                {user.firstName[0]}
                {user.lastName[0]}
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {user.firstName} {user.lastName}
                </div>
                <div className="text-xs text-gray-500">{user.email}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Loading state */}
      {showDropdown && searchQuery && users.length === 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 px-3 py-2 text-sm text-gray-500">
          {searchQuery.length < 1 ? 'Tastează pentru a căuta...' : 'Niciun utilizator găsit'}
        </div>
      )}
    </div>
  );
}

export default MentionAutocomplete;
