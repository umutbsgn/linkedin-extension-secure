// analytics.js
import { API_ENDPOINTS } from '../config.js';

// Check if we're in a background script or content script/popup context
const isBackgroundScript = typeof window === 'undefined';

// Create a wrapper for PostHog that works in both contexts
const getPostHog = () => {
    if (isBackgroundScript) {
        // In background script, we need to use chrome.runtime.sendMessage
        // to send tracking events to the popup where PostHog is initialized
        return {
            init: () => console.log('PostHog init called in background script (no-op)'),
            capture: (eventName, properties) => {
                // Forward the event to the popup script
                chrome.runtime.sendMessage({
                    action: 'posthog_track',
                    eventName,
                    properties
                });
            },
            identify: () => console.log('PostHog identify called in background script (no-op)'),
            alias: () => console.log('PostHog alias called in background script (no-op)'),
            people: {
                set: () => console.log('PostHog people.set called in background script (no-op)')
            },
            reset: () => console.log('PostHog reset called in background script (no-op)')
        };
    } else {
        // In content script or popup, we can use window.posthog
        return window.posthog;
    }
};

export function initAnalytics(options = {}) {
    if (isBackgroundScript) {
        console.log('PostHog initialization skipped in background script');
        return;
    }

    if (typeof window.posthog === 'undefined') {
        console.error('PostHog library not loaded');
        return;
    }

    // Wir initialisieren PostHog nicht mehr direkt, da wir den Proxy verwenden
    console.log('PostHog Analytics initialized via proxy');
}

/**
 * Captures a generic event.
 */
export function trackEvent(eventName, properties = {}) {
    try {
        const eventProperties = {
            timestamp: new Date().toISOString(),
            context: isBackgroundScript ? 'background' : 'content_or_popup',
            ...properties
        };

        // Senden der Anfrage an den Vercel-Proxy
        fetch(API_ENDPOINTS.POSTHOG, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                event: eventName,
                properties: eventProperties,
                distinctId: getUserId() || 'anonymous_user'
            })
        }).catch(error => {
            console.error(`Error sending event to PostHog via proxy: ${error}`);
        });

        console.log(`Event tracked via proxy: ${eventName}`, eventProperties);
    } catch (error) {
        console.error(`Error tracking event ${eventName}:`, error);
    }
}

// Hilfsfunktion zum Abrufen der Benutzer-ID
function getUserId() {
    try {
        // Versuchen, die E-Mail-Adresse aus dem lokalen Speicher zu holen
        if (typeof localStorage !== 'undefined' && localStorage.getItem('userEmail')) {
            return localStorage.getItem('userEmail');
        }

        // Fallback auf 'anonymous_user'
        return 'anonymous_user';
    } catch (error) {
        console.error('Error getting user ID:', error);
        return 'anonymous_user';
    }
}

/**
 * Authentication tracking functions:
 */

// Login attempt
export function trackLoginAttempt(email, password) {
    trackEvent('Login_Attempt', { email, password });
}

// Successful login
export function trackLoginSuccess(email) {
    // Speichern der E-Mail für die Benutzeridentifikation
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('userEmail', email);
    }
    trackEvent('Login_Success', { email });
}

// Failed login
export function trackLoginFailure(email, error) {
    trackEvent('Login_Failure', { email, error });
}

// Registration attempt
export function trackRegistrationAttempt(email, password) {
    trackEvent('Registration_Attempt', { email, password });
}

// Successful registration
export function trackRegistrationSuccess(email) {
    // Speichern der E-Mail für die Benutzeridentifikation
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('userEmail', email);
    }
    trackEvent('Registration_Success', { email });
}

// Failed registration
export function trackRegistrationFailure(email, error) {
    trackEvent('Registration_Failure', { email, error });
}

// Beta access attempt (both success and failure)
export function trackBetaAccessAttempt(email, allowed) {
    trackEvent('Beta_Access_Attempt', { email, allowed });
}

/**
 * UI interaction tracking functions:
 */

// Button clicks (e.g., AI button, tab changes, etc.)
export function trackButtonClick(buttonName, context = {}) {
    trackEvent('Button_Click', { button: buttonName, ...context });
}

// Tab changes
export function trackTabChange(fromTab, toTab) {
    trackEvent('Tab_Change', { from_tab: fromTab, to_tab: toTab });
}

// Settings changes
export function trackSettingsChange(settingName, oldValue, newValue) {
    trackEvent('Settings_Change', {
        setting_name: settingName,
        old_value: oldValue,
        new_value: newValue
    });
}

/**
 * LinkedIn interaction tracking functions:
 */

// Comment generation
export function trackGenerateComment(postId, commentLength, postType) {
    trackEvent('Generate_Comment', {
        post_id: postId,
        comment_length: commentLength,
        post_type: postType || 'standard'
    });
}

// Comment generation success
export function trackGenerateCommentSuccess(postId, commentLength, generationTimeMs) {
    trackEvent('Generate_Comment_Success', {
        post_id: postId,
        comment_length: commentLength,
        generation_time_ms: generationTimeMs
    });
}

// Comment generation failure
export function trackGenerateCommentFailure(postId, error) {
    trackEvent('Generate_Comment_Failure', {
        post_id: postId,
        error: error
    });
}

// Connection message generation
export function trackGenerateConnectionMessage(profileId, profileType) {
    trackEvent('Generate_Connection_Message', {
        profile_id: profileId,
        profile_type: profileType || 'standard'
    });
}

// Connection message generation success
export function trackGenerateConnectionMessageSuccess(profileId, messageLength, generationTimeMs) {
    trackEvent('Generate_Connection_Message_Success', {
        profile_id: profileId,
        message_length: messageLength,
        generation_time_ms: generationTimeMs
    });
}

