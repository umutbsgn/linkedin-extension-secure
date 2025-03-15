// Express.js server for Vercel deployment
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// PostHog tracking endpoint
app.post('/api/posthog/track', async(req, res) => {
    try {
        const { event, properties, distinctId } = req.body;

        if (!event) {
            return res.status(400).json({ error: 'Event name is required' });
        }

        // Get PostHog credentials from environment variables
        const posthogApiKey = process.env.POSTHOG_API_KEY;
        const posthogHost = process.env.POSTHOG_API_HOST;

        if (!posthogApiKey || !posthogHost) {
            return res.status(500).json({ error: 'PostHog configuration missing on server' });
        }

        // Make request to PostHog API
        const response = await fetch(`${posthogHost}/capture/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                api_key: posthogApiKey,
                event: event,
                properties: properties || {},
                distinct_id: distinctId || 'anonymous_user',
                timestamp: new Date().toISOString()
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return res.status(response.status).json({
                error: `PostHog API call failed: ${response.status} - ${errorData.message || response.statusText}`
            });
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error in PostHog proxy:', error);
        return res.status(500).json({ error: error.message });
    }
});

// Anthropic API endpoint
app.post('/api/anthropic/analyze', async(req, res) => {
    try {
        const { text, systemPrompt } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Text parameter is required' });
        }

        // Get API key from environment variables
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'API key not configured on server' });
        }

        // Log request (without sensitive data)
        console.log(`Anthropic API request: ${text.substring(0, 50)}...`);

        // Make request to Anthropic API
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            },
            body: JSON.stringify({
                model: "claude-3-5-sonnet-20241022",
                max_tokens: 1024,
                system: systemPrompt || "You are a helpful assistant.",
                messages: [
                    { role: "user", content: text }
                ]
            })
        });

        // Handle API errors
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error && errorData.error.message || response.statusText;
            console.error(`Anthropic API error: ${response.status} - ${errorMessage}`);
            return res.status(response.status).json({
                error: `API call failed: ${response.status} - ${errorMessage}`
            });
        }

        // Return the API response
        const data = await response.json();
        return res.status(200).json(data);
    } catch (error) {
        console.error('Error in Anthropic API proxy:', error);
        return res.status(500).json({ error: error.message });
    }
});

// Supabase proxy endpoint
app.post('/api/supabase/proxy', async(req, res) => {
    try {
        const { path, method, body, useServiceKey, token } = req.body;

        if (!path) {
            return res.status(400).json({ error: 'Path is required' });
        }

        // Get Supabase credentials from environment variables
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
        const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
            return res.status(500).json({ error: 'Supabase configuration missing on server' });
        }

        // Determine which key to use
        const apiKey = useServiceKey ? supabaseServiceKey : supabaseAnonKey;

        // Prepare headers
        const headers = {
            'Content-Type': 'application/json',
            'apikey': apiKey
        };

        // Add Authorization header
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        } else {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        // For data modification operations, add Prefer header
        if (method === 'POST' || method === 'PATCH' || method === 'PUT') {
            headers['Prefer'] = 'return=representation';
        }

        // Make request to Supabase API
        const response = await fetch(`${supabaseUrl}${path}`, {
            method: method || 'GET',
            headers,
            body: body ? JSON.stringify(body) : undefined
        });

        // Get response data
        let responseData;
        try {
            responseData = await response.json();
        } catch (e) {
            responseData = { message: 'No JSON response body' };
        }

        // Return the same status code and data that Supabase returned
        return res.status(response.status).json(responseData);
    } catch (error) {
        console.error('Error in Supabase proxy:', error);
        return res.status(500).json({ error: error.message });
    }
});

// Beta access endpoint
app.post('/api/supabase/beta-access', async(req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Get Supabase credentials from environment variables
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return res.status(500).json({ error: 'Supabase configuration missing on server' });
        }

        // Make request to Supabase API to check beta whitelist
        const response = await fetch(`${supabaseUrl}/rest/v1/beta_whitelist?email=eq.${encodeURIComponent(email)}`, {
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error('Error response from Supabase:', errorBody);
            return res.status(response.status).json({
                error: `Error checking beta whitelist: ${response.status} ${response.statusText}`,
                details: errorBody
            });
        }

        const data = await response.json();

        // Return whether the email is in the whitelist
        return res.status(200).json({
            allowed: data.length > 0,
            message: data.length > 0 ? 'Beta access confirmed' : 'This email is not authorized for beta access'
        });
    } catch (error) {
        console.error('Error in Supabase beta access check proxy:', error);
        return res.status(500).json({
            error: 'Network error occurred while checking beta whitelist',
            details: error.toString()
        });
    }
});

// Default route
app.get('/', (req, res) => {
    res.status(200).send('LinkedIn Extension API Server');
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Export the Express app for Vercel
export default app;