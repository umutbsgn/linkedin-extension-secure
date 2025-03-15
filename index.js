// index.js
// Simple server for Vercel deployment

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

// Import body-parser for more control over body parsing
const bodyParser = require('body-parser');

// Special handling for Stripe webhook route
app.post('/api/subscriptions/webhook',
    // Use raw body parser for webhook route
    bodyParser.raw({ type: 'application/json' }),
    async(req, res) => {
        // Only allow POST requests
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        const sig = req.headers['stripe-signature'];
        if (!sig) {
            return res.status(400).json({ error: 'Missing Stripe signature' });
        }

        // Start tracking the API call
        const startTime = trackApiCallStart('stripe_webhook', {
            event_type: 'unknown'
        });

        try {
            // Get Stripe secret key and webhook secret
            const stripeSecretKey = await getStripeSecretKey();
            const stripeWebhookSecret = await getStripeWebhookSecret();

            if (!stripeSecretKey) {
                trackApiCallFailure('stripe_webhook', startTime, 'Stripe secret key not configured');
                return res.status(500).json({ error: 'Stripe secret key not configured' });
            }

            if (!stripeWebhookSecret) {
                trackApiCallFailure('stripe_webhook', startTime, 'Stripe webhook secret not configured');
                return res.status(500).json({ error: 'Stripe webhook secret not configured' });
            }

            // Initialize Stripe
            const stripe = new Stripe(stripeSecretKey);

            // Verify the webhook signature
            let event;
            try {
                // The raw body is available directly from the request
                event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
            } catch (err) {
                trackApiCallFailure('stripe_webhook', startTime, `Webhook signature verification failed: ${err.message}`);
                return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
            }

            // Get Supabase credentials from environment variables
            const supabaseUrl = process.env.SUPABASE_URL;
            const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Use service key for admin operations

            if (!supabaseUrl || !supabaseKey) {
                trackApiCallFailure('stripe_webhook', startTime, 'Supabase credentials not configured on server');
                return res.status(500).json({ error: 'Supabase credentials not configured on server' });
            }

            // Initialize Supabase client
            const supabase = createClient(supabaseUrl, supabaseKey);

            // Handle the event
            switch (event.type) {
                case 'checkout.session.completed':
                    {
                        const session = event.data.object;

                        // Get the user ID from the client reference ID
                        const userId = session.client_reference_id;
                        if (!userId) {
                            trackApiCallFailure('stripe_webhook', startTime, 'Missing client reference ID in checkout session');
                            return res.status(400).json({ error: 'Missing client reference ID in checkout session' });
                        }

                        // Get the subscription ID from the session
                        const subscriptionId = session.subscription;
                        if (!subscriptionId) {
                            trackApiCallFailure('stripe_webhook', startTime, 'Missing subscription ID in checkout session');
                            return res.status(400).json({ error: 'Missing subscription ID in checkout session' });
                        }

                        // Get the subscription details from Stripe
                        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

                        // Create a new subscription entry in the database
                        const { error: insertError } = await supabase
                        .from('user_subscriptions')
                        .insert([{
                            user_id: userId,
                            subscription_type: 'pro',
                            stripe_customer_id: session.customer,
                            stripe_subscription_id: subscriptionId,
                            status: subscription.status,
                            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                            current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
                        }]);

                        if (insertError) {
                            trackApiCallFailure('stripe_webhook', startTime, `Error creating subscription entry: ${insertError.message}`);
                            return res.status(500).json({ error: `Error creating subscription entry: ${insertError.message}` });
                        }

                        break;
                    }
                case 'customer.subscription.updated':
                    {
                        const subscription = event.data.object;

                        // Update the subscription entry in the database
                        const { error: updateError } = await supabase
                        .from('user_subscriptions')
                        .update({
                            status: subscription.status,
                            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                            updated_at: new Date().toISOString()
                        })
                        .eq('stripe_subscription_id', subscription.id);

                        if (updateError) {
                            trackApiCallFailure('stripe_webhook', startTime, `Error updating subscription entry: ${updateError.message}`);
                            return res.status(500).json({ error: `Error updating subscription entry: ${updateError.message}` });
                        }

                        break;
                    }
                case 'customer.subscription.deleted':
                    {
                        const subscription = event.data.object;

                        // Update the subscription entry in the database
                        const { error: updateError } = await supabase
                        .from('user_subscriptions')
                        .update({
                            status: 'canceled',
                            updated_at: new Date().toISOString()
                        })
                        .eq('stripe_subscription_id', subscription.id);

                        if (updateError) {
                            trackApiCallFailure('stripe_webhook', startTime, `Error updating subscription entry: ${updateError.message}`);
                            return res.status(500).json({ error: `Error updating subscription entry: ${updateError.message}` });
                        }

                        break;
                    }
                default:
                    // Unhandled event type
                    console.log(`Unhandled event type: ${event.type}`);
            }

            // Track successful API call
            trackApiCallSuccess('stripe_webhook', startTime, {
                event_type: event.type
            });

            // Return a 200 response to acknowledge receipt of the event
            return res.status(200).json({ received: true });
        } catch (error) {
            // Track failed API call
            trackApiCallFailure('stripe_webhook', startTime, error.message);

            console.error('Error handling Stripe webhook:', error);
            return res.status(500).json({ error: error.message });
        }
    }
);

