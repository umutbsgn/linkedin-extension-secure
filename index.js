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

// Start server
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}

// Export for Vercel
module.exports = app;