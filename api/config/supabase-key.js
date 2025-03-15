// api/config/supabase-key.js
// Endpoint to securely provide the Supabase service key

export default function handler(req, res) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get the Supabase service key from environment variables
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseKey) {
        return res.status(500).json({ error: 'Supabase service key not configured' });
    }

    // Return the Supabase service key
    return res.status(200).json({ key: supabaseKey });
}