// Parse JSON request bodies for all other routes
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

// Helper functions for Stripe integration
const getStripeSecretKey = async() => {
    return process.env.STRIPE_SECRET_KEY;
};

const getStripePriceId = async() => {
    return process.env.STRIPE_PRO_PRICE_ID;
};

const getStripeWebhookSecret = async() => {
    return process.env.STRIPE_WEBHOOK_SECRET;
};

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

// Helper function to get next month date
const getNextMonthDate = () => {
    const now = new Date();
    // First day of the next month
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth.toISOString();
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

// Helper function to get user subscription type
const getUserSubscriptionType = async(supabase, userId) => {
    try {
        // Check if user has an active subscription
        const { data, error } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
            console.error('Error checking subscription status:', error);
            return 'trial'; // Default to trial on error
        }

        // If user has an active subscription, return 'pro', otherwise 'trial'
        return data ? 'pro' : 'trial';
    } catch (error) {
        console.error('Unexpected error in getUserSubscriptionType:', error);
        return 'trial'; // Default to trial on error
    }
};

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

// Stripe Publishable Key
app.get('/api/config/stripe-publishable-key', (req, res) => {
    const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
    if (!stripePublishableKey) {
        return res.status(500).json({ error: 'Stripe publishable key not configured' });
    }
    return res.status(200).json({ key: stripePublishableKey });
});

// Stripe Secret Key (only for server-side use)
app.get('/api/config/stripe-secret-key', (req, res) => {
    // This endpoint should only be called from server-side code
    // We're adding an extra layer of security by checking the host
    const host = req.headers.host || '';
    if (!host.includes('vercel.app') && !host.includes('localhost')) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
        return res.status(500).json({ error: 'Stripe secret key not configured' });
    }
    return res.status(200).json({ key: stripeSecretKey });
});

// Stripe Price ID
app.get('/api/config/stripe-price-id', (req, res) => {
    const stripePriceId = process.env.STRIPE_PRO_PRICE_ID;
    if (!stripePriceId) {
        return res.status(500).json({ error: 'Stripe price ID not configured' });
    }
    return res.status(200).json({ priceId: stripePriceId });
});

