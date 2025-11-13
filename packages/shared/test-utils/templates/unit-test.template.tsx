/**
 * UNIT TEST TEMPLATE
 *
 * This template demonstrates best practices for writing unit tests using Jest
 * and React Testing Library (RTL). Unit tests focus on testing isolated pieces
 * of functionality without external dependencies.
 *
 * WHEN TO USE UNIT TESTS:
 * - Testing individual components in isolation
 * - Testing utility functions and helpers
 * - Testing hooks and custom React hooks
 * - Testing business logic and data transformations
 * - Testing state management (stores, reducers)
 *
 * TARGET: 70% of your test suite should be unit tests (Testing Pyramid)
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@legal-platform/test-utils';
import { createUser } from '@legal-platform/test-utils/factories';

// ============================================================================
// EXAMPLE 1: Component Test with React Testing Library
// ============================================================================

/**
 * Component tests should:
 * 1. Test user-visible behavior, not implementation details
 * 2. Use accessible queries (getByRole, getByLabelText) over test IDs
 * 3. Test user interactions (clicks, typing, form submission)
 * 4. Verify rendered output and state changes
 * 5. Mock external dependencies (API calls, context)
 */

// Example component to test
interface UserProfileProps {
  userId: string;
  onSave?: (data: { name: string; email: string }) => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ userId, onSave }) => {
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [isEditing, setIsEditing] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave?.({ name, email });
    setIsEditing(false);
  };

  return (
    <div>
      <h1>User Profile</h1>
      {!isEditing ? (
        <>
          <p>Name: {name || 'Not set'}</p>
          <p>Email: {email || 'Not set'}</p>
          <button onClick={() => setIsEditing(true)}>Edit Profile</button>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          <label htmlFor="name">Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <button type="submit">Save</button>
          <button type="button" onClick={() => setIsEditing(false)}>
            Cancel
          </button>
        </form>
      )}
    </div>
  );
};

// Component test suite
describe('UserProfile Component', () => {
  // -------------------------------------------------------------------------
  // RENDERING TESTS: Verify component renders correctly in different states
  // -------------------------------------------------------------------------

  it('should render profile in view mode by default', () => {
    render(<UserProfile userId="123" />);

    // Use accessible queries (getByRole, getByText)
    expect(screen.getByRole('heading', { name: /user profile/i })).toBeInTheDocument();
    expect(screen.getByText(/name: not set/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit profile/i })).toBeInTheDocument();

    // Form should not be visible
    expect(screen.queryByLabelText(/name/i)).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // INTERACTION TESTS: Verify user interactions work correctly
  // -------------------------------------------------------------------------

  it('should switch to edit mode when edit button is clicked', () => {
    render(<UserProfile userId="123" />);

    const editButton = screen.getByRole('button', { name: /edit profile/i });
    fireEvent.click(editButton);

    // Form should now be visible
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('should update form fields when user types', () => {
    render(<UserProfile userId="123" />);

    // Enter edit mode
    fireEvent.click(screen.getByRole('button', { name: /edit profile/i }));

    // Type in the form fields
    const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement;
    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement;

    fireEvent.change(nameInput, { target: { value: 'John Doe' } });
    fireEvent.change(emailInput, { target: { value: 'john@example.com' } });

    // Verify values updated
    expect(nameInput.value).toBe('John Doe');
    expect(emailInput.value).toBe('john@example.com');
  });

  // -------------------------------------------------------------------------
  // CALLBACK TESTS: Verify callbacks are invoked correctly
  // -------------------------------------------------------------------------

  it('should call onSave with form data when saved', () => {
    const mockOnSave = jest.fn();
    render(<UserProfile userId="123" onSave={mockOnSave} />);

    // Enter edit mode and fill form
    fireEvent.click(screen.getByRole('button', { name: /edit profile/i }));
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Jane Smith' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jane@example.com' } });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    // Verify callback invoked with correct data
    expect(mockOnSave).toHaveBeenCalledTimes(1);
    expect(mockOnSave).toHaveBeenCalledWith({
      name: 'Jane Smith',
      email: 'jane@example.com'
    });
  });

  it('should return to view mode when save is clicked', () => {
    render(<UserProfile userId="123" />);

    fireEvent.click(screen.getByRole('button', { name: /edit profile/i }));
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Test User' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    // Should return to view mode
    expect(screen.queryByLabelText(/name/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit profile/i })).toBeInTheDocument();
  });

  it('should cancel editing when cancel button is clicked', () => {
    render(<UserProfile userId="123" />);

    fireEvent.click(screen.getByRole('button', { name: /edit profile/i }));
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Test' } });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    // Should return to view mode without saving
    expect(screen.queryByLabelText(/name/i)).not.toBeInTheDocument();
  });
});

// ============================================================================
// EXAMPLE 2: Component Test with Providers (Context, Stores, etc.)
// ============================================================================

/**
 * When components depend on context providers (Zustand, React Query, Router),
 * use renderWithProviders() instead of plain render()
 */

