// api/supabase/beta-access/index.js
// Secure proxy for checking beta access

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    // Allow GET and POST requests
    if (req.method !== 'GET' && req.method !== 'POST') {
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

        // Extract email from request (either query param or body)
        let email;
        if (req.method === 'GET') {
            email = req.query.email;
        } else {
            email = req.body.email;
        }

        if (!email) {
            return res.status(400).json({ error: 'Missing required parameter: email' });
        }

        // Check beta access
        const { data, error } = await supabase
            .from('beta_whitelist')
            .select('*')
            .eq('email', email);

        if (error) {
            return res.status(500).json({
                error: error.message || 'Error checking beta access'
            });
        }

        // Return whether the email is in the beta whitelist
        return res.status(200).json({
            allowed: data && data.length > 0,
            message: data && data.length > 0 ?
                'Beta access confirmed' :
                'This email is not authorized for beta access'
        });
    } catch (error) {
        console.error('Error in beta access check:', error);
        return res.status(500).json({ error: error.message });
    }
}