// Stripe Webhook Secret (only for server-side use)
app.get('/api/config/stripe-webhook-secret', (req, res) => {
    // This endpoint should only be called from server-side code
    // We're adding an extra layer of security by checking the host
    const host = req.headers.host || '';
    if (!host.includes('vercel.app') && !host.includes('localhost')) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripeWebhookSecret) {
        return res.status(500).json({ error: 'Stripe webhook secret not configured' });
    }
    return res.status(200).json({ secret: stripeWebhookSecret });
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

// Subscription endpoints
// Create checkout session
app.post('/api/subscriptions/create-checkout', async(req, res) => {
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

    // Start tracking the API call
    const startTime = trackApiCallStart('create_checkout_session', {}, userId);

    try {
        // Get Stripe secret key and price ID
        const stripeSecretKey = await getStripeSecretKey();
        const stripePriceId = await getStripePriceId();

        if (!stripeSecretKey) {
            trackApiCallFailure('create_checkout_session', startTime, 'Stripe secret key not configured');
            return res.status(500).json({ error: 'Stripe secret key not configured' });
        }

        if (!stripePriceId) {
            trackApiCallFailure('create_checkout_session', startTime, 'Stripe price ID not configured');
            return res.status(500).json({ error: 'Stripe price ID not configured' });
        }

        // Initialize Stripe
        const stripe = new Stripe(stripeSecretKey);

        // Get Supabase credentials from environment variables
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Use service key for admin operations

        if (!supabaseUrl || !supabaseKey) {
            trackApiCallFailure('create_checkout_session', startTime, 'Supabase credentials not configured on server');
            return res.status(500).json({ error: 'Supabase credentials not configured on server' });
        }

        // Initialize Supabase client
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Verify the token and get user information
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            trackApiCallFailure('create_checkout_session', startTime, authError ? authError.message : 'Invalid or expired token');
            return res.status(401).json({
                error: authError ? authError.message : 'Invalid or expired token'
            });
        }

        userId = user.id; // Update userId with actual user ID

        // Check if user already has an active subscription
        const { data: subscriptionData, error: subscriptionError } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (subscriptionError && subscriptionError.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
            trackApiCallFailure('create_checkout_session', startTime, 'Error checking subscription status', {}, user.email || userId);
            return res.status(500).json({ error: 'Error checking subscription status' });
        }

        // If user already has an active subscription, return error
        if (subscriptionData) {
            trackApiCallFailure('create_checkout_session', startTime, 'User already has an active subscription', {}, user.email || userId);
            return res.status(400).json({
                error: 'You already have an active subscription',
                subscription: {
                    id: subscriptionData.stripe_subscription_id,
                    status: subscriptionData.status,
                    currentPeriodEnd: subscriptionData.current_period_end
                }
            });
        }

        // Get the success and cancel URLs from the request
        const { successUrl, cancelUrl } = req.body;

        if (!successUrl || !cancelUrl) {
            trackApiCallFailure('create_checkout_session', startTime, 'Missing success or cancel URL', {}, user.email || userId);
            return res.status(400).json({ error: 'Missing success or cancel URL' });
        }

        // Create a new checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price: stripePriceId,
                quantity: 1,
            }, ],
            mode: 'subscription',
            success_url: successUrl,
            cancel_url: cancelUrl,
            client_reference_id: userId,
            customer_email: user.email,
            metadata: {
                userId: userId,
                email: user.email
            }
        });

        // Track successful API call
        trackApiCallSuccess('create_checkout_session', startTime, {
            session_id: session.id
        }, userId);

        // Return the checkout session ID
        return res.status(200).json({
            sessionId: session.id,
            url: session.url
        });
    } catch (error) {
        // Track failed API call
        trackApiCallFailure('create_checkout_session', startTime, error.message, {}, userId);

        console.error('Error creating checkout session:', error);
        return res.status(500).json({ error: error.message });
    }
});

// Get subscription status
app.get('/api/subscriptions/status', async(req, res) => {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get authorization token from request headers
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization token' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    let userId = 'anonymous_user';

    // Start tracking the API call
    const startTime = trackApiCallStart('subscription_status', {});

    try {
        // Get Supabase credentials from environment variables
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Use service key for admin operations

        if (!supabaseUrl || !supabaseKey) {
            trackApiCallFailure('subscription_status', startTime, 'Supabase credentials not configured on server');
            return res.status(500).json({ error: 'Supabase credentials not configured on server' });
        }

        // Initialize Supabase client
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Verify the token and get user information
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            trackApiCallFailure('subscription_status', startTime, authError ? authError.message : 'Invalid or expired token');
            return res.status(401).json({
                error: authError ? authError.message : 'Invalid or expired token'
            });
        }

        userId = user.id; // Update userId with actual user ID

        // Get the subscription type
        const subscriptionType = await getUserSubscriptionType(supabase, userId);

        // Get the active subscription details
        let subscriptionData = null;
        let subscriptionError = null;

        try {
            const result = await supabase
                .from('user_subscriptions')
                .select('*')
                .eq('user_id', userId)
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            subscriptionData = result.data;
            subscriptionError = result.error;
        } catch (error) {
            console.error('Error querying subscription data:', error);
            // Continue with subscriptionData as null
        }

        // Only treat as error if it's not a "no rows returned" error
        if (subscriptionError && subscriptionError.code !== 'PGRST116') {
            trackApiCallFailure('subscription_status', startTime, 'Error getting subscription details', {}, user.email || userId);
            return res.status(500).json({ error: 'Error getting subscription details' });
        }

        // Check if user has own API key configured
        const useOwnApiKey = subscriptionData && subscriptionData.use_own_api_key && subscriptionData.own_api_key;

        // Track successful API call
        trackApiCallSuccess('subscription_status', startTime, {
            subscription_type: subscriptionType,
            has_active_subscription: !!subscriptionData,
            use_own_api_key: !!useOwnApiKey
        }, userId);

        // Return the subscription status
        return res.status(200).json({
            subscriptionType,
            hasActiveSubscription: !!subscriptionData,
            useOwnApiKey: !!useOwnApiKey,
            subscription: subscriptionData ? {
                id: subscriptionData.stripe_subscription_id,
                status: subscriptionData.status,
                currentPeriodStart: subscriptionData.current_period_start,
                currentPeriodEnd: subscriptionData.current_period_end
            } : null
        });
    } catch (error) {
        // Track failed API call
        trackApiCallFailure('subscription_status', startTime, error.message, {}, userId);

        console.error('Error getting subscription status:', error);
        return res.status(500).json({ error: error.message });
    }
});

