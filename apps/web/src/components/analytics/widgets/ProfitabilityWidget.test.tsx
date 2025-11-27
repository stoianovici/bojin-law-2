/**
 * ProfitabilityWidget Component Tests
 * Story 2.11.4 & 2.11.5: Financial Dashboard UI Testing
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProfitabilityWidget } from './ProfitabilityWidget';
import type { CaseProfitability } from '../../../hooks/useFinancialKPIs';
import type { KPIDelta } from '../../../hooks/useFinancialKPIsComparison';

// Mock Next.js Link component
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href} data-testid="case-link">
      {children}
    </a>
  );
});

describe('ProfitabilityWidget', () => {
  const createMockCases = (count: number): CaseProfitability[] => {
    const cases: CaseProfitability[] = [];
    const billingTypes = ['Hourly', 'Fixed', 'Retainer'];

    for (let i = 0; i < count; i++) {
      cases.push({
        caseId: `case-${i}`,
        caseName: `Case ${i + 1} - Client ABC`,
        billingType: billingTypes[i % 3],
        revenue: 10000 + i * 5000,
        marginPercent: 50 - i * 5, // Descending margins
      });
    }
    return cases;
  };

  const defaultProps = {
    effectiveHourlyRate: 350,
    profitabilityByCase: createMockCases(10),
  };

  describe('Basic Rendering', () => {
    it('renders the widget title', () => {
      render(<ProfitabilityWidget {...defaultProps} />);
      expect(screen.getByText('Profitability')).toBeInTheDocument();
    });

    it('renders effective hourly rate', () => {
      render(<ProfitabilityWidget {...defaultProps} />);
      expect(screen.getByText('Effective Hourly Rate')).toBeInTheDocument();
      expect(screen.getByText('$350.00/hr')).toBeInTheDocument();
    });

    it('renders top performers section', () => {
      render(<ProfitabilityWidget {...defaultProps} />);
      expect(screen.getByText('Top Performers')).toBeInTheDocument();
    });

    it('renders needs attention section for low-margin cases', () => {
      render(<ProfitabilityWidget {...defaultProps} />);
      expect(screen.getByText('Needs Attention')).toBeInTheDocument();
    });

    it('renders case names', () => {
      render(<ProfitabilityWidget {...defaultProps} />);
      expect(screen.getByText('Case 1 - Client ABC')).toBeInTheDocument();
    });

    it('renders billing type badges', () => {
      render(<ProfitabilityWidget {...defaultProps} />);
      expect(screen.getAllByText('Hourly').length).toBeGreaterThan(0);
    });
  });

  describe('Loading State', () => {
    it('shows loading skeleton when isLoading is true', () => {
      render(<ProfitabilityWidget {...defaultProps} isLoading={true} />);
      expect(screen.getByTestId('widget-loading')).toBeInTheDocument();
    });

    it('does not show profitability data when loading', () => {
      render(<ProfitabilityWidget {...defaultProps} isLoading={true} />);
      expect(screen.queryByText('Effective Hourly Rate')).not.toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error message when error is provided', () => {
      const testError = new Error('Failed to fetch profitability');
      render(<ProfitabilityWidget {...defaultProps} error={testError} />);

      expect(screen.getByTestId('widget-error')).toBeInTheDocument();
    });

    it('calls onRetry when retry button clicked', () => {
      const mockRetry = jest.fn();
      const testError = new Error('Network error');

      render(
        <ProfitabilityWidget
          {...defaultProps}
          error={testError}
          onRetry={mockRetry}
        />
      );

      screen.getByRole('button', { name: /retry/i }).click();
      expect(mockRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('Empty State', () => {
    it('shows empty message when no data', () => {
      render(
        <ProfitabilityWidget
          effectiveHourlyRate={0}
          profitabilityByCase={[]}
        />
      );

      expect(screen.getByTestId('widget-empty')).toBeInTheDocument();
      expect(
        screen.getByText('No profitability data for this period')
      ).toBeInTheDocument();
    });
  });

  describe('Delta Badge', () => {
    it('renders delta badge when provided', () => {
      const delta: KPIDelta = {
        absolute: 25,
        percentage: 7.7,
        direction: 'up',
      };

      render(<ProfitabilityWidget {...defaultProps} delta={delta} />);

      expect(screen.getByText('+7.7%')).toBeInTheDocument();
    });

    it('does not render delta when null', () => {
      render(<ProfitabilityWidget {...defaultProps} delta={null} />);

      expect(screen.queryByText(/^\+\d+.*%$/)).not.toBeInTheDocument();
    });
  });

  describe('Case Sorting and Display', () => {
    it('shows top 5 cases as performers', () => {
      const cases = createMockCases(10);
      render(
        <ProfitabilityWidget
          effectiveHourlyRate={350}
          profitabilityByCase={cases}
        />
      );

      // Top performers section should exist
      expect(screen.getByText('Top Performers')).toBeInTheDocument();
    });

    it('shows low-margin cases in needs attention', () => {
      const cases = createMockCases(10);
      render(
        <ProfitabilityWidget
          effectiveHourlyRate={350}
          profitabilityByCase={cases}
        />
      );

      expect(screen.getByText('Needs Attention')).toBeInTheDocument();
    });

    it('does not show needs attention when all cases are profitable', () => {
      const profitableCases: CaseProfitability[] = [
        { caseId: '1', caseName: 'High Margin Case', billingType: 'Hourly', revenue: 10000, marginPercent: 45 },
        { caseId: '2', caseName: 'Good Margin Case', billingType: 'Fixed', revenue: 8000, marginPercent: 35 },
      ];

      render(
        <ProfitabilityWidget
          effectiveHourlyRate={350}
          profitabilityByCase={profitableCases}
        />
      );

      expect(screen.queryByText('Needs Attention')).not.toBeInTheDocument();
    });
  });

  describe('Margin Color Coding', () => {
    it('shows green for high margin cases (>=20%)', () => {
      const highMarginCase: CaseProfitability[] = [
        { caseId: '1', caseName: 'High Margin', billingType: 'Hourly', revenue: 10000, marginPercent: 35 },
      ];

      render(
        <ProfitabilityWidget
          effectiveHourlyRate={350}
          profitabilityByCase={highMarginCase}
        />
      );

      const marginText = screen.getByText('35.0%');
      expect(marginText).toHaveClass('text-green-600');
    });

    it('shows yellow for medium margin cases (0-19%)', () => {
      const mediumMarginCase: CaseProfitability[] = [
        { caseId: '1', caseName: 'Medium Margin', billingType: 'Hourly', revenue: 10000, marginPercent: 15 },
      ];

      render(
        <ProfitabilityWidget
          effectiveHourlyRate={350}
          profitabilityByCase={mediumMarginCase}
        />
      );

      // Case appears in both top performers and needs attention, so use getAllByText
      const marginTexts = screen.getAllByText('15.0%');
      expect(marginTexts.length).toBeGreaterThan(0);
      expect(marginTexts[0]).toHaveClass('text-amber-600');
    });

    it('shows red for negative margin cases (<0%)', () => {
      const negativeMarginCase: CaseProfitability[] = [
        { caseId: '1', caseName: 'Negative Margin', billingType: 'Hourly', revenue: 5000, marginPercent: -10 },
      ];

      render(
        <ProfitabilityWidget
          effectiveHourlyRate={350}
          profitabilityByCase={negativeMarginCase}
        />
      );

      // Case appears in both top performers and needs attention, so use getAllByText
      const marginTexts = screen.getAllByText('-10.0%');
      expect(marginTexts.length).toBeGreaterThan(0);
      expect(marginTexts[0]).toHaveClass('text-red-600');
    });
  });

  describe('Case Links', () => {
    it('renders links to case pages', () => {
      render(<ProfitabilityWidget {...defaultProps} />);

      const caseLinks = screen.getAllByTestId('case-link');
      expect(caseLinks.length).toBeGreaterThan(0);
      expect(caseLinks[0]).toHaveAttribute('href', '/cases/case-0');
    });
  });

  describe('Edge Cases', () => {
    it('handles single case', () => {
      const singleCase: CaseProfitability[] = [
        { caseId: '1', caseName: 'Only Case', billingType: 'Hourly', revenue: 10000, marginPercent: 30 },
      ];

      render(
        <ProfitabilityWidget
          effectiveHourlyRate={350}
          profitabilityByCase={singleCase}
        />
      );

      expect(screen.getByText('Only Case')).toBeInTheDocument();
    });

    it('handles very long case names with truncation', () => {
      const longNameCase: CaseProfitability[] = [
        {
          caseId: '1',
          caseName: 'This is a very long case name that should be truncated in the display',
          billingType: 'Hourly',
          revenue: 10000,
          marginPercent: 30,
        },
      ];

      render(
        <ProfitabilityWidget
          effectiveHourlyRate={350}
          profitabilityByCase={longNameCase}
        />
      );

      const caseName = screen.getByText(/This is a very long case name/);
      expect(caseName).toHaveClass('truncate');
    });

    it('handles zero effective hourly rate', () => {
      render(
        <ProfitabilityWidget
          effectiveHourlyRate={0}
          profitabilityByCase={createMockCases(3)}
        />
      );

      expect(screen.getByText('$0.00/hr')).toBeInTheDocument();
    });

    it('handles very high effective hourly rate', () => {
      render(
        <ProfitabilityWidget
          effectiveHourlyRate={2500}
          profitabilityByCase={createMockCases(3)}
        />
      );

      expect(screen.getByText('$2,500.00/hr')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <ProfitabilityWidget {...defaultProps} className="custom-profitability" />
      );

      expect(container.firstChild).toHaveClass('custom-profitability');
    });

    it('handles all billing types', () => {
      const allTypes: CaseProfitability[] = [
        { caseId: '1', caseName: 'Hourly Case', billingType: 'HOURLY', revenue: 10000, marginPercent: 30 },
        { caseId: '2', caseName: 'Fixed Case', billingType: 'FIXED', revenue: 8000, marginPercent: 25 },
        { caseId: '3', caseName: 'Retainer Case', billingType: 'RETAINER', revenue: 6000, marginPercent: 28 },
      ];

      render(
        <ProfitabilityWidget
          effectiveHourlyRate={350}
          profitabilityByCase={allTypes}
        />
      );

      expect(screen.getByText('HOURLY')).toBeInTheDocument();
      expect(screen.getByText('FIXED')).toBeInTheDocument();
      expect(screen.getByText('RETAINER')).toBeInTheDocument();
    });
  });
});
