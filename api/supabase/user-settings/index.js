// api/supabase/user-settings/index.js
// Secure proxy for user settings operations

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    // Allow GET, POST, and PATCH requests
    if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'PATCH') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Get Supabase credentials from environment variables
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Use service key for admin operations

        if (!supabaseUrl || !supabaseKey) {
            return res.status(500).json({ error: 'Supabase credentials not configured on server' });
        }

        // Initialize Supabase client
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Get authorization token from request headers
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid authorization token' });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Verify the token and get user information
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({
                error: authError ? authError.message : 'Invalid or expired token'
            });
        }

        const userId = user.id;

        // Handle different request methods
        if (req.method === 'GET') {
            // Get user settings
            const { data, error } = await supabase
                .from('user_settings')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
                return res.status(500).json({
                    error: error.message || 'Error fetching user settings'
                });
            }

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
                return res.status(500).json({
                    error: error.message || 'Error creating user settings'
                });
            }

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
                    return res.status(500).json({
                        error: insertError.message || 'Error creating user settings'
                    });
                }

                return res.status(201).json(insertData[0]);
            }

            return res.status(200).json(data[0]);
        }
    } catch (error) {
        console.error('Error in user settings endpoint:', error);
        return res.status(500).json({ error: error.message });
    }
}