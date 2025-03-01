import { createClient } from './popup/supabase-client.js';
import { API_ENDPOINTS } from './config.js';

// Implementation of trackEvent for background script using Vercel backend
async function trackEvent(eventName, properties = {}) {
    // Handle specific event types directly
    if (eventName === 'post_comment' || eventName === 'connection_message') {
        // Keep the event name as is
        properties = {
            ...properties,
            button_type: eventName // Add button_type property
        };
    } else if (eventName === 'Autocapture') {
        // Keep as Autocapture, no changes needed
    }
    // Only track events that are in the active tracked events list
    else if (eventName !== 'post_comment' && eventName !== 'connection_message' &&
        eventName !== 'API_Call' && eventName !== 'API_Call_Success' && eventName !== 'API_Call_Failure' &&
        eventName !== 'Extension_Installed' && eventName !== 'Extension_Updated' &&
        eventName !== 'Login_Attempt' && eventName !== 'Login_Success' &&
        eventName !== 'Session_End' && eventName !== 'Analyze_Text_Attempt' &&
        eventName !== 'Analyze_Text_Success' && eventName !== 'Pageleave' &&
        eventName !== 'Session_Start' && eventName !== 'Login_Duration' &&
        eventName !== 'Rageclick' && eventName !== 'Sign_Out_Success' &&
        eventName !== 'Pageview' && eventName !== 'Login_Failure' &&
        eventName !== 'Registration_Failure' && eventName !== 'Registration_Attempt') {

        // Skip tracking for unknown events
        console.log(`Skipping unknown event: ${eventName}`);
        return;
    }

    const eventProperties = {
        timestamp: new Date().toISOString(),
        context: 'background',
        ...properties
    };

    // Try to get the user's email from Supabase to use as distinct_id
    let userEmail = null;
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user) {
            userEmail = session.user.email;
            console.log('Using user email for tracking:', userEmail);
        }
    } catch (error) {
        console.error('Error getting user email:', error);
    }

    // Send to Vercel backend instead of directly to PostHog
    try {
        // Get the Supabase auth token for authentication
        const { supabaseAuthToken } = await chrome.storage.local.get('supabaseAuthToken');

        fetch(API_ENDPOINTS.TRACK, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': supabaseAuthToken ? `Bearer ${supabaseAuthToken}` : ''
            },
            body: JSON.stringify({
                event: eventName,
                properties: eventProperties,
                distinct_id: userEmail || 'anonymous_user',
                timestamp: new Date().toISOString()
            })
        }).catch(error => {
            console.error(`Error sending event to analytics endpoint: ${error}`);
        });

        console.log(`Event tracked via Vercel backend: ${eventName}`, eventProperties);
    } catch (error) {
        console.error(`Error tracking event ${eventName}:`, error);
    }
}

// Supabase client is only used for authentication
// All data operations go through the Vercel backend
const supabase = createClient(
    'https://fslbhbywcxqmqhwdcgcl.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzbGJoYnl3Y3hxbXFod2RjZ2NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg0MTc2MTQsImV4cCI6MjA1Mzk5MzYxNH0.vOWNflNbXMjzvjVbNPDZdwQqt2jUFy0M2gnt-msWQMM'
);

const ANTHROPIC_API_KEY = 'anthropicApiKey';

async function getApiKey() {
    const result = await chrome.storage.local.get(ANTHROPIC_API_KEY);
    return result[ANTHROPIC_API_KEY];
}

