import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import AppShell from '@/components/AppShell';
import { AuthProvider } from '@/components/AuthProvider';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'DOJOBID',
  description: 'Marketplace connecting homeowners and contractors.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'DOJOBID',
    statusBarStyle: 'default',
  },
  icons: {
    apple: '/app-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
