import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Db } from 'mongodb';

// Who is who. A Google account maps to an id of our own, and the number Google knows it by stays in this
// one collection. A session is a random token in the student's cookie with only its hash stored here, so
// reading the database gives nobody a way in.

export const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60;

interface UserDoc {
  _id: string;
  google_sub: string;
  created_at: Date;
}

interface AuthSessionDoc {
  /** The SHA-256 of the token in the cookie. */
  _id: string;
  user_id: string;
  created_at: Date;
  expires_at: Date;
}

const hashOf = (token: string) => createHash('sha256').update(token).digest('base64url');

export function createAuthStore(db: Db, now: () => number = Date.now) {
  const users = db.collection<UserDoc>('users');
  const sessions = db.collection<AuthSessionDoc>('auth_sessions');
  return {
    /** The same Google account is the same student on every device, however many sign in at once. */
    async userIdFor(googleSub: string): Promise<string> {
      const user = await users.findOneAndUpdate(
        { google_sub: googleSub },
        { $setOnInsert: { _id: randomUUID(), created_at: new Date(now()) } },
        { upsert: true, returnDocument: 'after' },
      );
      if (!user) throw new Error('userIdFor: nothing came back from an upsert');
      return user._id;
    },

    /** The token goes to the browser and is never seen here again. */
    async startSession(userId: string): Promise<string> {
      const token = randomBytes(32).toString('base64url');
      const created = now();
      await sessions.insertOne({
        _id: hashOf(token),
        user_id: userId,
        created_at: new Date(created),
        expires_at: new Date(created + SESSION_MAX_AGE_S * 1000),
      });
      return token;
    },

    async userOfSession(token: string): Promise<string | null> {
      const session = await sessions.findOne({
        _id: hashOf(token),
        // The TTL index only sweeps about once a minute, so the date is checked here too.
        expires_at: { $gt: new Date(now()) },
      });
      return session?.user_id ?? null;
    },

    async endSession(token: string): Promise<void> {
      await sessions.deleteOne({ _id: hashOf(token) });
    },
  };
}
