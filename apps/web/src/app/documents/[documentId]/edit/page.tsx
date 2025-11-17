/**
 * Document Editor Page
 * Full-featured document editing interface with AI assistance
 * Route: /documents/[documentId]/edit
 */

'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { clsx } from 'clsx';
// TODO: Revert to @ alias when Next.js/Turbopack path resolution is fixed
import { useDocumentEditorStore } from '../../../../stores/document-editor.store';
import { EditorToolbar } from '../../../../components/document/EditorToolbar';
import { DocumentEditor } from '../../../../components/document/DocumentEditor';
import { AIAssistantPanel } from '../../../../components/document/AIAssistantPanel';
import { CommentsSidebar } from '../../../../components/document/CommentsSidebar';
import { VersionComparison } from '../../../../components/document/VersionComparison';
import { CommandBar } from '../../../../components/document/CommandBar';

interface DocumentEditorPageProps {
  params: Promise<{
    documentId: string;
  }>;
}

/**
 * Document Editor Page Component
 *
 * Displays a full-featured document editor with:
 * - Editor toolbar with formatting options
 * - Split-screen layout (editor + AI panel)
 * - Comments sidebar for collaboration
 * - Version comparison view
 * - Natural language command bar
 */
export default function DocumentEditorPage({ params }: DocumentEditorPageProps) {
  const { documentId } = React.use(params);

  const {
    isAIPanelCollapsed,
    isCommentsSidebarOpen,
    activeView,
    toggleAIPanel,
    toggleCommentsSidebar,
    setActiveView,
    setCurrentDocument,
  } = useDocumentEditorStore();

  const [documentContent, setDocumentContent] = useState('');
  const [formatting, setFormatting] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
  });
  const [alignment, setAlignment] = useState<'left' | 'center' | 'right' | 'justify'>('left');
  const [heading, setHeading] = useState<'h1' | 'h2' | 'h3' | 'normal'>('normal');

  // Memoize version dates to avoid calling Date functions during render
  const versionDates = useMemo(
    () => ({
      // eslint-disable-next-line react-hooks/purity
      previous: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),

      current: new Date().toISOString(),
    }),
    []
  );

  // Load document metadata
  useEffect(() => {
    setCurrentDocument({
      id: documentId,
      title: 'Contract de Prestări Servicii Juridice',
      type: 'Contract',
      status: 'Draft',
      lastModified: new Date(),
      author: 'Mihai Bojin',
    });
  }, [documentId, setCurrentDocument]);

  // Toolbar handlers
  const handleFormatClick = (format: 'bold' | 'italic' | 'underline' | 'strikethrough') => {
    setFormatting((prev) => ({
      ...prev,
      [format]: !prev[format],
    }));
  };

  const handleAlignClick = (newAlignment: 'left' | 'center' | 'right' | 'justify') => {
    setAlignment(newAlignment);
  };

  const handleHeadingChange = (newHeading: 'h1' | 'h2' | 'h3' | 'normal') => {
    setHeading(newHeading);
  };

  const handleInsertClick = (type: 'table' | 'image' | 'link' | 'signature') => {
    console.log(`Insert ${type}`);
    // Mock implementation - in real app would show insert dialog
  };

  const handleVersionHistoryClick = () => {
    setActiveView(activeView === 'version-comparison' ? 'editor' : 'version-comparison');
  };

  const handleCommandSubmit = (command: string) => {
    console.log('Command submitted:', command);
    // Mock implementation - in real app would process AI command
  };

  // Render version comparison view
  if (activeView === 'version-comparison') {
    return (
      <div className="h-screen flex flex-col bg-gray-50">
        {/* Toolbar */}
        <EditorToolbar
          onFormatClick={handleFormatClick}
          onAlignClick={handleAlignClick}
          onHeadingChange={handleHeadingChange}
          onInsertClick={handleInsertClick}
          onVersionHistoryClick={handleVersionHistoryClick}
        />

        {/* Version Comparison View */}
        <div className="flex-1 overflow-hidden">
          <VersionComparison
            previousVersion={{
              info: {
                versionNumber: 1,
                date: versionDates.previous,
                author: 'Elena Popescu',
              },
              content: documentContent,
            }}
            currentVersion={{
              info: {
                versionNumber: 2,
                date: versionDates.current,
                author: 'Mihai Bojin',
              },
              content: documentContent,
            }}
          />
        </div>
      </div>
    );
  }

  // Render editor view
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Toolbar */}
      <EditorToolbar
        onFormatClick={handleFormatClick}
        onAlignClick={handleAlignClick}
        onHeadingChange={handleHeadingChange}
        onInsertClick={handleInsertClick}
        onVersionHistoryClick={handleVersionHistoryClick}
      />

      {/* Main Content Area - Split Screen Layout */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left Side - Document Editor */}
        <div
          className={clsx(
            'flex flex-col transition-all duration-300',
            isAIPanelCollapsed ? 'flex-1' : 'w-[60%]',
            isCommentsSidebarOpen && 'mr-80'
          )}
        >
          {/* Editor Area */}
          <div className="flex-1 overflow-y-auto bg-white shadow-sm">
            <DocumentEditor
              content={documentContent}
              onContentChange={setDocumentContent}
              formatting={formatting}
              alignment={alignment}
              heading={heading}
            />
          </div>

          {/* Command Bar - Fixed at bottom of editor */}
          <div className="border-t border-gray-200 bg-white">
            <CommandBar onCommandSubmit={handleCommandSubmit} />
          </div>
        </div>

        {/* Right Side - AI Assistant Panel */}
        {!isAIPanelCollapsed && (
          <div className="w-[40%] border-l border-gray-200 bg-gray-50">
            <AIAssistantPanel isCollapsed={isAIPanelCollapsed} onToggleCollapse={toggleAIPanel} />
          </div>
        )}

        {/* Comments Sidebar - Overlays from right */}
        {isCommentsSidebarOpen && (
          <div className="fixed right-0 top-0 bottom-0 w-80 bg-white border-l border-gray-200 shadow-lg z-20">
            <CommentsSidebar isOpen={isCommentsSidebarOpen} onToggle={toggleCommentsSidebar} />
          </div>
        )}

        {/* Toggle Buttons */}
        <div className="fixed bottom-20 right-4 flex flex-col gap-2 z-30">
          {/* Toggle AI Panel */}
          <button
            onClick={toggleAIPanel}
            className="relative p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors"
            aria-label={isAIPanelCollapsed ? 'Arată panoul AI' : 'Ascunde panoul AI'}
            title={isAIPanelCollapsed ? 'Arată panoul AI' : 'Ascunde panoul AI'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isAIPanelCollapsed ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              )}
            </svg>
          </button>

          {/* Toggle Comments Sidebar */}
          <button
            onClick={toggleCommentsSidebar}
            className={clsx(
              'relative p-3 rounded-full shadow-lg transition-colors',
              isCommentsSidebarOpen
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-600 text-white hover:bg-gray-700'
            )}
            aria-label={isCommentsSidebarOpen ? 'Ascunde comentariile' : 'Arată comentariile'}
            title={isCommentsSidebarOpen ? 'Ascunde comentariile' : 'Arată comentariile'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
              />
            </svg>
            {isCommentsSidebarOpen && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                3
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
