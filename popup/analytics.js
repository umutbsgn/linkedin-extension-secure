// analytics.js
import { API_ENDPOINTS } from '../config.js';

// These constants are kept for backward compatibility but will be used via Vercel backend
export const POSTHOG_API_KEY = 'phc_7teyAeNgBjZ2rRuu1yiPP8mJn1lg7SjZ4hhiJgmV5ar';
export const POSTHOG_API_HOST = 'https://eu.i.posthog.com';

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
    try {
        const eventProperties = {
            timestamp: new Date().toISOString(),
            context: isBackgroundScript ? 'background' : 'content_or_popup',
            ...properties
        };

        // If we're in a popup/content script context, use PostHog directly for UI events
        // This ensures real-time tracking for UI interactions
        if (!isBackgroundScript && window.posthog) {
            window.posthog.capture(eventName, eventProperties);
        }

        // Also send to Vercel backend for secure tracking
        try {
            // Get the Supabase auth token if available
            chrome.storage.local.get('supabaseAuthToken', (result) => {
                const supabaseAuthToken = result.supabaseAuthToken;

                fetch(API_ENDPOINTS.TRACK, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': supabaseAuthToken ? `Bearer ${supabaseAuthToken}` : ''
                    },
                    body: JSON.stringify({
                        event: eventName,
                        properties: eventProperties
                    })
                }).catch(error => {
                    console.error(`Error sending event to analytics endpoint: ${error}`);
                });
            });
        } catch (backendError) {
            console.error(`Error sending event to backend: ${backendError}`);
        }

        console.log(`Event tracked: ${eventName}`, eventProperties);
    } catch (error) {
        console.error(`Error tracking event ${eventName}:`, error);
    }
}

/**
 * Authentication tracking functions:
 */

// Login attempt
export function trackLoginAttempt(email) {
    trackEvent('Login_Attempt', { email });
}

// Successful login
export function trackLoginSuccess(email) {
    trackEvent('Login_Success', { email });
}

// Failed login
export function trackLoginFailure(email, error) {
    trackEvent('Login_Failure', { email, error });
}

// Registration attempt
export function trackRegistrationAttempt(email) {
    trackEvent('Registration_Attempt', { email });
}

// Successful registration
export function trackRegistrationSuccess(email) {
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
    localStorage.setItem('session_start_time', sessionStartTime);

    trackEvent('Session_Start', {
        email: email,
        timestamp: new Date(sessionStartTime).toISOString()
    });
}

// Track session end
export function trackSessionEnd() {
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
    if (isBackgroundScript) {
        console.log(`User identification skipped in background script for: ${userId}`);
        return;
    }

    const posthog = getPostHog();
    posthog.identify(userId);

    // Set user properties if provided
    if (Object.keys(userProperties).length > 0) {
        posthog.people.set(userProperties);
    }

    console.log(`User identified: ${userId}`, userProperties);
}

// Alias for switching from anonymous to identified user
export function aliasUser(newId) {
    if (isBackgroundScript) {
        console.log(`User alias skipped in background script for: ${newId}`);
        return;
    }

    const posthog = getPostHog();
    posthog.alias(newId);
    console.log(`User aliased: ${newId}`);
}

// Identify user with Supabase data
export async function identifyUserWithSupabase(supabase, userId) {
    try {
        // Get user data from Supabase
        const { data, error } = await supabase
            .from('users')
            .select('email, created_at, last_login, user_metadata')
            .eq('id', userId)
            .single();

        if (error) throw error;

        if (data && data.email) {
            // Get additional user data if available
            let additionalData = {};
            try {
                const { data: userData, error: userError } = await supabase
                    .from('user_settings')
                    .select('*')
                    .eq('user_id', userId)
                    .single();

                if (!userError && userData) {
                    additionalData = userData;
                }
            } catch (settingsError) {
                console.error('Error fetching user settings:', settingsError);
                // Continue with basic identification even if settings fetch fails
            }

            // Get usage statistics if available
            let usageStats = {};
            try {
                const { data: activityData, error: activityError } = await supabase
                    .from('user_activity')
                    .select('comment_count, connection_count, last_active')
                    .eq('user_id', userId)
                    .single();

                if (!activityError && activityData) {
                    usageStats = activityData;
                }
            } catch (activityError) {
                console.error('Error fetching user activity:', activityError);
                // Continue with basic identification even if activity fetch fails
            }

            // Set comprehensive user properties in PostHog
            const userProperties = {
                // Standard PostHog properties
                $email: data.email,
                email: data.email, // Keep for backward compatibility
                $name: data.user_metadata ? data.user_metadata.full_name : data.email.split('@')[0],
                $created: data.created_at,

                // Account information
                last_login: data.last_login || new Date().toISOString(),
                supabase_id: userId,
                account_type: additionalData.account_type || 'standard',
                api_key_set: !!additionalData.api_key,

                // Usage metrics
                comment_count: usageStats.comment_count || 0,
                connection_messages_sent: usageStats.connection_count || 0,
                last_active: usageStats.last_active || data.last_login || new Date().toISOString(),

                // Device information
                browser: navigator.userAgent.match(/Chrome|Firefox|Safari|Edge|Opera/) ? navigator.userAgent.match(/Chrome|Firefox|Safari|Edge|Opera/)[0] : 'Unknown',
                device_type: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop',

                // Other useful properties
                email_domain: data.email.split('@')[1],

                // Include any user metadata
                ...data.user_metadata
            };

            // Identify user with their email as the distinct ID
            identifyUser(data.email, userProperties);

            // Also alias the user ID to the email for complete tracking
            aliasUser(data.email);

            // Set a PostHog event to update person profile
            trackEvent('Person_Profile_Updated', {
                email: data.email,
                update_source: 'login',
                properties_count: Object.keys(userProperties).length
            });

            console.log('User identified with email in PostHog:', data.email);
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
    if (isBackgroundScript) {
        console.log('PostHog reset skipped in background script');
        return;
    }

    const posthog = getPostHog();
    posthog.reset();
    console.log('PostHog tracking reset');
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