// Cancel subscription
app.post('/api/subscriptions/cancel', async(req, res) => {
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

    // Start tracking the API call
    const startTime = trackApiCallStart('cancel_subscription', {});

    try {
        // Get Stripe secret key
        const stripeSecretKey = await getStripeSecretKey();

        if (!stripeSecretKey) {
            trackApiCallFailure('cancel_subscription', startTime, 'Stripe secret key not configured');
            return res.status(500).json({ error: 'Stripe secret key not configured' });
        }

        // Initialize Stripe
        const stripe = new Stripe(stripeSecretKey);

        // Get Supabase credentials from environment variables
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Use service key for admin operations

        if (!supabaseUrl || !supabaseKey) {
            trackApiCallFailure('cancel_subscription', startTime, 'Supabase credentials not configured on server');
            return res.status(500).json({ error: 'Supabase credentials not configured on server' });
        }

        // Initialize Supabase client
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Verify the token and get user information
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            trackApiCallFailure('cancel_subscription', startTime, authError ? authError.message : 'Invalid or expired token');
            return res.status(401).json({
                error: authError ? authError.message : 'Invalid or expired token'
            });
        }

        userId = user.id; // Update userId with actual user ID

        // Get the active subscription
        const { data: subscriptionData, error: subscriptionError } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (subscriptionError && subscriptionError.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
            trackApiCallFailure('cancel_subscription', startTime, 'Error getting subscription details', {}, user.email || userId);
            return res.status(500).json({ error: 'Error getting subscription details' });
        }

        if (!subscriptionData) {
            trackApiCallFailure('cancel_subscription', startTime, 'No active subscription found', {}, user.email || userId);
            return res.status(404).json({ error: 'No active subscription found' });
        }

        // Check if this is a Stripe subscription or just a custom subscription
        if (subscriptionData.stripe_subscription_id) {
            // Cancel the subscription in Stripe
            const subscription = await stripe.subscriptions.update(
                subscriptionData.stripe_subscription_id, { cancel_at_period_end: true }
            );

            // Update the subscription in the database
            const { error: updateError } = await supabase
                .from('user_subscriptions')
                .update({
                    status: 'canceling',
                    updated_at: new Date().toISOString()
                })
                .eq('id', subscriptionData.id);

            if (updateError) {
                trackApiCallFailure('cancel_subscription', startTime, `Error updating subscription entry: ${updateError.message}`, {}, user.email || userId);
                return res.status(500).json({ error: `Error updating subscription entry: ${updateError.message}` });
            }

            // Track successful API call
            trackApiCallSuccess('cancel_subscription', startTime, {
                subscription_id: subscriptionData.stripe_subscription_id,
                cancel_at_period_end: true
            }, userId);

            // Return success
            return res.status(200).json({
                success: true,
                message: 'Subscription will be canceled at the end of the billing period',
                subscription: {
                    id: subscription.id,
                    status: subscription.status,
                    cancelAtPeriodEnd: subscription.cancel_at_period_end,
                    currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString()
                }
            });
        } else {
            // This is a custom subscription (e.g., for users using their own API key)
            // Update the subscription in the database
            const { error: updateError } = await supabase
                .from('user_subscriptions')
                .update({
                    status: 'canceled',
                    updated_at: new Date().toISOString()
                })
                .eq('id', subscriptionData.id);

            if (updateError) {
                trackApiCallFailure('cancel_subscription', startTime, `Error updating subscription entry: ${updateError.message}`, {}, user.email || userId);
                return res.status(500).json({ error: `Error updating subscription entry: ${updateError.message}` });
            }

            // Track successful API call
            trackApiCallSuccess('cancel_subscription', startTime, {
                subscription_id: subscriptionData.id,
                custom_subscription: true
            }, userId);

            // Return success
            return res.status(200).json({
                success: true,
                message: 'Subscription has been canceled',
                subscription: {
                    id: subscriptionData.id,
                    status: 'canceled'
                }
            });
        }
    } catch (error) {
        // Track failed API call
        trackApiCallFailure('cancel_subscription', startTime, error.message, {}, userId);

        console.error('Error canceling subscription:', error);
        return res.status(500).json({ error: error.message });
    }
});

