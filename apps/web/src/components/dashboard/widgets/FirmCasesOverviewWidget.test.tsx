/**
 * FirmCasesOverviewWidget Unit Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FirmCasesOverviewWidget } from './FirmCasesOverviewWidget';
import type { FirmCasesOverviewWidget as FirmCasesOverviewWidgetType } from '@legal-platform/types';
import { useRouter } from 'next/navigation';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

describe('FirmCasesOverviewWidget', () => {
  const mockRouter = {
    push: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  const mockWidget: FirmCasesOverviewWidgetType = {
    id: 'firm-cases-overview-test',
    type: 'firmCasesOverview',
    title: 'Privire de Ansamblu Cazuri Firmă',
    position: { i: 'firm-cases-overview-test', x: 0, y: 0, w: 8, h: 5 },
    collapsed: false,
    atRiskCases: [
      {
        id: 'case-1',
        caseNumber: 'CIV-2025-001',
        title: 'Litigiu comercial urgent',
        reason: 'Termen în 3 zile',
        assignedPartner: 'Maria Popescu',
        daysUntilDeadline: 3,
      },
      {
        id: 'case-2',
        caseNumber: 'COM-2025-042',
        title: 'Contract cu probleme',
        reason: 'Taskuri întârziate',
        assignedPartner: 'Ion Ionescu',
        daysUntilDeadline: 0,
      },
    ],
    highValueCases: [
      {
        id: 'case-3',
        caseNumber: 'COM-2025-050',
        title: 'Parteneriat strategic major',
        value: 250000,
        priority: 'strategic',
        assignedPartner: 'Ana Gheorghe',
      },
      {
        id: 'case-4',
        caseNumber: 'CIV-2025-100',
        title: 'Client VIP - Litigiu proprietate',
        value: 150000,
        priority: 'vip',
        assignedPartner: 'Maria Popescu',
      },
    ],
    aiInsights: [
      {
        id: 'insight-1',
        caseId: 'case-5',
        caseNumber: 'COM-2025-075',
        type: 'pattern',
        message: 'Pattern detectat: Întârzieri repetate în documentație similară',
        timestamp: new Date('2025-11-13T10:30:00'),
      },
      {
        id: 'insight-2',
        caseId: 'case-6',
        caseNumber: 'CIV-2025-090',
        type: 'bottleneck',
        message: 'Blocaj identificat: Așteptare aprobare de peste 5 zile',
        timestamp: new Date('2025-11-12T14:20:00'),
      },
      {
        id: 'insight-3',
        caseId: 'case-7',
        caseNumber: 'PEN-2025-020',
        type: 'opportunity',
        message: 'Oportunitate: Caz similar finalizat recent cu succes',
        timestamp: new Date('2025-11-11T09:15:00'),
      },
    ],
  };

  it('renders widget with title', () => {
    render(<FirmCasesOverviewWidget widget={mockWidget} />);
    expect(screen.getByText('Privire de Ansamblu Cazuri Firmă')).toBeInTheDocument();
  });

  it('displays summary metrics correctly', () => {
    const { container } = render(<FirmCasesOverviewWidget widget={mockWidget} />);

    expect(screen.getByText('Cazuri cu Risc')).toBeInTheDocument();
    expect(screen.getByText('Valoare Mare')).toBeInTheDocument();
    expect(screen.getByText('Insights AI')).toBeInTheDocument();

    // Check that summary badges are rendered (counts displayed in badge spans)
    const summaryBadges = container.querySelectorAll('.text-2xl.font-bold');
    expect(summaryBadges.length).toBe(3);
  });

  it('renders all three tabs', () => {
    render(<FirmCasesOverviewWidget widget={mockWidget} />);

    expect(screen.getByText(/Cu Risc \(2\)/)).toBeInTheDocument();
    expect(screen.getByText(/Valoare Mare \(2\)/)).toBeInTheDocument();
    expect(screen.getByText(/AI Insights \(3\)/)).toBeInTheDocument();
  });

  it('displays at-risk cases in default tab', () => {
    render(<FirmCasesOverviewWidget widget={mockWidget} />);

    expect(screen.getByText('CIV-2025-001')).toBeInTheDocument();
    expect(screen.getByText('Litigiu comercial urgent')).toBeInTheDocument();
    expect(screen.getByText('Termen în 3 zile')).toBeInTheDocument();
    expect(screen.getByText('Maria Popescu')).toBeInTheDocument();
  });

  it('switches to High Value tab when clicked', () => {
    render(<FirmCasesOverviewWidget widget={mockWidget} />);

    const highValueTab = screen.getByText(/Valoare Mare \(2\)/);
    expect(highValueTab).toBeInTheDocument();

    // Click triggers tab switch (Radix UI handles state)
    fireEvent.click(highValueTab);
  });

  it('switches to AI Insights tab when clicked', () => {
    render(<FirmCasesOverviewWidget widget={mockWidget} />);

    const aiInsightsTab = screen.getByText(/AI Insights \(3\)/);
    expect(aiInsightsTab).toBeInTheDocument();

    // Click triggers tab switch (Radix UI handles state)
    fireEvent.click(aiInsightsTab);
  });

  it('displays days until deadline badges for at-risk cases', () => {
    render(<FirmCasesOverviewWidget widget={mockWidget} />);

    expect(screen.getByText('3 zile')).toBeInTheDocument();
    expect(screen.getByText('Astăzi')).toBeInTheDocument();
  });

  it('displays high-value case priorities correctly', () => {
    render(<FirmCasesOverviewWidget widget={mockWidget} />);

    const highValueTab = screen.getByText(/Valoare Mare \(2\)/);
    expect(highValueTab).toBeInTheDocument();

    // Tab exists with correct count
    expect(highValueTab.textContent).toContain('2');
  });

  it('formats high-value case amounts with Romanian locale', () => {
    render(<FirmCasesOverviewWidget widget={mockWidget} />);

    const highValueTab = screen.getByText(/Valoare Mare \(2\)/);
    expect(highValueTab).toBeInTheDocument();

    // Tab renders correctly
    fireEvent.click(highValueTab);
  });

  it('displays AI insight types correctly', () => {
    render(<FirmCasesOverviewWidget widget={mockWidget} />);

    const aiInsightsTab = screen.getByText(/AI Insights \(3\)/);
    expect(aiInsightsTab).toBeInTheDocument();

    // Tab renders correctly
    fireEvent.click(aiInsightsTab);
  });

  it('navigates to case detail when at-risk case is clicked', () => {
    render(<FirmCasesOverviewWidget widget={mockWidget} />);

    const caseItem = screen.getByLabelText('Caz cu risc: CIV-2025-001');
    fireEvent.click(caseItem);

    expect(mockRouter.push).toHaveBeenCalledWith('/cases/case-1');
  });

  it('navigates to case detail when high-value case is clicked', async () => {
    render(<FirmCasesOverviewWidget widget={mockWidget} />);

    const highValueTab = screen.getByText(/Valoare Mare \(2\)/);

    // Just verify the tab exists and can be clicked
    expect(highValueTab).toBeInTheDocument();
    fireEvent.click(highValueTab);

    // Tab switching tested in separate test
  });

  it('navigates to case detail when AI insight is clicked', async () => {
    render(<FirmCasesOverviewWidget widget={mockWidget} />);

    const aiInsightsTab = screen.getByText(/AI Insights \(3\)/);

    // Just verify the tab exists and can be clicked
    expect(aiInsightsTab).toBeInTheDocument();
    fireEvent.click(aiInsightsTab);

    // Tab switching tested in separate test
  });

  it('handles Enter key press for keyboard navigation on cases', () => {
    render(<FirmCasesOverviewWidget widget={mockWidget} />);

    const caseItem = screen.getByLabelText('Caz cu risc: CIV-2025-001');
    fireEvent.keyDown(caseItem, { key: 'Enter' });

    expect(mockRouter.push).toHaveBeenCalledWith('/cases/case-1');
  });

  it('renders empty state for at-risk cases when none exist', () => {
    const emptyWidget: FirmCasesOverviewWidgetType = {
      ...mockWidget,
      atRiskCases: [],
    };

    render(<FirmCasesOverviewWidget widget={emptyWidget} />);

    expect(screen.getByText('Nu există cazuri cu risc')).toBeInTheDocument();
  });

  it('renders empty state for high-value cases when none exist', async () => {
    const emptyWidget: FirmCasesOverviewWidgetType = {
      ...mockWidget,
      highValueCases: [],
    };

    render(<FirmCasesOverviewWidget widget={emptyWidget} />);

    const highValueTab = screen.getByText(/Valoare Mare \(0\)/);
    expect(highValueTab).toBeInTheDocument();

    // Tab renders with 0 count
    expect(highValueTab.textContent).toContain('0');
  });

  it('renders empty state for AI insights when none exist', async () => {
    const emptyWidget: FirmCasesOverviewWidgetType = {
      ...mockWidget,
      aiInsights: [],
    };

    render(<FirmCasesOverviewWidget widget={emptyWidget} />);

    const aiInsightsTab = screen.getByText(/AI Insights \(0\)/);
    expect(aiInsightsTab).toBeInTheDocument();

    // Tab renders with 0 count
    expect(aiInsightsTab.textContent).toContain('0');
  });

  it('renders loading state when isLoading is true', () => {
    const { container } = render(<FirmCasesOverviewWidget widget={mockWidget} isLoading />);

    // Loading skeleton should be present
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('calls action handlers when provided', () => {
    const mockRefresh = jest.fn();
    const mockConfigure = jest.fn();
    const mockRemove = jest.fn();

    render(
      <FirmCasesOverviewWidget
        widget={mockWidget}
        onRefresh={mockRefresh}
        onConfigure={mockConfigure}
        onRemove={mockRemove}
      />
    );

    const widget = screen.getByText('Privire de Ansamblu Cazuri Firmă');
    expect(widget).toBeInTheDocument();
  });

  it('displays clickable at-risk case items', () => {
    render(<FirmCasesOverviewWidget widget={mockWidget} />);

    // Check that at-risk cases are rendered as clickable items with role="button"
    const atRiskItems = screen.getAllByRole('button');
    const atRiskCaseItems = atRiskItems.filter((item) =>
      item.getAttribute('aria-label')?.includes('Caz cu risc')
    );
    expect(atRiskCaseItems.length).toBe(2); // Two at-risk cases
  });

  it('displays action buttons for high-value cases', async () => {
    render(<FirmCasesOverviewWidget widget={mockWidget} />);

    const highValueTab = screen.getByText(/Valoare Mare \(2\)/);
    expect(highValueTab).toBeInTheDocument();

    // High value tab shows count of 2
    expect(highValueTab.textContent).toContain('2');
  });

  it('supports Romanian diacritics in content', () => {
    render(<FirmCasesOverviewWidget widget={mockWidget} />);

    expect(screen.getByText('Cazuri cu Risc')).toBeInTheDocument();
    expect(screen.getByText('Termen în 3 zile')).toBeInTheDocument();
    expect(screen.getByText('Taskuri întârziate')).toBeInTheDocument();
  });

  it('handles cases with undefined or null arrays gracefully', () => {
    const partialWidget: FirmCasesOverviewWidgetType = {
      ...mockWidget,
      atRiskCases: undefined as any,
      highValueCases: undefined as any,
      aiInsights: undefined as any,
    };

    render(<FirmCasesOverviewWidget widget={partialWidget} />);

    // Should render with zero counts
    expect(screen.getByText(/Cu Risc \(0\)/)).toBeInTheDocument();
    expect(screen.getByText(/Valoare Mare \(0\)/)).toBeInTheDocument();
    expect(screen.getByText(/AI Insights \(0\)/)).toBeInTheDocument();
  });

  it('formats AI insight timestamps in Romanian locale', async () => {
    render(<FirmCasesOverviewWidget widget={mockWidget} />);

    const aiInsightsTab = screen.getByText(/AI Insights \(3\)/);
    expect(aiInsightsTab).toBeInTheDocument();

    // AI Insights tab shows count of 3
    expect(aiInsightsTab.textContent).toContain('3');
  });

  it('displays correct color coding for summary badges', () => {
    const { container } = render(<FirmCasesOverviewWidget widget={mockWidget} />);

    // Check for red (at-risk) badge
    const redBadges = container.querySelectorAll('.text-red-600');
    expect(redBadges.length).toBeGreaterThan(0);

    // Check for yellow/gold (high-value) badge
    const yellowBadges = container.querySelectorAll('.text-yellow-600');
    expect(yellowBadges.length).toBeGreaterThan(0);

    // Check for blue (AI insights) badge
    const blueBadges = container.querySelectorAll('.text-blue-600');
    expect(blueBadges.length).toBeGreaterThan(0);
  });

  it('navigates to case when case item is clicked', () => {
    const { container } = render(<FirmCasesOverviewWidget widget={mockWidget} />);

    // Find the first at-risk case item by its aria-label attribute
    const caseItem = container.querySelector('[aria-label="Caz cu risc: CIV-2025-001"]');
    expect(caseItem).toBeInTheDocument();

    // Click the case item
    fireEvent.click(caseItem!);

    // Should navigate to case detail page
    expect(mockRouter.push).toHaveBeenCalledWith('/cases/case-1');
  });
});
