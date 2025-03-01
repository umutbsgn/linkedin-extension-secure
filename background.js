import { createClient } from './popup/supabase-client.js';
import { POSTHOG_API_KEY, POSTHOG_API_HOST } from './popup/analytics.js';

// Direct implementation of trackEvent for background script
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

    // Send directly to PostHog API
    try {
        fetch(`${POSTHOG_API_HOST}/capture/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                api_key: POSTHOG_API_KEY,
                event: eventName,
                properties: eventProperties,
                distinct_id: userEmail || 'anonymous_user', // Use email if available, otherwise anonymous
                timestamp: new Date().toISOString()
            })
        }).catch(error => {
            console.error(`Error sending event to PostHog: ${error}`);
        });

        console.log(`Event tracked directly from background: ${eventName}`, eventProperties);
    } catch (error) {
        console.error(`Error tracking event ${eventName}:`, error);
    }
}

const supabaseUrl = 'https://fslbhbywcxqmqhwdcgcl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzbGJoYnl3Y3hxbXFod2RjZ2NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg0MTc2MTQsImV4cCI6MjA1Mzk5MzYxNH0.vOWNflNbXMjzvjVbNPDZdwQqt2jUFy0M2gnt-msWQMM';
const supabase = createClient(supabaseUrl, supabaseKey);

const ANTHROPIC_API_KEY = 'anthropicApiKey';

async function getApiKey() {
    const result = await chrome.storage.local.get(ANTHROPIC_API_KEY);
    return result[ANTHROPIC_API_KEY];
}

async function callAnthropicAPI(prompt, systemPrompt) {
    const startTime = Date.now();
    const apiKey = await getApiKey();
    if (!apiKey) {
        throw new Error('API key not found. Please set your Anthropic API key in the extension options.');
    }

    // Additional validation of the API key
    if (!apiKey.startsWith('sk-ant-api')) {
        throw new Error('Invalid API key format. Please check your Anthropic API key.');
    }

    // Migrate old API key if exists
    await migrateOldApiKey();

    // Track API call
    trackEvent('API_Call', {
        endpoint: 'anthropic_messages',
        prompt_length: prompt.length,
        system_prompt_length: systemPrompt.length
    });

    try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
                "anthropic-dangerous-direct-browser-access": "true"
            },
            body: JSON.stringify({
                model: "claude-3-5-sonnet-20241022",
                max_tokens: 1024,
                system: systemPrompt,
                messages: [
                    { role: "user", content: prompt }
                ]
            })
        });

        const responseTime = Date.now() - startTime;

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error && errorData.error.message || response.statusText;

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
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new Error('No active session');
        }
        const userId = session.user.id;
        const { data, error } = await supabase
            .from('user_settings')
            .select('system_prompt')
            .eq('user_id', userId)
            .single();

        if (error) throw error;
        return data.system_prompt;
    } catch (error) {
        console.error('Error fetching comment system prompt:', error);
        throw error;
    }
}

async function getConnectSystemPrompt() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new Error('No active session');
        }
        const userId = session.user.id;
        const { data, error } = await supabase
            .from('user_settings')
            .select('connect_system_prompt')
            .eq('user_id', userId)
            .single();

        if (error) throw error;

        if (data && data.connect_system_prompt) {
            console.log('Retrieved connect system prompt from Supabase:', data.connect_system_prompt);
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