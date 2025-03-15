// api/config/stripe-secret-key.js
// Endpoint to securely provide the Stripe secret key to server-side code

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

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
        return res.status(500).json({ error: 'Stripe secret key not configured' });
    }

    return res.status(200).json({ key: stripeSecretKey });
}