// Update API key
app.post('/api/subscriptions/update-api-key', async(req, res) => {
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

    // Start tracking the API call
    const startTime = trackApiCallStart('update_api_key', {});

    try {
        // Get Supabase credentials from environment variables
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Use service key for admin operations

        if (!supabaseUrl || !supabaseKey) {
            trackApiCallFailure('update_api_key', startTime, 'Supabase credentials not configured on server');
            return res.status(500).json({ error: 'Supabase credentials not configured on server' });
        }

        // Initialize Supabase client
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Verify the token and get user information
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            trackApiCallFailure('update_api_key', startTime, authError ? authError.message : 'Invalid or expired token');
            return res.status(401).json({
                error: authError ? authError.message : 'Invalid or expired token'
            });
        }

        userId = user.id; // Update userId with actual user ID

        // Get the subscription type
        const subscriptionType = await getUserSubscriptionType(supabase, userId);

        // Only Pro users can use their own API key
        if (subscriptionType !== 'pro') {
            trackApiCallFailure('update_api_key', startTime, 'Only Pro users can use their own API key', {}, user.email || userId);
            return res.status(403).json({
                error: 'Only Pro users can use their own API key',
                subscriptionType
            });
        }

        // Get the API key and use flag from the request
        const { apiKey, useOwnKey } = req.body;

        if (useOwnKey && (!apiKey || apiKey.trim() === '')) {
            trackApiCallFailure('update_api_key', startTime, 'API key is required when useOwnKey is true', {}, user.email || userId);
            return res.status(400).json({ error: 'API key is required when useOwnKey is true' });
        }

        // Get the active subscription
        const { data: subscriptionData, error: subscriptionError } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (subscriptionError && subscriptionError.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
            trackApiCallFailure('update_api_key', startTime, 'Error getting subscription details', {}, user.email || userId);
            return res.status(500).json({ error: 'Error getting subscription details' });
        }

        if (!subscriptionData) {
            // Create a new subscription entry with the API key
            const { error: insertError } = await supabase
                .from('user_subscriptions')
                .insert([{
                    user_id: userId,
                    subscription_type: 'pro',
                    status: 'active',
                    use_own_api_key: useOwnKey,
                    own_api_key: apiKey,
                    current_period_start: new Date().toISOString(),
                    current_period_end: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString() // 1 year from now
                }]);

            if (insertError) {
                trackApiCallFailure('update_api_key', startTime, `Error creating subscription entry: ${insertError.message}`, {}, user.email || userId);
                return res.status(500).json({ error: `Error creating subscription entry: ${insertError.message}` });
            }
        } else {
            // Update the existing subscription entry
            const { error: updateError } = await supabase
                .from('user_subscriptions')
                .update({
                    use_own_api_key: useOwnKey,
                    own_api_key: apiKey,
                    updated_at: new Date().toISOString()
                })
                .eq('id', subscriptionData.id);

            if (updateError) {
                trackApiCallFailure('update_api_key', startTime, `Error updating subscription entry: ${updateError.message}`, {}, user.email || userId);
                return res.status(500).json({ error: `Error updating subscription entry: ${updateError.message}` });
            }
        }

        // Track successful API call
        trackApiCallSuccess('update_api_key', startTime, {
            use_own_api_key: useOwnKey
        }, userId);

        // Return success
        return res.status(200).json({
            success: true,
            message: 'API key settings updated successfully',
            useOwnKey
        });
    } catch (error) {
        // Track failed API call
        trackApiCallFailure('update_api_key', startTime, error.message, {}, userId);

        console.error('Error updating API key:', error);
        return res.status(500).json({ error: error.message });
    }
});

