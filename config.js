// Configuration for the LinkedIn AI Assistant browser extension

// Vercel backend URL (change this to your deployed Vercel app URL)
// After deploying to Vercel, replace this with your actual deployment URL
export const VERCEL_BACKEND_URL = 'https://linkedin-extension-secure-elew.vercel.app';

// API endpoints
export const API_ENDPOINTS = {
    // Base URL
    VERCEL_BACKEND_URL: VERCEL_BACKEND_URL,

    // Anthropic
    ANALYZE: `${VERCEL_BACKEND_URL}/api/anthropic/analyze`,

    // Supabase Auth
    LOGIN: `${VERCEL_BACKEND_URL}/api/supabase/auth/login`,
    SIGNUP: `${VERCEL_BACKEND_URL}/api/supabase/auth/signup`,

    // Supabase Data
    USER_SETTINGS: `${VERCEL_BACKEND_URL}/api/supabase/user-settings`,
    BETA_ACCESS: `${VERCEL_BACKEND_URL}/api/supabase/beta-access`,

    // API Usage
    USAGE: `${VERCEL_BACKEND_URL}/api/usage`,

    // Analytics
    TRACK: `${VERCEL_BACKEND_URL}/api/analytics/track`,

    // Supabase Configuration (these will be accessed via Vercel backend)
    SUPABASE_URL: `${VERCEL_BACKEND_URL}/api/config/supabase-url`,
    SUPABASE_KEY: `${VERCEL_BACKEND_URL}/api/config/supabase-key`,

    // PostHog Configuration (these will be accessed via Vercel backend)
    POSTHOG_API_KEY: `${VERCEL_BACKEND_URL}/api/config/posthog-key`,
    POSTHOG_API_HOST: `${VERCEL_BACKEND_URL}/api/config/posthog-host`
};