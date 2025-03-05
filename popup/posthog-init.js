// posthog-init.js

import posthog from '../lib/posthog/posthog.js';
import { API_ENDPOINTS } from '../config.js';

// These variables will be fetched from the Vercel backend
let POSTHOG_API_KEY = null;
let POSTHOG_API_HOST = null;

// Function to initialize PostHog configuration
async function initPostHogConfig() {
    try {
        // Fetch PostHog configuration from Vercel backend
        const keyResponse = await fetch(API_ENDPOINTS.POSTHOG_API_KEY);
        const hostResponse = await fetch(API_ENDPOINTS.POSTHOG_API_HOST);

        if (!keyResponse.ok || !hostResponse.ok) {
            console.error('Failed to fetch PostHog configuration');
            // Use default values as fallback
            POSTHOG_API_KEY = 'phc_7teyAeNgBjZ2rRuu1yiPP8mJn1lg7SjZ4hhiJgmV5ar';
            POSTHOG_API_HOST = 'https://eu.i.posthog.com';
            return;
        }

        const { key } = await keyResponse.json();
        const { host } = await hostResponse.json();

        POSTHOG_API_KEY = key;
        POSTHOG_API_HOST = host;

        console.log('PostHog configuration initialized');
    } catch (error) {
        console.error('Error initializing PostHog configuration:', error);
        // Use default values as fallback
        POSTHOG_API_KEY = 'phc_7teyAeNgBjZ2rRuu1yiPP8mJn1lg7SjZ4hhiJgmV5ar';
        POSTHOG_API_HOST = 'https://eu.i.posthog.com';
    }
}

export async function initPostHog() {
    if (typeof posthog === 'undefined') {
        console.error('PostHog library not loaded');
        return;
    }

    // Initialize PostHog configuration
    await initPostHogConfig();

    try {
        posthog.init(POSTHOG_API_KEY, {
            api_host: POSTHOG_API_HOST,
            person_profiles: 'identified_only',
            loaded: function(posthog) {
                console.log('PostHog loaded successfully');
            },
        });

        console.log('PostHog initialized with API Key:', POSTHOG_API_KEY);
        console.log('PostHog API Host:', POSTHOG_API_HOST);
    } catch (error) {
        console.error('Error initializing PostHog:', error);
    }
}