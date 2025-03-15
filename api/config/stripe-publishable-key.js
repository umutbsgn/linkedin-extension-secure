// api/config/stripe-publishable-key.js
// Endpoint to securely provide the Stripe publishable key to the client

export default function handler(req, res) {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY;

    if (!stripePublishableKey) {
        return res.status(500).json({ error: 'Stripe publishable key not configured' });
    }

    return res.status(200).json({ key: stripePublishableKey });
}