import { Metadata, Viewport } from 'next';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { CreateSheet } from '@/components/layout/CreateSheet';
import { CreateFAB } from '@/components/layout/CreateFAB';
import { MobileThemeWrapper } from '@/components/layout/MobileThemeWrapper';

export const metadata: Metadata = {
  title: 'Bojin Law',
  description: 'Legal case management',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Bojin Law',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <MobileThemeWrapper>
      <main className="pb-20">{children}</main>
      <CreateFAB />
      <BottomTabBar />
      <CreateSheet />
    </MobileThemeWrapper>
  );
}
