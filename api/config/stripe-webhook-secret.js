// api/config/stripe-webhook-secret.js
// Endpoint to securely provide the Stripe webhook secret to server-side code

export default function handler(req, res) {
    // Only allow GET requests from server-side code
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // This endpoint should only be called from server-side code
    // We're adding an extra layer of security by checking the host
    const host = req.headers.host || '';
    if (!host.includes('vercel.app') && !host.includes('localhost')) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripeWebhookSecret) {
        return res.status(500).json({ error: 'Stripe webhook secret not configured' });
    }

    return res.status(200).json({ secret: stripeWebhookSecret });
}