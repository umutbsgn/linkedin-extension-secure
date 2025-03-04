// api/supabase/auth/login.js
// Secure proxy for Supabase authentication

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Get Supabase credentials from environment variables
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return res.status(500).json({ error: 'Supabase credentials not configured on server' });
        }

        // Initialize Supabase client
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Extract login credentials from request
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Missing required parameters: email and password' });
        }

        // Authenticate with Supabase
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        // Handle authentication errors
        if (error) {
            return res.status(401).json({
                error: error.message || 'Authentication failed'
            });
        }

        // Return successful response with session data
        return res.status(200).json({
            session: {
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token,
                user: data.user
            }
        });
    } catch (error) {
        console.error('Error in Supabase login proxy:', error);
        return res.status(500).json({ error: error.message });
    }
}