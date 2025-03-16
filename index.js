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

// Models endpoint
app.get('/api/models', async(req, res) => {
    console.log('Models endpoint called');

    // Get authorization token from request headers
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('Missing or invalid authorization token');
        return res.status(401).json({ error: 'Missing or invalid authorization token' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    console.log(`Token received: ${token.substring(0, 10)}...`);

    try {
        // Get Supabase credentials from environment variables
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Use service key for admin operations

        if (!supabaseUrl || !supabaseKey) {
            console.log('Supabase credentials not configured on server');
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
            return res.status(401).json({
                error: authError ? authError.message : 'Invalid or expired token'
            });
        }

        const userId = user.id;
        console.log(`User ID: ${userId}`);

        console.log('Getting available models for user');
        // Get available models for the user
        const { data, error } = await supabase.rpc('get_available_models', { user_id: userId });

        if (error) {
            console.log('Error getting available models:', error);
            return res.status(500).json({ error: 'Error retrieving available models', details: error });
        }

        console.log('Available models data:', data);
        // Return the available models
        return res.status(200).json(data);
    } catch (error) {
        console.error('Error in models endpoint:', error);
        return res.status(500).json({ error: error.message });
    }
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
    const currentDate = new Date().toISOString().substring(0, 10); // YYYY-MM-DD

    try {
        // Get the API usage limit (hardcoded for now)
        const limit = 50;

        // Get the current usage
        const { data, error } = await supabase
            .from('api_usage')
            .select('*')
            .eq('user_id', userId)
            .eq('date', currentDate)
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
    const currentDate = new Date().toISOString().substring(0, 10); // YYYY-MM-DD

    try {
        // Get the API usage limit (hardcoded for now)
        const limit = 50;

        // Check if an entry exists for the current date
        let { data, error } = await supabase
            .from('api_usage')
            .select('*')
            .eq('user_id', userId)
            .eq('date', currentDate)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
            console.error('Error checking API usage:', error);
            return { error };
        }

        // If no entry exists, create a new one
        if (!data) {
            console.log(`Creating new API usage entry for user ${userId} and date ${currentDate}`);
            const { data: newData, error: insertError } = await supabase
                .from('api_usage')
                .insert([{
                    user_id: userId,
                    date: currentDate,
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

// Supabase auth login endpoint
app.post('/api/supabase/auth/login', async(req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Get Supabase credentials from environment variables
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return res.status(500).json({ error: 'Supabase credentials not configured on server' });
        }

        // Initialize Supabase client
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Sign in with email and password
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            return res.status(401).json({ error: error.message });
        }

        return res.status(200).json(data);
    } catch (error) {
        console.error('Error in Supabase login:', error);
        return res.status(500).json({ error: error.message });
    }
});

// Supabase auth signup endpoint
app.post('/api/supabase/auth/signup', async(req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Get Supabase credentials from environment variables
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return res.status(500).json({ error: 'Supabase credentials not configured on server' });
        }

        // Initialize Supabase client
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Sign up with email and password
        const { data, error } = await supabase.auth.signUp({
            email,
            password
        });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        return res.status(200).json(data);
    } catch (error) {
        console.error('Error in Supabase signup:', error);
        return res.status(500).json({ error: error.message });
    }
});

// Supabase proxy endpoint
app.post('/api/supabase/proxy', async(req, res) => {
    try {
        // Extract data from request
        const { path, method, body, useServiceKey, token } = req.body;

        if (!path) {
            return res.status(400).json({ error: 'Missing required parameter: path' });
        }

        // Get Supabase credentials from environment variables
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = useServiceKey ?
            process.env.SUPABASE_SERVICE_KEY :
            process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return res.status(500).json({ error: 'Supabase credentials not configured on server' });
        }

        // Prepare headers for the request
        const headers = {
            'Content-Type': 'application/json',
            'apikey': supabaseKey
        };

        // Add authorization header if token is provided
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // Construct the full URL
        const url = `${supabaseUrl}${path}`;

        // Make the request to Supabase
        const response = await fetch(url, {
            method: method || 'GET',
            headers,
            body: body ? JSON.stringify(body) : undefined
        });

        // Get the response data
        const data = await response.json().catch(() => ({}));

        // Return the response with the same status code
        return res.status(response.status).json(data);
    } catch (error) {
        console.error('Error in Supabase proxy:', error);
        return res.status(500).json({ error: error.message });
    }
});

// Subscription status endpoint
app.get('/api/subscriptions/status', async(req, res) => {
    // Get authorization token from request headers
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization token' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    let userId = 'anonymous_user';

    try {
        // Get Supabase credentials from environment variables
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Use service key for admin operations

        if (!supabaseUrl || !supabaseKey) {
            return res.status(500).json({ error: 'Supabase credentials not configured on server' });
        }

        // Initialize Supabase client
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Verify the token and get user information
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({
                error: authError ? authError.message : 'Invalid or expired token'
            });
        }

        userId = user.id; // Update userId with actual user ID

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
            return res.status(500).json({ error: 'Error checking subscription status' });
        }

        // Determine subscription type
        const subscriptionType = data ? 'pro' : 'trial';

        // Check if user has own API key configured
        const useOwnApiKey = data && data.use_own_api_key && data.own_api_key;

        // Return the subscription status
        return res.status(200).json({
            subscriptionType,
            hasActiveSubscription: !!data,
            useOwnApiKey: !!useOwnApiKey,
            subscription: data ? {
                id: data.stripe_subscription_id,
                status: data.status,
                currentPeriodStart: data.current_period_start,
                currentPeriodEnd: data.current_period_end
            } : null
        });
    } catch (error) {
        console.error('Error getting subscription status:', error);
        return res.status(500).json({ error: error.message });
    }
});

// Create checkout session endpoint
app.post('/api/subscriptions/create-checkout', async(req, res) => {
    // Get authorization token from request headers
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization token' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    let userId = 'anonymous_user';

    try {
        // Get Stripe secret key and price ID
        const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
        const stripePriceId = process.env.STRIPE_PRO_PRICE_ID;

        if (!stripeSecretKey) {
            return res.status(500).json({ error: 'Stripe secret key not configured' });
        }

        if (!stripePriceId) {
            return res.status(500).json({ error: 'Stripe price ID not configured' });
        }

        // Initialize Stripe
        const Stripe = require('stripe');
        const stripe = new Stripe(stripeSecretKey);

        // Get Supabase credentials from environment variables
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Use service key for admin operations

        if (!supabaseUrl || !supabaseKey) {
            return res.status(500).json({ error: 'Supabase credentials not configured on server' });
        }

        // Initialize Supabase client
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Verify the token and get user information
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
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
            return res.status(500).json({ error: 'Error checking subscription status' });
        }

        // If user already has an active subscription, return error
        if (subscriptionData) {
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

        // Return the checkout session ID
        return res.status(200).json({
            sessionId: session.id,
            url: session.url
        });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        return res.status(500).json({ error: error.message });
    }
});

// Update API key endpoint
app.post('/api/subscriptions/update-api-key', async(req, res) => {
    // Get authorization token from request headers
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization token' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    let userId = 'anonymous_user';

    try {
        // Get Supabase credentials from environment variables
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Use service key for admin operations

        if (!supabaseUrl || !supabaseKey) {
            return res.status(500).json({ error: 'Supabase credentials not configured on server' });
        }

        // Initialize Supabase client
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Verify the token and get user information
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({
                error: authError ? authError.message : 'Invalid or expired token'
            });
        }

        userId = user.id; // Update userId with actual user ID

        // Check if user has a Pro subscription
        const { data: subscriptionData, error: subscriptionError } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (subscriptionError && subscriptionError.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
            return res.status(500).json({ error: 'Error checking subscription status' });
        }

        // Only Pro users can use their own API key
        if (!subscriptionData) {
            return res.status(403).json({
                error: 'Only Pro users can use their own API key',
                subscriptionType: 'trial'
            });
        }

        // Get the API key and use flag from the request
        const { apiKey, useOwnKey } = req.body;

        if (useOwnKey && (!apiKey || apiKey.trim() === '')) {
            return res.status(400).json({ error: 'API key is required when useOwnKey is true' });
        }

        // Update the subscription entry
        const { error: updateError } = await supabase
            .from('user_subscriptions')
            .update({
                use_own_api_key: useOwnKey,
                own_api_key: apiKey,
                updated_at: new Date().toISOString()
            })
            .eq('id', subscriptionData.id);

        if (updateError) {
            return res.status(500).json({ error: `Error updating subscription entry: ${updateError.message}` });
        }

        // Return success
        return res.status(200).json({
            success: true,
            message: 'API key settings updated successfully',
            useOwnKey
        });
    } catch (error) {
        console.error('Error updating API key:', error);
        return res.status(500).json({ error: error.message });
    }
});

