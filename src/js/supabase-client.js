import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config/supabase.js";
import {
  getMockAuthSession,
  getMockAuthUser,
  isMockAuthEnabled,
} from "./config/mock-auth.js";

const realClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * @returns {import('@supabase/supabase-js').SupabaseAuthClient}
 */
function createMockAuthApi() {
  /** @type {Set<(event: string, session: import('@supabase/supabase-js').Session | null) => void>} */
  const listeners = new Set();

  /** @param {string} event @param {import('@supabase/supabase-js').Session | null} session */
  const notify = (event, session) => {
    for (const cb of listeners) {
      try {
        cb(event, session);
      } catch (err) {
        console.warn("[mock-auth] onAuthStateChange listener failed", err);
      }
    }
  };

  return {
    getSession: async () => ({ data: { session: getMockAuthSession() }, error: null }),
    getUser: async () => ({ data: { user: getMockAuthUser() }, error: null }),
    signInWithOAuth: async () => ({ data: { provider: "google", url: "" }, error: null }),
    signOut: async () => {
      notify("SIGNED_OUT", null);
      return { error: null };
    },
    onAuthStateChange: (callback) => {
      listeners.add(callback);
      queueMicrotask(() => callback("INITIAL_SESSION", getMockAuthSession()));
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              listeners.delete(callback);
            },
          },
        },
      };
    },
  };
}

/**
 * @param {ReturnType<typeof createClient>} client
 */
function wrapClientWithMockAuth(client) {
  if (!isMockAuthEnabled()) return client;
  const mockAuth = createMockAuthApi();
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === "auth") return mockAuth;
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

/** Singleton Supabase client (Auth + Postgres + Storage). */
export const supabase = wrapClientWithMockAuth(realClient);
