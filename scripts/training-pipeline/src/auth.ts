/**
 * Microsoft Authentication using MSAL
 *
 * Handles interactive login, token caching, and auto-refresh
 */

import {
  PublicClientApplication,
  InteractionRequiredAuthError,
  AuthenticationResult,
  Configuration,
  LogLevel,
} from '@azure/msal-node';
import { readFile, writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import open from 'open';
import chalk from 'chalk';

// Token cache location
const TOKEN_CACHE_DIR = join(homedir(), '.legal-platform');
const TOKEN_CACHE_FILE = join(TOKEN_CACHE_DIR, 'ms-token-cache.json');

// OAuth scopes needed for OneDrive access
const SCOPES = ['Files.Read.All', 'User.Read', 'offline_access'];

/**
 * Get MSAL configuration
 * Checks for training-specific env var first, then falls back to general Azure AD vars
 */
function getMsalConfig(): Configuration {
  // Priority: training-specific > general Azure AD vars
  const clientId =
    process.env.AZURE_TRAINING_CLIENT_ID ||
    process.env.AZURE_AD_CLIENT_ID ||
    process.env.AZURE_CLIENT_ID;

  if (!clientId) {
    throw new Error(
      'AZURE_TRAINING_CLIENT_ID environment variable is required.\n' +
      'Create an Azure AD app registration and set the client ID.'
    );
  }

  return {
    auth: {
      clientId,
      authority: 'https://login.microsoftonline.com/common',
    },
    system: {
      loggerOptions: {
        loggerCallback: () => {}, // Silent
        logLevel: LogLevel.Error,
      },
    },
  };
}

/**
 * Load cached tokens if available
 */
async function loadTokenCache(): Promise<string | null> {
  try {
    if (existsSync(TOKEN_CACHE_FILE)) {
      const cache = await readFile(TOKEN_CACHE_FILE, 'utf-8');
      return cache;
    }
  } catch {
    // Cache doesn't exist or is invalid
  }
  return null;
}

/**
 * Save token cache to disk
 */
async function saveTokenCache(cache: string): Promise<void> {
  if (!existsSync(TOKEN_CACHE_DIR)) {
    await mkdir(TOKEN_CACHE_DIR, { recursive: true });
  }
  await writeFile(TOKEN_CACHE_FILE, cache, 'utf-8');
}

/**
 * Clear cached tokens
 */
export async function clearTokenCache(): Promise<void> {
  try {
    if (existsSync(TOKEN_CACHE_FILE)) {
      await unlink(TOKEN_CACHE_FILE);
    }
  } catch {
    // Ignore errors
  }
}

/**
 * Check if user is logged in (has valid cached token)
 */
export async function isLoggedIn(): Promise<boolean> {
  try {
    const token = await getAccessToken();
    return !!token;
  } catch {
    return false;
  }
}

/**
 * Get access token - tries cache first, then prompts for login
 */
export async function getAccessToken(): Promise<string> {
  const msalConfig = getMsalConfig();
  const pca = new PublicClientApplication(msalConfig);

  // Load cached tokens
  const cachedTokens = await loadTokenCache();
  if (cachedTokens) {
    pca.getTokenCache().deserialize(cachedTokens);
  }

  // Try to get token silently from cache
  const accounts = await pca.getTokenCache().getAllAccounts();

  if (accounts.length > 0) {
    try {
      const result = await pca.acquireTokenSilent({
        account: accounts[0],
        scopes: SCOPES,
      });

      // Save updated cache (might have refreshed token)
      const cache = pca.getTokenCache().serialize();
      await saveTokenCache(cache);

      return result.accessToken;
    } catch (error) {
      if (!(error instanceof InteractionRequiredAuthError)) {
        throw error;
      }
      // Token expired and can't be refreshed - need interactive login
    }
  }

  throw new Error('Not logged in. Run: pnpm run login');
}

/**
 * Interactive login flow using Device Code Flow
 * No redirect URI needed - works reliably with any Azure AD app
 */
export async function login(): Promise<AuthenticationResult> {
  const msalConfig = getMsalConfig();
  const pca = new PublicClientApplication(msalConfig);

  console.log(chalk.blue('\n🔐 Microsoft Sign-In (Device Code Flow)\n'));

  const deviceCodeRequest = {
    scopes: SCOPES,
    deviceCodeCallback: (response: { message: string; userCode: string; verificationUri: string }) => {
      console.log(chalk.yellow(response.message));
      console.log();
      console.log(chalk.gray('Or go to: ') + chalk.cyan(response.verificationUri));
      console.log(chalk.gray('And enter code: ') + chalk.bold.white(response.userCode));
      console.log();

      // Try to open the browser automatically
      open(response.verificationUri).catch(() => {
        // Ignore if browser doesn't open
      });
    },
  };

  console.log(chalk.gray('Waiting for you to sign in...\n'));

  const result = await pca.acquireTokenByDeviceCode(deviceCodeRequest);

  // Save token cache
  const cache = pca.getTokenCache().serialize();
  await saveTokenCache(cache);

  console.log(chalk.green('\n✅ Logged in successfully!'));
  console.log(chalk.gray(`   Account: ${result.account?.username}`));
  console.log(chalk.gray(`   Token cached at: ${TOKEN_CACHE_FILE}\n`));

  return result;
}

/**
 * Get info about current logged-in user
 */
export async function getLoggedInUser(): Promise<{ username: string; name: string } | null> {
  try {
    const msalConfig = getMsalConfig();
    const pca = new PublicClientApplication(msalConfig);

    const cachedTokens = await loadTokenCache();
    if (cachedTokens) {
      pca.getTokenCache().deserialize(cachedTokens);
    }

    const accounts = await pca.getTokenCache().getAllAccounts();
    if (accounts.length > 0) {
      return {
        username: accounts[0].username,
        name: accounts[0].name || accounts[0].username,
      };
    }
  } catch {
    // Not logged in
  }
  return null;
}