// Cancel subscription endpoint
app.post('/api/subscriptions/cancel', async(req, res) => {
    // Get authorization token from request headers
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization token' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    let userId = 'anonymous_user';

    try {
        // Get Stripe secret key
        const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

        if (!stripeSecretKey) {
            return res.status(500).json({ error: 'Stripe secret key not configured' });
        }

        // Initialize Stripe
        const Stripe = require('stripe');
        const stripe = new Stripe(stripeSecretKey);

        // Get Supabase credentials from environment variables
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Use service key for admin operations

        if (!supabaseUrl || !supabaseKey) {
            return res.status(500).json({ error: 'Supabase credentials not configured on server' });
        }

        // Initialize Supabase client
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Verify the token and get user information
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
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
            return res.status(500).json({ error: 'Error getting subscription details' });
        }

        if (!subscriptionData) {
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
                return res.status(500).json({ error: `Error updating subscription entry: ${updateError.message}` });
            }

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
                return res.status(500).json({ error: `Error updating subscription entry: ${updateError.message}` });
            }

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
        console.error('Error canceling subscription:', error);
        return res.status(500).json({ error: error.message });
    }
});

// User settings endpoint
app.get('/api/supabase/user-settings', async(req, res) => {
    // Get authorization token from request headers
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization token' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
        // Get Supabase credentials from environment variables
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Use service key for admin operations

        if (!supabaseUrl || !supabaseKey) {
            return res.status(500).json({ error: 'Supabase credentials not configured on server' });
        }

        // Initialize Supabase client
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Verify the token and get user information
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({
                error: authError ? authError.message : 'Invalid or expired token'
            });
        }

        // Get user settings
        const { data, error } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
            return res.status(500).json({ error: 'Error retrieving user settings' });
        }

        // Return user settings or empty object if not found
        return res.status(200).json(data || {});
    } catch (error) {
        console.error('Error retrieving user settings:', error);
        return res.status(500).json({ error: error.message });
    }
});

