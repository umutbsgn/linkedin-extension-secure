// Configuration for the LinkedIn AI Assistant browser extension

// Vercel backend URL (change this to your deployed Vercel app URL)
// After deploying to Vercel, replace this with your actual deployment URL
export const VERCEL_BACKEND_URL = 'https://saas-browser-extension-secure.vercel.app';

// API endpoints
export const API_ENDPOINTS = {
    // Anthropic
    ANALYZE: `${VERCEL_BACKEND_URL}/api/anthropic/analyze`,

    // Supabase Auth
    LOGIN: `${VERCEL_BACKEND_URL}/api/supabase/auth/login`,
    SIGNUP: `${VERCEL_BACKEND_URL}/api/supabase/auth/signup`,

    // Supabase Data
    USER_SETTINGS: `${VERCEL_BACKEND_URL}/api/supabase/user-settings`,
    BETA_ACCESS: `${VERCEL_BACKEND_URL}/api/supabase/beta-access`,

    // Analytics
    TRACK: `${VERCEL_BACKEND_URL}/api/analytics/track`
};