// Einheitlicher API-Endpunkt für alle Supabase-Operationen
import fetch from 'node-fetch';

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { path, method, body, useServiceKey, token } = req.body;

        if (!path) {
            return res.status(400).json({ error: 'Path is required' });
        }

        // Get Supabase credentials from environment variables
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
        const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
            return res.status(500).json({ error: 'Supabase configuration missing on server' });
        }

        // Determine which key to use
        const apiKey = useServiceKey ? supabaseServiceKey : supabaseAnonKey;

        // Prepare headers
        const headers = {
            'Content-Type': 'application/json',
            'apikey': apiKey
        };

        // Add Authorization header
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        } else {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        // For data modification operations, add Prefer header
        if (method === 'POST' || method === 'PATCH' || method === 'PUT') {
            headers['Prefer'] = 'return=representation';
        }

        // Make request to Supabase API
        const response = await fetch(`${supabaseUrl}${path}`, {
            method: method || 'GET',
            headers,
            body: body ? JSON.stringify(body) : undefined
        });

        // Get response data
        let responseData;
        try {
            responseData = await response.json();
        } catch (e) {
            responseData = { message: 'No JSON response body' };
        }

        // Return the same status code and data that Supabase returned
        return res.status(response.status).json(responseData);
    } catch (error) {
        console.error('Error in Supabase proxy:', error);
        return res.status(500).json({ error: error.message });
    }
}