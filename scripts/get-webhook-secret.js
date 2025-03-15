// scripts/get-webhook-secret.js
// Script to retrieve the webhook secret for an existing webhook endpoint

const https = require('https');

// Function to make a request to the Stripe API
function makeStripeRequest(method, path, apiKey) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.stripe.com',
            path,
            method,
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Stripe-Version': '2025-02-24.acacia',
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(responseData);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsedData);
                    } else {
                        reject(new Error(`Stripe API error: ${JSON.stringify(parsedData)}`));
                    }
                } catch (error) {
                    reject(new Error(`Failed to parse response: ${error.message}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(new Error(`Request error: ${error.message}`));
        });

        req.end();
    });
}

// Main function to get the webhook secret
async function getWebhookSecret(apiKey, webhookId) {
    try {
        console.log(`Retrieving webhook secret for webhook ID: ${webhookId}`);

        // Get the webhook endpoint
        const response = await makeStripeRequest('GET', `/v2/core/event_destinations/${webhookId}`, apiKey);

        // Check if the webhook endpoint has a secret
        if (response.webhook_endpoint && response.webhook_endpoint.secret) {
            console.log('\nWebhook Secret:', response.webhook_endpoint.secret);
            console.log('\nAdd this to your .env file or Vercel environment variables:');
            console.log(`STRIPE_WEBHOOK_SECRET=${response.webhook_endpoint.secret}`);
        } else {
            console.log('\nNo webhook secret found for this webhook endpoint.');
            console.log('You may need to retrieve the secret from the Stripe Dashboard.');
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Get API key and webhook ID from command line arguments
const apiKey = process.argv[2];
const webhookId = process.argv[3];

if (!apiKey || !apiKey.startsWith('sk_')) {
    console.error('Error: Please provide a valid Stripe API key as the first argument.');
    console.error('Usage: node scripts/get-webhook-secret.js sk_test_your_api_key we_your_webhook_id');
    process.exit(1);
}

if (!webhookId || !webhookId.startsWith('we_')) {
    console.error('Error: Please provide a valid webhook ID as the second argument.');
    console.error('Usage: node scripts/get-webhook-secret.js sk_test_your_api_key we_your_webhook_id');
    process.exit(1);
}

// Run the script
getWebhookSecret(apiKey, webhookId);