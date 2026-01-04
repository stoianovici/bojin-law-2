/**
 * Comments/Review Sidebar Component
 * Collapsible sidebar for document comments and collaboration
 */

'use client';

import React from 'react';

export interface Comment {
  id: string;
  author: {
    name: string;
    avatar?: string;
  };
  text: string;
  timestamp: string;
  lineNumber?: number;
  resolved?: boolean;
}

export interface CommentsSidebarProps {
  isOpen?: boolean;
  onToggle?: () => void;
  comments?: Comment[];
  onAddComment?: (text: string) => void;
  onResolveComment?: (commentId: string) => void;
  onReplyComment?: (commentId: string, text: string) => void;
}

// Mock comments data
const MOCK_COMMENTS: Comment[] = [
  {
    id: '1',
    author: {
      name: 'Elena Popescu',
      avatar: undefined,
    },
    text: 'Onorariul ar trebui să fie negociat. Propun să rămână la 4.500 EUR până la evaluarea trimestrială.',
    timestamp: '2 ore',
    lineNumber: 21,
    resolved: false,
  },
  {
    id: '2',
    author: {
      name: 'Mihai Bojin',
      avatar: undefined,
    },
    text: 'Am adăugat clauza de prelungire automată pentru continuitate. Vă rog să confirmați dacă este acceptabilă.',
    timestamp: 'Ieri',
    lineNumber: 17,
    resolved: false,
  },
  {
    id: '3',
    author: {
      name: 'Ana Ionescu',
      avatar: undefined,
    },
    text: 'Perfectă adăugarea serviciilor GDPR. Aceasta era o cerință esențială pentru noi.',
    timestamp: '2 zile',
    lineNumber: 10,
    resolved: true,
  },
  {
    id: '4',
    author: {
      name: 'Andrei Vlad',
      avatar: undefined,
    },
    text: 'Ar trebui specificat mai clar ce înseamnă "cheltuieli suplimentare". Putem adăuga câteva exemple?',
    timestamp: '3 zile',
    lineNumber: 24,
    resolved: false,
  },
];

export function CommentsSidebar({
  isOpen = false,
  onToggle,
  comments = MOCK_COMMENTS,
  onAddComment,
  onResolveComment,
  onReplyComment,
}: CommentsSidebarProps) {
  const [newCommentText, setNewCommentText] = React.useState('');
  const [showAddComment, setShowAddComment] = React.useState(false);

  const handleAddComment = () => {
    if (newCommentText.trim()) {
      onAddComment?.(newCommentText);
      setNewCommentText('');
      setShowAddComment(false);
    }
  };

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    return parts
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const activeComments = comments.filter((c) => !c.resolved);
  const resolvedComments = comments.filter((c) => c.resolved);

  if (!isOpen) {
    return (
      <div className="flex items-center justify-center w-12 bg-gray-50 border-l border-gray-200">
        <button
          onClick={onToggle}
          className="flex flex-col items-center gap-2 p-2 text-gray-600 hover:text-gray-900 transition-colors"
          aria-label="Deschide comentarii"
          title="Deschide comentarii"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
            />
          </svg>
          {activeComments.length > 0 && (
            <span className="flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
              {activeComments.length}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-80 h-full bg-white border-l border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900">Comentarii</h2>
          {activeComments.length > 0 && (
            <span className="flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-red-500 rounded-full">
              {activeComments.length}
            </span>
          )}
        </div>
        <button
          onClick={onToggle}
          className="p-1 rounded hover:bg-gray-200 transition-colors"
          aria-label="Închide comentarii"
          title="Închide comentarii"
        >
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Add Comment Button */}
      <div className="px-4 py-3 border-b border-gray-200">
        {!showAddComment ? (
          <button
            onClick={() => setShowAddComment(true)}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Adaugă comentariu
          </button>
        ) : (
          <div className="space-y-2">
            <textarea
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              placeholder="Scrie un comentariu..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
              autoFocus
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddComment}
                className="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
              >
                Adaugă
              </button>
              <button
                onClick={() => {
                  setShowAddComment(false);
                  setNewCommentText('');
                }}
                className="flex-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                Anulează
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto">
        {comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <svg
              className="w-16 h-16 text-gray-300 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
              />
            </svg>
            <h3 className="text-sm font-medium text-gray-900 mb-1">Niciun comentariu încă</h3>
            <p className="text-xs text-gray-500">Adaugă primul comentariu pentru acest document</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {/* Active Comments */}
            {activeComments.length > 0 && (
              <div className="p-4 space-y-4">
                {activeComments.map((comment) => (
                  <div
                    key={comment.id}
                    className="p-3 bg-gray-50 border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-start gap-3 mb-2">
                      {/* Avatar */}
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold text-white">
                        {getInitials(comment.author.name)}
                      </div>

                      {/* Comment Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-sm font-semibold text-gray-900">
                            {comment.author.name}
                          </span>
                          <span className="text-xs text-gray-500">{comment.timestamp}</span>
                        </div>

                        {comment.lineNumber && (
                          <div className="flex items-center gap-1 mb-2">
                            <svg
                              className="w-3 h-3 text-gray-400"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <span className="text-xs text-gray-500">
                              Linia {comment.lineNumber}
                            </span>
                          </div>
                        )}

                        <p className="text-sm text-gray-700 mb-3">{comment.text}</p>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onResolveComment?.(comment.id)}
                            className="px-2 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded hover:bg-green-100 transition-colors"
                          >
                            Rezolvat
                          </button>
                          <button
                            onClick={() => onReplyComment?.(comment.id, '')}
                            className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                          >
                            Răspunde
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Resolved Comments */}
            {resolvedComments.length > 0 && (
              <div className="p-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Rezolvate ({resolvedComments.length})
                </h3>
                <div className="space-y-3">
                  {resolvedComments.map((comment) => (
                    <div
                      key={comment.id}
                      className="p-3 bg-green-50 border border-green-200 rounded-lg opacity-75"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-xs font-bold text-white">
                          {getInitials(comment.author.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-sm font-semibold text-gray-900">
                              {comment.author.name}
                            </span>
                            <span className="text-xs text-gray-500">{comment.timestamp}</span>
                          </div>
                          <p className="text-sm text-gray-700">{comment.text}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
