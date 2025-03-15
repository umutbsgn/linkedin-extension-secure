// api/config/stripe-keys.js
// Configuration for Stripe API keys

// Export Stripe API endpoints
export const STRIPE_PUBLISHABLE_KEY_ENDPOINT = '/api/config/stripe-publishable-key';
export const STRIPE_SECRET_KEY_ENDPOINT = '/api/config/stripe-secret-key';
export const STRIPE_PRICE_ID_ENDPOINT = '/api/config/stripe-price-id';
export const STRIPE_WEBHOOK_SECRET_ENDPOINT = '/api/config/stripe-webhook-secret';

// Helper function to get Stripe secret key (only used server-side)
export async function getStripeSecretKey() {
    // In server-side context, we can directly access environment variables
    return process.env.STRIPE_SECRET_KEY;
}

// Helper function to get Stripe webhook secret (only used server-side)
export async function getStripeWebhookSecret() {
    // In server-side context, we can directly access environment variables
    return process.env.STRIPE_WEBHOOK_SECRET;
}

// Helper function to get Stripe price ID for Pro subscription (only used server-side)
export async function getStripePriceId() {
    // In server-side context, we can directly access environment variables
    return process.env.STRIPE_PRO_PRICE_ID;
}