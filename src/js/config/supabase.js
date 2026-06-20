/** Supabase project config — anon/publishable keys are safe to commit (RLS-scoped). */
export const SUPABASE_URL = "https://mnoczpssewnymuxeniyo.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ub2N6cHNzZXdueW11eGVuaXlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4OTA4NjAsImV4cCI6MjA5NzQ2Njg2MH0.QUg5sXHifoCqp8pd5bUI2WDuLvlezgeBTMawfQeHLF8";

/**
 * OAuth return URL for signInWithOAuth redirectTo.
 * Resolved at runtime so one build works on localhost and production.
 * Must be allow-listed in Supabase Dashboard → Authentication → Redirect URLs.
 */
export function getOAuthRedirectUrl() {
  if (typeof window === "undefined" || !window.location?.origin) return "";
  const path = window.location.pathname || "/";
  return `${window.location.origin}${path}`;
}
