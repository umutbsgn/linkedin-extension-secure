// api/subscriptions/update-api-key.js
// Endpoint to update the user's own API key

import { createClient } from '@supabase/supabase-js';
import { trackApiCallStart, trackApiCallSuccess, trackApiCallFailure } from '../utils/tracking.js';
import { getUserSubscriptionType } from '../utils/usage.js';

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
            // Only Pro users should be able to update API key settings
            // If no subscription data exists, the user is not a Pro user
            trackApiCallFailure('update_api_key', startTime, 'No active subscription found. Only Pro users can use their own API key', {}, user.email || userId);
            return res.status(403).json({
                error: 'No active subscription found. Only Pro users can use their own API key',
                subscriptionType
            });
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

        // Return success with the API key if useOwnKey is true
        return res.status(200).json({
            success: true,
            message: 'API key settings updated successfully',
            useOwnKey,
            apiKey: useOwnKey ? apiKey : null
        });
    } catch (error) {
        // Track failed API call
        trackApiCallFailure('update_api_key', startTime, error.message, {}, userId);

        console.error('Error updating API key:', error);
        return res.status(500).json({ error: error.message });
    }
}