// Update user settings endpoint
app.post('/api/supabase/user-settings', async(req, res) => {
    // Get authorization token from request headers
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization token' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
        // Get Supabase credentials from environment variables
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Use service key for admin operations

        if (!supabaseUrl || !supabaseKey) {
            return res.status(500).json({ error: 'Supabase credentials not configured on server' });
        }

        // Initialize Supabase client
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Verify the token and get user information
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({
                error: authError ? authError.message : 'Invalid or expired token'
            });
        }

        // Get the settings from the request body
        const settings = req.body;
        if (!settings) {
            return res.status(400).json({ error: 'Settings are required' });
        }

        // Add user_id and updated_at to settings
        const updatedSettings = {
            ...settings,
            user_id: user.id,
            updated_at: new Date().toISOString()
        };

        // Check if user settings already exist
        const { data: existingSettings, error: getError } = await supabase
            .from('user_settings')
            .select('id')
            .eq('user_id', user.id)
            .single();

        if (getError && getError.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
            return res.status(500).json({ error: 'Error checking existing user settings' });
        }

        let result;
        if (existingSettings) {
            // Update existing settings
            result = await supabase
                .from('user_settings')
                .update(updatedSettings)
                .eq('id', existingSettings.id)
                .select();
        } else {
            // Insert new settings
            result = await supabase
                .from('user_settings')
                .insert([updatedSettings])
                .select();
        }

        if (result.error) {
            return res.status(500).json({ error: 'Error saving user settings' });
        }

        // Return updated settings
        return res.status(200).json(result.data[0]);
    } catch (error) {
        console.error('Error saving user settings:', error);
        return res.status(500).json({ error: error.message });
    }
});