// Redirect endpoint for Stripe checkout
app.get('/api/subscriptions/redirect', async(req, res) => {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Get the status parameter and session tracking ID
        const { status, session_id } = req.query;

        console.log('Redirect endpoint called with:', { status, session_id });

        if (!status) {
            return res.status(400).json({ error: 'Missing status parameter' });
        }

        // If no session_id is provided, just show a generic success/cancel page
        if (!session_id) {
            console.log('No session_id provided, showing generic page');
            return res.status(200).send(getGenericPage(status));
        }

        // Get Stripe secret key
        const stripeSecretKey = await getStripeSecretKey();
        if (!stripeSecretKey) {
            console.error('Stripe secret key not configured');
            return res.status(500).json({ error: 'Stripe secret key not configured' });
        }

        // Initialize Stripe
        const stripe = new Stripe(stripeSecretKey);

        try {
            // Try to find a session with matching metadata
            const sessions = await stripe.checkout.sessions.list({
                limit: 10,
                expand: ['data.metadata']
            });

            console.log('Looking for session with tracking ID:', session_id);

            // Find the session with matching tracking ID in metadata
            const matchingSession = sessions.data.find(
                s => s.metadata && s.metadata.sessionTrackingId === session_id
            );

            if (matchingSession) {
                console.log('Found matching session:', matchingSession.id);

                // Check if this was a Chrome extension checkout
                if (matchingSession.metadata.isExtension === 'true') {
                    // Get the original URL based on the status
                    const redirectUrl = status === 'success' ?
                        matchingSession.metadata.originalSuccessUrl :
                        matchingSession.metadata.originalCancelUrl;

                    if (redirectUrl) {
                        console.log('Redirecting to extension URL:', redirectUrl);
                        // Redirect to the Chrome extension
                        return res.redirect(302, redirectUrl);
                    }
                }
            } else {
                console.log('No matching session found with tracking ID:', session_id);
            }
        } catch (stripeError) {
            console.error('Error retrieving Stripe sessions:', stripeError);
            // Continue to generic page if there's an error
        }

        // If we get here, either it wasn't a Chrome extension checkout or we couldn't find the original URL
        // Show a generic success/cancel page
        console.log('Showing generic page for status:', status);
        return res.status(200).send(getGenericPage(status));
    } catch (error) {
        console.error('Error in redirect endpoint:', error);
        return res.status(500).json({ error: error.message });
    }
});

