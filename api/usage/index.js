// api/usage/index.js
// API endpoint for retrieving user API usage

import { createClient } from '@supabase/supabase-js';
import { trackApiCallStart, trackApiCallSuccess, trackApiCallFailure } from '../utils/tracking.js';
import { getCurrentApiUsage } from '../utils/usage.js';

export default async function handler(req, res) {
    console.log('API usage endpoint called');

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
    const startTime = trackApiCallStart('api_usage', {}, userId);

    try {
        // Get Supabase credentials from environment variables
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Use service key for admin operations

        if (!supabaseUrl || !supabaseKey) {
            console.log('Supabase credentials not configured on server');
            trackApiCallFailure('api_usage', startTime, 'Supabase credentials not configured on server');
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
            trackApiCallFailure('api_usage', startTime, authError ? authError.message : 'Invalid or expired token');
            return res.status(401).json({
                error: authError ? authError.message : 'Invalid or expired token'
            });
        }

        userId = user.id; // Update userId with actual user ID
        console.log(`User ID: ${userId}`);

        console.log('Getting current API usage for user');
        // Get the current API usage for the user
        try {
            const usageResponse = await getCurrentApiUsage(supabase, userId);
            console.log('Usage response received:', JSON.stringify(usageResponse, null, 2));

            const { data: usageData, error: usageError } = usageResponse;

            if (usageError) {
                console.log('Usage error:', usageError);
                trackApiCallFailure('api_usage', startTime, 'Error retrieving API usage', {}, userId);
                return res.status(500).json({ error: 'Error retrieving API usage', details: usageError });
            }

            // Track successful API call
            trackApiCallSuccess('api_usage', startTime, {}, userId);

            console.log('Returning API usage data');
            // Return the API usage data
            return res.status(200).json(usageData);
        } catch (usageError) {
            console.error('Error in getCurrentApiUsage:', usageError);
            trackApiCallFailure('api_usage', startTime, `Error in getCurrentApiUsage: ${usageError.message}`, {}, userId);
            return res.status(500).json({ error: `Error in getCurrentApiUsage: ${usageError.message}` });
        }
    } catch (error) {
        // Track failed API call
        console.error('Error in API usage endpoint:', error);
        trackApiCallFailure('api_usage', startTime, error.message, {}, userId);
        return res.status(500).json({ error: error.message });
    }
}