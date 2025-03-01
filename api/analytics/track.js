import { PostHog } from 'posthog-node';

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
        const { event, properties, distinct_id, timestamp } = req.body;

        // Initialize PostHog client
        const posthog = new PostHog(
            process.env.POSTHOG_API_KEY, { host: process.env.POSTHOG_API_HOST }
        );

        // Send event to PostHog
        await posthog.capture({
            distinctId: distinct_id,
            event: event,
            properties: properties,
            timestamp: timestamp
        });

        // Flush events before responding
        await posthog.flush();

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Analytics error:', error);
        return res.status(500).json({ error: error.message });
    }
}