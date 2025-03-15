// api/subscriptions/create-checkout.js
// Endpoint to create a Stripe checkout session for subscription

import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { getStripeSecretKey, getStripePriceId } from '../config/stripe-keys.js';
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
    const startTime = trackApiCallStart('create_checkout_session', {}, userId);

    try {
        // Get Stripe secret key and price ID
        const stripeSecretKey = await getStripeSecretKey();
        const stripePriceId = await getStripePriceId();

        if (!stripeSecretKey) {
            trackApiCallFailure('create_checkout_session', startTime, 'Stripe secret key not configured');
            return res.status(500).json({ error: 'Stripe secret key not configured' });
        }

        if (!stripePriceId) {
            trackApiCallFailure('create_checkout_session', startTime, 'Stripe price ID not configured');
            return res.status(500).json({ error: 'Stripe price ID not configured' });
        }

        // Initialize Stripe
        const stripe = new Stripe(stripeSecretKey);

        // Get Supabase credentials from environment variables
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Use service key for admin operations

        if (!supabaseUrl || !supabaseKey) {
            trackApiCallFailure('create_checkout_session', startTime, 'Supabase credentials not configured on server');
            return res.status(500).json({ error: 'Supabase credentials not configured on server' });
        }

        // Initialize Supabase client
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Verify the token and get user information
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            trackApiCallFailure('create_checkout_session', startTime, authError ? authError.message : 'Invalid or expired token');
            return res.status(401).json({
                error: authError ? authError.message : 'Invalid or expired token'
            });
        }

        userId = user.id; // Update userId with actual user ID

        // Check if user already has an active subscription
        const { data: subscriptionData, error: subscriptionError } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (subscriptionError && subscriptionError.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
            trackApiCallFailure('create_checkout_session', startTime, 'Error checking subscription status', {}, user.email || userId);
            return res.status(500).json({ error: 'Error checking subscription status' });
        }

        // If user already has an active subscription, return error
        if (subscriptionData) {
            trackApiCallFailure('create_checkout_session', startTime, 'User already has an active subscription', {}, user.email || userId);
            return res.status(400).json({
                error: 'You already have an active subscription',
                subscription: {
                    id: subscriptionData.stripe_subscription_id,
                    status: subscriptionData.status,
                    currentPeriodEnd: subscriptionData.current_period_end
                }
            });
        }

        // Get the success and cancel URLs from the request
        const { successUrl, cancelUrl } = req.body;

        if (!successUrl || !cancelUrl) {
            trackApiCallFailure('create_checkout_session', startTime, 'Missing success or cancel URL', {}, user.email || userId);
            return res.status(400).json({ error: 'Missing success or cancel URL' });
        }

        // Log the received URLs for debugging
        console.log('Received URLs:', { successUrl, cancelUrl });

        // Validate that the URLs are valid HTTPS URLs
        try {
            const successUrlObj = new URL(successUrl);
            const cancelUrlObj = new URL(cancelUrl);

            if (!successUrlObj.protocol.startsWith('http') || !cancelUrlObj.protocol.startsWith('http')) {
                throw new Error('URLs must use HTTP or HTTPS protocol');
            }
        } catch (error) {
            console.error('Invalid URLs provided:', error);
            trackApiCallFailure('create_checkout_session', startTime, `Invalid URLs provided: ${error.message}`, {}, user.email || userId);
            return res.status(400).json({ error: `Invalid URLs provided: ${error.message}` });
        }

        // Store metadata about the user
        const metadata = {
            userId: userId,
            email: user.email
        };

        // Extract session ID from the success URL if it exists
        try {
            const urlParams = new URL(successUrl).searchParams;
            const sessionId = urlParams.get('session_id');
            if (sessionId) {
                metadata.sessionTrackingId = sessionId;
            }
        } catch (error) {
            console.error('Error extracting session ID:', error);
        }

        // Create a new checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price: stripePriceId,
                quantity: 1,
            }, ],
            mode: 'subscription',
            success_url: successUrl,
            cancel_url: cancelUrl,
            client_reference_id: userId,
            customer_email: user.email,
            metadata: metadata
        });

        // Track successful API call
        trackApiCallSuccess('create_checkout_session', startTime, {
            session_id: session.id
        }, userId);

        // Return the checkout session ID
        return res.status(200).json({
            sessionId: session.id,
            url: session.url
        });
    } catch (error) {
        // Track failed API call
        trackApiCallFailure('create_checkout_session', startTime, error.message, {}, userId);

        console.error('Error creating checkout session:', error);
        return res.status(500).json({ error: error.message });
    }
}