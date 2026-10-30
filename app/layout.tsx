import type { Metadata } from 'next';
import { IBM_Plex_Sans_Thai, Inter } from 'next/font/google';
import { CONFIG } from '@/lib/config';
import { th } from '@/lib/content/th';
import './globals.css';

const bodyFont = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-thai',
  display: 'swap',
});

const numberFont = Inter({
  subsets: ['latin'],
  variable: '--font-numeric',
  display: 'swap',
});

export const metadata: Metadata = {
  title: CONFIG.appName,
  description: th.home.tagline,
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="th" className={`${bodyFont.variable} ${numberFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
