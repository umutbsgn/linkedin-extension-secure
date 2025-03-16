// api/anthropic/analyze.js
// Secure proxy for Anthropic API calls

import { createClient } from '@supabase/supabase-js';
import { trackApiCallStart, trackApiCallSuccess, trackApiCallFailure } from '../utils/tracking.js';
import { checkAndUpdateApiUsage, shouldUseOwnApiKey, getUserSubscriptionType } from '../utils/usage.js';

// Model mapping for Anthropic API
const MODEL_MAPPING = {
    'haiku-3.5': 'claude-3-5-haiku-20241022', // Updated to Claude 3.5 Haiku (cheaper for trial users)
    'sonnet-3.7': 'claude-3-7-sonnet-20250219' // Updated to Claude 3.7 Sonnet (premium for pro users)
};

// Debug log to verify model mapping
console.log('CRITICAL DEBUG - Model mapping:', JSON.stringify(MODEL_MAPPING));
console.log('CRITICAL DEBUG - Accepting both short and full model names');

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

    // Validate model and convert if necessary
    let validatedModel = model;
    let anthropicModel;

    console.log(`DEBUG: Validating model: ${model}`);

    // Check if it's a short model name (key in MODEL_MAPPING)
    if (MODEL_MAPPING[model]) {
        console.log(`Using short model name: ${model}`);
        anthropicModel = MODEL_MAPPING[model];
    }
    // Check if it's a full model name (either with date or 'latest')
    else if (model.startsWith('claude-3-')) {
        console.log(`Using full model name: ${model}`);
        // Use the full model name directly
        anthropicModel = model;

        // Try to determine the short model name for internal tracking
        if (model.includes('haiku')) {
            validatedModel = 'haiku-3.5';
        } else if (model.includes('sonnet')) {
            validatedModel = 'sonnet-3.7';
        } else {
            // Default to sonnet if we can't determine
            validatedModel = 'sonnet-3.7';
        }
        console.log(`Mapped full model name ${model} to short model name ${validatedModel} for tracking`);
    }
    // Invalid model
    else {
        console.log(`Invalid model specified: ${model}`);
        return res.status(400).json({
            error: 'Invalid model specified',
            validModels: Object.keys(MODEL_MAPPING).concat(Object.values(MODEL_MAPPING))
        });
    }

    // Start tracking the API call
    const startTime = trackApiCallStart('anthropic_messages', {
        prompt_length: text ? text.length : 0,
        system_prompt_length: systemPrompt ? systemPrompt.length : 0,
        model: validatedModel // Use the validated model name for tracking
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

        // Check if trial user is trying to use sonnet-3.7 model
        if (validatedModel === 'sonnet-3.7') {
            console.log('Checking subscription type for sonnet-3.7 access');
            const subscriptionType = await getUserSubscriptionType(supabase, userId);
            console.log(`User subscription type: ${subscriptionType}`);

            if (subscriptionType === 'trial') {
                console.log('Trial user attempting to use sonnet-3.7 model - access denied');
                trackApiCallFailure('anthropic_messages', startTime, 'Trial users cannot use sonnet-3.7 model', { model: validatedModel }, user.email || userId);
                return res.status(403).json({
                    error: 'Trial users cannot use the sonnet-3.7 model. Please upgrade to Pro.',
                    subscriptionType: 'trial',
                    model: validatedModel,
                    subscriptionOptions: {
                        upgrade: true
                    }
                });
            }
        }

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
            // Check and update API usage with the validated model name
            const usageResponse = await checkAndUpdateApiUsage(supabase, userId, validatedModel);
            console.log('Usage response:', JSON.stringify(usageResponse, null, 2));

            const { data: usageData, error: usageError } = usageResponse;

            if (usageError) {
                console.log('Error checking API usage:', usageError);
                trackApiCallFailure('anthropic_messages', startTime, 'Error checking API usage', { model: validatedModel }, user.email || userId);
                return res.status(500).json({ error: 'Error checking API usage', details: usageError });
            }

            if (!usageData.hasRemainingCalls) {
                console.log('API call limit reached');
                trackApiCallFailure('anthropic_messages', startTime, 'API call limit reached', { model: validatedModel }, user.email || userId);
                return res.status(403).json({
                    error: 'Monthly API call limit reached',
                    limit: usageData.limit,
                    used: usageData.callsCount,
                    model: validatedModel,
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
                'Anthropic API key not configured', { model: validatedModel, usingOwnKey }, user.email || userId);
            return res.status(500).json({
                error: 'Anthropic API key not configured'
            });
        }

        console.log(`CRITICAL DEBUG - Model requested: ${model}, mapped to Anthropic model: ${anthropicModel}, using validated model ${validatedModel} for tracking`);

        console.log('Calling Anthropic API');
        // Prepare request body
        const requestBody = {
            model: anthropicModel, // Use the validated Anthropic model name
            max_tokens: 1024,
            system: systemPrompt || "",
            messages: [
                { role: "user", content: text }
            ]
        };

        console.log('Anthropic API request body:', JSON.stringify({
            ...requestBody,
            system: requestBody.system ? requestBody.system.substring(0, 50) + '...' : '',
            messages: [{ role: "user", content: text.substring(0, 50) + '...' }]
        }));

        // Call Anthropic API
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
                "anthropic-dangerous-direct-browser-access": "true" // Allow direct browser access
            },
            body: JSON.stringify(requestBody)
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
                `API call failed: ${response.status} - ${errorMessage}`, { model: validatedModel, usingOwnKey },
                user.email || userId);

            return res.status(response.status).json({
                error: `API call failed: ${response.status} - ${errorMessage}`,
                model: validatedModel,
                usingOwnKey: usingOwnKey
            });
        }

        console.log('Anthropic API call successful');
        // Return successful response
        const data = await response.json();
        console.log('CRITICAL DEBUG - API response data:', {
            id: data.id,
            model: data.model,
            requested_model: model,
            mapped_model: anthropicModel,
            content_length: data.content && data.content[0] && data.content[0].text ? data.content[0].text.length : 0
        });

        // Track successful API call
        const responseSize = JSON.stringify(data).length;
        trackApiCallSuccess('anthropic_messages', startTime, {
            response_size_bytes: responseSize,
            content_length: data.content && data.content[0] && data.content[0].text ? data.content[0].text.length : 0,
            model: validatedModel,
            usingOwnKey: usingOwnKey
        }, userId);

        console.log('Returning successful response');
        return res.status(200).json({
            ...data,
            model: validatedModel,
            usingOwnKey: usingOwnKey
        });
    } catch (error) {
        // Track failed API call
        console.error('Error in Anthropic API proxy:', error);
        trackApiCallFailure('anthropic_messages', startTime, error.message, { model: validatedModel }, userId);
        return res.status(500).json({
            error: error.message,
            model: validatedModel
        });
    }
}