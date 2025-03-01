import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
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
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];

    // Initialize Supabase client
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
    );

    // Verify the token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
        return res.status(401).json({ error: 'Invalid authentication token' });
    }

    try {
        if (req.method === 'GET') {
            // Get user settings
            const { data, error } = await supabase
                .from('user_settings')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (error) {
                return res.status(404).json({ error: 'User settings not found' });
            }

            return res.status(200).json(data);
        } else if (req.method === 'POST') {
            const settingsData = {
                ...req.body,
                user_id: user.id,
                updated_at: new Date().toISOString()
            };

            // Try to update first
            const { data: updateData, error: updateError } = await supabase
                .from('user_settings')
                .update(settingsData)
                .eq('user_id', user.id);

            // If no rows were updated, try an insert
            if (updateError && updateError.message === 'No rows were updated') {
                const { data: insertData, error: insertError } = await supabase
                    .from('user_settings')
                    .insert(settingsData);

                if (insertError) {
                    return res.status(500).json({ error: insertError.message });
                }

                return res.status(201).json(insertData);
            }

            if (updateError) {
                return res.status(500).json({ error: updateError.message });
            }

            return res.status(200).json(updateData);
        }
    } catch (error) {
        console.error('User settings error:', error);
        return res.status(500).json({ error: error.message });
    }
}