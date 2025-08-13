type AuthSession = {
  state: string;
  codeVerifier: string;
  createdAt: number;
  redirectTo?: string;
  provider: "google";
};

const memory = new Map<string, AuthSession>();

export function saveSession(sessionId: string, session: AuthSession): void {
  memory.set(sessionId, session);
}

export function getSession(sessionId: string): AuthSession | undefined {
  return memory.get(sessionId);
}

export function deleteSession(sessionId: string): void {
  memory.delete(sessionId);
}

// Basic sweeper for long-lived processes (Vercel functions are short-lived typically)
const TTL_MS = 10 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of memory.entries()) {
    if (now - value.createdAt > TTL_MS) memory.delete(key);
  }
}, 60 * 1000).unref?.();


