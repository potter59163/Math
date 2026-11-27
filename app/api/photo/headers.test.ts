import { describe, expect, it } from 'vitest';
import nextConfig from '@/next.config';

// The photo routes set a strict Content-Security-Policy of their own, and Next.js replaces it with the
// one next.config.ts gives every path. What a browser gets is therefore decided there, by a rule for
// the photo addresses that has to come after the rule for everything.
describe('the headers of a photo address', () => {
  it('carry a policy under which the bytes can load nothing and run nothing', async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const everywhere = rules.findIndex(({ source }) => source === '/:path*');
    const photos = rules.findIndex(({ source }) => source === '/api/photo/:path*');
    expect(everywhere).toBeGreaterThanOrEqual(0);
    // Of two rules that set the same header on a path, the later one wins.
    expect(photos).toBeGreaterThan(everywhere);

    const policy =
      rules[photos].headers.find(({ key }) => key === 'Content-Security-Policy')?.value ?? '';
    expect(policy).toContain("default-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain('sandbox');
  });

  it('still say, on every path, that the app is not to be framed or sniffed', async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const everywhere = rules.find(({ source }) => source === '/:path*');
    const valueOf = (name: string) => everywhere?.headers.find(({ key }) => key === name)?.value;
    expect(valueOf('X-Frame-Options')).toBe('DENY');
    expect(valueOf('X-Content-Type-Options')).toBe('nosniff');
    expect(valueOf('Content-Security-Policy')).toContain("frame-ancestors 'none'");
  });
});
