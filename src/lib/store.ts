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
  userinfo?: Record<string, unknown>;
};
import { kv as vercelKv } from "@vercel/kv";

const memorySessions = new Map<string, AuthSession>();
const memoryResults = new Map<string, OAuthResult>();

const SESSION_PREFIX = "session:";
const RESULT_PREFIX = "result:";
const TTL_SECONDS = 10 * 60; // 10 minutes

function kvAvailable(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

export async function saveSession(sessionId: string, session: AuthSession): Promise<void> {
  if (kvAvailable()) {
    await vercelKv.set(`${SESSION_PREFIX}${sessionId}`, session, { ex: TTL_SECONDS });
  } else {
    memorySessions.set(sessionId, session);
  }
}

export async function getSession(sessionId: string): Promise<AuthSession | undefined> {
  if (kvAvailable()) {
    const value = await vercelKv.get<AuthSession>(`${SESSION_PREFIX}${sessionId}`);
    return value ?? undefined;
  }
  return memorySessions.get(sessionId);
}

export async function deleteSession(sessionId: string): Promise<void> {
  if (kvAvailable()) {
    await vercelKv.del(`${SESSION_PREFIX}${sessionId}`);
  } else {
    memorySessions.delete(sessionId);
  }
}

export async function saveResult(sessionId: string, value: OAuthResult): Promise<void> {
  if (kvAvailable()) {
    await vercelKv.set(`${RESULT_PREFIX}${sessionId}`, value, { ex: TTL_SECONDS });
  } else {
    memoryResults.set(sessionId, value);
  }
}

export async function hasResult(sessionId: string): Promise<boolean> {
  if (kvAvailable()) {
    try {
      const exists = await vercelKv.exists(`${RESULT_PREFIX}${sessionId}`);
      return Boolean(exists);
    } catch {
      const v = await vercelKv.get(`${RESULT_PREFIX}${sessionId}`);
      return v != null;
    }
  }
  return memoryResults.has(sessionId);
}

export async function takeResult(sessionId: string): Promise<OAuthResult | undefined> {
  if (kvAvailable()) {
    const key = `${RESULT_PREFIX}${sessionId}`;
    const value = await vercelKv.get<OAuthResult>(key);
    if (value != null) await vercelKv.del(key);
    return value ?? undefined;
  }
  const value = memoryResults.get(sessionId);
  if (value !== undefined) memoryResults.delete(sessionId);
  return value;
}


