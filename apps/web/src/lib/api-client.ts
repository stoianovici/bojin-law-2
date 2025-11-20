/**
 * API Client with Automatic Token Refresh
 * Interceptor that automatically refreshes access tokens on 401 responses
 * Story 2.4: Authentication with Azure AD
 */

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

/**
 * Custom fetch wrapper with automatic token refresh
 * Automatically retries requests with refreshed token on 401 errors
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Always include credentials (session cookie)
  const requestOptions: RequestInit = {
    ...options,
    credentials: 'include',
  };

  // Make initial request
  let response = await fetch(url, requestOptions);

  // If 401 Unauthorized, try to refresh token and retry
  if (response.status === 401 && !url.includes('/auth/refresh')) {
    // If already refreshing, wait for it to complete
    if (isRefreshing && refreshPromise) {
      const refreshSuccess = await refreshPromise;
      if (refreshSuccess) {
        // Retry original request with refreshed token
        response = await fetch(url, requestOptions);
      }
      return response;
    }

    // Start token refresh
    isRefreshing = true;
    refreshPromise = refreshAccessToken();

    try {
      const refreshSuccess = await refreshPromise;

      if (refreshSuccess) {
        // Retry original request with refreshed token
        response = await fetch(url, requestOptions);
      } else {
        // Refresh failed - redirect to login
        window.location.href = '/login';
      }
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  }

  return response;
}

/**
 * Refresh access token by calling backend refresh endpoint
 * Returns true if successful, false otherwise
 */
async function refreshAccessToken(): Promise<boolean> {
  try {
    const response = await fetch('/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });

    return response.ok;
  } catch (error) {
    console.error('Token refresh failed:', error);
    return false;
  }
}

/**
 * API Client with typed methods
 */
export const apiClient = {
  /**
   * GET request with automatic token refresh
   */
  async get<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetchWithAuth(url, {
      ...options,
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`GET ${url} failed with status ${response.status}`);
    }

    return response.json();
  },

  /**
   * POST request with automatic token refresh
   */
  async post<T>(url: string, data?: unknown, options?: RequestInit): Promise<T> {
    const response = await fetchWithAuth(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      throw new Error(`POST ${url} failed with status ${response.status}`);
    }

    return response.json();
  },

  /**
   * PUT request with automatic token refresh
   */
  async put<T>(url: string, data?: unknown, options?: RequestInit): Promise<T> {
    const response = await fetchWithAuth(url, {
      ...options,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      throw new Error(`PUT ${url} failed with status ${response.status}`);
    }

    return response.json();
  },

  /**
   * DELETE request with automatic token refresh
   */
  async delete<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetchWithAuth(url, {
      ...options,
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`DELETE ${url} failed with status ${response.status}`);
    }

    return response.json();
  },

  /**
   * PATCH request with automatic token refresh
   */
  async patch<T>(url: string, data?: unknown, options?: RequestInit): Promise<T> {
    const response = await fetchWithAuth(url, {
      ...options,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      throw new Error(`PATCH ${url} failed with status ${response.status}`);
    }

    return response.json();
  },
};
