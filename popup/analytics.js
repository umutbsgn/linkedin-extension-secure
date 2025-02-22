// analytics.js
const POSTHOG_API_KEY = 'phc_xhWdv89FeaL8iaT13O5A8CL9zo6kyCGzRFCtihoZKUB';
const POSTHOG_API_HOST = 'https://eu.i.posthog.com';

export function initAnalytics(options = {}) {
    if (typeof window.posthog === 'undefined') {
        console.error('PostHog library not loaded');
        return;
    }
    window.posthog.init(POSTHOG_API_KEY, {
        api_host: POSTHOG_API_HOST,
        person_profiles: 'identified_only',
        ...options
    });
    console.log('PostHog Analytics initialized');
}


/**
 * Captures a generic event.
 */
export function trackEvent(eventName, properties = {}) {
    window.posthog.capture(eventName, {
        timestamp: new Date().toISOString(),
        ...properties
    });
    console.log(`Event tracked: ${eventName}`, properties);
}

/**
 * Specific tracking functions:
 */

// Successful login
export function trackLoginSuccess(userId) {
    trackEvent('Login_Success', { userId });
}

// Failed login
export function trackLoginFailure(reason, email) {
    trackEvent('Login_Failure', { reason, email });
}

// Button clicks (e.g., AI button, tab changes, etc.)
export function trackButtonClick(buttonName, context = {}) {
    trackEvent('Button_Click', { button: buttonName, ...context });
}

// Comment generation
export function trackGenerateComment(postId, commentLength) {
    trackEvent('Generate_Comment', { postId, commentLength });
}

// Beta access attempt (both success and failure)
export function trackBetaAccessAttempt(email, allowed) {
    trackEvent('Beta_Access_Attempt', { email, allowed });
}

// User identification (after successful login)
export function identifyUser(userId) {
    window.posthog.identify(userId);
    console.log(`User identified: ${userId}`);
}

// Alias for switching from anonymous to identified user
export function aliasUser(newId) {
    window.posthog.alias(newId);
    console.log(`User aliased: ${newId}`);
}

// Reset tracking (e.g., on logout)
export function resetTracking() {
    window.posthog.reset();
    console.log('PostHog tracking reset');
}