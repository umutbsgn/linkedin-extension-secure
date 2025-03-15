// api/anthropic/analyze.js
// Secure proxy for Anthropic API calls

import { createClient } from '@supabase/supabase-js';
import { trackApiCallStart, trackApiCallSuccess, trackApiCallFailure } from '../utils/tracking.js';
import { checkAndUpdateApiUsage, shouldUseOwnApiKey, invalidateSubscriptionCache } from '../utils/usage.js';

// Model mapping for Anthropic API
const MODEL_MAPPING = {
    'haiku-3.5': 'claude-3-haiku-20240307',
    'sonnet-3.7': 'claude-3-5-sonnet-20241022'
};

// Default model if none is specified
const DEFAULT_MODEL = 'haiku-3.5';

export default async function handler(req, res) {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get authorization token from request headers
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization token' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    let userId = 'anonymous_user';

    // Extract data from request
    const { text, systemPrompt, model = DEFAULT_MODEL } = req.body;

    if (!text) {
        return res.status(400).json({ error: 'Missing required parameter: text' });
    }

    // Validate model
    if (!MODEL_MAPPING[model]) {
        return res.status(400).json({
            error: 'Invalid model specified',
            validModels: Object.keys(MODEL_MAPPING)
        });
    }

    // Start tracking the API call
    const startTime = trackApiCallStart('anthropic_messages', {
        prompt_length: text ? text.length : 0,
        system_prompt_length: systemPrompt ? systemPrompt.length : 0,
        model: model
    }, userId);

    try {
        // Get Supabase credentials from environment variables
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Use service key for admin operations

        if (!supabaseUrl || !supabaseKey) {
            trackApiCallFailure('anthropic_messages', startTime, 'Supabase credentials not configured on server');
            return res.status(500).json({ error: 'Supabase credentials not configured on server' });
        }

        // Initialize Supabase client
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Verify the token and get user information
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            trackApiCallFailure('anthropic_messages', startTime, authError ? authError.message : 'Invalid or expired token');
            return res.status(401).json({
                error: authError ? authError.message : 'Invalid or expired token'
            });
        }

        userId = user.id; // Update userId with actual user ID

        // Invalidate the subscription cache for the user to ensure we get the latest data
        try {
            invalidateSubscriptionCache(userId);
            console.log(`Invalidated subscription cache for user ${userId} before checking API usage`);
        } catch (cacheError) {
            console.error('Error invalidating subscription cache:', cacheError);
            // Continue with the request even if cache invalidation fails
        }

        // Check if user should use their own API key
        console.log(`Checking if user ${userId} should use their own API key`);
        let useOwnKey = false;
        let userApiKey = null;

        try {
            const result = await shouldUseOwnApiKey(supabase, userId);
            useOwnKey = result.useOwnKey;
            userApiKey = result.apiKey;
            console.log(`User ${userId} should use own API key: ${useOwnKey}`);
        } catch (apiKeyError) {
            console.error('Error checking if user should use own API key:', apiKeyError);
            // Continue with default values (don't use own key)
        }

        // Determine which API key to use
        let apiKey;
        let usingOwnKey = false;

        if (useOwnKey && userApiKey) {
            apiKey = userApiKey;
            usingOwnKey = true;
        } else {
            // Check and update API usage
            console.log(`Checking API usage for user ${userId} and model ${model}`);
            let usageData = {
                hasRemainingCalls: true, // Default to true to allow the call if there's an error
                limit: 0,
                callsCount: 0,
                nextResetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString()
            };

            try {
                const result = await checkAndUpdateApiUsage(supabase, userId, model);

                if (result.error) {
                    console.error('Detailed usage error in anthropic/analyze:', result.error);
                    console.log('Continuing with default usage data due to error');
                } else {
                    usageData = result.data;
                    console.log(`User ${userId} has ${usageData.callsCount} of ${usageData.limit} API calls for model ${model}`);
                }
            } catch (usageError) {
                console.error('Unexpected error in checkAndUpdateApiUsage:', usageError);
                console.log('Continuing with default usage data due to unexpected error');
            }

            if (!usageData.hasRemainingCalls) {
                console.log(`User ${userId} has reached the API call limit for model ${model}`);
                trackApiCallFailure('anthropic_messages', startTime, 'API call limit reached', { model }, user.email || userId);
                return res.status(403).json({
                    error: 'Monthly API call limit reached',
                    limit: usageData.limit,
                    used: usageData.callsCount,
                    model: model,
                    resetDate: usageData.nextResetDate,
                    subscriptionOptions: {
                        upgrade: true,
                        useOwnKey: true
                    }
                });
            }

            // Use the API key from environment variable
            apiKey = process.env.ANTHROPIC_API_KEY;
        }

        if (!apiKey) {
            console.error('Anthropic API key not configured. This is a critical error.');
            trackApiCallFailure('anthropic_messages', startTime,
                'Anthropic API key not configured', { model, usingOwnKey }, user.email || userId);
            return res.status(500).json({
                error: 'Anthropic API key not configured',
                details: 'The ANTHROPIC_API_KEY environment variable is not set in Vercel or the user has not provided their own API key.',
                usingOwnKey: usingOwnKey
            });
        }

        // Map the model name to the actual Anthropic model ID
        const anthropicModel = MODEL_MAPPING[model];

        // Call Anthropic API
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
                "anthropic-dangerous-direct-browser-access": "true" // Allow direct browser access
            },
            body: JSON.stringify({
                model: anthropicModel,
                max_tokens: 1024,
                system: systemPrompt || "",
                messages: [
                    { role: "user", content: text }
                ]
            })
        });

        // Handle API response
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error && errorData.error.message || response.statusText;

            trackApiCallFailure('anthropic_messages', startTime,
                `API call failed: ${response.status} - ${errorMessage}`, { model, usingOwnKey },
                user.email || userId);

            return res.status(response.status).json({
                error: `API call failed: ${response.status} - ${errorMessage}`,
                model: model,
                usingOwnKey: usingOwnKey
            });
        }

        // Return successful response
        const data = await response.json();

        // Track successful API call
        const responseSize = JSON.stringify(data).length;
        trackApiCallSuccess('anthropic_messages', startTime, {
            response_size_bytes: responseSize,
            content_length: data.content && data.content[0] && data.content[0].text ? data.content[0].text.length : 0,
            model: model,
            usingOwnKey: usingOwnKey
        }, userId);

        return res.status(200).json({
            ...data,
            model: model,
            usingOwnKey: usingOwnKey
        });
    } catch (error) {
        // Track failed API call
        trackApiCallFailure('anthropic_messages', startTime, error.message, { model }, userId);

        console.error('Error in Anthropic API proxy:', error);
        return res.status(500).json({
            error: error.message,
            model: model
        });
    }
}