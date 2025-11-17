import type { Metadata } from 'next';
import './globals.css';
// TODO: Revert to @ alias when Next.js/Turbopack path resolution is fixed
import { MainLayout } from '../components/layout/MainLayout';

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
    <html lang="ro">
      <body>
        <MainLayout>{children}</MainLayout>
      </body>
    </html>
  );
}
