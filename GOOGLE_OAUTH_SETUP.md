# Google OAuth setup for Pith (Supabase Auth)

Configure Google as the OAuth provider for the **Pith** Supabase project (`mnoczpssewnymuxeniyo`).

## 1. Supabase Dashboard

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → project **Pith**.
2. Go to **Authentication** → **Providers** → **Google**.
3. Enable Google provider.
4. Note the **Callback URL** shown (format: `https://mnoczpssewnymuxeniyo.supabase.co/auth/v1/callback`).

## 2. Google Cloud Console

1. Open [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials.
2. Create or select an OAuth 2.0 **Web application** client.
3. **Authorized JavaScript origins** — add your app URLs:
   - `http://localhost:5500` (or your local static server)
   - `https://<your-production-host>` (production PWA URL)
4. **Authorized redirect URIs** — add the Supabase callback URL from step 1.
5. Copy **Client ID** and **Client Secret**.

## 3. Back to Supabase

1. Paste Google **Client ID** and **Client Secret** into the Google provider settings.
2. Save.

## 4. Site URL / Redirect URLs (Supabase)

Under **Authentication** → **URL Configuration**:

| Field | Value |
|-------|-------|
| Site URL | Your primary app origin (e.g. `http://localhost:5500` or production URL) |
| Redirect URLs | Same origin(s) as Site URL (comma-separated if multiple) |

The PWA uses `redirectTo: window.location.origin + window.location.pathname` on sign-in.

## 5. Verify

1. Open the app → **Sign in with Google**.
2. Complete OAuth → land on app home or settings (if no API key yet).
3. Upload a document → reload → session persists.
4. Sign out → returns to auth screen.

## Troubleshooting

- **Redirect mismatch**: redirect URI in Google must exactly match Supabase callback.
- **Stuck on auth after callback**: check Site URL matches where the app is served.
- **RLS errors after sign-in**: confirm `document_sessions` policies exist (see migration).
