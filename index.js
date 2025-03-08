// index.js
// Simple server for Vercel deployment

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Parse JSON request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add debugging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log('Headers:', JSON.stringify(req.headers));
    console.log('Body:', req.body);
    next();
});

// Add CORS headers
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

// Root endpoint
app.get('/', (req, res) => {
    res.status(200).json({
        status: 'ok',
        message: 'LinkedIn Extension Secure API is running'
    });
});

// Healthcheck endpoint
app.get('/api/healthcheck', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        message: 'Vercel deployment is working correctly',
        version: '1.0.1'
    });
});

// Configuration endpoints
// Supabase URL
app.get('/api/config/supabase-url', (req, res) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    if (!supabaseUrl) {
        return res.status(500).json({ error: 'Supabase URL not configured' });
    }
    return res.status(200).json({ url: supabaseUrl });
});

// Supabase Key
app.get('/api/config/supabase-key', (req, res) => {
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseKey) {
        return res.status(500).json({ error: 'Supabase anon key not configured' });
    }
    return res.status(200).json({ key: supabaseKey });
});

// PostHog API Key
app.get('/api/config/posthog-key', (req, res) => {
    const posthogApiKey = process.env.POSTHOG_API_KEY;
    if (!posthogApiKey) {
        return res.status(500).json({ error: 'PostHog API key not configured' });
    }
    return res.status(200).json({ key: posthogApiKey });
});

// PostHog API Host
app.get('/api/config/posthog-host', (req, res) => {
    const posthogApiHost = process.env.POSTHOG_API_HOST;
    if (!posthogApiHost) {
        return res.status(500).json({ error: 'PostHog API host not configured' });
    }
    return res.status(200).json({ host: posthogApiHost });
});

// Analytics tracking endpoint
app.post('/api/analytics/track', async(req, res) => {
    try {
        const { eventName, properties, distinctId } = req.body;

        if (!eventName) {
            return res.status(400).json({ error: 'Event name is required' });
        }

        // Log the event for debugging
        console.log(`Tracking event: ${eventName}`, {
            properties,
            distinctId: distinctId || 'anonymous'
        });

        // Get PostHog configuration from environment variables
        const posthogApiKey = process.env.POSTHOG_API_KEY;
        const posthogApiHost = process.env.POSTHOG_API_HOST || 'https://eu.i.posthog.com';

        if (!posthogApiKey) {
            console.error('PostHog API key not configured');
            // Still return success to avoid breaking client functionality
            return res.status(200).json({
                success: true,
                message: 'Event acknowledged but not tracked (PostHog not configured)',
                event: eventName
            });
        }

        // Send the event to PostHog
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
                    distinct_id: distinctId || 'anonymous_user',
                    timestamp: new Date().toISOString()
                })
            });

            if (!response.ok) {
                console.error(`Error sending event to PostHog: ${response.status} ${response.statusText}`);
            } else {
                console.log(`Event successfully sent to PostHog: ${eventName}`);
            }
        } catch (posthogError) {
            console.error('Error sending event to PostHog:', posthogError);
            // Still return success to avoid breaking client functionality
        }

        return res.status(200).json({
            success: true,
            message: 'Event tracked successfully',
            event: eventName
        });
    } catch (error) {
        console.error('Error tracking event:', error);
        return res.status(500).json({
            error: 'Failed to track event',
            message: error.message
        });
    }
});

// Import required modules for API usage tracking
const { createClient } = require('@supabase/supabase-js');

// Helper functions for tracking API calls
const trackApiCallStart = (eventName, properties = {}, userId = 'anonymous_user') => {
    console.log(`[${new Date().toISOString()}] API Call Start: ${eventName}`, { properties, userId });
    return Date.now();
};

