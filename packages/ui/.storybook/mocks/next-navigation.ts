/**
 * Mock Next.js navigation hooks for Storybook
 */

export interface NextRouter {
  push: (url: string) => void;
  replace: (url: string) => void;
  back: () => void;
  forward: () => void;
  refresh: () => void;
  prefetch: (url: string) => Promise<void>;
  pathname: string;
  query: Record<string, string | string[] | undefined>;
  asPath: string;
  route: string;
  basePath: string;
  locale?: string;
  locales?: string[];
  defaultLocale?: string;
  isReady: boolean;
  isPreview: boolean;
  isFallback: boolean;
}

const mockRouter: NextRouter = {
  push: (url: string) => {
    console.log(`Router.push: ${url}`);
  },
  replace: (url: string) => {
    console.log(`Router.replace: ${url}`);
  },
  back: () => {
    console.log('Router.back');
  },
  forward: () => {
    console.log('Router.forward');
  },
  refresh: () => {
    console.log('Router.refresh');
  },
  prefetch: async (url: string) => {
    console.log(`Router.prefetch: ${url}`);
  },
  pathname: '/',
  query: {},
  asPath: '/',
  route: '/',
  basePath: '',
  locale: undefined,
  locales: undefined,
  defaultLocale: undefined,
  isReady: true,
  isPreview: false,
  isFallback: false,
};

/**
 * Mock useRouter hook
 */
export function useRouter(): NextRouter {
  return mockRouter;
}

/**
 * Mock usePathname hook
 */
export function usePathname(): string {
  return '/';
}

/**
 * Mock useSearchParams hook
 */
export function useSearchParams(): URLSearchParams {
  return new URLSearchParams();
}

/**
 * Mock useParams hook
 */
export function useParams(): Record<string, string | string[]> {
  return {};
}

/**
 * Mock redirect function
 */
export function redirect(url: string): never {
  console.log(`Redirect to: ${url}`);
  throw new Error('NEXT_REDIRECT');
}

/**
 * Mock notFound function
 */
export function notFound(): never {
  console.log('Not found');
  throw new Error('NEXT_NOT_FOUND');
}
