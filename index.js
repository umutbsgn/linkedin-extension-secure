// index.js
// Simple server for Vercel deployment

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Add CORS headers
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

// Root endpoint
app.get('/', (req, res) => {
    res.status(200).json({
        status: 'ok',
        message: 'LinkedIn Extension Secure API is running'
    });
});

// Healthcheck endpoint
app.get('/api/healthcheck', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        message: 'Vercel deployment is working correctly',
        version: '1.0.1'
    });
});

// Configuration endpoints
// Supabase URL
app.get('/api/config/supabase-url', (req, res) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    if (!supabaseUrl) {
        return res.status(500).json({ error: 'Supabase URL not configured' });
    }
    return res.status(200).json({ url: supabaseUrl });
});

// Supabase Key
app.get('/api/config/supabase-key', (req, res) => {
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseKey) {
        return res.status(500).json({ error: 'Supabase anon key not configured' });
    }
    return res.status(200).json({ key: supabaseKey });
});

// PostHog API Key
app.get('/api/config/posthog-key', (req, res) => {
    const posthogApiKey = process.env.POSTHOG_API_KEY;
    if (!posthogApiKey) {
        return res.status(500).json({ error: 'PostHog API key not configured' });
    }
    return res.status(200).json({ key: posthogApiKey });
});

// PostHog API Host
app.get('/api/config/posthog-host', (req, res) => {
    const posthogApiHost = process.env.POSTHOG_API_HOST;
    if (!posthogApiHost) {
        return res.status(500).json({ error: 'PostHog API host not configured' });
    }
    return res.status(200).json({ host: posthogApiHost });
});

// Analytics tracking endpoint
app.post('/api/analytics/track', async(req, res) => {
    try {
        const { eventName, properties, distinctId } = req.body;

        if (!eventName) {
            return res.status(400).json({ error: 'Event name is required' });
        }

        // Log the event for debugging
        console.log(`Tracking event: ${eventName}`, {
            properties,
            distinctId: distinctId || 'anonymous'
        });

        // Here you would typically send the event to PostHog
        // For now, we'll just acknowledge receipt

        return res.status(200).json({
            success: true,
            message: 'Event tracked successfully',
            event: eventName
        });
    } catch (error) {
        console.error('Error tracking event:', error);
        return res.status(500).json({
            error: 'Failed to track event',
            message: error.message
        });
    }
});

// Anthropic API proxy endpoint
app.post('/api/anthropic/analyze', async(req, res) => {
    try {
        // Get authorization token from request headers
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid authorization token' });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Extract data from request
        const { text, systemPrompt } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Missing required parameter: text' });
        }

        // Call Anthropic API directly
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "x-api-key": process.env.ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            },
            body: JSON.stringify({
                model: "claude-3-5-sonnet-20241022",
                max_tokens: 1024,
                system: systemPrompt || "",
                messages: [
                    { role: "user", content: text }
                ]
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error && errorData.error.message || response.statusText;
            return res.status(response.status).json({
                error: `API call failed: ${response.status} - ${errorMessage}`
            });
        }

        // Return successful response
        const data = await response.json();
        return res.status(200).json(data);
    } catch (error) {
        console.error('Error in Anthropic API proxy:', error);
        return res.status(500).json({ error: error.message });
    }
});

// Start server
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}

// Export for Vercel
module.exports = app;