interface DashboardProps {
  role: 'Partner' | 'Associate' | 'Paralegal';
}

const Dashboard: React.FC<DashboardProps> = ({ role }) => {
  // In real component, would use useQuery, useStore, etc.
  return (
    <div>
      <h1>{role} Dashboard</h1>
      <p>Welcome to your personalized dashboard</p>
    </div>
  );
};

describe('Dashboard Component (with Providers)', () => {
  it('should render with required providers', () => {
    // Use renderWithProviders for components that need context
    renderWithProviders(<Dashboard role="Partner" />);

    expect(screen.getByRole('heading', { name: /partner dashboard/i })).toBeInTheDocument();
  });

  it('should handle different user roles', () => {
    const { rerender } = renderWithProviders(<Dashboard role="Associate" />);
    expect(screen.getByRole('heading', { name: /associate dashboard/i })).toBeInTheDocument();

    // Rerender with different props
    rerender(<Dashboard role="Paralegal" />);
    expect(screen.getByRole('heading', { name: /paralegal dashboard/i })).toBeInTheDocument();
  });
});

// ============================================================================
// EXAMPLE 3: Service/Utility Function Tests
// ============================================================================

/**
 * Service and utility tests should:
 * 1. Test pure functions in isolation
 * 2. Cover edge cases and error conditions
 * 3. Use descriptive test names that explain the behavior
 * 4. Test input validation and error handling
 * 5. Mock external dependencies (HTTP, database)
 */

// Example utility functions to test
class CaseNumberGenerator {
  /**
   * Generates a Romanian legal case number in format: YYYY/NNNNN/TYP
   * Example: 2024/00042/CIV
   */
  static generate(type: 'CIV' | 'PEN' | 'ADM', year?: number): string {
    const currentYear = year || new Date().getFullYear();
    const randomNum = Math.floor(Math.random() * 100000);
    const paddedNum = String(randomNum).padStart(5, '0');
    return `${currentYear}/${paddedNum}/${type}`;
  }

  static parse(caseNumber: string): { year: number; number: string; type: string } | null {
    const regex = /^(\d{4})\/(\d{5})\/([A-Z]{3})$/;
    const match = caseNumber.match(regex);

    if (!match) return null;

    return {
      year: parseInt(match[1], 10),
      number: match[2],
      type: match[3]
    };
  }

  static validate(caseNumber: string): boolean {
    return this.parse(caseNumber) !== null;
  }
}

// Utility function test suite
describe('CaseNumberGenerator', () => {
  // -------------------------------------------------------------------------
  // GENERATION TESTS: Verify correct format generation
  // -------------------------------------------------------------------------

  describe('generate', () => {
    it('should generate case number in correct format', () => {
      const caseNumber = CaseNumberGenerator.generate('CIV', 2024);

      // Verify format: YYYY/NNNNN/TYP
      expect(caseNumber).toMatch(/^\d{4}\/\d{5}\/[A-Z]{3}$/);
      expect(caseNumber).toContain('2024');
      expect(caseNumber).toContain('CIV');
    });

    it('should use current year when year not provided', () => {
      const currentYear = new Date().getFullYear();
      const caseNumber = CaseNumberGenerator.generate('PEN');

      expect(caseNumber).toContain(String(currentYear));
    });

    it('should pad case number with leading zeros', () => {
      // Mock Math.random to return predictable value
      const spy = jest.spyOn(Math, 'random').mockReturnValue(0.00042);

      const caseNumber = CaseNumberGenerator.generate('ADM', 2024);

      expect(caseNumber).toBe('2024/00042/ADM');

      spy.mockRestore();
    });

    it('should handle different case types', () => {
      const civilCase = CaseNumberGenerator.generate('CIV', 2024);
      const penalCase = CaseNumberGenerator.generate('PEN', 2024);
      const adminCase = CaseNumberGenerator.generate('ADM', 2024);

      expect(civilCase).toContain('CIV');
      expect(penalCase).toContain('PEN');
      expect(adminCase).toContain('ADM');
    });
  });

  // -------------------------------------------------------------------------
  // PARSING TESTS: Verify correct parsing logic
  // -------------------------------------------------------------------------

  describe('parse', () => {
    it('should parse valid case number', () => {
      const result = CaseNumberGenerator.parse('2024/00042/CIV');

      expect(result).toEqual({
        year: 2024,
        number: '00042',
        type: 'CIV'
      });
    });

    it('should return null for invalid format', () => {
      expect(CaseNumberGenerator.parse('invalid')).toBeNull();
      expect(CaseNumberGenerator.parse('2024-00042-CIV')).toBeNull();
      expect(CaseNumberGenerator.parse('2024/42/CIV')).toBeNull(); // Not padded
      expect(CaseNumberGenerator.parse('24/00042/CIV')).toBeNull(); // 2-digit year
    });

    it('should handle edge cases', () => {
      expect(CaseNumberGenerator.parse('')).toBeNull();
      expect(CaseNumberGenerator.parse('2024/00000/CIV')).not.toBeNull(); // Zero is valid
    });
  });

  // -------------------------------------------------------------------------
  // VALIDATION TESTS: Verify validation logic
  // -------------------------------------------------------------------------

  describe('validate', () => {
    it('should return true for valid case numbers', () => {
      expect(CaseNumberGenerator.validate('2024/00042/CIV')).toBe(true);
      expect(CaseNumberGenerator.validate('2023/99999/PEN')).toBe(true);
      expect(CaseNumberGenerator.validate('2025/00001/ADM')).toBe(true);
    });

    it('should return false for invalid case numbers', () => {
      expect(CaseNumberGenerator.validate('invalid')).toBe(false);
      expect(CaseNumberGenerator.validate('2024/42/CIV')).toBe(false);
      expect(CaseNumberGenerator.validate('2024/00042/CIVIL')).toBe(false); // 4 chars
    });
  });
});

