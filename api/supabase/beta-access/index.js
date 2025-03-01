import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    console.log('Beta access API called with method:', req.method);

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
        console.log('SUPABASE_SERVICE_KEY defined:', !!process.env.SUPABASE_SERVICE_KEY);

        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
            console.error('Missing required environment variables');
            return res.status(500).json({
                error: 'Server configuration error: Missing required environment variables',
                details: {
                    supabase_url_defined: !!process.env.SUPABASE_URL,
                    supabase_service_key_defined: !!process.env.SUPABASE_SERVICE_KEY
                }
            });
        }

        // Initialize Supabase client with service key for admin access
        console.log('Initializing Supabase client with service key...');
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY
        );
        console.log('Supabase client initialized');

        // Check if email is in beta whitelist
        console.log('Querying beta_whitelist table for email:', email);
        try {
            const { data, error } = await supabase
                .from('beta_whitelist')
                .select('*')
                .eq('email', email.toLowerCase().trim());

            if (error) {
                console.error('Supabase query error:', error);
                return res.status(500).json({
                    error: 'Database query failed',
                    details: {
                        message: error.message,
                        code: error.code,
                        hint: error.hint || null
                    }
                });
            }

            // Check if any rows were returned (data is an array)
            const isAllowed = Array.isArray(data) && data.length > 0;
            console.log('Beta access check result:', isAllowed, 'Rows found:', data ? data.length : 0);

            return res.status(200).json({
                allowed: isAllowed,
                message: isAllowed ? 'Beta access confirmed' : 'This email is not authorized for beta access'
            });
        } catch (queryError) {
            console.error('Error during beta whitelist query:', queryError);
            return res.status(500).json({
                error: 'Error querying beta whitelist',
                details: queryError.message,
                stack: process.env.NODE_ENV === 'development' ? queryError.stack : undefined
            });
        }
    } catch (error) {
        console.error('Beta access check error:', error);
        return res.status(500).json({
            error: 'Server error during beta access check',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}