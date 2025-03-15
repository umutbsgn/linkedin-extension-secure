// scripts/create-webhook-simple.js
// Simple script to create a Stripe webhook endpoint using the API v2

const https = require('https');

// Webhook URL for the application
const WEBHOOK_URL = 'https://linkedin-extension-secure-elew.vercel.app/api/subscriptions/webhook';

// Function to make a request to the Stripe API
function makeStripeRequest(method, path, apiKey, data = null) {
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

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

// Main function to create a webhook endpoint
async function createWebhookEndpoint(apiKey) {
    try {
        console.log('Creating a Stripe webhook endpoint...');
        console.log(`Webhook URL: ${WEBHOOK_URL}`);

        // Create webhook endpoint using API v2
        const webhookData = {
            name: "Subscription Webhook",
            description: "Webhook for subscription events",
            type: "webhook_endpoint",
            event_payload: "snapshot",
            enabled_events: [
                "checkout.session.completed",
                "customer.subscription.updated",
                "customer.subscription.deleted"
            ],
            webhook_endpoint: {
                url: WEBHOOK_URL
            }
        };

        const response = await makeStripeRequest('POST', '/v2/core/event_destinations', apiKey, webhookData);
        console.log('Webhook endpoint created successfully!');
        console.log('Webhook ID:', response.id);

        // Get webhook secret
        if (response.webhook_endpoint && response.webhook_endpoint.secret) {
            console.log('\nWebhook Secret:', response.webhook_endpoint.secret);
            console.log('\nAdd this to your .env file or Vercel environment variables:');
            console.log(`STRIPE_WEBHOOK_SECRET=${response.webhook_endpoint.secret}`);
        } else {
            console.log('\nWebhook created, but no secret was returned.');
            console.log('You may need to retrieve the secret from the Stripe Dashboard.');
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Get API key from command line arguments
const apiKey = process.argv[2];

if (!apiKey || !apiKey.startsWith('sk_')) {
    console.error('Error: Please provide a valid Stripe API key as an argument.');
    console.error('Usage: node scripts/create-webhook-simple.js sk_test_your_api_key');
    process.exit(1);
}

// Run the script
createWebhookEndpoint(apiKey);