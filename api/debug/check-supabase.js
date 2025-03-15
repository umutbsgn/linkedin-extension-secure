// api/debug/check-supabase.js
// Debug endpoint to check Supabase connection and configuration

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get authorization token from request headers
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization token' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
        // Get Supabase credentials from environment variables
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
        const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

        // Check if credentials are configured
        const credentialsCheck = {
            supabaseUrl: {
                configured: !!supabaseUrl,
                value: supabaseUrl ? `${supabaseUrl.substring(0, 10)}...` : null
            },
            supabaseServiceKey: {
                configured: !!supabaseKey,
                value: supabaseKey ? `${supabaseKey.substring(0, 10)}...` : null
            },
            supabaseAnonKey: {
                configured: !!supabaseAnonKey,
                value: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 10)}...` : null
            }
        };

        // If credentials are not configured, return error
        if (!supabaseUrl || !supabaseKey) {
            return res.status(500).json({
                error: 'Supabase credentials not configured on server',
                credentialsCheck
            });
        }

        // Initialize Supabase client
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Verify the token and get user information
        const { data: userData, error: authError } = await supabase.auth.getUser(token);

        if (authError) {
            return res.status(401).json({
                error: 'Authentication error',
                message: authError.message,
                credentialsCheck
            });
        }

        // Check database connection by querying tables
        const tablesCheck = {};

        // Check user_subscriptions table
        try {
            const { data: subscriptionData, error: subscriptionError } = await supabase
                .from('user_subscriptions')
                .select('count(*)')
                .limit(1);

            tablesCheck.user_subscriptions = {
                exists: !subscriptionError,
                error: subscriptionError ? subscriptionError.message : null
            };
        } catch (error) {
            tablesCheck.user_subscriptions = {
                exists: false,
                error: error.message
            };
        }

        // Check api_models_usage table
        try {
            const { data: usageData, error: usageError } = await supabase
                .from('api_models_usage')
                .select('count(*)')
                .limit(1);

            tablesCheck.api_models_usage = {
                exists: !usageError,
                error: usageError ? usageError.message : null
            };
        } catch (error) {
            tablesCheck.api_models_usage = {
                exists: false,
                error: error.message
            };
        }

        // Check system_config table
        try {
            const { data: configData, error: configError } = await supabase
                .from('system_config')
                .select('count(*)')
                .limit(1);

            tablesCheck.system_config = {
                exists: !configError,
                error: configError ? configError.message : null
            };
        } catch (error) {
            tablesCheck.system_config = {
                exists: false,
                error: error.message
            };
        }

        // Check RPC functions
        const rpcCheck = {};

        // Check get_model_limits function
        try {
            const { data: limitsData, error: limitsError } = await supabase.rpc('get_model_limits', {
                subscription_type: 'trial'
            });

            rpcCheck.get_model_limits = {
                exists: !limitsError,
                error: limitsError ? limitsError.message : null,
                data: limitsData
            };
        } catch (error) {
            rpcCheck.get_model_limits = {
                exists: false,
                error: error.message
            };
        }

        // Check increment_api_usage function
        try {
            const { data: incrementData, error: incrementError } = await supabase.rpc('increment_api_usage', {
                p_user_id: userData.user.id,
                p_model: 'haiku-3.5'
            });

            rpcCheck.increment_api_usage = {
                exists: !incrementError,
                error: incrementError ? incrementError.message : null,
                data: incrementData
            };
        } catch (error) {
            rpcCheck.increment_api_usage = {
                exists: false,
                error: error.message
            };
        }

        // Check get_user_api_usage function
        try {
            const { data: userUsageData, error: userUsageError } = await supabase.rpc('get_user_api_usage', {
                p_user_id: userData.user.id
            });

            rpcCheck.get_user_api_usage = {
                exists: !userUsageError,
                error: userUsageError ? userUsageError.message : null,
                data: userUsageData
            };
        } catch (error) {
            rpcCheck.get_user_api_usage = {
                exists: false,
                error: error.message
            };
        }

        // Return debug information
        return res.status(200).json({
            success: true,
            user: {
                id: userData.user.id,
                email: userData.user.email
            },
            credentialsCheck,
            tablesCheck,
            rpcCheck
        });
    } catch (error) {
        console.error('Error in debug endpoint:', error);
        return res.status(500).json({
            error: 'Unexpected error in debug endpoint',
            message: error.message,
            stack: error.stack
        });
    }
}