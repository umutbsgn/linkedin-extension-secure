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
    BETA_ACCESS: `${VERCEL_BACKEND_URL}/api/supabasdue/beta-access`,

    // API Usage
    USAGE: `${VERCEL_BACKEND_URL}/api/usage`,

    // Analytics
    TRACK: `${VERCEL_BACKEND_URL}/api/analytics/track`,

    // Supabase Configuration (these will be accessed via Vercel backend)
    SUPABASE_URL: `${VERCEL_BACKEND_URL}/api/config/supabase-url`,
    SUPABASE_KEY: `${VERCEL_BACKEND_URL}/api/config/supabase-key`,

    // PostHog Configuration (these will be accessed via Vercel backend)
    POSTHOG_API_KEY: `${VERCEL_BACKEND_URL}/api/config/posthog-key`,
    POSTHOG_API_HOST: `${VERCEL_BACKEND_URL}/api/config/posthog-host`,

    // Stripe Configuration
    STRIPE_PUBLISHABLE_KEY: `${VERCEL_BACKEND_URL}/api/config/stripe-publishable-key`,

    // Subscription Management
    SUBSCRIPTION_STATUS: `${VERCEL_BACKEND_URL}/api/subscriptions/status`,
    CREATE_CHECKOUT: `${VERCEL_BACKEND_URL}/api/subscriptions/create-checkout`,
    CANCEL_SUBSCRIPTION: `${VERCEL_BACKEND_URL}/api/subscriptions/cancel`,
    UPDATE_API_KEY: `${VERCEL_BACKEND_URL}/api/subscriptions/update-api-key`,
    REDIRECT: `${VERCEL_BACKEND_URL}/api/subscriptions/redirect`
};

// Available models
export const MODELS = {
    HAIKU: 'haiku-3.5',
    SONNET: 'sonnet-3.7'
};

// Default model
export const DEFAULT_MODEL = MODELS.HAIKU;

// Subscription types
export const SUBSCRIPTION_TYPES = {
    TRIAL: 'trial',
    PRO: 'pro'
};

// Ensure consistent case for subscription types
// This helps prevent issues with case-sensitive comparisons
export const NORMALIZED_SUBSCRIPTION_TYPES = {
    trial: 'trial',
    pro: 'pro'
};