import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Thai, Inter } from 'next/font/google';
import { CONFIG } from '@/lib/config';
import { th } from '@/lib/content/th';
import { SETTINGS_BOOT_SCRIPT } from '@/lib/client/settings';
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

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f5fb' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1022' },
  ],
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // The attributes on <html> are set before paint from this device's settings, so they can differ.
    <html
      lang="th"
      className={`${bodyFont.variable} ${numberFont.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SETTINGS_BOOT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
