// api/supabase/beta-access/index.js
// Secure proxy for checking beta access

import { createClient } from '@supabase/supabase-js';
import { trackApiCallStart, trackApiCallSuccess, trackApiCallFailure } from '../../utils/tracking.js';

export default async function handler(req, res) {
    // Allow GET and POST requests
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Extract email from request for tracking
    let email;
    if (req.method === 'GET') {
        email = req.query.email;
    } else {
        email = req.body.email;
    }
    const distinctId = email || 'anonymous_user';

    // Start tracking the API call
    const startTime = trackApiCallStart('beta_access_check', {
        method: req.method,
        has_email: !!email
    }, distinctId);

    try {
        // Get Supabase credentials from environment variables
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            trackApiCallFailure('beta_access_check', startTime, 'Supabase credentials not configured on server', {}, distinctId);
            return res.status(500).json({ error: 'Supabase credentials not configured on server' });
        }

        // Initialize Supabase client
        const supabase = createClient(supabaseUrl, supabaseKey);

        if (!email) {
            trackApiCallFailure('beta_access_check', startTime, 'Missing required parameter: email', {}, distinctId);
            return res.status(400).json({ error: 'Missing required parameter: email' });
        }

        // Check beta access
        const { data, error } = await supabase
            .from('beta_whitelist')
            .select('*')
            .eq('email', email);

        if (error) {
            trackApiCallFailure('beta_access_check', startTime, error.message, {}, distinctId);
            return res.status(500).json({
                error: error.message || 'Error checking beta access'
            });
        }

        const isAllowed = data && data.length > 0;

        // Track the result
        if (isAllowed) {
            trackApiCallSuccess('beta_access_check', startTime, {
                allowed: true
            }, distinctId);
        } else {
            trackApiCallSuccess('beta_access_check', startTime, {
                allowed: false
            }, distinctId);
        }

        // Return whether the email is in the beta whitelist
        return res.status(200).json({
            allowed: isAllowed,
            message: isAllowed ?
                'Beta access confirmed' : 'This email is not authorized for beta access'
        });
    } catch (error) {
        trackApiCallFailure('beta_access_check', startTime, error.message, {}, distinctId);
        console.error('Error in beta access check:', error);
        return res.status(500).json({ error: error.message });
    }
}