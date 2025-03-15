// api/config/posthog-key.js
// Endpoint to securely provide the PostHog API key

export default function handler(req, res) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get the PostHog API key from environment variables
    const posthogApiKey = process.env.POSTHOG_API_KEY;

    if (!posthogApiKey) {
        return res.status(500).json({ error: 'PostHog API key not configured' });
    }

    // Return the PostHog API key
    return res.status(200).json({ key: posthogApiKey });
}