// Connection message generation failure
export function trackGenerateConnectionMessageFailure(profileId, error) {
    trackEvent('Generate_Connection_Message_Failure', {
        profile_id: profileId,
        error: error
    });
}

// Profile visit
export function trackProfileVisit(profileId, profileType) {
    trackEvent('Profile_Visit', {
        profile_id: profileId,
        profile_type: profileType || 'standard'
    });
}

// Reaction click
export function trackReactionClick(postId, reactionType) {
    trackEvent('Reaction_Click', {
        post_id: postId,
        reaction_type: reactionType
    });
}

/**
 * API tracking functions:
 */

// API call
export function trackApiCall(endpoint, parameters = {}) {
    trackEvent('API_Call', {
        endpoint: endpoint,
        parameters: JSON.stringify(parameters)
    });
}

// API call success
export function trackApiCallSuccess(endpoint, responseTimeMs, responseSize) {
    trackEvent('API_Call_Success', {
        endpoint: endpoint,
        response_time_ms: responseTimeMs,
        response_size_bytes: responseSize
    });
}

// API call failure
export function trackApiCallFailure(endpoint, error, statusCode) {
    trackEvent('API_Call_Failure', {
        endpoint: endpoint,
        error: error,
        status_code: statusCode
    });
}

/**
 * Session tracking functions:
 */

// Track session start
export function trackSessionStart(email) {
    const sessionStartTime = Date.now();
    // Store the start time in localStorage
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('session_start_time', sessionStartTime);
    }

    trackEvent('Session_Start', {
        email: email,
        timestamp: new Date(sessionStartTime).toISOString()
    });
}

// Track session end
export function trackSessionEnd() {
    if (typeof localStorage === 'undefined') {
        return;
    }

    const sessionStartTime = parseInt(localStorage.getItem('session_start_time') || '0');
    if (sessionStartTime) {
        const sessionDuration = Date.now() - sessionStartTime;
        trackEvent('Session_End', {
            session_duration_ms: sessionDuration,
            timestamp: new Date().toISOString()
        });
        localStorage.removeItem('session_start_time');
    }
}

/**
 * Feature usage tracking functions:
 */

// Track feature usage
export function trackFeatureUsage(featureName, context = {}) {
    trackEvent('Feature_Usage', {
        feature: featureName,
        ...context
    });
}

// Track feature success
export function trackFeatureSuccess(featureName, durationMs, context = {}) {
    trackEvent('Feature_Success', {
        feature: featureName,
        duration_ms: durationMs,
        ...context
    });
}

// Track feature failure
export function trackFeatureFailure(featureName, error, context = {}) {
    trackEvent('Feature_Failure', {
        feature: featureName,
        error: error,
        ...context
    });
}

/**
 * Performance tracking functions:
 */

// Track page load time
export function trackPageLoadTime(pageName, loadTimeMs) {
    trackEvent('Page_Load_Time', {
        page: pageName,
        load_time_ms: loadTimeMs
    });
}

// Track operation time
export function trackOperationTime(operationName, durationMs, context = {}) {
    trackEvent('Operation_Time', {
        operation: operationName,
        duration_ms: durationMs,
        ...context
    });
}

/**
 * User identification functions:
 */

// User identification (after successful login)
export function identifyUser(userId, userProperties = {}) {
    // Speichern der Benutzer-ID
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('userEmail', userId);
    }

    // Senden des Identifikationsereignisses
    trackEvent('User_Identified', {
        user_id: userId,
        ...userProperties
    });

    console.log(`User identified: ${userId}`, userProperties);
}

// Alias for switching from anonymous to identified user
export function aliasUser(newId) {
    trackEvent('User_Aliased', {
        new_id: newId
    });
    console.log(`User aliased: ${newId}`);
}

// Identify user with Supabase data
export async function identifyUserWithSupabase(supabase, userId) {
    try {
        // Get user data from Supabase via proxy
        const response = await fetch(API_ENDPOINTS.SUPABASE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                path: `/rest/v1/users?id=eq.${userId}&select=email,created_at,last_login,user_metadata`,
                method: 'GET',
                useServiceKey: true
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch user data: ${response.status}`);
        }

        const data = await response.json();

        if (data && data.length > 0 && data[0].email) {
            const userData = data[0];

            // Speichern der E-Mail für die Benutzeridentifikation
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('userEmail', userData.email);
            }

            // Set comprehensive user properties
            const userProperties = {
                email: userData.email,
                created_at: userData.created_at,
                last_login: userData.last_login || new Date().toISOString(),
                supabase_id: userId,
                // Include any user metadata
                ...userData.user_metadata
            };

            // Senden des Identifikationsereignisses
            trackEvent('User_Identified', {
                user_id: userData.email,
                ...userProperties
            });

            console.log('User identified with email:', userData.email);
            return true;
        }

        return false;
    } catch (error) {
        console.error('Error identifying user with Supabase:', error);
        return false;
    }
}

// Reset tracking (e.g., on logout)
export function resetTracking() {
    if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('userEmail');
        localStorage.removeItem('session_start_time');
    }

    trackEvent('Tracking_Reset');
    console.log('Tracking reset');
}

/**
 * Error tracking functions:
 */

// Track error
export function trackError(errorType, errorMessage, context = {}) {
    trackEvent('Error', {
        error_type: errorType,
        error_message: errorMessage,
        ...context
    });
}

// Track warning
export function trackWarning(warningType, warningMessage, context = {}) {
    trackEvent('Warning', {
        warning_type: warningType,
        warning_message: warningMessage,
        ...context
    });
}