async function callAnthropicAPI(prompt, systemPrompt) {
    const startTime = Date.now();

    // Track API call
    trackEvent('API_Call', {
        endpoint: 'anthropic_messages',
        prompt_length: prompt.length,
        system_prompt_length: systemPrompt.length
    });

    try {
        // Get the Supabase auth token
        const { supabaseAuthToken } = await chrome.storage.local.get('supabaseAuthToken');
        if (!supabaseAuthToken) {
            throw new Error('Authentication required. Please log in.');
        }

        // Call the Vercel backend instead of Anthropic directly
        const response = await fetch(API_ENDPOINTS.ANALYZE, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseAuthToken}`
            },
            body: JSON.stringify({
                prompt: prompt,
                systemPrompt: systemPrompt
            })
        });

        const responseTime = Date.now() - startTime;

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error || response.statusText;

            // Track API call failure
            trackEvent('API_Call_Failure', {
                endpoint: 'anthropic_messages',
                error: errorMessage,
                status_code: response.status,
                response_time_ms: responseTime
            });

            throw new Error(`API call failed: ${response.status} - ${errorMessage}`);
        }

        const data = await response.json();
        const responseSize = JSON.stringify(data).length;

        // Track API call success
        trackEvent('API_Call_Success', {
            endpoint: 'anthropic_messages',
            response_time_ms: responseTime,
            response_size_bytes: responseSize,
            content_length: data.content && data.content[0] && data.content[0].text && data.content[0].text.length || 0
        });

        return data;
    } catch (error) {
        console.error('API Call Error:', error);

        // Track API call error if not already tracked
        if (!error.message.includes('API call failed:')) {
            trackEvent('API_Call_Failure', {
                endpoint: 'anthropic_messages',
                error: error.message,
                response_time_ms: Date.now() - startTime
            });
        }

        throw error;
    }
}

// Default connect system prompt for CONNECT
const DEFAULT_CONNECT_SYSTEM_PROMPT = 'You are a LinkedIn connection request assistant. Your task is to analyze the recipient\'s profile and craft a personalized, concise connection message. Keep it friendly, professional, and highlight a shared interest or mutual benefit. Maximum 160 characters.';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "analyze") {
        callAnthropicAPI(request.text, request.systemPrompt)
            .then(response => sendResponse({ success: true, data: response }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Indicates an asynchronous response
    } else if (request.action === "storeSupabaseToken") {
        chrome.storage.local.set({ supabaseAuthToken: request.token }, () => {
            sendResponse({ success: true });
        });
        return true;
    } else if (request.action === "getSupabaseToken") {
        chrome.storage.local.get('supabaseAuthToken', (result) => {
            sendResponse({ token: result.supabaseAuthToken });
        });
        return true;
    } else if (request.action === 'getCommentSystemPrompt') {
        getCommentSystemPrompt()
            .then(systemPromptComments => sendResponse({ systemPromptComments }))
            .catch(error => sendResponse({ error: error.message }));
        return true; // Indicates an asynchronous response
    } else if (request.action === 'getConnectSystemPrompt') {
        getConnectSystemPrompt()
            .then(systemPromptConnect => sendResponse({ systemPromptConnect }))
            .catch(error => {
                console.error('Error in getConnectSystemPrompt:', error);
                sendResponse({ systemPromptConnect: DEFAULT_CONNECT_SYSTEM_PROMPT });
            });
        return true; // Indicates an asynchronous response
    } else if (request.action === 'trackEvent') {
        // Handle tracking events from content script
        trackEvent(request.eventName, request.properties)
            .then(() => sendResponse({ success: true }))
            .catch(error => {
                console.error('Error handling trackEvent:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true; // Indicates an asynchronous response
    } else if (request.action === 'posthog_track') {
        // This is a special case for background script tracking
        // Forward to popup for actual tracking in PostHog
        (async() => {
            try {
                // Handle specific event types directly
                if (request.eventName === 'post_comment' || request.eventName === 'connection_message') {
                    // Use trackEvent directly with the specific event name
                    await trackEvent(request.eventName, request.properties);
                    // No forwarding to popup to avoid loops
                }
                // Prioritize Autocapture
                else if (request.eventName === 'Autocapture') {
                    // Use trackEvent directly
                    await trackEvent('Autocapture', request.properties);
                    // No forwarding to popup to avoid loops
                }
                // For other events, map to post_comment (preferred)
                else {
                    const mappedProperties = {
                        ...request.properties,
                        original_event: request.eventName
                    };

                    await trackEvent('post_comment', mappedProperties);
                    // No forwarding to popup to avoid loops
                }

                sendResponse({ success: true });
            } catch (error) {
                console.error('Error forwarding posthog_track:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true; // Indicates an asynchronous response
    }
});

// Track extension installation and updates
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        trackEvent('Extension_Installed', {
            version: chrome.runtime.getManifest().version
        });
    } else if (details.reason === 'update') {
        trackEvent('Extension_Updated', {
            previous_version: details.previousVersion,
            current_version: chrome.runtime.getManifest().version
        });
    }
});

async function getCommentSystemPrompt() {
    try {
        // Get the Supabase auth token
        const { supabaseAuthToken } = await chrome.storage.local.get('supabaseAuthToken');
        if (!supabaseAuthToken) {
            throw new Error('No active session');
        }

        // Get user settings from Vercel backend
        const response = await fetch(API_ENDPOINTS.USER_SETTINGS, {
            headers: {
                'Authorization': `Bearer ${supabaseAuthToken}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to fetch user settings');
        }

        const data = await response.json();
        return data.system_prompt;
    } catch (error) {
        console.error('Error fetching comment system prompt:', error);
        throw error;
    }
}

async function getConnectSystemPrompt() {
    try {
        // Get the Supabase auth token
        const { supabaseAuthToken } = await chrome.storage.local.get('supabaseAuthToken');
        if (!supabaseAuthToken) {
            throw new Error('No active session');
        }

        // Get user settings from Vercel backend
        const response = await fetch(API_ENDPOINTS.USER_SETTINGS, {
            headers: {
                'Authorization': `Bearer ${supabaseAuthToken}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to fetch user settings');
        }

        const data = await response.json();

        if (data && data.connect_system_prompt) {
            console.log('Retrieved connect system prompt from backend:', data.connect_system_prompt);
            return data.connect_system_prompt;
        } else {
            console.log('No custom connect system prompt found, using default');
            return DEFAULT_CONNECT_SYSTEM_PROMPT;
        }
    } catch (error) {
        console.error('Error fetching connect system prompt:', error);
        console.log('Using default connect system prompt due to error');
        return DEFAULT_CONNECT_SYSTEM_PROMPT;
    }
}

// Initialize Supabase session and migrate old API key
chrome.runtime.onInstalled.addListener(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            chrome.storage.local.set({ supabaseAuthToken: session.access_token });
        }
    });
    migrateOldApiKey();
});

async function migrateOldApiKey() {
    const result = await chrome.storage.local.get(['apiKey', ANTHROPIC_API_KEY]);
    if (result.apiKey && !result[ANTHROPIC_API_KEY]) {
        await chrome.storage.local.set({
            [ANTHROPIC_API_KEY]: result.apiKey
        });
        await chrome.storage.local.remove('apiKey');
        console.log('Migrated old API key to new format');
    }
}