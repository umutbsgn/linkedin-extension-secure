import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    console.log('Login API called with method:', req.method);

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
        console.log('Login attempt for email:', email);

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

        // Sign in user
        console.log('Attempting to sign in user...');
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            console.error('Supabase authentication error:', error);
            return res.status(401).json({
                error: error.message,
                details: {
                    code: error.code,
                    status: error.status
                }
            });
        }

        console.log('Login successful for user:', data.user.id);
        return res.status(200).json({
            token: data.session.access_token,
            user: data.user
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}