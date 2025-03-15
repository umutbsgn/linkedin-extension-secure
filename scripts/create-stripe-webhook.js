// scripts/create-stripe-webhook.js
// Script to create a Stripe webhook endpoint using the API v2

const https = require('https');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Function to prompt user for input
function prompt(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
}

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
async function createWebhookEndpoint() {
    try {
        console.log('Creating a Stripe webhook endpoint...');

        // Get Stripe API key
        const apiKey = await prompt('Enter your Stripe API key (starts with sk_): ');
        if (!apiKey.startsWith('sk_')) {
            throw new Error('Invalid API key. It should start with "sk_".');
        }

        // Get webhook URL
        const webhookUrl = await prompt('beten-umutbsgns-projects.vercel.app): ');
        if (!webhookUrl.startsWith('https://')) {
            throw new Error('Invalid webhook URL. It should start with "https://".');
        }

        // Create webhook endpoint using API v2
        console.log('Creating webhook endpoint...');
        const webhookData = {
            name: "Subscription Webhook",
            description: "Webhook for subscription events",
            type: "webhook_endpoint",
            event_payload: "thin",
            enabled_events: [
                "checkout.session.completed",
                "customer.subscription.updated",
                "customer.subscription.deleted"
            ],
            webhook_endpoint: {
                url: webhookUrl
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
    } finally {
        rl.close();
    }
}

// Run the script
createWebhookEndpoint();