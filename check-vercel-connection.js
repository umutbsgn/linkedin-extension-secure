// check-vercel-connection.js
// Simple script to check connection to Vercel deployment

import { VERCEL_BACKEND_URL } from './config.js';

async function checkVercelConnection() {
    console.log(`Checking connection to Vercel at: ${VERCEL_BACKEND_URL}`);

    try {
        // Try to connect to the healthcheck endpoint
        const healthcheckUrl = `${VERCEL_BACKEND_URL}/api/healthcheck`;
        console.log(`Connecting to: ${healthcheckUrl}`);

        const response = await fetch(healthcheckUrl);

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Connection successful!');
            console.log('Response:', data);
            return true;
        } else {
            console.error('❌ Server responded with error:', response.status, response.statusText);
            console.error('This could mean the endpoint exists but returned an error');
            return false;
        }
    } catch (error) {
        console.error('❌ Connection failed!');
        console.error('Error details:', error.message);
        console.error('\nPossible reasons:');
        console.error('1. The Vercel deployment does not exist yet');
        console.error('2. The URL in config.js is incorrect');
        console.error('3. There is a network connectivity issue');
        console.error('\nNext steps:');
        console.error('1. Deploy your project to Vercel');
        console.error('2. Update the VERCEL_BACKEND_URL in config.js with your actual deployment URL');
        console.error('3. Run this script again to verify the connection');
        return false;
    }
}

// Run the check
checkVercelConnection();