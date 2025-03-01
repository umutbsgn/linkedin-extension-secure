import { Anthropic } from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
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

        // Get user's API key from user_settings
        const { data: settings, error: settingsError } = await supabase
            .from('user_settings')
            .select('api_key')
            .eq('user_id', user.id)
            .single();

        if (settingsError || !settings || !settings.api_key) {
            return res.status(400).json({ error: 'API key not found in user settings' });
        }

        const { prompt, systemPrompt } = req.body;

        // Initialize Anthropic client with user's API key
        const anthropic = new Anthropic({
            apiKey: settings.api_key,
        });

        // Call Anthropic API
        const response = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 1024,
            system: systemPrompt,
            messages: [
                { role: "user", content: prompt }
            ]
        });

        return res.status(200).json(response);
    } catch (error) {
        console.error('Anthropic API error:', error);
        return res.status(500).json({ error: error.message });
    }
}