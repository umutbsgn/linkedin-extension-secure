// api/analytics/track.js
// Secure proxy for PostHog analytics tracking

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Get API key from environment variables
        const posthogApiKey = process.env.POSTHOG_API_KEY;
        const posthogApiHost = process.env.POSTHOG_API_HOST || 'https://eu.i.posthog.com';

        if (!posthogApiKey) {
            return res.status(500).json({ error: 'PostHog API key not configured on server' });
        }

        // Extract data from request
        const { eventName, properties, distinctId } = req.body;

        if (!eventName) {
            return res.status(400).json({ error: 'Missing required parameter: eventName' });
        }

        // Prepare the tracking payload
        const payload = {
            api_key: posthogApiKey,
            event: eventName,
            properties: {
                ...properties,
                $lib: 'vercel-server',
                timestamp: properties.timestamp || new Date().toISOString()
            },
            distinct_id: distinctId || 'anonymous_user',
            timestamp: new Date().toISOString()
        };

        // Call PostHog API
        const response = await fetch(`${posthogApiHost}/capture/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        // Handle API response
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return res.status(response.status).json({
                error: `PostHog API call failed: ${response.status} - ${response.statusText}`,
                details: errorData
            });
        }

        // Return successful response
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error in PostHog tracking proxy:', error);
        return res.status(500).json({ error: error.message });
    }
}