import type { Metadata } from 'next';
import './globals.css';
// TODO: Revert to @ alias when Next.js/Turbopack path resolution is fixed
import { ConditionalLayout } from '../components/layout/ConditionalLayout';
import { ToastProvider } from '../components/ui/toast';
import { AuthProvider } from '../contexts/AuthContext';
import { FinancialAccessProvider } from '../contexts/FinancialAccessContext';
import { ApolloProvider } from '../providers/ApolloProvider';
import { ReactQueryProvider } from '../providers/ReactQueryProvider';

export const metadata: Metadata = {
  title: 'Legal Platform',
  description: 'AI-powered legal case management platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ro" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>
          <FinancialAccessProvider>
            <ApolloProvider>
              <ReactQueryProvider>
                <ToastProvider>
                  <ConditionalLayout>{children}</ConditionalLayout>
                </ToastProvider>
              </ReactQueryProvider>
            </ApolloProvider>
          </FinancialAccessProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
