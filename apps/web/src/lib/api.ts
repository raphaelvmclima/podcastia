const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000];

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem("podcastia_session");
  if (!stored) return null;
  try {
    const session = JSON.parse(stored);
    return session.access_token || null;
  } catch {
    return null;
  }
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem("podcastia_session");
  if (!stored) return null;
  try {
    const session = JSON.parse(stored);
    return session.refresh_token || null;
  } catch {
    return null;
  }
}

async function refreshSession(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.session) {
      localStorage.setItem("podcastia_session", JSON.stringify(data.session));
      return data.session.access_token;
    }
    return null;
  } catch {
    return null;
  }
}

function isRetryable(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  return false;
}

function isRetryableStatus(status: number): boolean {
  return [429, 502, 503, 504].includes(status);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function api<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  let token = getToken();
  const hasBody = !!options.body;

  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  if (hasBody) {
    headers["Content-Type"] = "application/json";
  }

  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      let res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: { ...headers, ...options.headers },
      });

      // Auto-refresh token on 401
      if (res.status === 401 && token) {
        const newToken = await refreshSession();
        if (newToken) {
          token = newToken;
          headers.Authorization = `Bearer ${newToken}`;
          res = await fetch(`${API_URL}${path}`, {
            ...options,
            headers: { ...headers, ...options.headers },
          });
        } else {
          localStorage.removeItem("podcastia_session");
          if (typeof window !== "undefined") window.location.href = "/login";
          throw new Error("Sessao expirada");
        }
      }

      // Retry on retryable status codes
      if (isRetryableStatus(res.status) && attempt < MAX_RETRIES) {
        const retryAfter = res.headers.get("Retry-After");
        const delayMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : RETRY_DELAYS[attempt] || 4000;
        await sleep(delayMs);
        continue;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "Erro na requisicao");
      }

      const text = await res.text();
      if (!text) return {} as T;
      try {
        return JSON.parse(text);
      } catch {
        return {} as T;
      }
    } catch (error) {
      lastError = error;
      if (error instanceof Error && error.message === "Sessao expirada") {
        throw error;
      }
      if (isRetryable(error) && attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAYS[attempt] || 4000);
        continue;
      }
      if (error instanceof Error && !isRetryable(error)) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Falha na requisicao apos multiplas tentativas");
}
