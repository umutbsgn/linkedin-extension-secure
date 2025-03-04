// api/supabase/auth/signup.js
// Secure proxy for Supabase registration

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
    const startTime = trackApiCallStart('supabase_signup', {
        has_email: !!email
    }, distinctId);

    try {
        // Get Supabase credentials from environment variables
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            trackApiCallFailure('supabase_signup', startTime, 'Supabase credentials not configured on server', {}, distinctId);
            return res.status(500).json({ error: 'Supabase credentials not configured on server' });
        }

        // Initialize Supabase client
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Extract registration data from request
        const { password } = req.body;

        if (!email || !password) {
            trackApiCallFailure('supabase_signup', startTime, 'Missing required parameters', {
                missing_email: !email,
                missing_password: !password
            }, distinctId);
            return res.status(400).json({ error: 'Missing required parameters: email and password' });
        }

        // Always check beta access
        {
            // Track beta access check
            const betaCheckStartTime = trackApiCallStart('beta_access_check', {
                email: email
            }, distinctId);

            const { data: betaData, error: betaError } = await supabase
                .from('beta_whitelist')
                .select('*')
                .eq('email', email)
                .single();

            if (betaError || !betaData) {
                // Track beta access failure
                trackApiCallFailure('beta_access_check', betaCheckStartTime,
                    betaError ? betaError.message : 'Email not in beta whitelist', {}, distinctId);

                trackApiCallFailure('supabase_signup', startTime, 'Beta access denied', {}, distinctId);
                return res.status(403).json({
                    error: 'This email is not authorized for beta access'
                });
            }

            // Track beta access success
            trackApiCallSuccess('beta_access_check', betaCheckStartTime, {}, distinctId);
        }

        // Register with Supabase
        const { data, error } = await supabase.auth.signUp({
            email,
            password
        });

        // Handle registration errors
        if (error) {
            trackApiCallFailure('supabase_signup', startTime, error.message, {
                error_code: error.code || 'unknown'
            }, distinctId);
            return res.status(400).json({
                error: error.message || 'Registration failed'
            });
        }

        // Track successful registration
        trackApiCallSuccess('supabase_signup', startTime, {
            user_id: data.user.id,
            has_session: !!data.session
        }, email);

        // Return successful response with user data
        return res.status(200).json({
            user: data.user,
            session: data.session
        });
    } catch (error) {
        trackApiCallFailure('supabase_signup', startTime, error.message, {}, distinctId);
        console.error('Error in Supabase signup proxy:', error);
        return res.status(500).json({ error: error.message });
    }
}