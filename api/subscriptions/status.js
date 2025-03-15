// api/subscriptions/status.js
// Endpoint to get the subscription status for a user

import { createClient } from '@supabase/supabase-js';
import { trackApiCallStart, trackApiCallSuccess, trackApiCallFailure } from '../utils/tracking.js';
import { getUserSubscriptionType } from '../utils/usage.js';

export default async function handler(req, res) {
    console.log('Subscription status endpoint called');

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

        console.log('Getting subscription type');
        // Get the subscription type
        try {
            const subscriptionType = await getUserSubscriptionType(supabase, userId);
            console.log(`Subscription type for user ${userId}: ${subscriptionType}`);

            console.log('Getting active subscription details');
            // Get the active subscription details
            let subscriptionData = null;
            let subscriptionError = null;

            try {
                console.log(`Querying user_subscriptions table for user ${userId}`);
                const result = await supabase
                    .from('user_subscriptions')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('status', 'active')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                console.log('Subscription query result:', JSON.stringify(result, null, 2));

                subscriptionData = result.data;
                subscriptionError = result.error;
            } catch (error) {
                console.error('Error querying subscription data:', error);
                // Continue with subscriptionData as null
            }

            // Only treat as error if it's not a "no rows returned" error
            if (subscriptionError && subscriptionError.code !== 'PGRST116') {
                console.log('Subscription error (not PGRST116):', subscriptionError);
                trackApiCallFailure('subscription_status', startTime, 'Error getting subscription details', {}, user.email || userId);
                return res.status(500).json({ error: 'Error getting subscription details', details: subscriptionError });
            }

            if (subscriptionError && subscriptionError.code === 'PGRST116') {
                console.log('No subscription found for user (PGRST116)');
            }

            // Check if user has own API key configured
            const useOwnApiKey = subscriptionData && subscriptionData.use_own_api_key && subscriptionData.own_api_key;
            console.log(`User ${userId} should use own API key: ${!!useOwnApiKey}`);

            // Track successful API call
            trackApiCallSuccess('subscription_status', startTime, {
                subscription_type: subscriptionType,
                has_active_subscription: !!subscriptionData,
                use_own_api_key: !!useOwnApiKey
            }, userId);

            console.log('Returning subscription status');
            // Return the subscription status
            const response = {
                subscriptionType,
                hasActiveSubscription: !!subscriptionData,
                useOwnApiKey: !!useOwnApiKey,
                subscription: subscriptionData ? {
                    id: subscriptionData.stripe_subscription_id,
                    status: subscriptionData.status,
                    currentPeriodStart: subscriptionData.current_period_start,
                    currentPeriodEnd: subscriptionData.current_period_end
                } : null
            };

            console.log('Response:', JSON.stringify(response, null, 2));
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