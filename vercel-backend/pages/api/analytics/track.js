// API endpoint for PostHog analytics tracking
import fetch from 'node-fetch';

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { eventName, properties, distinctId } = req.body;

        if (!eventName) {
            return res.status(400).json({ error: 'eventName is required' });
        }

        // Get PostHog credentials from environment variables
        const posthogApiKey = process.env.POSTHOG_API_KEY;
        const posthogApiHost = process.env.POSTHOG_API_HOST;

        if (!posthogApiKey || !posthogApiHost) {
            return res.status(500).json({ error: 'PostHog configuration missing on server' });
        }

        // Prepare event properties
        const eventProperties = {
            timestamp: new Date().toISOString(),
            ...properties
        };

        // Make request to PostHog API
        const response = await fetch(`${posthogApiHost}/capture/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                api_key: posthogApiKey,
                event: eventName,
                properties: eventProperties,
                distinct_id: distinctId || 'anonymous_user',
                timestamp: new Date().toISOString()
            })
        });

        // Check if the request was successful
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error from PostHog API:', errorText);
            return res.status(response.status).json({
                error: `Error tracking event: ${response.status} ${response.statusText}`,
                details: errorText
            });
        }

        // Return success response
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error in PostHog tracking proxy:', error);
        return res.status(500).json({ error: error.message });
    }
}