const trackApiCallSuccess = (eventName, startTime, properties = {}, userId = 'anonymous_user') => {
    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] API Call Success: ${eventName}`, {
        duration_ms: duration,
        properties,
        userId
    });
};

const trackApiCallFailure = (eventName, startTime, errorMessage, properties = {}, userId = 'anonymous_user') => {
    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] API Call Failure: ${eventName}`, {
        duration_ms: duration,
        error: errorMessage,
        properties,
        userId
    });
};

// Helper functions for API usage tracking
const getCurrentApiUsage = async(supabase, userId) => {
    const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM

    try {
        // Get the API usage limit (hardcoded for now)
        const limit = 50;

        // Get the current usage
        const { data, error } = await supabase
            .from('api_usage')
            .select('*')
            .eq('user_id', userId)
            .eq('month', currentMonth)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
            console.error('Error getting API usage:', error);
            return { error };
        }

        // If no entry exists, return default values
        if (!data) {
            return {
                data: {
                    callsCount: 0,
                    limit: limit,
                    hasRemainingCalls: true,
                    nextResetDate: getNextMonthDate()
                }
            };
        }

        // Return the current usage
        return {
            data: {
                callsCount: data.calls_count,
                limit: limit,
                hasRemainingCalls: data.calls_count < limit,
                nextResetDate: getNextMonthDate()
            }
        };
    } catch (error) {
        console.error('Unexpected error in getCurrentApiUsage:', error);
        return { error };
    }
};

// Function to check and update API usage
const checkAndUpdateApiUsage = async(supabase, userId) => {
    const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM

    try {
        // Get the API usage limit (hardcoded for now)
        const limit = 50;

        // Check if an entry exists for the current month
        let { data, error } = await supabase
            .from('api_usage')
            .select('*')
            .eq('user_id', userId)
            .eq('month', currentMonth)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
            console.error('Error checking API usage:', error);
            return { error };
        }

        // If no entry exists, create a new one
        if (!data) {
            console.log(`Creating new API usage entry for user ${userId} and month ${currentMonth}`);
            const { data: newData, error: insertError } = await supabase
                .from('api_usage')
                .insert([{
                    user_id: userId,
                    month: currentMonth,
                    calls_count: 1,
                    last_reset: new Date().toISOString()
                }])
                .select()
                .single();

            if (insertError) {
                console.error('Error creating API usage entry:', insertError);
                return { error: insertError };
            }

            return {
                data: {
                    callsCount: 1,
                    limit: limit,
                    hasRemainingCalls: true,
                    nextResetDate: getNextMonthDate()
                }
            };
        }

        // Entry exists, increment counter
        const newCount = data.calls_count + 1;
        const hasRemainingCalls = newCount <= limit;

        // Only update if the limit hasn't been exceeded
        if (hasRemainingCalls) {
            console.log(`Updating API usage for user ${userId}: ${data.calls_count} -> ${newCount}`);
            const { error: updateError } = await supabase
                .from('api_usage')
                .update({
                    calls_count: newCount,
                    updated_at: new Date().toISOString()
                })
                .eq('id', data.id);

            if (updateError) {
                console.error('Error updating API usage:', updateError);
                return { error: updateError };
            }
        }

        return {
            data: {
                callsCount: newCount,
                limit: limit,
                hasRemainingCalls,
                nextResetDate: getNextMonthDate()
            }
        };
    } catch (error) {
        console.error('Unexpected error in checkAndUpdateApiUsage:', error);
        return { error };
    }
};

// Helper function to get next month date
const getNextMonthDate = () => {
    const now = new Date();
    // First day of the next month
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth.toISOString();
};

