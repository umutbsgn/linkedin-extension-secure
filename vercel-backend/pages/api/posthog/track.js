// API endpoint for PostHog tracking
import fetch from 'node-fetch';

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

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
}