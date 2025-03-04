// api/anthropic/analyze.js
// Secure proxy for Anthropic API calls

import { trackApiCallStart, trackApiCallSuccess, trackApiCallFailure } from '../utils/tracking.js';

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Extract user identifier if available
    const authHeader = req.headers.authorization;
    let userId = 'anonymous_user';
    if (authHeader && authHeader.startsWith('Bearer ')) {
        // If we have an auth token, we could potentially extract user info
        // This would require additional logic to validate the token
        userId = 'authenticated_user'; // Placeholder, should be replaced with actual user ID
    }

    // Start tracking the API call
    const startTime = trackApiCallStart('anthropic_messages', {
        prompt_length: req.body.text ? req.body.text.length : 0,
        system_prompt_length: req.body.systemPrompt ? req.body.systemPrompt.length : 0
    }, userId);

    try {
        // Extract data from request
        const { text, systemPrompt, apiKey } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Missing required parameter: text' });
        }

        if (!apiKey) {
            return res.status(400).json({ error: 'Missing required parameter: apiKey' });
        }

        // Call Anthropic API
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
                system: systemPrompt || "",
                messages: [
                    { role: "user", content: text }
                ]
            })
        });

        // Handle API response
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error && errorData.error.message || response.statusText;
            return res.status(response.status).json({
                error: `API call failed: ${response.status} - ${errorMessage}`
            });
        }

        // Return successful response
        const data = await response.json();

        // Track successful API call
        const responseSize = JSON.stringify(data).length;
        trackApiCallSuccess('anthropic_messages', startTime, {
            response_size_bytes: responseSize,
            content_length: data.content && data.content[0] && data.content[0].text ? data.content[0].text.length : 0
        }, userId);

        return res.status(200).json(data);
    } catch (error) {
        // Track failed API call
        trackApiCallFailure('anthropic_messages', startTime, error.message, {}, userId);

        console.error('Error in Anthropic API proxy:', error);
        return res.status(500).json({ error: error.message });
    }
}