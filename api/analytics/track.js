// api/analytics/track.js
// Secure proxy for PostHog analytics tracking

import { trackApiEvent, trackApiCallStart, trackApiCallSuccess, trackApiCallFailure } from '../utils/tracking.js';

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Start tracking this API call itself
    const startTime = trackApiCallStart('analytics_track', {
        event_type: req.body.eventName
    });

    try {
        // Extract data from request
        const { eventName, properties, distinctId } = req.body;

        if (!eventName) {
            trackApiCallFailure('analytics_track', startTime, 'Missing required parameter: eventName');
            return res.status(400).json({ error: 'Missing required parameter: eventName' });
        }

        // Use our tracking utility to forward the event to PostHog
        await trackApiEvent(
            eventName,
            properties || {},
            distinctId || 'anonymous_user'
        );

        // Track successful API call
        trackApiCallSuccess('analytics_track', startTime, {
            event_name: eventName
        });

        // Return successful response
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error in PostHog tracking proxy:', error);
        return res.status(500).json({ error: error.message });
    }
}