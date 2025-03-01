import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    console.log('User settings API called with method:', req.method);

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Verify authentication token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.error('Missing or invalid authorization header');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    console.log('Token received, verifying...');

    // Check environment variables
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
        console.error('Missing required environment variables:', {
            SUPABASE_URL_defined: !!process.env.SUPABASE_URL,
            SUPABASE_SERVICE_KEY_defined: !!process.env.SUPABASE_SERVICE_KEY
        });
        return res.status(500).json({
            error: 'Server configuration error: Missing required environment variables',
            details: {
                SUPABASE_URL_defined: !!process.env.SUPABASE_URL,
                SUPABASE_SERVICE_KEY_defined: !!process.env.SUPABASE_SERVICE_KEY
            }
        });
    }

    try {
        // Initialize Supabase client
        console.log('Initializing Supabase client...');
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY
        );
        console.log('Supabase client initialized');

        // Verify the token and get user
        console.log('Verifying token and getting user...');
        const { data, error: authError } = await supabase.auth.getUser(token);

        if (authError) {
            console.error('Authentication error:', authError);
            return res.status(401).json({
                error: 'Invalid authentication token',
                details: authError.message
            });
        }

        if (!data || !data.user) {
            console.error('No user found for token');
            return res.status(401).json({ error: 'User not found for provided token' });
        }

        const user = data.user;
        console.log('User authenticated:', user.id);

        try {
            if (req.method === 'GET') {
                console.log('Getting user settings for user:', user.id);
                // Get user settings
                const { data, error } = await supabase
                    .from('user_settings')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                if (error) {
                    console.error('Error fetching user settings:', error);

                    // If no settings found, return empty settings instead of 404
                    if (error.code === 'PGRST116') { // No rows returned
                        console.log('No settings found, returning empty settings');
                        return res.status(200).json({
                            user_id: user.id,
                            api_key: '',
                            system_prompt: '',
                            connect_system_prompt: '',
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        });
                    }

                    return res.status(500).json({
                        error: 'Failed to fetch user settings',
                        details: error.message,
                        code: error.code
                    });
                }

                console.log('User settings retrieved successfully');
                return res.status(200).json(data);
            } else if (req.method === 'POST') {
                console.log('Saving user settings for user:', user.id);
                console.log('Settings data:', JSON.stringify(req.body));

                const settingsData = {
                    ...req.body,
                    user_id: user.id,
                    updated_at: new Date().toISOString()
                };

                // Try to update first
                console.log('Attempting to update existing settings...');
                const { data: updateData, error: updateError } = await supabase
                    .from('user_settings')
                    .update(settingsData)
                    .eq('user_id', user.id);

                // If no rows were updated, try an insert
                if (updateError || (updateData && updateData.length === 0)) {
                    console.log('No rows updated, attempting insert instead');

                    // Add created_at for new records
                    settingsData.created_at = new Date().toISOString();

                    const { data: insertData, error: insertError } = await supabase
                        .from('user_settings')
                        .insert(settingsData);

                    if (insertError) {
                        console.error('Error inserting user settings:', insertError);
                        return res.status(500).json({
                            error: 'Failed to insert user settings',
                            details: insertError.message,
                            code: insertError.code
                        });
                    }

                    console.log('Settings inserted successfully');
                    return res.status(201).json(insertData || settingsData);
                }

                if (updateError) {
                    console.error('Error updating user settings:', updateError);
                    return res.status(500).json({
                        error: 'Failed to update user settings',
                        details: updateError.message,
                        code: updateError.code
                    });
                }

                console.log('Settings updated successfully');
                return res.status(200).json(updateData || settingsData);
            }
        } catch (error) {
            console.error('User settings operation error:', error);
            return res.status(500).json({
                error: 'Error processing user settings request',
                details: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    } catch (error) {
        console.error('Supabase initialization or authentication error:', error);
        return res.status(500).json({
            error: 'Server error during authentication',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}