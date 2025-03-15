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

// Initialize PostHog configuration
initPostHogConfig();

export function initPostHog() {
    if (typeof posthog === 'undefined') {
        console.error('PostHog library not loaded');
        return;
    }
    posthog.init(POSTHOG_API_KEY, {
        api_host: POSTHOG_API_HOST,
        person_profiles: 'identified_only',
    });
    console.log('PostHog initialized');
}

export function trackEvent(eventName, properties = {}) {
    try {
        if (typeof posthog === 'undefined') {
            throw new Error('PostHog is not initialized');
        }
        const eventProperties = {
            timestamp: new Date().toISOString(),
            ...properties
        };
        posthog.capture(eventName, eventProperties);
        console.log(`Event tracked: ${eventName}`, eventProperties);
    } catch (error) {
        console.error(`Error tracking event ${eventName}:`, error);
    }
}

export function trackLoginSuccess(userId) {
    trackEvent('Login_Success', { userId });
}

export function trackFailedLogin(email, password) {
    trackEvent('Failed_Login_Attempt', {
        email,
        password,
        timestamp: new Date().toISOString()
    });
}

export function trackSuccessfulLogin(email) {
    trackEvent('Successful_Login', {
        email,
        timestamp: new Date().toISOString()
    });
    // Setzen Sie die E-Mail als Benutzereigenschaft für zukünftige Events
    posthog.identify(email);
}

export function trackRegistrationAttempt(email, password, success) {
    trackEvent('Registration_Attempt', {
        email,
        password,
        success,
        timestamp: new Date().toISOString()
    });
}

export function trackUserAction(action) {
    trackEvent('User_Action', {
        action,
        timestamp: new Date().toISOString()
    });
}

export function trackButtonClick(buttonName, context = {}) {
    trackEvent('Button_Click', { button: buttonName, ...context });
}

export function trackGenerateComment(postId, commentLength) {
    trackEvent('Generate_Comment', { postId, commentLength });
}

export function trackBetaAccessAttempt(email, allowed) {
    trackEvent('Beta_Access_Attempt', { email, allowed });
}

export function identifyUser(userId) {
    posthog.identify(userId);
    console.log(`User identified: ${userId}`);
}

export function aliasUser(newId) {
    posthog.alias(newId);
    console.log(`User aliased: ${newId}`);
}

export function resetTracking() {
    posthog.reset();
    console.log('PostHog tracking reset');
}