// API Usage endpoint
app.get('/api/usage', async(req, res) => {
    // Get authorization token from request headers
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization token' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    let userId = 'anonymous_user';

    // Start tracking the API call
    const startTime = trackApiCallStart('api_usage', {}, userId);

    try {
        // Get Supabase credentials from environment variables
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Use service key for admin operations

        if (!supabaseUrl || !supabaseKey) {
            trackApiCallFailure('api_usage', startTime, 'Supabase credentials not configured on server');
            return res.status(500).json({ error: 'Supabase credentials not configured on server' });
        }

        // Initialize Supabase client
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Verify the token and get user information
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            trackApiCallFailure('api_usage', startTime, authError ? authError.message : 'Invalid or expired token');
            return res.status(401).json({
                error: authError ? authError.message : 'Invalid or expired token'
            });
        }

        userId = user.id; // Update userId with actual user ID

        // Get the current API usage for the user
        const { data: usageData, error: usageError } = await getCurrentApiUsage(supabase, userId);

        if (usageError) {
            trackApiCallFailure('api_usage', startTime, 'Error retrieving API usage', {}, userId);
            return res.status(500).json({ error: 'Error retrieving API usage' });
        }

        // Track successful API call
        trackApiCallSuccess('api_usage', startTime, {}, userId);

        // Return the API usage data
        return res.status(200).json(usageData);
    } catch (error) {
        // Track failed API call
        trackApiCallFailure('api_usage', startTime, error.message, {}, userId);

        console.error('Error in API usage endpoint:', error);
        return res.status(500).json({ error: error.message });
    }
});

// Anthropic API proxy endpoint
app.post('/api/anthropic/analyze', async(req, res) => {
    // Get authorization token from request headers
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization token' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    let userId = 'anonymous_user';

    // Start tracking the API call
    const startTime = trackApiCallStart('anthropic_messages', {
        prompt_length: req.body.text ? req.body.text.length : 0,
        system_prompt_length: req.body.systemPrompt ? req.body.systemPrompt.length : 0
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

        // Check and update API usage
        const { data: usageData, error: usageError } = await checkAndUpdateApiUsage(supabase, userId);

        if (usageError) {
            trackApiCallFailure('anthropic_messages', startTime, 'Error checking API usage', {}, user.email || userId);
            return res.status(500).json({ error: 'Error checking API usage' });
        }

        if (!usageData.hasRemainingCalls) {
            trackApiCallFailure('anthropic_messages', startTime, 'API call limit reached', {}, user.email || userId);
            return res.status(403).json({
                error: 'Monthly API call limit reached',
                limit: usageData.limit,
                used: usageData.callsCount,
                resetDate: usageData.nextResetDate
            });
        }

        // Extract data from request
        const { text, systemPrompt } = req.body;

        if (!text) {
            trackApiCallFailure('anthropic_messages', startTime, 'Missing required parameter: text', {}, user.email || userId);
            return res.status(400).json({ error: 'Missing required parameter: text' });
        }

        // Use the API key from environment variable
        const apiKey = process.env.ANTHROPIC_API_KEY;

        if (!apiKey) {
            trackApiCallFailure('anthropic_messages', startTime,
                'Anthropic API key not configured on server', {}, user.email || userId);
            return res.status(500).json({
                error: 'Anthropic API key not configured on server'
            });
        }

        // Call Anthropic API
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            },
            body: JSON.stringify({
                model: "claude-3-5-sonnet-20241022",
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
                `API call failed: ${response.status} - ${errorMessage}`, {}, user.email || userId);
            return res.status(response.status).json({
                error: `API call failed: ${response.status} - ${errorMessage}`
            });
        }

        // Return successful response
        const data = await response.json();

        // Track successful API call
        const responseSize = JSON.stringify(data).length;
        trackApiCallSuccess('anthropic_messages', startTime, {
            response_size_bytes: responseSize,
            content_length: data.content && data.content[0] && data.content[0].text ? data.content[0].text.length : 0
        }, userId);

        return res.status(200).json(data);
    } catch (error) {
        // Track failed API call
        trackApiCallFailure('anthropic_messages', startTime, error.message, {}, userId);

        console.error('Error in Anthropic API proxy:', error);
        return res.status(500).json({ error: error.message });
    }
});

// Start server
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}

// Export for Vercel
module.exports = app;