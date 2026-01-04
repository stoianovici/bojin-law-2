import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
// TODO: Revert to @ alias when Next.js/Turbopack path resolution is fixed
import { ConditionalLayout } from '../components/layout/ConditionalLayout';
import { ToastProvider } from '../components/ui/toast';
import { AuthProvider } from '../contexts/AuthContext';
import { FinancialAccessProvider } from '../contexts/FinancialAccessContext';
import { AIAssistantProvider } from '../contexts/AIAssistantContext';
import { ApolloProvider } from '../providers/ApolloProvider';
import { ReactQueryProvider } from '../providers/ReactQueryProvider';
import { ThemeProvider } from '../providers/ThemeProvider';
import { GlobalShortcuts } from '../components/linear/GlobalShortcuts';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Legal Platform',
  description: 'AI-powered legal case management platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" className={inter.variable} suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider>
          <AuthProvider>
            <FinancialAccessProvider>
              <ApolloProvider>
                <ReactQueryProvider>
                  <ToastProvider>
                    <AIAssistantProvider>
                      <GlobalShortcuts />
                      <ConditionalLayout>{children}</ConditionalLayout>
                    </AIAssistantProvider>
                  </ToastProvider>
                </ReactQueryProvider>
              </ApolloProvider>
            </FinancialAccessProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
