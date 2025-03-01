import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { email } = req.query;

        if (!email) {
            return res.status(400).json({ error: 'Email parameter is required' });
        }

        // Initialize Supabase client
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );

        // Check if email is in beta whitelist
        const { data, error } = await supabase
            .from('beta_whitelist')
            .select('*')
            .eq('email', email)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "No rows returned" error
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json({
            allowed: !!data,
            message: data ? 'Beta access confirmed' : 'This email is not authorized for beta access'
        });
    } catch (error) {
        console.error('Beta access check error:', error);
        return res.status(500).json({ error: error.message });
    }
}