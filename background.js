import { createClient } from './popup/supabase-client.js';
import { API_ENDPOINTS, MODELS, DEFAULT_MODEL } from './config.js';

// Initialize Supabase client with async function
let supabase = null;

async function initSupabase() {
    try {
        // Fetch Supabase URL and key from Vercel backend
        const urlResponse = await fetch(API_ENDPOINTS.SUPABASE_URL);
        const keyResponse = await fetch(API_ENDPOINTS.SUPABASE_KEY);

        if (!urlResponse.ok || !keyResponse.ok) {
            console.error('Failed to fetch Supabase configuration');
            // Return null instead of using hardcoded values
            return null;
        }

        const { url } = await urlResponse.json();
        const { key } = await keyResponse.json();

        return createClient(url, key);
    } catch (error) {
        console.error('Error initializing Supabase:', error);
        // Return null instead of using hardcoded values
        return null;
    }
}

// Initialize Supabase on load
initSupabase().then(client => {
    supabase = client;
    console.log('Supabase client initialized');

    // Test user_subscriptions table access
    testUserSubscriptionsTable();

    // Initialize session after Supabase is ready
    if (supabase) {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                chrome.storage.local.set({ supabaseAuthToken: session.access_token });
            }
        });
    }
});

// Testfunktion zur Überprüfung der user_subscriptions-Tabelle
async function testUserSubscriptionsTable() {
    try {
        if (!supabase) {
            console.error('Cannot test user_subscriptions table: Supabase client not initialized');
            return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            console.error('Cannot test user_subscriptions table: No active session');
            return;
        }

        console.log('Testing user_subscriptions table access...');

        // Versuche, die user_subscriptions-Tabelle abzufragen
        const { data, error } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', session.user.id)
            .single();

        if (error) {
            console.error('Error accessing user_subscriptions table:', error);

            // Überprüfe, ob es sich um einen "no rows returned"-Fehler handelt
            if (error.code === 'PGRST116') {
                console.log('No subscription found for user, but table exists');
            } else {
                console.error('Possible table access issue or other database error');
            }
        } else {
            console.log('Successfully accessed user_subscriptions table:', data);
        }

        // Teste auch die RPC-Funktion get_user_subscription_type
        console.log('Testing get_user_subscription_type function...');
        const { data: subscriptionType, error: rpcError } = await supabase
            .rpc('get_user_subscription_type', { user_id: session.user.id });

        if (rpcError) {
            console.error('Error calling get_user_subscription_type:', rpcError);
        } else {
            console.log('User subscription type:', subscriptionType);
        }

        // Teste auch den Subscription Status Endpunkt
        console.log('Testing subscription status endpoint...');
        try {
            const response = await fetch(API_ENDPOINTS.SUBSCRIPTION_STATUS, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });

            console.log('Subscription status response status:', response.status);

            if (!response.ok) {
                console.error('Failed to fetch subscription status:', response.status, response.statusText);

                // Log response body for debugging
                try {
                    const errorText = await response.text();
                    console.error('Error response body:', errorText);
                } catch (e) {
                    console.error('Could not read error response body:', e);
                }
            } else {
                const subscriptionStatus = await response.json();
                console.log('Subscription status:', subscriptionStatus);
            }
        } catch (error) {
            console.error('Error fetching subscription status:', error);
        }

        // Teste auch den API Usage Endpunkt
        console.log('Testing API usage endpoint...');
        try {
            const response = await fetch(API_ENDPOINTS.USAGE, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });

            console.log('API usage response status:', response.status);

            if (!response.ok) {
                console.error('Failed to fetch API usage:', response.status, response.statusText);

                // Log response body for debugging
                try {
                    const errorText = await response.text();
                    console.error('Error response body:', errorText);
                } catch (e) {
                    console.error('Could not read error response body:', e);
                }
            } else {
                const usageData = await response.json();
                console.log('API usage data:', usageData);
            }
        } catch (error) {
            console.error('Error fetching API usage:', error);
        }
    } catch (error) {
        console.error('Unexpected error in testUserSubscriptionsTable:', error);
    }
}

const ANTHROPIC_API_KEY = 'anthropicApiKey';

async function getApiKey() {
    const result = await chrome.storage.local.get(ANTHROPIC_API_KEY);
    return result[ANTHROPIC_API_KEY];
}

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
        if (supabase) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session && session.user) {
                userEmail = session.user.email;
                console.log('Using user email for tracking:', userEmail);
            }
        }
    } catch (error) {
        console.error('Error getting user email:', error);
    }

    // Send to Vercel backend instead of directly to PostHog
    try {
        fetch(API_ENDPOINTS.TRACK, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                eventName: eventName,
                properties: eventProperties,
                distinctId: userEmail || 'anonymous_user' // Use email if available, otherwise anonymous
            })
        }).catch(error => {
            console.error(`Error sending event to tracking endpoint: ${error}`);
        });

        console.log(`Event tracked via Vercel backend: ${eventName}`, eventProperties);
    } catch (error) {
        console.error(`Error tracking event ${eventName}:`, error);
    }
}

async function callAnthropicAPI(prompt, systemPrompt, model = DEFAULT_MODEL) {
    const startTime = Date.now();

    // Track API call
    trackEvent('API_Call', {
        endpoint: 'anthropic_messages',
        prompt_length: prompt.length,
        system_prompt_length: systemPrompt ? systemPrompt.length : 0,
        model: model
    });

    try {
        // Get auth token
        const result = await chrome.storage.local.get('supabaseAuthToken');
        const token = result.supabaseAuthToken;

        if (!token) {
            throw new Error('Not authenticated. Please log in first.');
        }

        // Call the Vercel backend endpoint with auth token
        const response = await fetch(API_ENDPOINTS.ANALYZE, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                text: prompt,
                systemPrompt: systemPrompt || "",
                model: model
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
                response_time_ms: responseTime,
                model: model
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
            content_length: data.content && data.content[0] && data.content[0].text && data.content[0].text.length || 0,
            model: model
        });

        return data;
    } catch (error) {
        console.error('API Call Error:', error);

        // Track API call error if not already tracked
        if (!error.message.includes('API call failed:')) {
            trackEvent('API_Call_Failure', {
                endpoint: 'anthropic_messages',
                error: error.message,
                response_time_ms: Date.now() - startTime,
                model: model
            });
        }

        throw error;
    }
}

// Default connect system prompt for CONNECT
const DEFAULT_CONNECT_SYSTEM_PROMPT = 'You are a LinkedIn connection request assistant. Your task is to analyze the recipient\'s profile and craft a personalized, concise connection message. Keep it friendly, professional, and highlight a shared interest or mutual benefit. Maximum 160 characters.';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "analyze") {
        callAnthropicAPI(request.text, request.systemPrompt, request.model || DEFAULT_MODEL)
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

    // Initialize Supabase session
    initSupabase().then(client => {
        if (client) {
            client.auth.getSession().then(({ data: { session } }) => {
                if (session) {
                    chrome.storage.local.set({ supabaseAuthToken: session.access_token });
                }
            });
        }
    });

    // Migrate old API key
    migrateOldApiKey();
});

async function getCommentSystemPrompt() {
    try {
        if (!supabase) {
            throw new Error('Supabase client not initialized');
        }

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
        if (!supabase) {
            throw new Error('Supabase client not initialized');
        }

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