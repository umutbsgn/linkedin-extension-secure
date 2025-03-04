// api/healthcheck.js
// Simple endpoint to check if the Vercel deployment is working

export default function handler(req, res) {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        message: 'Vercel deployment is working correctly'
    });
}