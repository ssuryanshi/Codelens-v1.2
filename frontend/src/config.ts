// Single source of truth for the backend URL.
// Set VITE_API_BASE_URL in the Amplify console (App settings > Environment variables)
// or in frontend/.env for local development. No hardcoded fallback on purpose:
// a stale fallback silently points the app at a backend that may no longer exist.
const raw = import.meta.env.VITE_API_BASE_URL as string | undefined

if (!raw) {
  console.error(
    'VITE_API_BASE_URL is not set. API calls will fail. ' +
      'Set it to the ApiEndpoint output of the h2s-backend stack.'
  )
}

export const API_BASE_URL = (raw ?? '').replace(/\/+$/, '')
