// api/healthcheck.js
// Endpoint to check if the API is running

export default function handler(req, res) {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        message: 'Vercel deployment is working correctly',
        version: '1.0.2'
    });
}