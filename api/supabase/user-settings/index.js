// api/supabase/user-settings/index.js
// Secure proxy for user settings operations

import { createClient } from '@supabase/supabase-js';
import { trackApiEvent, trackApiCallStart, trackApiCallSuccess, trackApiCallFailure } from '../../utils/tracking.js';

export default async function handler(req, res) {
    // Allow GET, POST, and PATCH requests
    if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'PATCH') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Extract method for tracking
    const method = req.method;

    // Start tracking the API call
    const startTime = trackApiCallStart('user_settings', {
        method: method
    });

    try {
        // Get Supabase credentials from environment variables
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Use service key for admin operations

        if (!supabaseUrl || !supabaseKey) {
            trackApiCallFailure('user_settings', startTime, 'Supabase credentials not configured on server');
            return res.status(500).json({ error: 'Supabase credentials not configured on server' });
        }

        // Initialize Supabase client
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Get authorization token from request headers
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            trackApiCallFailure('user_settings', startTime, 'Missing or invalid authorization token');
            return res.status(401).json({ error: 'Missing or invalid authorization token' });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Verify the token and get user information
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            trackApiCallFailure('user_settings', startTime, authError ? authError.message : 'Invalid or expired token');
            return res.status(401).json({
                error: authError ? authError.message : 'Invalid or expired token'
            });
        }

        const userId = user.id;

        // Update tracking with user ID
        trackApiEvent('User_Identified', {
            user_id: userId,
            email: user.email
        }, user.email || userId);

        // Handle different request methods
        if (req.method === 'GET') {
            // Get user settings
            const { data, error } = await supabase
                .from('user_settings')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
                trackApiCallFailure('user_settings_get', startTime, error.message, {}, user.email || userId);
                return res.status(500).json({
                    error: error.message || 'Error fetching user settings'
                });
            }

            trackApiCallSuccess('user_settings_get', startTime, {
                found: !!data
            }, user.email || userId);

            return res.status(200).json(data || { user_id: userId });
        } else if (req.method === 'POST') {
            // Create new user settings
            const settingsData = {
                ...req.body,
                user_id: userId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from('user_settings')
                .insert([settingsData])
                .select();

            if (error) {
                trackApiCallFailure('user_settings_create', startTime, error.message, {}, user.email || userId);
                return res.status(500).json({
                    error: error.message || 'Error creating user settings'
                });
            }

            trackApiCallSuccess('user_settings_create', startTime, {}, user.email || userId);
            return res.status(201).json(data[0]);
        } else if (req.method === 'PATCH') {
            // Update existing user settings
            const settingsData = {
                ...req.body,
                updated_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from('user_settings')
                .update(settingsData)
                .eq('user_id', userId)
                .select();

            if (error) {
                trackApiCallFailure('user_settings_update', startTime, error.message, {}, user.email || userId);
                return res.status(500).json({
                    error: error.message || 'Error updating user settings'
                });
            }

            // If no rows were updated, try to insert instead
            if (!data || data.length === 0) {
                const newSettingsData = {
                    ...settingsData,
                    user_id: userId,
                    created_at: new Date().toISOString()
                };

                const { data: insertData, error: insertError } = await supabase
                    .from('user_settings')
                    .insert([newSettingsData])
                    .select();

                if (insertError) {
                    trackApiCallFailure('user_settings_insert', startTime, insertError.message, {}, user.email || userId);
                    return res.status(500).json({
                        error: insertError.message || 'Error creating user settings'
                    });
                }

                trackApiCallSuccess('user_settings_insert', startTime, {}, user.email || userId);
                return res.status(201).json(insertData[0]);
            }

            trackApiCallSuccess('user_settings_update', startTime, {}, user.email || userId);
            return res.status(200).json(data[0]);
        }
    } catch (error) {
        trackApiCallFailure('user_settings', startTime, error.message);
        console.error('Error in user settings endpoint:', error);
        return res.status(500).json({ error: error.message });
    }
}