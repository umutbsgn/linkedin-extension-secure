// server.js
// Express server for local development and Vercel deployment

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Parse JSON request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add debugging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log('Headers:', JSON.stringify(req.headers));
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('Body:', JSON.stringify(req.body));
    }
    next();
});

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

// Dynamic API route handling
app.all('/api/*', async(req, res) => {
    try {
        // Extract the path from the URL
        const path = req.path.substring(5); // Remove '/api/' prefix
        const segments = path.split('/');

        // Construct the module path
        let modulePath;
        if (segments.length === 1) {
            // Handle root level API endpoints like /api/healthcheck
            modulePath = `./api/${segments[0]}.js`;
        } else {
            // Handle nested API endpoints like /api/anthropic/analyze
            modulePath = `./api/${segments.join('/')}.js`;
        }

        console.log(`Attempting to load module: ${modulePath}`);

        try {
            // Try to load the module
            const handler = require(modulePath);

            // Call the handler
            await handler(req, res);
        } catch (moduleError) {
            // If module not found, try index.js in the directory
            if (moduleError.code === 'MODULE_NOT_FOUND') {
                try {
                    const indexPath = `./api/${segments.slice(0, -1).join('/')}/index.js`;
                    console.log(`Module not found, trying index: ${indexPath}`);

                    const handler = require(indexPath);
                    await handler(req, res);
                } catch (indexError) {
                    console.error(`Error loading index module: ${indexError.message}`);
                    res.status(404).json({ error: `API endpoint not found: ${req.path}` });
                }
            } else {
                console.error(`Error loading module: ${moduleError.message}`);
                res.status(500).json({ error: `Error loading API endpoint: ${moduleError.message}` });
            }
        }
    } catch (error) {
        console.error(`Unexpected error handling API request: ${error.message}`);
        res.status(500).json({ error: `Internal server error: ${error.message}` });
    }
});

// Start server
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}

// Export for Vercel
module.exports = app;