// api/subscriptions/status.js
// Endpoint to get the subscription status for a user

import { createClient } from '@supabase/supabase-js';
import { trackApiCallStart, trackApiCallSuccess, trackApiCallFailure } from '../utils/tracking.js';
import { getUserSubscriptionType } from '../utils/usage.js';

export default async function handler(req, res) {
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
}