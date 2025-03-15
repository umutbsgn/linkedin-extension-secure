// api/config/supabase-url.js
// Endpoint to securely provide the Supabase URL

export default function handler(req, res) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get the Supabase URL from environment variables
    const supabaseUrl = process.env.SUPABASE_URL;

    if (!supabaseUrl) {
        return res.status(500).json({ error: 'Supabase URL not configured' });
    }

    // Return the Supabase URL
    return res.status(200).json({ url: supabaseUrl });
}