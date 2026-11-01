import { createHash } from 'node:crypto';
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type CryptoKey,
  type JWTVerifyGetKey,
} from 'jose';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  beginSignIn,
  decodePending,
  encodePending,
  finishSignIn,
  type PendingSignIn,
} from './google';

const CLIENT = { clientId: 'kidma-test.apps.example', clientSecret: 'test-secret' };
const REDIRECT = 'https://kidma.test/auth/callback';
const PENDING: PendingSignIn = { state: 'the-state', nonce: 'the-nonce', verifier: 'v'.repeat(43) };

describe('beginSignIn', () => {
  it("goes to Google's page and asks for nothing but the account's number", () => {
    const { url, pending } = beginSignIn(CLIENT.clientId, REDIRECT);
    const sent = new URL(url);
    expect(sent.origin + sent.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(sent.searchParams)).toMatchObject({
      client_id: CLIENT.clientId,
      redirect_uri: REDIRECT,
      response_type: 'code',
      scope: 'openid',
      state: pending.state,
      nonce: pending.nonce,
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });
  });

  it('proves the verifier by its hash, and never sends it or the secret to the browser', () => {
    const { url, pending } = beginSignIn(CLIENT.clientId, REDIRECT);
    const challenge = createHash('sha256').update(pending.verifier).digest('base64url');
    expect(new URL(url).searchParams.get('code_challenge')).toBe(challenge);
    expect(url).not.toContain(pending.verifier);
    expect(url).not.toContain(CLIENT.clientSecret);
  });

  it('draws new values each time', () => {
    const first = beginSignIn(CLIENT.clientId, REDIRECT).pending;
    const second = beginSignIn(CLIENT.clientId, REDIRECT).pending;
    expect(first.state).not.toBe(second.state);
    expect(first.nonce).not.toBe(second.nonce);
    expect(first.verifier).not.toBe(second.verifier);
  });
});

describe('the cookie that holds a sign-in', () => {
  it('reads back what was written', () => {
    expect(decodePending(encodePending(PENDING))).toEqual(PENDING);
  });

  it.each([
    ['nothing', undefined],
    ['an empty value', ''],
    ['not base64 of JSON', '%%%'],
    ['some other JSON', Buffer.from('{"state":"a"}').toString('base64url')],
    ['a short verifier', encodePending({ ...PENDING, verifier: 'short' })],
    ['an array', Buffer.from('[1,2]').toString('base64url')],
  ])('is refused for %s', (_name, value) => {
    expect(decodePending(value)).toBeNull();
  });
});

describe('finishSignIn', () => {
  let signingKey: CryptoKey;
  let otherKey: CryptoKey;
  let keys: JWTVerifyGetKey;

  beforeAll(async () => {
    const pair = await generateKeyPair('RS256');
    signingKey = pair.privateKey;
    otherKey = (await generateKeyPair('RS256')).privateKey;
    const published = await exportJWK(pair.publicKey);
    keys = createLocalJWKSet({ keys: [{ ...published, kid: 'k1', alg: 'RS256', use: 'sig' }] });
  });

  interface TokenOptions {
    issuer?: string;
    audience?: string;
    nonce?: string;
    subject?: string;
    expires?: string;
    key?: CryptoKey;
  }

  function idToken({
    issuer = 'https://accounts.google.com',
    audience = CLIENT.clientId,
    nonce = PENDING.nonce,
    subject = 'google-account-1',
    expires = '1h',
    key = signingKey,
  }: TokenOptions = {}) {
    return new SignJWT({ nonce })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject(subject)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(expires)
      .sign(key);
  }

  const answering = (body: unknown, status = 200) =>
    vi.fn<typeof fetch>(async () => Response.json(body, { status }));

  const finish = (post: ReturnType<typeof answering>) =>
    finishSignIn(
      { client: CLIENT, redirectUri: REDIRECT, code: 'one-time-code', pending: PENDING },
      { post, keys },
    );

  it("returns the account's number, having sent the code and the verifier to Google", async () => {
    const post = answering({ id_token: await idToken() });
    expect(await finish(post)).toBe('google-account-1');

    const [url, init] = post.mock.calls[0];
    expect(url).toBe('https://oauth2.googleapis.com/token');
    expect(init?.method).toBe('POST');
    expect(Object.fromEntries(init?.body as URLSearchParams)).toEqual({
      grant_type: 'authorization_code',
      code: 'one-time-code',
      client_id: CLIENT.clientId,
      client_secret: CLIENT.clientSecret,
      redirect_uri: REDIRECT,
      code_verifier: PENDING.verifier,
    });
  });

  it('accepts the other way Google writes its name', async () => {
    const post = answering({ id_token: await idToken({ issuer: 'accounts.google.com' }) });
    expect(await finish(post)).toBe('google-account-1');
  });

  it.each<[string, TokenOptions]>([
    ['from someone other than Google', { issuer: 'https://accounts.example.com' }],
    ['meant for another app', { audience: 'another-app' }],
    ['from another sign-in', { nonce: 'another-nonce' }],
    ['already expired', { expires: '1 hour ago' }],
  ])('refuses a token %s', async (_name, options) => {
    await expect(finish(answering({ id_token: await idToken(options) }))).rejects.toThrow();
  });

  it('refuses a token not signed by Google', async () => {
    const post = answering({ id_token: await idToken({ key: otherKey }) });
    await expect(finish(post)).rejects.toThrow();
  });

  it('refuses a token signed the cheap way with a shared secret', async () => {
    const forged = await new SignJWT({ nonce: PENDING.nonce })
      .setProtectedHeader({ alg: 'HS256', kid: 'k1' })
      .setIssuer('https://accounts.google.com')
      .setAudience(CLIENT.clientId)
      .setSubject('google-account-1')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('a shared secret anyone might guess'));
    await expect(finish(answering({ id_token: forged }))).rejects.toThrow();
  });

  it('refuses when Google says no, without repeating what it said', async () => {
    const post = answering({ error: 'invalid_grant', error_description: 'secret detail' }, 400);
    await expect(finish(post)).rejects.toThrow('Google answered 400');
  });

  it('refuses an answer with no token', async () => {
    await expect(finish(answering({ access_token: 'x' }))).rejects.toThrow('no ID token');
  });
});
