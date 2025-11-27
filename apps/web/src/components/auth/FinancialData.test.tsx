/**
 * FinancialData Component Tests
 * Story 2.8.3: Role-Based Financial Visibility
 */

import { render, screen } from '@testing-library/react';
import { FinancialData } from './FinancialData';
import { useFinancialAccess } from '@/hooks/useFinancialAccess';

// Mock the useFinancialAccess hook
jest.mock('@/hooks/useFinancialAccess');

const mockUseFinancialAccess = useFinancialAccess as jest.MockedFunction<
  typeof useFinancialAccess
>;

describe('FinancialData Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when user has financial access (Partner)', () => {
    beforeEach(() => {
      mockUseFinancialAccess.mockReturnValue({
        hasFinancialAccess: true,
        userRole: 'Partner',
      });
    });

    it('renders children', () => {
      render(
        <FinancialData>
          <div data-testid="financial-content">Financial Data</div>
        </FinancialData>
      );

      expect(screen.getByTestId('financial-content')).toBeInTheDocument();
      expect(screen.getByText('Financial Data')).toBeInTheDocument();
    });

    it('renders complex children', () => {
      render(
        <FinancialData>
          <div>
            <h1>Billing Information</h1>
            <p>Case Value: $50,000</p>
            <button>Edit</button>
          </div>
        </FinancialData>
      );

      expect(screen.getByText('Billing Information')).toBeInTheDocument();
      expect(screen.getByText('Case Value: $50,000')).toBeInTheDocument();
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('ignores fallback when access granted', () => {
      render(
        <FinancialData fallback={<div data-testid="fallback">Restricted</div>}>
          <div data-testid="financial-content">Financial Data</div>
        </FinancialData>
      );

      expect(screen.getByTestId('financial-content')).toBeInTheDocument();
      expect(screen.queryByTestId('fallback')).not.toBeInTheDocument();
    });
  });

  describe('when user lacks financial access (Associate/Paralegal)', () => {
    beforeEach(() => {
      mockUseFinancialAccess.mockReturnValue({
        hasFinancialAccess: false,
        userRole: 'Associate',
      });
    });

    it('does not render children', () => {
      render(
        <FinancialData>
          <div data-testid="financial-content">Financial Data</div>
        </FinancialData>
      );

      expect(screen.queryByTestId('financial-content')).not.toBeInTheDocument();
      expect(screen.queryByText('Financial Data')).not.toBeInTheDocument();
    });

    it('renders nothing by default', () => {
      const { container } = render(
        <FinancialData>
          <div>Financial Data</div>
        </FinancialData>
      );

      // Should render nothing (null)
      expect(container.firstChild).toBeNull();
    });

    it('renders fallback when provided', () => {
      render(
        <FinancialData fallback={<div data-testid="fallback">Restricted</div>}>
          <div data-testid="financial-content">Financial Data</div>
        </FinancialData>
      );

      expect(screen.getByTestId('fallback')).toBeInTheDocument();
      expect(screen.getByText('Restricted')).toBeInTheDocument();
      expect(screen.queryByTestId('financial-content')).not.toBeInTheDocument();
    });

    it('renders null fallback explicitly', () => {
      const { container } = render(
        <FinancialData fallback={null}>
          <div>Financial Data</div>
        </FinancialData>
      );

      expect(container.firstChild).toBeNull();
    });

    it('renders custom fallback component', () => {
      const CustomFallback = () => (
        <div data-testid="custom-fallback">
          <p>Access Denied</p>
          <button>Request Access</button>
        </div>
      );

      render(
        <FinancialData fallback={<CustomFallback />}>
          <div data-testid="financial-content">Financial Data</div>
        </FinancialData>
      );

      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
      expect(screen.getByText('Access Denied')).toBeInTheDocument();
      expect(screen.getByText('Request Access')).toBeInTheDocument();
      expect(screen.queryByTestId('financial-content')).not.toBeInTheDocument();
    });
  });

  describe('integration scenarios', () => {
    it('hides financial table column for Associates', () => {
      mockUseFinancialAccess.mockReturnValue({
        hasFinancialAccess: false,
        userRole: 'Associate',
      });

      render(
        <table>
          <thead>
            <tr>
              <th>Case Number</th>
              <FinancialData>
                <th data-testid="value-header">Case Value</th>
              </FinancialData>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>CASE-001</td>
              <FinancialData>
                <td data-testid="value-cell">$50,000</td>
              </FinancialData>
            </tr>
          </tbody>
        </table>
      );

      expect(screen.getByText('Case Number')).toBeInTheDocument();
      expect(screen.getByText('CASE-001')).toBeInTheDocument();
      expect(screen.queryByTestId('value-header')).not.toBeInTheDocument();
      expect(screen.queryByTestId('value-cell')).not.toBeInTheDocument();
    });

    it('shows financial table column for Partners', () => {
      mockUseFinancialAccess.mockReturnValue({
        hasFinancialAccess: true,
        userRole: 'Partner',
      });

      render(
        <table>
          <thead>
            <tr>
              <th>Case Number</th>
              <FinancialData>
                <th data-testid="value-header">Case Value</th>
              </FinancialData>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>CASE-001</td>
              <FinancialData>
                <td data-testid="value-cell">$50,000</td>
              </FinancialData>
            </tr>
          </tbody>
        </table>
      );

      expect(screen.getByText('Case Number')).toBeInTheDocument();
      expect(screen.getByText('CASE-001')).toBeInTheDocument();
      expect(screen.getByTestId('value-header')).toBeInTheDocument();
      expect(screen.getByTestId('value-cell')).toBeInTheDocument();
    });

    it('hides entire billing section for non-Partners', () => {
      mockUseFinancialAccess.mockReturnValue({
        hasFinancialAccess: false,
        userRole: 'Paralegal',
      });

      render(
        <div>
          <h1>Case Details</h1>
          <section>
            <h2>General Information</h2>
            <p>Case Title: Smith vs Jones</p>
          </section>
          <FinancialData>
            <section data-testid="billing-section">
              <h2>Billing Information</h2>
              <p>Case Value: $50,000</p>
              <p>Billing Type: Hourly</p>
              <p>Rate: $350/hour</p>
            </section>
          </FinancialData>
        </div>
      );

      expect(screen.getByText('Case Details')).toBeInTheDocument();
      expect(screen.getByText('General Information')).toBeInTheDocument();
      expect(screen.getByText('Case Title: Smith vs Jones')).toBeInTheDocument();
      expect(screen.queryByTestId('billing-section')).not.toBeInTheDocument();
      expect(screen.queryByText('Billing Information')).not.toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles null children', () => {
      mockUseFinancialAccess.mockReturnValue({
        hasFinancialAccess: true,
        userRole: 'Partner',
      });

      const { container } = render(<FinancialData>{null}</FinancialData>);

      expect(container.firstChild).toBeNull();
    });

    it('handles undefined children', () => {
      mockUseFinancialAccess.mockReturnValue({
        hasFinancialAccess: true,
        userRole: 'Partner',
      });

      const { container } = render(<FinancialData>{undefined}</FinancialData>);

      expect(container.firstChild).toBeNull();
    });

    it('handles multiple children', () => {
      mockUseFinancialAccess.mockReturnValue({
        hasFinancialAccess: true,
        userRole: 'Partner',
      });

      render(
        <FinancialData>
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
          <div data-testid="child-3">Child 3</div>
        </FinancialData>
      );

      expect(screen.getByTestId('child-1')).toBeInTheDocument();
      expect(screen.getByTestId('child-2')).toBeInTheDocument();
      expect(screen.getByTestId('child-3')).toBeInTheDocument();
    });
  });
});
