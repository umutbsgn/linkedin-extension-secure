// api/subscriptions/status.js
// Endpoint to get the subscription status for a user
// Updated to fix subscription type issue

import { createClient } from '@supabase/supabase-js';
import { trackApiCallStart, trackApiCallSuccess, trackApiCallFailure } from '../utils/tracking.js';
import { getUserSubscriptionType } from '../utils/usage.js';

export default async function handler(req, res) {
    console.log('Subscription status endpoint called');

    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Add Cache-Control headers to prevent caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');

    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow GET requests
    if (req.method !== 'GET') {
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

    // Start tracking the API call
    const startTime = trackApiCallStart('subscription_status', {});

    try {
        // Get Supabase credentials from environment variables
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Use service key for admin operations

        if (!supabaseUrl || !supabaseKey) {
            console.log('Supabase credentials not configured on server');
            trackApiCallFailure('subscription_status', startTime, 'Supabase credentials not configured on server');
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
            trackApiCallFailure('subscription_status', startTime, authError ? authError.message : 'Invalid or expired token');
            return res.status(401).json({
                error: authError ? authError.message : 'Invalid or expired token'
            });
        }

        userId = user.id; // Update userId with actual user ID
        console.log(`User ID: ${userId}`);

        console.log(`Checking subscription for user ${userId}`);
        try {
            // Use the centralized check_user_subscription function
            const { data: subscriptionData, error: subscriptionError } = await supabase.rpc('check_user_subscription', {
                user_id: userId
            });

            if (subscriptionError) {
                console.error('Error checking subscription:', subscriptionError);
                trackApiCallFailure('subscription_status', startTime, 'Error checking subscription', {}, user.email || userId);
                return res.status(500).json({ error: 'Error checking subscription', details: subscriptionError });
            }

            console.log('Subscription data from check_user_subscription:', JSON.stringify(subscriptionData, null, 2));
            console.log('subscription_type:', subscriptionData.subscription_type);
            console.log('is_active:', subscriptionData.is_active);
            console.log('subscription_id:', subscriptionData.subscription_id);
            console.log('current_period_end:', subscriptionData.current_period_end);

            // Force subscription_type to match what's in the database
            const subscriptionType = subscriptionData.subscription_type;
            console.log('Using subscription_type from database:', subscriptionType);

            // Check if user has own API key configured
            const useOwnApiKey = subscriptionData.use_own_api_key && subscriptionData.own_api_key;
            console.log(`User ${userId} should use own API key: ${!!useOwnApiKey}`);

            // Track successful API call
            trackApiCallSuccess('subscription_status', startTime, {
                subscription_type: subscriptionData.subscription_type,
                has_active_subscription: subscriptionData.is_active,
                use_own_api_key: !!useOwnApiKey
            }, userId);

            console.log('Returning subscription status');
            // Return the subscription status
            const response = {
                subscriptionType: subscriptionType, // Use the forced value
                hasActiveSubscription: subscriptionData.is_active,
                useOwnApiKey: !!useOwnApiKey,
                subscription: subscriptionData.is_active ? {
                    id: subscriptionData.subscription_id,
                    status: 'active',
                    currentPeriodStart: null, // Could be added to check_user_subscription if needed
                    currentPeriodEnd: subscriptionData.current_period_end
                } : null
            };

            console.log('Final response being sent to client:', JSON.stringify(response, null, 2));
            return res.status(200).json(response);
        } catch (subscriptionError) {
            console.error('Error in getUserSubscriptionType:', subscriptionError);
            trackApiCallFailure('subscription_status', startTime, `Error in getUserSubscriptionType: ${subscriptionError.message}`, {}, userId);
            return res.status(500).json({ error: `Error in getUserSubscriptionType: ${subscriptionError.message}` });
        }
    } catch (error) {
        // Track failed API call
        console.error('Error in subscription status endpoint:', error);
        trackApiCallFailure('subscription_status', startTime, error.message, {}, userId);
        return res.status(500).json({ error: error.message });
    }
}