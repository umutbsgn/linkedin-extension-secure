// api/config/stripe-price-id.js
// Endpoint to securely provide the Stripe price ID for Pro subscription

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

    const stripePriceId = process.env.STRIPE_PRO_PRICE_ID;

    if (!stripePriceId) {
        return res.status(500).json({ error: 'Stripe price ID not configured' });
    }

    return res.status(200).json({ priceId: stripePriceId });
}