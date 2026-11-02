import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Thai, Kodchasan, Mitr, Playpen_Sans_Thai } from 'next/font/google';
import { VoiceUnlock } from '@/components/clip/VoiceUnlock';
import { CONFIG } from '@/lib/config';
import { th } from '@/lib/content/th';
import { SETTINGS_BOOT_SCRIPT } from '@/lib/client/settings';
import './globals.css';

// `subsets` is what gets preloaded, and the rest still loads as soon as a page uses it. A school's
// network feels every preloaded file, so each font preloads only what the first paint needs.
const bodyFont = IBM_Plex_Sans_Thai({
  subsets: ['thai'],
  weight: ['400', '500', '600'],
  variable: '--font-thai',
  display: 'swap',
});

// Headings and the name of the app. Its zero has a slash through it, so numbers use the next one.
const headingFont = Mitr({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-heading',
  display: 'swap',
});

// Every printed number.
const numberFont = Kodchasan({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-numeric',
  display: 'swap',
  preload: false,
});

// What is written by hand: the student's answers and the tutor's notes.
const handFont = Playpen_Sans_Thai({
  subsets: ['thai'],
  // One fixed weight: the variable font is three times the download.
  weight: '400',
  variable: '--font-handwriting',
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  title: { default: CONFIG.appName, template: `%s · ${CONFIG.appName}` },
  description: th.home.tagline,
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fdfdfb' },
    { media: '(prefers-color-scheme: dark)', color: '#17252b' },
  ],
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // The attributes on <html> are set before paint from this device's settings, so they can differ.
    <html
      lang="th"
      className={`${bodyFont.variable} ${headingFont.variable} ${numberFont.variable} ${handFont.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SETTINGS_BOOT_SCRIPT }} />
      </head>
      <body>
        <VoiceUnlock />
        {children}
      </body>
    </html>
  );
}
