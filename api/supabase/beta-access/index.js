import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { email } = req.query;
        console.log('Beta access check for email:', email);

        if (!email) {
            return res.status(400).json({ error: 'Email parameter is required' });
        }

        // Log environment variables (without revealing sensitive values)
        console.log('SUPABASE_URL defined:', !!process.env.SUPABASE_URL);
        console.log('SUPABASE_ANON_KEY defined:', !!process.env.SUPABASE_ANON_KEY);

        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
            console.error('Missing required environment variables');
            return res.status(500).json({
                error: 'Server configuration error: Missing required environment variables',
                details: {
                    supabase_url_defined: !!process.env.SUPABASE_URL,
                    supabase_anon_key_defined: !!process.env.SUPABASE_ANON_KEY
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

        // Check if email is in beta whitelist
        console.log('Querying beta_whitelist table...');
        const { data, error } = await supabase
            .from('beta_whitelist')
            .select('*')
            .eq('email', email)
            .single();

        if (error) {
            console.error('Supabase query error:', error);

            // PGRST116 is "No rows returned" error - this is expected for emails not in the whitelist
            if (error.code === 'PGRST116') {
                console.log('No matching email found in beta whitelist');
                return res.status(200).json({
                    allowed: false,
                    message: 'This email is not authorized for beta access'
                });
            }

            return res.status(500).json({
                error: error.message,
                details: {
                    code: error.code,
                    hint: error.hint || null,
                    details: error.details || null
                }
            });
        }

        console.log('Beta access check result:', !!data);
        return res.status(200).json({
            allowed: !!data,
            message: data ? 'Beta access confirmed' : 'This email is not authorized for beta access'
        });
    } catch (error) {
        console.error('Beta access check error:', error);
        return res.status(500).json({
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}