// Stripe webhook
app.post('/api/subscriptions/webhook', async(req, res) => {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const sig = req.headers['stripe-signature'];
    if (!sig) {
        return res.status(400).json({ error: 'Missing Stripe signature' });
    }

    // Start tracking the API call
    const startTime = trackApiCallStart('stripe_webhook', {
        event_type: req.body.type || 'unknown'
    });

    try {
        // Get Stripe secret key and webhook secret
        const stripeSecretKey = await getStripeSecretKey();
        const stripeWebhookSecret = await getStripeWebhookSecret();

        if (!stripeSecretKey) {
            trackApiCallFailure('stripe_webhook', startTime, 'Stripe secret key not configured');
            return res.status(500).json({ error: 'Stripe secret key not configured' });
        }

        if (!stripeWebhookSecret) {
            trackApiCallFailure('stripe_webhook', startTime, 'Stripe webhook secret not configured');
            return res.status(500).json({ error: 'Stripe webhook secret not configured' });
        }

        // Initialize Stripe
        const stripe = new Stripe(stripeSecretKey);

        // Verify the webhook signature
        let event;
        try {
            // Get the raw body as a buffer or string
            const rawBody = req.rawBody || req.body;

            // If we have the raw body as a buffer, convert it to a string
            const stripePayload = Buffer.isBuffer(rawBody) ?
                rawBody.toString('utf8') :
                typeof rawBody === 'string' ?
                rawBody :
                JSON.stringify(rawBody);

            event = stripe.webhooks.constructEvent(stripePayload, sig, stripeWebhookSecret);
        } catch (err) {
            trackApiCallFailure('stripe_webhook', startTime, `Webhook signature verification failed: ${err.message}`);
            return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
        }

        // Get Supabase credentials from environment variables
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Use service key for admin operations

        if (!supabaseUrl || !supabaseKey) {
            trackApiCallFailure('stripe_webhook', startTime, 'Supabase credentials not configured on server');
            return res.status(500).json({ error: 'Supabase credentials not configured on server' });
        }

        // Initialize Supabase client
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Handle the event
        switch (event.type) {
            case 'checkout.session.completed':
                {
                    const session = event.data.object;

                    // Get the user ID from the client reference ID
                    const userId = session.client_reference_id;
                    if (!userId) {
                        trackApiCallFailure('stripe_webhook', startTime, 'Missing client reference ID in checkout session');
                        return res.status(400).json({ error: 'Missing client reference ID in checkout session' });
                    }

                    // Get the subscription ID from the session
                    const subscriptionId = session.subscription;
                    if (!subscriptionId) {
                        trackApiCallFailure('stripe_webhook', startTime, 'Missing subscription ID in checkout session');
                        return res.status(400).json({ error: 'Missing subscription ID in checkout session' });
                    }

                    // Get the subscription details from Stripe
                    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

                    // Create a new subscription entry in the database
                    const { error: insertError } = await supabase
                    .from('user_subscriptions')
                    .insert([{
                        user_id: userId,
                        subscription_type: 'pro',
                        stripe_customer_id: session.customer,
                        stripe_subscription_id: subscriptionId,
                        status: subscription.status,
                        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                        current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
                    }]);

                    if (insertError) {
                        trackApiCallFailure('stripe_webhook', startTime, `Error creating subscription entry: ${insertError.message}`);
                        return res.status(500).json({ error: `Error creating subscription entry: ${insertError.message}` });
                    }

                    break;
                }
            case 'customer.subscription.updated':
                {
                    const subscription = event.data.object;

                    // Update the subscription entry in the database
                    const { error: updateError } = await supabase
                    .from('user_subscriptions')
                    .update({
                        status: subscription.status,
                        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('stripe_subscription_id', subscription.id);

                    if (updateError) {
                        trackApiCallFailure('stripe_webhook', startTime, `Error updating subscription entry: ${updateError.message}`);
                        return res.status(500).json({ error: `Error updating subscription entry: ${updateError.message}` });
                    }

                    break;
                }
            case 'customer.subscription.deleted':
                {
                    const subscription = event.data.object;

                    // Update the subscription entry in the database
                    const { error: updateError } = await supabase
                    .from('user_subscriptions')
                    .update({
                        status: 'canceled',
                        updated_at: new Date().toISOString()
                    })
                    .eq('stripe_subscription_id', subscription.id);

                    if (updateError) {
                        trackApiCallFailure('stripe_webhook', startTime, `Error updating subscription entry: ${updateError.message}`);
                        return res.status(500).json({ error: `Error updating subscription entry: ${updateError.message}` });
                    }

                    break;
                }
            default:
                // Unhandled event type
                console.log(`Unhandled event type: ${event.type}`);
        }

        // Track successful API call
        trackApiCallSuccess('stripe_webhook', startTime, {
            event_type: event.type
        });

        // Return a 200 response to acknowledge receipt of the event
        return res.status(200).json({ received: true });
    } catch (error) {
        // Track failed API call
        trackApiCallFailure('stripe_webhook', startTime, error.message);

        console.error('Error handling Stripe webhook:', error);
        return res.status(500).json({ error: error.message });
    }
});

// Start server
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}

/**
 * Returns a generic success/cancel page
 * @param {string} status - The status (success or canceled)
 * @returns {string} The HTML page
 */
function getGenericPage(status) {
    const isSuccess = status === 'success';
    const title = isSuccess ? 'Subscription Successful' : 'Subscription Canceled';
    const message = isSuccess ?
        'Your subscription was successful! You can now close this window and return to the extension.' :
        'Your subscription was canceled. You can close this window and return to the extension.';
    const color = isSuccess ? '#4CAF50' : '#F44336';

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    background-color: #f5f5f5;
                }
                .container {
                    text-align: center;
                    padding: 2rem;
                    background-color: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                    max-width: 500px;
                }
                h1 {
                    color: ${color};
                }
                p {
                    margin: 1rem 0;
                    font-size: 1.1rem;
                    line-height: 1.5;
                }
                .icon {
                    font-size: 4rem;
                    margin-bottom: 1rem;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="icon">${isSuccess ? '✅' : '❌'}</div>
                <h1>${title}</h1>
                <p>${message}</p>
            </div>
        </body>
        </html>
    `;
}

// Export for Vercel
module.exports = app;