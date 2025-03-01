import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { email, password } = req.body;

        // Initialize Supabase client
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );

        // Sign up user
        const { data, error } = await supabase.auth.signUp({
            email,
            password
        });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        // If email confirmation is required
        if (data.user && data.user.identities && data.user.identities.length === 0) {
            return res.status(200).json({
                message: 'Check your email for the confirmation link'
            });
        }

        return res.status(200).json({
            token: data.session ? data.session.access_token : null,
            user: data.user
        });
    } catch (error) {
        console.error('Signup error:', error);
        return res.status(500).json({ error: error.message });
    }
}