// ============================================================================
// EXAMPLE 4: Testing Async Functions
// ============================================================================

/**
 * For async tests:
 * 1. Use async/await in test functions
 * 2. Use waitFor() for async state updates
 * 3. Mock async dependencies (API calls)
 * 4. Test loading and error states
 */

interface FetchCaseResult {
  data?: { id: string; title: string };
  loading: boolean;
  error?: string;
}

const fetchCase = async (caseId: string): Promise<FetchCaseResult> => {
  try {
    // Simulate API call
    const response = await fetch(`/api/cases/${caseId}`);
    const data = await response.json();
    return { data, loading: false };
  } catch (error) {
    return { loading: false, error: 'Failed to fetch case' };
  }
};

describe('fetchCase (Async)', () => {
  // Mock fetch globally
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should fetch case successfully', async () => {
    const mockCase = { id: '123', title: 'Test Case' };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockCase
    });

    const result = await fetchCase('123');

    expect(result).toEqual({
      data: mockCase,
      loading: false
    });
    expect(global.fetch).toHaveBeenCalledWith('/api/cases/123');
  });

  it('should handle fetch errors', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const result = await fetchCase('123');

    expect(result).toEqual({
      loading: false,
      error: 'Failed to fetch case'
    });
  });
});

// ============================================================================
// EXAMPLE 5: Testing Custom Hooks
// ============================================================================

/**
 * Test custom hooks using renderHook from @testing-library/react
 */

import { renderHook, act } from '@testing-library/react';

const useCounter = (initialValue = 0) => {
  const [count, setCount] = React.useState(initialValue);

  const increment = () => setCount(prev => prev + 1);
  const decrement = () => setCount(prev => prev - 1);
  const reset = () => setCount(initialValue);

  return { count, increment, decrement, reset };
};

describe('useCounter Hook', () => {
  it('should initialize with default value', () => {
    const { result } = renderHook(() => useCounter());
    expect(result.current.count).toBe(0);
  });

  it('should initialize with custom value', () => {
    const { result } = renderHook(() => useCounter(10));
    expect(result.current.count).toBe(10);
  });

  it('should increment count', () => {
    const { result } = renderHook(() => useCounter());

    act(() => {
      result.current.increment();
    });

    expect(result.current.count).toBe(1);
  });

  it('should decrement count', () => {
    const { result } = renderHook(() => useCounter(5));

    act(() => {
      result.current.decrement();
    });

    expect(result.current.count).toBe(4);
  });

  it('should reset to initial value', () => {
    const { result } = renderHook(() => useCounter(10));

    act(() => {
      result.current.increment();
      result.current.increment();
      result.current.reset();
    });

    expect(result.current.count).toBe(10);
  });
});

// ============================================================================
// TESTING BEST PRACTICES CHECKLIST
// ============================================================================

/**
 * ✅ DO:
 * - Test behavior, not implementation
 * - Use accessible queries (getByRole, getByLabelText)
 * - Test user interactions and workflows
 * - Mock external dependencies
 * - Write descriptive test names
 * - Group related tests in describe blocks
 * - Clean up after tests (restore mocks)
 * - Test edge cases and error conditions
 * - Keep tests focused and isolated
 *
 * ❌ DON'T:
 * - Test implementation details (state, internal methods)
 * - Use test IDs unless absolutely necessary
 * - Write tests that depend on other tests
 * - Test framework/library code
 * - Use real API calls or database connections
 * - Write overly complex test setup
 * - Skip error cases
 * - Test too many things in one test
 */

/**
 * QUERY PRIORITY (React Testing Library):
 * 1. getByRole - Most accessible, prefer this
 * 2. getByLabelText - Good for form fields
 * 3. getByPlaceholderText - For inputs without labels
 * 4. getByText - For non-interactive text
 * 5. getByDisplayValue - Current form field value
 * 6. getByAltText - For images
 * 7. getByTitle - For title attributes
 * 8. getByTestId - Last resort only
 */

/**
 * COVERAGE TARGETS:
 * - Statements: 80%+
 * - Branches: 80%+
 * - Functions: 80%+
 * - Lines: 80%+
 *
 * Run: pnpm test:coverage
 */
