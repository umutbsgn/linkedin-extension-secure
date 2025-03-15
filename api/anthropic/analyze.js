// api/anthropic/analyze.js
// Secure proxy for Anthropic API calls

import { createClient } from '@supabase/supabase-js';
import { trackApiCallStart, trackApiCallSuccess, trackApiCallFailure } from '../utils/tracking.js';
import { checkAndUpdateApiUsage, shouldUseOwnApiKey } from '../utils/usage.js';

// Model mapping for Anthropic API
const MODEL_MAPPING = {
    'haiku-3.5': 'claude-3-haiku-20240307',
    'sonnet-3.7': 'claude-3-5-sonnet-20241022'
};

// Default model if none is specified
const DEFAULT_MODEL = 'haiku-3.5';

export default async function handler(req, res) {
    console.log('Anthropic analyze endpoint called');
    console.log('Request method:', req.method);
    console.log('Request headers:', JSON.stringify(req.headers));

    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
        console.log('Handling OPTIONS request');
        return res.status(200).end();
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        console.log(`Method not allowed: ${req.method}`);
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get authorization token from request headers
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('Missing or invalid authorization token');
        return res.status(401).json({ error: 'Missing or invalid authorization token' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    console.log(`Token received: ${token.substring(0, 10)}...`);

    let userId = 'anonymous_user';

    // Extract data from request
    const { text, systemPrompt, model = DEFAULT_MODEL } = req.body;
    console.log('Request body:', {
        text: text ? text.substring(0, 50) + (text.length > 50 ? '...' : '') : undefined,
        systemPrompt: systemPrompt ? systemPrompt.substring(0, 50) + (systemPrompt.length > 50 ? '...' : '') : undefined,
        model
    });

    if (!text) {
        console.log('Missing required parameter: text');
        return res.status(400).json({ error: 'Missing required parameter: text' });
    }

    // Validate model
    if (!MODEL_MAPPING[model]) {
        console.log(`Invalid model specified: ${model}`);
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
            console.log('Supabase credentials not configured on server');
            trackApiCallFailure('anthropic_messages', startTime, 'Supabase credentials not configured on server');
            return res.status(500).json({ error: 'Supabase credentials not configured on server' });
        }

        console.log('Initializing Supabase client');
        // Initialize Supabase client
        const supabase = createClient(supabaseUrl, supabaseKey);

        console.log('Verifying token and getting user information');
        // Verify the token and get user information
        const authResponse = await supabase.auth.getUser(token);
        console.log('Auth response received:', JSON.stringify(authResponse, null, 2));

        const { data: { user }, error: authError } = authResponse;

        if (authError || !user) {
            console.log('Auth error or no user:', authError);
            trackApiCallFailure('anthropic_messages', startTime, authError ? authError.message : 'Invalid or expired token');
            return res.status(401).json({
                error: authError ? authError.message : 'Invalid or expired token'
            });
        }

        userId = user.id; // Update userId with actual user ID
        console.log(`User ID: ${userId}`);

        console.log('Checking if user should use their own API key');
        // Check if user should use their own API key
        const ownKeyResponse = await shouldUseOwnApiKey(supabase, userId);
        console.log('Own key response:', JSON.stringify(ownKeyResponse, null, 2));

        const { useOwnKey, apiKey: userApiKey } = ownKeyResponse;

        // Determine which API key to use
        let apiKey;
        let usingOwnKey = false;

        if (useOwnKey && userApiKey) {
            console.log('Using user\'s own API key');
            apiKey = userApiKey;
            usingOwnKey = true;
        } else {
            console.log('Checking and updating API usage');
            // Check and update API usage
            const usageResponse = await checkAndUpdateApiUsage(supabase, userId, model);
            console.log('Usage response:', JSON.stringify(usageResponse, null, 2));

            const { data: usageData, error: usageError } = usageResponse;

            if (usageError) {
                console.log('Error checking API usage:', usageError);
                trackApiCallFailure('anthropic_messages', startTime, 'Error checking API usage', { model }, user.email || userId);
                return res.status(500).json({ error: 'Error checking API usage', details: usageError });
            }

            if (!usageData.hasRemainingCalls) {
                console.log('API call limit reached');
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

            console.log('Using server API key');
            // Use the API key from environment variable
            apiKey = process.env.ANTHROPIC_API_KEY;
        }

        if (!apiKey) {
            console.log('Anthropic API key not configured');
            trackApiCallFailure('anthropic_messages', startTime,
                'Anthropic API key not configured', { model, usingOwnKey }, user.email || userId);
            return res.status(500).json({
                error: 'Anthropic API key not configured'
            });
        }

        // Map the model name to the actual Anthropic model ID
        const anthropicModel = MODEL_MAPPING[model];
        console.log(`Using Anthropic model: ${anthropicModel}`);

        console.log('Calling Anthropic API');
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

        console.log(`Anthropic API response status: ${response.status}`);

        // Handle API response
        if (!response.ok) {
            let errorMessage = response.statusText;
            try {
                const errorData = await response.json();
                console.error('API error response:', errorData);
                errorMessage = errorData.error && errorData.error.message || response.statusText;
            } catch (e) {
                console.error('Could not parse error response:', e);
                try {
                    const errorText = await response.text();
                    console.error('Error response text:', errorText);
                } catch (textError) {
                    console.error('Could not read error response text:', textError);
                }
            }

            trackApiCallFailure('anthropic_messages', startTime,
                `API call failed: ${response.status} - ${errorMessage}`, { model, usingOwnKey },
                user.email || userId);

            return res.status(response.status).json({
                error: `API call failed: ${response.status} - ${errorMessage}`,
                model: model,
                usingOwnKey: usingOwnKey
            });
        }

        console.log('Anthropic API call successful');
        // Return successful response
        const data = await response.json();
        console.log('API response data:', {
            id: data.id,
            model: data.model,
            content_length: data.content && data.content[0] && data.content[0].text ? data.content[0].text.length : 0
        });

        // Track successful API call
        const responseSize = JSON.stringify(data).length;
        trackApiCallSuccess('anthropic_messages', startTime, {
            response_size_bytes: responseSize,
            content_length: data.content && data.content[0] && data.content[0].text ? data.content[0].text.length : 0,
            model: model,
            usingOwnKey: usingOwnKey
        }, userId);

        console.log('Returning successful response');
        return res.status(200).json({
            ...data,
            model: model,
            usingOwnKey: usingOwnKey
        });
    } catch (error) {
        // Track failed API call
        console.error('Error in Anthropic API proxy:', error);
        trackApiCallFailure('anthropic_messages', startTime, error.message, { model }, userId);
        return res.status(500).json({
            error: error.message,
            model: model
        });
    }
}