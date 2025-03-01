import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    console.log('Signup API called with method:', req.method);

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { email, password } = req.body;
        console.log('Signup attempt for email:', email);

        if (!email || !password) {
            console.error('Missing email or password');
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Check environment variables
        console.log('SUPABASE_URL defined:', !!process.env.SUPABASE_URL);
        console.log('SUPABASE_ANON_KEY defined:', !!process.env.SUPABASE_ANON_KEY);
        console.log('SUPABASE_SERVICE_KEY defined:', !!process.env.SUPABASE_SERVICE_KEY);

        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
            console.error('Missing required environment variables:', {
                SUPABASE_URL_defined: !!process.env.SUPABASE_URL,
                SUPABASE_ANON_KEY_defined: !!process.env.SUPABASE_ANON_KEY
            });
            return res.status(500).json({
                error: 'Server configuration error: Missing required environment variables',
                details: {
                    SUPABASE_URL_defined: !!process.env.SUPABASE_URL,
                    SUPABASE_ANON_KEY_defined: !!process.env.SUPABASE_ANON_KEY
                }
            });
        }

        // Initialize Supabase client
        console.log('Initializing Supabase client...');
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );
        console.log('Supabase client initialized');

        // Sign up user
        console.log('Attempting to sign up user...');
        const { data, error } = await supabase.auth.signUp({
            email,
            password
        });

        if (error) {
            console.error('Supabase signup error:', error);
            return res.status(400).json({
                error: error.message,
                details: {
                    code: error.code,
                    status: error.status
                }
            });
        }

        // If email confirmation is required
        if (data.user && data.user.identities && data.user.identities.length === 0) {
            console.log('Email confirmation required for:', email);
            return res.status(200).json({
                message: 'Check your email for the confirmation link'
            });
        }

        console.log('Signup successful for user:', data.user.id);
        return res.status(200).json({
            token: data.session ? data.session.access_token : null,
            user: data.user
        });
    } catch (error) {
        console.error('Signup error:', error);
        return res.status(500).json({
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}