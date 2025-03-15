// api/supabase/proxy.js
// General-purpose proxy for Supabase API requests

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

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

        // Initialize Supabase client
        const supabase = createClient(supabaseUrl, supabaseKey);

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
}