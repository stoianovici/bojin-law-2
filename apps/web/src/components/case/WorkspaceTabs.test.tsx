/**
 * WorkspaceTabs Component Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { WorkspaceTabs, TabContent } from './WorkspaceTabs';
import { useCaseWorkspaceStore } from '../../stores/case-workspace.store';

// Mock the store
jest.mock('../../stores/case-workspace.store', () => ({
  useCaseWorkspaceStore: jest.fn(),
}));

describe('WorkspaceTabs', () => {
  const mockSetActiveTab = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useCaseWorkspaceStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({
        activeTab: 'overview',
        setActiveTab: mockSetActiveTab,
        aiPanelCollapsed: false,
        quickActionsVisible: true,
        selectedCaseId: null,
        toggleAIPanel: jest.fn(),
        toggleQuickActions: jest.fn(),
        setSelectedCase: jest.fn(),
      })
    );
  });

  it('renders all 6 tabs', () => {
    render(<WorkspaceTabs />);

    expect(screen.getByText('Prezentare Generală')).toBeInTheDocument();
    expect(screen.getByText('Documente')).toBeInTheDocument();
    expect(screen.getByText('Sarcini')).toBeInTheDocument();
    expect(screen.getByText('Comunicări')).toBeInTheDocument();
    expect(screen.getByText('Înregistrări Timp')).toBeInTheDocument();
    expect(screen.getByText('Notițe')).toBeInTheDocument();
  });

  it('shows active tab with correct styling', () => {
    render(<WorkspaceTabs />);

    const overviewTab = screen.getByText('Prezentare Generală').closest('button');
    expect(overviewTab).toHaveAttribute('data-state', 'active');
  });

  it('renders tabs as clickable buttons', () => {
    render(<WorkspaceTabs />);

    const documentsTab = screen.getByText('Documente').closest('button');
    expect(documentsTab).toBeInTheDocument();
    expect(documentsTab).not.toBeDisabled();
  });

  it('renders with different active tab from store', () => {
    (useCaseWorkspaceStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({
        activeTab: 'tasks',
        setActiveTab: mockSetActiveTab,
        aiPanelCollapsed: false,
        quickActionsVisible: true,
        selectedCaseId: null,
        toggleAIPanel: jest.fn(),
        toggleQuickActions: jest.fn(),
        setSelectedCase: jest.fn(),
      })
    );

    render(<WorkspaceTabs />);

    const tasksTab = screen.getByText('Sarcini').closest('button');
    expect(tasksTab).toHaveAttribute('data-state', 'active');
  });

  it('renders tab content correctly', () => {
    render(
      <WorkspaceTabs>
        <TabContent value="overview">
          <div>Overview content</div>
        </TabContent>
        <TabContent value="documents">
          <div>Documents content</div>
        </TabContent>
      </WorkspaceTabs>
    );

    // Overview should be visible (active tab)
    expect(screen.getByText('Overview content')).toBeInTheDocument();
  });

  it('switches between tab contents', () => {
    (useCaseWorkspaceStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({
        activeTab: 'documents',
        setActiveTab: mockSetActiveTab,
        aiPanelCollapsed: false,
        quickActionsVisible: true,
        selectedCaseId: null,
        toggleAIPanel: jest.fn(),
        toggleQuickActions: jest.fn(),
        setSelectedCase: jest.fn(),
      })
    );

    render(
      <WorkspaceTabs>
        <TabContent value="overview">
          <div>Overview content</div>
        </TabContent>
        <TabContent value="documents">
          <div>Documents content</div>
        </TabContent>
      </WorkspaceTabs>
    );

    // Documents should be visible (active tab)
    expect(screen.getByText('Documents content')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<WorkspaceTabs className="custom-class" />);

    const tabsRoot = container.firstChild;
    expect(tabsRoot).toHaveClass('custom-class');
  });

  it('has proper accessibility attributes', () => {
    render(<WorkspaceTabs />);

    const tabList = screen.getByRole('tablist');
    expect(tabList).toHaveAttribute('aria-label', 'Workspace tabs');
  });

  it('renders icons for each tab', () => {
    const { container } = render(<WorkspaceTabs />);

    const svgElements = container.querySelectorAll('svg');
    expect(svgElements.length).toBeGreaterThanOrEqual(6); // At least one icon per tab
  });
});

describe('TabContent', () => {
  const mockSetActiveTab = jest.fn();

  beforeEach(() => {
    (useCaseWorkspaceStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({
        activeTab: 'overview',
        setActiveTab: mockSetActiveTab,
        aiPanelCollapsed: false,
        quickActionsVisible: true,
        selectedCaseId: null,
        toggleAIPanel: jest.fn(),
        toggleQuickActions: jest.fn(),
        setSelectedCase: jest.fn(),
      })
    );
  });

  it('renders children correctly', () => {
    render(
      <WorkspaceTabs>
        <TabContent value="overview">
          <div>Test content</div>
        </TabContent>
      </WorkspaceTabs>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('applies custom className to TabContent', () => {
    const { container } = render(
      <WorkspaceTabs>
        <TabContent value="overview" className="custom-content-class">
          <div>Test content</div>
        </TabContent>
      </WorkspaceTabs>
    );

    const tabContent = container.querySelector('.custom-content-class');
    expect(tabContent).toBeInTheDocument();
  });
});
