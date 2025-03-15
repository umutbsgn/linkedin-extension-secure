// api/subscriptions/webhook.js
// Webhook handler for Stripe events

import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { getStripeSecretKey, getStripeWebhookSecret } from '../config/stripe-keys.js';
import { trackApiCallStart, trackApiCallSuccess, trackApiCallFailure } from '../utils/tracking.js';

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const sig = req.headers['stripe-signature'];
    if (!sig) {
        return res.status(400).json({ error: 'Missing Stripe signature' });
    }

    // Start tracking the API call
    const startTime = trackApiCallStart('stripe_webhook', {
        event_type: req.body.type || 'unknown'
    });

    try {
        // Get Stripe secret key and webhook secret
        const stripeSecretKey = await getStripeSecretKey();
        const stripeWebhookSecret = await getStripeWebhookSecret();

        if (!stripeSecretKey) {
            trackApiCallFailure('stripe_webhook', startTime, 'Stripe secret key not configured');
            return res.status(500).json({ error: 'Stripe secret key not configured' });
        }

        if (!stripeWebhookSecret) {
            trackApiCallFailure('stripe_webhook', startTime, 'Stripe webhook secret not configured');
            return res.status(500).json({ error: 'Stripe webhook secret not configured' });
        }

        // Initialize Stripe
        const stripe = new Stripe(stripeSecretKey);

        // Verify the webhook signature
        let event;
        try {
            const rawBody = req.body; // Express.js already parses the body
            const stripePayload = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);
            event = stripe.webhooks.constructEvent(stripePayload, sig, stripeWebhookSecret);
        } catch (err) {
            trackApiCallFailure('stripe_webhook', startTime, `Webhook signature verification failed: ${err.message}`);
            return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
        }

        // Get Supabase credentials from environment variables
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Use service key for admin operations

        if (!supabaseUrl || !supabaseKey) {
            trackApiCallFailure('stripe_webhook', startTime, 'Supabase credentials not configured on server');
            return res.status(500).json({ error: 'Supabase credentials not configured on server' });
        }

        // Initialize Supabase client
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Handle the event
        switch (event.type) {
            case 'checkout.session.completed':
                {
                    const session = event.data.object;

                    // Get the user ID from the client reference ID
                    const userId = session.client_reference_id;
                    if (!userId) {
                        trackApiCallFailure('stripe_webhook', startTime, 'Missing client reference ID in checkout session');
                        return res.status(400).json({ error: 'Missing client reference ID in checkout session' });
                    }

                    // Get the subscription ID from the session
                    const subscriptionId = session.subscription;
                    if (!subscriptionId) {
                        trackApiCallFailure('stripe_webhook', startTime, 'Missing subscription ID in checkout session');
                        return res.status(400).json({ error: 'Missing subscription ID in checkout session' });
                    }

                    // Get the subscription details from Stripe
                    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

                    // Create a new subscription entry in the database
                    const { error: insertError } = await supabase
                    .from('user_subscriptions')
                    .insert([{
                        user_id: userId,
                        subscription_type: 'pro',
                        stripe_customer_id: session.customer,
                        stripe_subscription_id: subscriptionId,
                        status: subscription.status,
                        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                        current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
                    }]);

                    if (insertError) {
                        trackApiCallFailure('stripe_webhook', startTime, `Error creating subscription entry: ${insertError.message}`);
                        return res.status(500).json({ error: `Error creating subscription entry: ${insertError.message}` });
                    }

                    break;
                }
            case 'customer.subscription.updated':
                {
                    const subscription = event.data.object;

                    // Update the subscription entry in the database
                    const { error: updateError } = await supabase
                    .from('user_subscriptions')
                    .update({
                        status: subscription.status,
                        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('stripe_subscription_id', subscription.id);

                    if (updateError) {
                        trackApiCallFailure('stripe_webhook', startTime, `Error updating subscription entry: ${updateError.message}`);
                        return res.status(500).json({ error: `Error updating subscription entry: ${updateError.message}` });
                    }

                    break;
                }
            case 'customer.subscription.deleted':
                {
                    const subscription = event.data.object;

                    // Update the subscription entry in the database
                    const { error: updateError } = await supabase
                    .from('user_subscriptions')
                    .update({
                        status: 'canceled',
                        updated_at: new Date().toISOString()
                    })
                    .eq('stripe_subscription_id', subscription.id);

                    if (updateError) {
                        trackApiCallFailure('stripe_webhook', startTime, `Error updating subscription entry: ${updateError.message}`);
                        return res.status(500).json({ error: `Error updating subscription entry: ${updateError.message}` });
                    }

                    break;
                }
                // Add more event types as needed
            default:
                // Unhandled event type
                console.log(`Unhandled event type: ${event.type}`);
        }

        // Track successful API call
        trackApiCallSuccess('stripe_webhook', startTime, {
            event_type: event.type
        });

        // Return a 200 response to acknowledge receipt of the event
        return res.status(200).json({ received: true });
    } catch (error) {
        // Track failed API call
        trackApiCallFailure('stripe_webhook', startTime, error.message);

        console.error('Error handling Stripe webhook:', error);
        return res.status(500).json({ error: error.message });
    }
}