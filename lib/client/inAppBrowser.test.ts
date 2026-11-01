import { describe, expect, it } from 'vitest';
import { inAppBrowserOf, lineExternalUrl } from './inAppBrowser';

describe('inAppBrowserOf', () => {
  it.each([
    ['Mozilla/5.0 (iPhone) AppleWebKit/605 Mobile/15E148 Safari Line/13.20.0', 'line'],
    [
      'Mozilla/5.0 (Linux; Android 13; wv) Chrome/120 Mobile Safari/537.36 Line/13.20.0/IAB',
      'line',
    ],
    ['Mozilla/5.0 (iPhone) Mobile/15E148 [FBAN/FBIOS;FBAV/430.0]', 'facebook'],
    ['Mozilla/5.0 (iPhone) Mobile/15E148 Instagram 300.0', 'instagram'],
    ['Mozilla/5.0 (Linux; Android 13) musical_ly_2023 Mobile', 'tiktok'],
    ['Mozilla/5.0 (Linux; Android 13; Pixel 7; wv) AppleWebKit/537.36 Chrome/120 Mobile', 'other'],
  ])('knows %s', (userAgent, expected) => {
    expect(inAppBrowserOf(userAgent)).toBe(expected);
  });

  it.each([
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605 Version/17.0 Mobile/15E148 Safari/604',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605 Version/17.0 Safari/605',
    'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  ])('lets a real browser through: %s', (userAgent) => {
    expect(inAppBrowserOf(userAgent)).toBeNull();
  });
});

describe('lineExternalUrl', () => {
  it("asks LINE to open the phone's own browser, and keeps what the link already had", () => {
    const url = new URL(lineExternalUrl('https://example.test/?cohort=ABC'));
    expect(url.searchParams.get('openExternalBrowser')).toBe('1');
    expect(url.searchParams.get('cohort')).toBe('ABC');
  });
});
