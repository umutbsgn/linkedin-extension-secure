// popup/stripe-client.js
// Client-side Stripe integration

import { API_ENDPOINTS } from '../config.js';

/**
 * Initializes Stripe with the publishable key
 * @returns {Promise<Stripe>} The Stripe instance
 */
export async function initStripe() {
    try {
        // Fetch the Stripe publishable key from the server
        const response = await fetch(API_ENDPOINTS.STRIPE_PUBLISHABLE_KEY);

        if (!response.ok) {
            throw new Error(`Failed to fetch Stripe publishable key: ${response.status} ${response.statusText}`);
        }

        const { key } = await response.json();

        if (!key) {
            throw new Error('Invalid Stripe publishable key received');
        }

        // Load Stripe.js dynamically
        if (!window.Stripe) {
            await loadStripeScript();
        }

        // Initialize Stripe with the publishable key
        return window.Stripe(key);
    } catch (error) {
        console.error('Error initializing Stripe:', error);
        throw error;
    }
}

/**
 * Loads the Stripe.js script
 * @returns {Promise<void>}
 */
function loadStripeScript() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://js.stripe.com/v3/';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Stripe.js'));
        document.head.appendChild(script);
    });
}

/**
 * Creates a checkout session for a subscription
 * @param {string} token - The authentication token
 * @returns {Promise<Object>} The checkout session
 */
export async function createCheckoutSession(token) {
    try {
        // Get the current URL for success and cancel URLs
        const currentUrl = chrome.runtime.getURL('popup/popup.html');

        // Create the checkout session
        const response = await fetch(API_ENDPOINTS.CREATE_CHECKOUT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                successUrl: `${currentUrl}?checkout=success`,
                cancelUrl: `${currentUrl}?checkout=canceled`
            })
        });

        // Check if the response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            console.error('Non-JSON response received from create-checkout endpoint:');
            const text = await response.text();
            console.error(text);
            throw new Error('Invalid response format from server. Please check server logs.');
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Failed to create checkout session: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error creating checkout session:', error);
        throw error;
    }
}

/**
 * Redirects to the Stripe Checkout page
 * @param {string} token - The authentication token
 * @returns {Promise<void>}
 */
export async function redirectToCheckout(token) {
    try {
        // Create a checkout session
        const { url } = await createCheckoutSession(token);

        // Redirect to the checkout page
        window.open(url, '_blank');
    } catch (error) {
        console.error('Error redirecting to checkout:', error);
        throw error;
    }
}

/**
 * Gets the subscription status
 * @param {string} token - The authentication token
 * @returns {Promise<Object>} The subscription status
 */
export async function getSubscriptionStatus(token) {
    try {
        const response = await fetch(API_ENDPOINTS.SUBSCRIPTION_STATUS, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        // Check if the response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            console.error('Non-JSON response received:', await response.text());
            throw new Error('Invalid response format from server');
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Failed to get subscription status: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error getting subscription status:', error);
        // Return a default subscription status for trial users
        return {
            subscriptionType: 'trial',
            hasActiveSubscription: false,
            useOwnApiKey: false,
            subscription: null
        };
    }
}

/**
 * Cancels a subscription
 * @param {string} token - The authentication token
 * @returns {Promise<Object>} The result of the cancellation
 */
export async function cancelSubscription(token) {
    try {
        const response = await fetch(API_ENDPOINTS.CANCEL_SUBSCRIPTION, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Failed to cancel subscription: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error canceling subscription:', error);
        throw error;
    }
}

/**
 * Updates the API key settings
 * @param {string} token - The authentication token
 * @param {boolean} useOwnKey - Whether to use the user's own API key
 * @param {string} apiKey - The API key to use
 * @returns {Promise<Object>} The result of the update
 */
export async function updateApiKeySettings(token, useOwnKey, apiKey) {
    try {
        const response = await fetch(API_ENDPOINTS.UPDATE_API_KEY, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                useOwnKey,
                apiKey
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Failed to update API key settings: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error updating API key settings:', error);
        throw error;
    }
}