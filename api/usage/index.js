// api/usage/index.js
// API endpoint for retrieving user API usage

import { createClient } from '@supabase/supabase-js';
import { trackApiCallStart, trackApiCallSuccess, trackApiCallFailure } from '../utils/tracking.js';
import { getCurrentApiUsage, invalidateSubscriptionCache, getAllApiUsage } from '../utils/usage.js';

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

        // Invalidate the subscription cache for the user to ensure we get the latest data
        try {
            invalidateSubscriptionCache(userId);
            console.log(`Invalidated subscription cache for user ${userId} before retrieving API usage`);
        } catch (cacheError) {
            console.error('Error invalidating subscription cache:', cacheError);
            // Continue with the request even if cache invalidation fails
        }

        // Get the current API usage for the user
        try {
            console.log(`Getting API usage for user ${userId}`);

            // Use getAllApiUsage instead of getCurrentApiUsage to get usage for all models
            const { data: usageData, error: usageError } = await getAllApiUsage(supabase, userId);

            if (usageError) {
                console.error('Detailed usage error:', usageError);
                trackApiCallFailure('api_usage', startTime, `Error retrieving API usage: ${usageError.message || JSON.stringify(usageError)}`, {}, userId);
                return res.status(500).json({
                    error: 'Error retrieving API usage',
                    details: usageError.message || JSON.stringify(usageError),
                    errorCode: usageError.code
                });
            }

            // Track successful API call
            trackApiCallSuccess('api_usage', startTime, {}, userId);

            console.log(`Successfully retrieved API usage for user ${userId}`);

            // Return the API usage data
            return res.status(200).json(usageData);
        } catch (usageError) {
            console.error('Unexpected error in getAllApiUsage:', usageError);
            trackApiCallFailure('api_usage', startTime, `Unexpected error in getAllApiUsage: ${usageError.message}`, {}, userId);
            return res.status(500).json({
                error: 'Unexpected error retrieving API usage',
                details: usageError.message,
                stack: usageError.stack
            });
        }

    } catch (error) {
        // Track failed API call
        trackApiCallFailure('api_usage', startTime, error.message, {}, userId);

        console.error('Error in API usage endpoint:', error);
        return res.status(500).json({ error: error.message });
    }
}