// api/utils/tracking.js
// Shared utility for tracking API events in PostHog

/**
 * Tracks an API event in PostHog
 * @param {string} eventName - The name of the event to track
 * @param {Object} properties - Properties to include with the event
 * @param {string} [distinctId='anonymous_server'] - Distinct ID for the user
 */
export async function trackApiEvent(eventName, properties, distinctId = 'anonymous_server') {
    const posthogApiKey = process.env.POSTHOG_API_KEY;
    const posthogApiHost = process.env.POSTHOG_API_HOST || 'https://eu.i.posthog.com';

    if (!posthogApiKey) {
        console.error('PostHog API key not configured');
        return;
    }

    try {
        const response = await fetch(`${posthogApiHost}/capture/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: posthogApiKey,
                event: eventName,
                properties: {
                    ...properties,
                    source: 'vercel_backend',
                    timestamp: new Date().toISOString()
                },
                distinct_id: distinctId,
                timestamp: new Date().toISOString()
            })
        });

        if (!response.ok) {
            console.error(`Error tracking event ${eventName}: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.error(`Error tracking event ${eventName}:`, error);
    }
}

/**
 * Tracks the start of an API call
 * @param {string} endpoint - The API endpoint being called
 * @param {Object} details - Additional details about the API call
 * @param {string} [distinctId='anonymous_server'] - Distinct ID for the user
 * @returns {number} The start time in milliseconds
 */
export function trackApiCallStart(endpoint, details = {}, distinctId = 'anonymous_server') {
    const startTime = Date.now();

    trackApiEvent('API_Call', {
        endpoint,
        ...details
    }, distinctId);

    return startTime;
}

/**
 * Tracks the success of an API call
 * @param {string} endpoint - The API endpoint that was called
 * @param {number} startTime - The start time from trackApiCallStart
 * @param {Object} details - Additional details about the API response
 * @param {string} [distinctId='anonymous_server'] - Distinct ID for the user
 */
export function trackApiCallSuccess(endpoint, startTime, details = {}, distinctId = 'anonymous_server') {
    const responseTime = Date.now() - startTime;

    trackApiEvent('API_Call_Success', {
        endpoint,
        response_time_ms: responseTime,
        ...details
    }, distinctId);
}

/**
 * Tracks the failure of an API call
 * @param {string} endpoint - The API endpoint that was called
 * @param {number} startTime - The start time from trackApiCallStart
 * @param {string} error - The error message
 * @param {Object} details - Additional details about the error
 * @param {string} [distinctId='anonymous_server'] - Distinct ID for the user
 */
export function trackApiCallFailure(endpoint, startTime, error, details = {}, distinctId = 'anonymous_server') {
    const responseTime = Date.now() - startTime;

    trackApiEvent('API_Call_Failure', {
        endpoint,
        error,
        response_time_ms: responseTime,
        ...details
    }, distinctId);
}