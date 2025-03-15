// api/subscriptions/redirect.js
// Endpoint to redirect users back to the Chrome extension after Stripe checkout

import Stripe from 'stripe';
import { getStripeSecretKey } from '../config/stripe-keys.js';

export default async function handler(req, res) {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Get the status parameter and session tracking ID
        const { status, session_id } = req.query;

        console.log('Redirect endpoint called with:', { status, session_id });

        if (!status) {
            return res.status(400).json({ error: 'Missing status parameter' });
        }

        // If no session_id is provided, just show a generic success/cancel page
        if (!session_id) {
            console.log('No session_id provided, showing generic page');
            return res.status(200).send(getGenericPage(status));
        }

        // Get Stripe secret key
        const stripeSecretKey = await getStripeSecretKey();
        if (!stripeSecretKey) {
            console.error('Stripe secret key not configured');
            return res.status(500).json({ error: 'Stripe secret key not configured' });
        }

        // Initialize Stripe
        const stripe = new Stripe(stripeSecretKey);

        try {
            // Try to find a session with matching metadata
            const sessions = await stripe.checkout.sessions.list({
                limit: 10,
                expand: ['data.metadata']
            });

            console.log('Looking for session with tracking ID:', session_id);

            // Find the session with matching tracking ID in metadata
            const matchingSession = sessions.data.find(
                s => s.metadata && s.metadata.sessionTrackingId === session_id
            );

            if (matchingSession) {
                console.log('Found matching session:', matchingSession.id);

                // Check if this was a Chrome extension checkout
                if (matchingSession.metadata.isExtension === 'true') {
                    // Get the original URL based on the status
                    const redirectUrl = status === 'success' ?
                        matchingSession.metadata.originalSuccessUrl :
                        matchingSession.metadata.originalCancelUrl;

                    if (redirectUrl) {
                        console.log('Redirecting to extension URL:', redirectUrl);
                        // Redirect to the Chrome extension
                        return res.redirect(302, redirectUrl);
                    }
                }
            } else {
                console.log('No matching session found with tracking ID:', session_id);
            }
        } catch (stripeError) {
            console.error('Error retrieving Stripe sessions:', stripeError);
            // Continue to generic page if there's an error
        }

        // If we get here, either it wasn't a Chrome extension checkout or we couldn't find the original URL
        // Show a generic success/cancel page
        console.log('Showing generic page for status:', status);
        return res.status(200).send(getGenericPage(status));
    } catch (error) {
        console.error('Error in redirect endpoint:', error);
        return res.status(500).json({ error: error.message });
    }
}

/**
 * Returns a generic success/cancel page
 * @param {string} status - The status (success or canceled)
 * @returns {string} The HTML page
 */
function getGenericPage(status) {
    const isSuccess = status === 'success';
    const title = isSuccess ? 'Subscription Successful' : 'Subscription Canceled';
    const message = isSuccess ?
        'Your subscription was successful! You can now close this window and return to the extension.' :
        'Your subscription was canceled. You can close this window and return to the extension.';
    const color = isSuccess ? '#4CAF50' : '#F44336';

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    background-color: #f5f5f5;
                }
                .container {
                    text-align: center;
                    padding: 2rem;
                    background-color: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                    max-width: 500px;
                }
                h1 {
                    color: ${color};
                }
                p {
                    margin: 1rem 0;
                    font-size: 1.1rem;
                    line-height: 1.5;
                }
                .icon {
                    font-size: 4rem;
                    margin-bottom: 1rem;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="icon">${isSuccess ? '✅' : '❌'}</div>
                <h1>${title}</h1>
                <p>${message}</p>
            </div>
        </body>
        </html>
    `;
}