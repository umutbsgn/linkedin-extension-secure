// api/models/index.js
// API endpoint for retrieving available models based on user subscription

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    console.log('Models endpoint called');

    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
        console.log('Handling OPTIONS request');
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
}