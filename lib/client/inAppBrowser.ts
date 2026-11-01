// Google refuses to sign anyone in from inside another app's built-in browser, with a bare error page
// that means nothing to a student. A link shared in a class's LINE group opens in exactly such a browser,
// so this has to be caught before the button is pressed.

export type InAppBrowser = 'line' | 'facebook' | 'instagram' | 'tiktok' | 'other';

export function inAppBrowserOf(userAgent: string): InAppBrowser | null {
  if (/\bLine\//i.test(userAgent)) return 'line';
  if (/FBAN|FBAV|FB_IAB|FBIOS|FB4A/.test(userAgent)) return 'facebook';
  if (/Instagram/.test(userAgent)) return 'instagram';
  if (/musical_ly|TikTok|BytedanceWebview/i.test(userAgent)) return 'tiktok';
  // Android's generic web view marks itself, whichever app it sits inside.
  if (/;\s*wv\)/.test(userAgent)) return 'other';
  return null;
}

/** LINE documents this query parameter: it reopens the page in the phone's own browser. */
export function lineExternalUrl(href: string): string {
  const url = new URL(href);
  url.searchParams.set('openExternalBrowser', '1');
  return url.toString();
}
