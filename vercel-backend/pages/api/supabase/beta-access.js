// API endpoint for Supabase beta access check
import fetch from 'node-fetch';

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
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
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Get Supabase credentials from environment variables
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return res.status(500).json({ error: 'Supabase configuration missing on server' });
        }

        // Make request to Supabase API to check beta whitelist
        const response = await fetch(`${supabaseUrl}/rest/v1/beta_whitelist?email=eq.${encodeURIComponent(email)}`, {
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error('Error response from Supabase:', errorBody);
            return res.status(response.status).json({
                error: `Error checking beta whitelist: ${response.status} ${response.statusText}`,
                details: errorBody
            });
        }

        const data = await response.json();

        // Return whether the email is in the whitelist
        return res.status(200).json({
            allowed: data.length > 0,
            message: data.length > 0 ? 'Beta access confirmed' : 'This email is not authorized for beta access'
        });
    } catch (error) {
        console.error('Error in Supabase beta access check proxy:', error);
        return res.status(500).json({
            error: 'Network error occurred while checking beta whitelist',
            details: error.toString()
        });
    }
}