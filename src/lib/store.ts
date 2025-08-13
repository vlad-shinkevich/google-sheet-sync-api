type AuthSession = {
  state: string;
  codeVerifier: string;
  createdAt: number;
  redirectTo?: string;
  provider: "google";
};

export type OAuthResult = {
  tokens: Record<string, unknown>;
  redirectTo?: string;
};

const memory = new Map<string, AuthSession>();
const results = new Map<string, OAuthResult>();

export function saveSession(sessionId: string, session: AuthSession): void {
  memory.set(sessionId, session);
}

export function getSession(sessionId: string): AuthSession | undefined {
  return memory.get(sessionId);
}

export function deleteSession(sessionId: string): void {
  memory.delete(sessionId);
}

export function saveResult(sessionId: string, value: OAuthResult): void {
  results.set(sessionId, value);
}

export function hasResult(sessionId: string): boolean {
  return results.has(sessionId);
}

export function takeResult(sessionId: string): OAuthResult | undefined {
  const value = results.get(sessionId);
  if (value !== undefined) {
    results.delete(sessionId);
  }
  return value;
}

// Basic sweeper for long-lived processes (Vercel functions are short-lived typically)
const TTL_MS = 10 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of memory.entries()) {
    if (now - value.createdAt > TTL_MS) memory.delete(key);
  }
  for (const [key] of results.entries()) {
    // Simple TTL for results as well
    // If there is no matching session, or if session is older than TTL, drop the result
    const session = memory.get(key);
    if (!session || now - session.createdAt > TTL_MS) {
      results.delete(key);
    }
  }
}, 60 * 1000).unref?.();


