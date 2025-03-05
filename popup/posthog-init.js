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
            // Don't set default values, tracking will be disabled
            return false;
        }

        const { key } = await keyResponse.json();
        const { host } = await hostResponse.json();

        POSTHOG_API_KEY = key;
        POSTHOG_API_HOST = host;

        console.log('PostHog configuration initialized');
        return true;
    } catch (error) {
        console.error('Error initializing PostHog configuration:', error);
        // Don't set default values, tracking will be disabled
        return false;
    }
}

export async function initPostHog() {
    if (typeof posthog === 'undefined') {
        console.error('PostHog library not loaded');
        return;
    }

    // Initialize PostHog configuration
    const configLoaded = await initPostHogConfig();

    // Only initialize PostHog if configuration was loaded successfully
    if (configLoaded && POSTHOG_API_KEY && POSTHOG_API_HOST) {
        try {
            posthog.init(POSTHOG_API_KEY, {
                api_host: POSTHOG_API_HOST,
                person_profiles: 'identified_only',
                loaded: function(posthog) {
                    console.log('PostHog loaded successfully');
                },
            });

            console.log('PostHog initialized successfully');
        } catch (error) {
            console.error('Error initializing PostHog:', error);
        }
    } else {
        console.warn('PostHog initialization skipped: Configuration not available');
    }
}