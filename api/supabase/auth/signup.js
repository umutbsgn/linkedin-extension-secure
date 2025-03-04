// api/supabase/auth/signup.js
// Secure proxy for Supabase registration

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

        // Extract registration data from request
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Missing required parameters: email and password' });
        }

        // Check beta access if required
        if (process.env.REQUIRE_BETA_ACCESS === 'true') {
            const { data: betaData, error: betaError } = await supabase
                .from('beta_whitelist')
                .select('*')
                .eq('email', email)
                .single();

            if (betaError || !betaData) {
                return res.status(403).json({
                    error: 'This email is not authorized for beta access'
                });
            }
        }

        // Register with Supabase
        const { data, error } = await supabase.auth.signUp({
            email,
            password
        });

        // Handle registration errors
        if (error) {
            return res.status(400).json({
                error: error.message || 'Registration failed'
            });
        }

        // Return successful response with user data
        return res.status(200).json({
            user: data.user,
            session: data.session
        });
    } catch (error) {
        console.error('Error in Supabase signup proxy:', error);
        return res.status(500).json({ error: error.message });
    }
}