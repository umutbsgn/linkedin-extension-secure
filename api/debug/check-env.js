// api/debug/check-env.js
// Endpoint to check environment variables on the server

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

    // Check environment variables
    const variables = {
        'SUPABASE_URL': process.env.SUPABASE_URL ? '✓' : '✗',
        'SUPABASE_ANON_KEY': process.env.SUPABASE_ANON_KEY ? '✓' : '✗',
        'SUPABASE_SERVICE_KEY': process.env.SUPABASE_SERVICE_KEY ? '✓' : '✗',
        'POSTHOG_API_KEY': process.env.POSTHOG_API_KEY ? '✓' : '✗',
        'POSTHOG_API_HOST': process.env.POSTHOG_API_HOST ? '✓' : '✗',
        'ANTHROPIC_API_KEY': process.env.ANTHROPIC_API_KEY ? '✓' : '✗',
        'STRIPE_SECRET_KEY': process.env.STRIPE_SECRET_KEY ? '✓' : '✗',
        'STRIPE_PUBLISHABLE_KEY': process.env.STRIPE_PUBLISHABLE_KEY ? '✓' : '✗',
        'STRIPE_PRO_PRICE_ID': process.env.STRIPE_PRO_PRICE_ID ? '✓' : '✗',
        'STRIPE_WEBHOOK_SECRET': process.env.STRIPE_WEBHOOK_SECRET ? '✓' : '✗'
    };

    // Check if any variables are missing
    const missingVariables = Object.entries(variables)
        .filter(([_, value]) => value === '✗')
        .map(([key]) => key);

    // Return the result
    return res.status(200).json({
        variables,
        missingVariables,
        allVariablesPresent: missingVariables.length === 0,
        // Add masked values for debugging
        maskedValues: {
            'STRIPE_SECRET_KEY': maskString(process.env.STRIPE_SECRET_KEY),
            'STRIPE_PUBLISHABLE_KEY': maskString(process.env.STRIPE_PUBLISHABLE_KEY),
            'STRIPE_PRO_PRICE_ID': maskString(process.env.STRIPE_PRO_PRICE_ID),
            'STRIPE_WEBHOOK_SECRET': maskString(process.env.STRIPE_WEBHOOK_SECRET)
        }
    });
}

// Function to mask strings
function maskString(str) {
    if (!str) return '';
    if (str.length <= 8) return '********';
    return str.substring(0, 4) + '********' + str.substring(str.length - 4);
}