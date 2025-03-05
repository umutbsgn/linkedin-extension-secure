// index.js
// Simple server for Vercel deployment

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Add CORS headers
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

// Root endpoint
app.get('/', (req, res) => {
    res.status(200).json({
        status: 'ok',
        message: 'LinkedIn Extension Secure API is running'
    });
});

// Healthcheck endpoint
app.get('/api/healthcheck', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        message: 'Vercel deployment is working correctly',
        version: '1.0.1'
    });
});

// Start server
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}

// Export for Vercel
module.exports = app;