import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { z } from 'zod';

// Signing in with Google: the authorization code flow with PKCE. Only `openid` is asked for, so all that
// Google ever tells this app is a number for the account. No name, email or photo arrives here at all.

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const TOKEN_TIMEOUT_MS = 10_000;

// Fetched when first needed, cached, and fetched again when Google changes its keys.
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export interface GoogleClient {
  clientId: string;
  clientSecret: string;
}

const pendingSignIn = z.strictObject({
  state: z.string().min(1),
  nonce: z.string().min(1),
  verifier: z.string().min(43),
});

/** What has to match when the browser comes back from Google. Kept in a short-lived cookie until then. */
export type PendingSignIn = z.infer<typeof pendingSignIn>;

const randomValue = () => randomBytes(32).toString('base64url');

export function beginSignIn(
  clientId: string,
  redirectUri: string,
): { url: string; pending: PendingSignIn } {
  const pending = { state: randomValue(), nonce: randomValue(), verifier: randomValue() };
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid',
    state: pending.state,
    nonce: pending.nonce,
    code_challenge: createHash('sha256').update(pending.verifier).digest('base64url'),
    code_challenge_method: 'S256',
    // A school computer must not sign the next student straight into the last one's account.
    prompt: 'select_account',
  });
  return { url: `${AUTHORIZE_URL}?${params}`, pending };
}

export function encodePending(pending: PendingSignIn): string {
  return Buffer.from(JSON.stringify(pending)).toString('base64url');
}

/** Null for anything that is not a sign-in this browser started. */
export function decodePending(value: string | undefined): PendingSignIn | null {
  if (!value) return null;
  try {
    const parsed = pendingSignIn.safeParse(JSON.parse(Buffer.from(value, 'base64url').toString()));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export interface FinishSignIn {
  client: GoogleClient;
  redirectUri: string;
  code: string;
  pending: PendingSignIn;
}

/** The account's number, once Google has vouched for it. Anything else throws. */
export async function finishSignIn(
  { client, redirectUri, code, pending }: FinishSignIn,
  { post = fetch, keys = googleKeys }: { post?: typeof fetch; keys?: JWTVerifyGetKey } = {},
): Promise<string> {
  const response = await post(TOKEN_URL, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: client.clientId,
      client_secret: client.clientSecret,
      redirect_uri: redirectUri,
      code_verifier: pending.verifier,
    }),
    signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Google answered ${response.status}`);
  const { id_token: idToken } = (await response.json()) as { id_token?: string };
  if (!idToken) throw new Error('Google sent no ID token');

  const { payload } = await jwtVerify(idToken, keys, {
    algorithms: ['RS256'],
    issuer: ISSUERS,
    audience: client.clientId,
    requiredClaims: ['sub', 'nonce'],
  });
  if (payload.nonce !== pending.nonce) throw new Error('the nonce does not match');
  return payload.sub!;
}
