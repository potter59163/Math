/** Ends the session on this device. The Google account itself stays signed in. */
export async function signOut(): Promise<void> {
  await fetch('/auth/signout', { method: 'POST' });
}
