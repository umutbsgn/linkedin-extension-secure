// Zentrale Konfigurationsdatei für API-Endpunkte
export const VERCEL_BASE_URL = 'https://linkedin-extension-secure-elew.vercel.app';

export const API_ENDPOINTS = {
    ANTHROPIC: `${VERCEL_BASE_URL}/api/anthropic/analyze`,
    POSTHOG: `${VERCEL_BASE_URL}/api/posthog/track`,
    SUPABASE: `${VERCEL_BASE_URL}/api/supabase/proxy`
};