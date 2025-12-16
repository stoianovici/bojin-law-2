import React, { type ReactElement } from 'react';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';

/**
 * Options for customizing the test providers
 */
export interface TestProvidersOptions {
  /**
   * Initial route for router context
   * Will be used when Next.js router provider is implemented
   */
  initialRoute?: string;

  /**
   * Initial state for Zustand stores
   * Will be used when Zustand stores are implemented
   */
  initialStoreState?: Record<string, unknown>;

  /**
   * Custom Query Client configuration
   * Will be used when React Query is implemented
   */
  queryClientConfig?: Record<string, unknown>;

  /**
   * Theme mode (light/dark)
   * Will be used when theme provider is implemented
   */
  themeMode?: 'light' | 'dark';

  /**
   * Locale for internationalization
   * Default: 'ro-RO' (Romanian)
   */
  locale?: string;
}

/**
 * Create a wrapper component with all necessary providers
 *
 * NOTE: This is currently a placeholder implementation that provides a simple div wrapper.
 * As providers are implemented in the application, extend this function to include them.
 *
 * Future implementation example:
 * ```tsx
 * import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
 * import { ThemeProvider } from '@/contexts/ThemeContext';
 * import { AppRouterMock } from 'next/router';
 *
 * function createTestProviders(options: TestProvidersOptions = {}) {
 *   const queryClient = new QueryClient({
 *     defaultOptions: { queries: { retry: false }, ...options.queryClientConfig }
 *   });
 *
 *   return ({ children }) => (
 *     <QueryClientProvider client={queryClient}>
 *       <ThemeProvider mode={options.themeMode}>
 *         <AppRouterMock initialRoute={options.initialRoute}>
 *           {children}
 *         </AppRouterMock>
 *       </ThemeProvider>
 *     </QueryClientProvider>
 *   );
 * }
 * ```
 */
function createTestProviders(options: TestProvidersOptions = {}) {
  const { initialRoute = '/', themeMode = 'light', locale = 'ro-RO' } = options;

  /**
   * Placeholder wrapper component
   *
   * TODO: Replace with actual providers as they are implemented:
   * - [ ] Add QueryClientProvider when React Query is configured
   * - [ ] Add Zustand store providers when stores are created
   * - [ ] Add Next.js router mock when routing is implemented
   * - [ ] Add ThemeProvider when theme system is implemented
   * - [ ] Add i18n provider when internationalization is set up
   *
   * For now, this provides data attributes that can be used for testing
   * provider-dependent behavior in a basic way.
   */
  const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
    return (
      <div
        data-testid="test-providers"
        data-theme={themeMode}
        data-locale={locale}
        data-route={initialRoute}
        data-placeholder="true"
      >
        {children}
      </div>
    );
  };

  return AllTheProviders;
}

/**
 * Custom render function that wraps components with test providers
 *
 * NOTE: Currently returns a simple wrapper div. As application providers are implemented,
 * this function will automatically provide them to all tests using this render method.
 *
 * For components that don't require providers yet, you can use the standard `render`
 * from '@testing-library/react' directly.
 *
 * @example
 * ```tsx
 * import { renderWithProviders } from '@legal-platform/test-utils';
 *
 * test('renders component with providers', () => {
 *   renderWithProviders(<MyComponent />, {
 *     initialRoute: '/dashboard',
 *     themeMode: 'dark'
 *   });
 *
 *   // Component will be wrapped with all configured providers
 *   expect(screen.getByText('Dashboard')).toBeInTheDocument();
 * });
 *
 * // Alternative: Use standard render for simple components
 * test('renders simple component', () => {
 *   render(<Button>Click me</Button>);
 * });
 * ```
 */
export function renderWithProviders(
  ui: ReactElement,
  options: TestProvidersOptions & Omit<RenderOptions, 'wrapper'> = {}
): RenderResult {
  const {
    initialRoute,
    initialStoreState,
    queryClientConfig,
    themeMode,
    locale,
    ...renderOptions
  } = options;

  const Wrapper = createTestProviders({
    initialRoute,
    initialStoreState,
    queryClientConfig,
    themeMode,
    locale,
  });

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

/**
 * Re-export all testing library utilities for convenience
 */
export * from '@testing-library/react';
export { renderWithProviders as render };
