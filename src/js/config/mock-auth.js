/** Test-only mock auth — active when MOCK_AUTH=true (Node) or browser test flags. */

export const MOCK_AUTH_USER_ID = "00000000-0000-4000-8000-000000000001";

/** @type {import('@supabase/supabase-js').User} */
export const MOCK_AUTH_USER = Object.freeze({
  id: MOCK_AUTH_USER_ID,
  email: "test@pith.local",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: Object.freeze({ provider: "google", providers: ["google"] }),
  user_metadata: Object.freeze({
    full_name: "Test User",
    email: "test@pith.local",
    avatar_url: "",
  }),
  created_at: "2020-01-01T00:00:00.000Z",
});

/**
 * @returns {import('@supabase/supabase-js').Session}
 */
export function buildMockAuthSession() {
  const now = Math.floor(Date.now() / 1000);
  return Object.freeze({
    access_token: "mock-access-token-for-tests",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: "mock-refresh-token-for-tests",
    user: MOCK_AUTH_USER,
  });
}

/**
 * True when test mock auth should bypass real Google/Supabase OAuth.
 * @returns {boolean}
 */
export function isMockAuthEnabled() {
  if (typeof process !== "undefined" && process.env?.MOCK_AUTH === "true") {
    return true;
  }
  if (typeof globalThis !== "undefined" && globalThis.__MOCK_AUTH__ === true) {
    return true;
  }
  if (typeof window !== "undefined" && window.location?.search) {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("MOCK_AUTH") === "true") return true;
    } catch {
      // ignore
    }
  }
  return false;
}

/**
 * @returns {import('@supabase/supabase-js').AuthResponse['data']['session']}
 */
export function getMockAuthSession() {
  return buildMockAuthSession();
}

/**
 * @returns {import('@supabase/supabase-js').User}
 */
export function getMockAuthUser() {
  return MOCK_AUTH_USER;
}
