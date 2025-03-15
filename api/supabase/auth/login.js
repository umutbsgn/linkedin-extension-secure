// api/supabase/auth/login.js
// Secure proxy for Supabase authentication

import { createClient } from '@supabase/supabase-js';
import { trackApiCallStart, trackApiCallSuccess, trackApiCallFailure } from '../../utils/tracking.js';

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Extract email from request for tracking
    const { email } = req.body;
    const distinctId = email || 'anonymous_user';

    // Start tracking the API call
    const startTime = trackApiCallStart('supabase_login', {
        has_email: !!email
    }, distinctId);

    try {
        // Get Supabase credentials from environment variables
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            trackApiCallFailure('supabase_login', startTime, 'Supabase credentials not configured on server', {}, distinctId);
            return res.status(500).json({ error: 'Supabase credentials not configured on server' });
        }

        // Initialize Supabase client
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Extract login credentials from request
        const { password } = req.body;

        if (!email || !password) {
            trackApiCallFailure('supabase_login', startTime, 'Missing required parameters', {
                missing_email: !email,
                missing_password: !password
            }, distinctId);
            return res.status(400).json({ error: 'Missing required parameters: email and password' });
        }

        // Authenticate with Supabase
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        // Handle authentication errors
        if (error) {
            trackApiCallFailure('supabase_login', startTime, error.message, {
                error_code: error.code || 'unknown'
            }, distinctId);
            return res.status(401).json({
                error: error.message || 'Authentication failed'
            });
        }

        // Track successful login
        trackApiCallSuccess('supabase_login', startTime, {
            user_id: data.user.id
        }, email);

        // Return successful response with session data
        return res.status(200).json({
            session: {
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token,
                user: data.user
            }
        });
    } catch (error) {
        trackApiCallFailure('supabase_login', startTime, error.message, {}, distinctId);
        console.error('Error in Supabase login proxy:', error);
        return res.status(500).json({ error: error.message });
    }
}