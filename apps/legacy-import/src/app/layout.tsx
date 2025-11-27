import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';

export const metadata: Metadata = {
  title: 'Legacy Document Import - AI Training',
  description: 'Import and categorize legacy documents for AI training',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        <AuthProvider>
          <Header />
          <main className="max-w-7xl mx-auto px-6 py-8">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