// Beta access check endpoint
app.get('/api/supabase/beta-access', async(req, res) => {
    try {
        const { email } = req.query;

        if (!email) {
            return res.status(400).json({ error: 'Email parameter is required' });
        }

        // Get Supabase credentials from environment variables
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return res.status(500).json({ error: 'Supabase credentials not configured on server' });
        }

        // Initialize Supabase client
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Check if email is in beta whitelist
        const { data, error } = await supabase
            .from('beta_whitelist')
            .select('*')
            .eq('email', email.toLowerCase())
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
            return res.status(500).json({ error: 'Error checking beta access' });
        }

        // Return whether email is in whitelist
        return res.status(200).json({ allowed: !!data });
    } catch (error) {
        console.error('Error checking beta access:', error);
        return res.status(500).json({ error: error.message });
    }
});

// Anthropic API proxy endpoint
app.post('/api/anthropic/analyze', async(req, res) => {
    console.log('Anthropic analyze endpoint called');
    console.log('Request method:', req.method);
    console.log('Request headers:', JSON.stringify(req.headers));
    console.log('Request body:', {
        text: req.body.text ? req.body.text.substring(0, 50) + (req.body.text.length > 50 ? '...' : '') : undefined,
        systemPrompt: req.body.systemPrompt ? req.body.systemPrompt.substring(0, 50) + (req.body.systemPrompt.length > 50 ? '...' : '') : undefined,
        model: req.body.model
    });

    // Get authorization token from request headers
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('Missing or invalid authorization token');
        return res.status(401).json({ error: 'Missing or invalid authorization token' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    console.log(`Token received: ${token.substring(0, 10)}...`);

    let userId = 'anonymous_user';

    // Start tracking the API call
    const startTime = trackApiCallStart('anthropic_messages', {
        prompt_length: req.body.text ? req.body.text.length : 0,
        system_prompt_length: req.body.systemPrompt ? req.body.systemPrompt.length : 0,
        model: req.body.model
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

        // Model mapping for Anthropic API
        const MODEL_MAPPING = {
            'haiku-3.5': 'claude-3-haiku-20240307',
            'sonnet-3.7': 'claude-3-5-sonnet-20241022'
        };

        // Default model if none is specified
        const DEFAULT_MODEL = 'haiku-3.5';

        // Extract data from request
        const { text, systemPrompt, model = DEFAULT_MODEL } = req.body;

        if (!text) {
            console.log('Missing required parameter: text');
            trackApiCallFailure('anthropic_messages', startTime, 'Missing required parameter: text', {}, user.email || userId);
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
        const apiKey = process.env.ANTHROPIC_API_KEY;

        if (!apiKey) {
            console.log('Anthropic API key not configured');
            trackApiCallFailure('anthropic_messages', startTime,
                'Anthropic API key not configured', { model }, user.email || userId);
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
                `API call failed: ${response.status} - ${errorMessage}`, { model },
                user.email || userId);

            return res.status(response.status).json({
                error: `API call failed: ${response.status} - ${errorMessage}`,
                model: model
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
            model: model
        }, userId);

        console.log('Returning successful response');
        return res.status(200).json({
            ...data,
            model: model
        });
    } catch (error) {
        // Track failed API call
        console.error('Error in Anthropic API proxy:', error);
        trackApiCallFailure('anthropic_messages', startTime, error.message, { model: req.body.model }, userId);
        return res.status(500).json({
            error: error.message,
            model: req.body.model
        });
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