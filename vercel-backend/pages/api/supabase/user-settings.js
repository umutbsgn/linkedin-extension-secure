// API endpoint for Supabase user settings
import fetch from 'node-fetch';

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
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
        const { userId, token, action, data } = req.body;

        if (!userId || !token || !action) {
            return res.status(400).json({ error: 'userId, token, and action are required' });
        }

        // Get Supabase credentials from environment variables
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return res.status(500).json({ error: 'Supabase configuration missing on server' });
        }

        // Prepare request based on action
        let url = `${supabaseUrl}/rest/v1/user_settings`;
        let method = 'GET';
        let body = null;

        if (action === 'get') {
            url += `?user_id=eq.${userId}&select=*`;
        } else if (action === 'update') {
            if (!data) {
                return res.status(400).json({ error: 'data is required for update action' });
            }
            url += `?user_id=eq.${userId}`;
            method = 'PATCH';
            body = JSON.stringify(data);
        } else if (action === 'insert') {
            if (!data) {
                return res.status(400).json({ error: 'data is required for insert action' });
            }
            method = 'POST';
            body = JSON.stringify({...data, user_id: userId });
        } else {
            return res.status(400).json({ error: 'Invalid action. Must be get, update, or insert' });
        }

        // Make request to Supabase API
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${token}`,
                'Prefer': method !== 'GET' ? 'return=representation' : ''
            },
            body
        });

        // Get response data
        const responseData = await response.json();

        // Return the same status code and data that Supabase returned
        return res.status(response.status).json(responseData);
    } catch (error) {
        console.error('Error in Supabase user settings proxy:', error);
        return res.status(500).json({ error: error.message });
    }
}