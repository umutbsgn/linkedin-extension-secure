// api/subscriptions/cancel.js
// Endpoint to cancel a subscription

import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../config/stripe-keys.js';
import { trackApiCallStart, trackApiCallSuccess, trackApiCallFailure } from '../utils/tracking.js';

export default async function handler(req, res) {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get authorization token from request headers
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization token' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    let userId = 'anonymous_user';

    // Start tracking the API call
    const startTime = trackApiCallStart('cancel_subscription', {});

    try {
        // Get Stripe secret key
        const stripeSecretKey = await getStripeSecretKey();

        if (!stripeSecretKey) {
            trackApiCallFailure('cancel_subscription', startTime, 'Stripe secret key not configured');
            return res.status(500).json({ error: 'Stripe secret key not configured' });
        }

        // Initialize Stripe
        const stripe = new Stripe(stripeSecretKey);

        // Get Supabase credentials from environment variables
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Use service key for admin operations

        if (!supabaseUrl || !supabaseKey) {
            trackApiCallFailure('cancel_subscription', startTime, 'Supabase credentials not configured on server');
            return res.status(500).json({ error: 'Supabase credentials not configured on server' });
        }

        // Initialize Supabase client
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Verify the token and get user information
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            trackApiCallFailure('cancel_subscription', startTime, authError ? authError.message : 'Invalid or expired token');
            return res.status(401).json({
                error: authError ? authError.message : 'Invalid or expired token'
            });
        }

        userId = user.id; // Update userId with actual user ID

        // Get the active subscription
        const { data: subscriptionData, error: subscriptionError } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (subscriptionError && subscriptionError.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
            trackApiCallFailure('cancel_subscription', startTime, 'Error getting subscription details', {}, user.email || userId);
            return res.status(500).json({ error: 'Error getting subscription details' });
        }

        if (!subscriptionData) {
            trackApiCallFailure('cancel_subscription', startTime, 'No active subscription found', {}, user.email || userId);
            return res.status(404).json({ error: 'No active subscription found' });
        }

        // Check if this is a Stripe subscription or just a custom subscription
        if (subscriptionData.stripe_subscription_id) {
            // Cancel the subscription in Stripe
            const subscription = await stripe.subscriptions.update(
                subscriptionData.stripe_subscription_id, { cancel_at_period_end: true }
            );

            // Update the subscription in the database
            const { error: updateError } = await supabase
                .from('user_subscriptions')
                .update({
                    status: 'canceling',
                    updated_at: new Date().toISOString()
                })
                .eq('id', subscriptionData.id);

            if (updateError) {
                trackApiCallFailure('cancel_subscription', startTime, `Error updating subscription entry: ${updateError.message}`, {}, user.email || userId);
                return res.status(500).json({ error: `Error updating subscription entry: ${updateError.message}` });
            }

            // Track successful API call
            trackApiCallSuccess('cancel_subscription', startTime, {
                subscription_id: subscriptionData.stripe_subscription_id,
                cancel_at_period_end: true
            }, userId);

            // Return success
            return res.status(200).json({
                success: true,
                message: 'Subscription will be canceled at the end of the billing period',
                subscription: {
                    id: subscription.id,
                    status: subscription.status,
                    cancelAtPeriodEnd: subscription.cancel_at_period_end,
                    currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString()
                }
            });
        } else {
            // This is a custom subscription (e.g., for users using their own API key)
            // Update the subscription in the database
            const { error: updateError } = await supabase
                .from('user_subscriptions')
                .update({
                    status: 'canceled',
                    updated_at: new Date().toISOString()
                })
                .eq('id', subscriptionData.id);

            if (updateError) {
                trackApiCallFailure('cancel_subscription', startTime, `Error updating subscription entry: ${updateError.message}`, {}, user.email || userId);
                return res.status(500).json({ error: `Error updating subscription entry: ${updateError.message}` });
            }

            // Track successful API call
            trackApiCallSuccess('cancel_subscription', startTime, {
                subscription_id: subscriptionData.id,
                custom_subscription: true
            }, userId);

            // Return success
            return res.status(200).json({
                success: true,
                message: 'Subscription has been canceled',
                subscription: {
                    id: subscriptionData.id,
                    status: 'canceled'
                }
            });
        }
    } catch (error) {
        // Track failed API call
        trackApiCallFailure('cancel_subscription', startTime, error.message, {}, userId);

        console.error('Error canceling subscription:', error);
        return res.status(500).json({ error: error.message });
    }
}