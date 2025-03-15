// test-rpc-functions.js
// Script to test the RPC functions in Supabase

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

// Vercel URL
const vercelUrl = process.argv[3] || 'https://linkedin-extension-secure-elew.vercel.app';

// Function to get Supabase credentials from Vercel
async function getSupabaseCredentials() {
    try {
        console.log(`Fetching Supabase URL from ${vercelUrl}/api/config/supabase-url`);
        const urlResponse = await fetch(`${vercelUrl}/api/config/supabase-url`);
        if (!urlResponse.ok) {
            throw new Error(`Failed to fetch Supabase URL: ${urlResponse.status} ${urlResponse.statusText}`);
        }
        const urlData = await urlResponse.json();
        const supabaseUrl = urlData.url;

        console.log(`Fetching Supabase key from ${vercelUrl}/api/config/supabase-key`);
        const keyResponse = await fetch(`${vercelUrl}/api/config/supabase-key`);
        if (!keyResponse.ok) {
            throw new Error(`Failed to fetch Supabase key: ${keyResponse.status} ${keyResponse.statusText}`);
        }
        const keyData = await keyResponse.json();
        const supabaseKey = keyData.key;

        return { supabaseUrl, supabaseKey };
    } catch (error) {
        console.error('Error fetching Supabase credentials:', error);
        throw error;
    }
}

// Test user ID (replace with an actual user ID from your database)
const testUserId = process.argv[2];

if (!testUserId) {
    console.error('Please provide a test user ID as a command line argument.');
    console.error('Usage: node test-rpc-functions.js <user_id> [vercel_url]');
    process.exit(1);
}

// Test the get_model_limits RPC function
async function testGetModelLimits(supabase) {
    console.log('\n--- Testing get_model_limits RPC function ---');

    try {
        // Test with 'trial' subscription type
        console.log('Testing with subscription type: trial');
        const { data: trialData, error: trialError } = await supabase.rpc('get_model_limits', {
            subscription_type: 'trial'
        });

        if (trialError) {
            console.error('Error testing get_model_limits with trial subscription type:', trialError);
        } else {
            console.log('Result for trial subscription type:', trialData);
        }

        // Test with 'pro' subscription type
        console.log('\nTesting with subscription type: pro');
        const { data: proData, error: proError } = await supabase.rpc('get_model_limits', {
            subscription_type: 'pro'
        });

        if (proError) {
            console.error('Error testing get_model_limits with pro subscription type:', proError);
        } else {
            console.log('Result for pro subscription type:', proData);
        }
    } catch (error) {
        console.error('Unexpected error in testGetModelLimits:', error);
    }
}

// Test the increment_api_usage RPC function
async function testIncrementApiUsage(supabase) {
    console.log('\n--- Testing increment_api_usage RPC function ---');

    try {
        // Test with haiku-3.5 model
        console.log(`Testing with user ID: ${testUserId}, model: haiku-3.5`);
        const { data: haikuData, error: haikuError } = await supabase.rpc('increment_api_usage', {
            p_user_id: testUserId,
            p_model: 'haiku-3.5'
        });

        if (haikuError) {
            console.error('Error testing increment_api_usage with haiku-3.5 model:', haikuError);
        } else {
            console.log('Result for haiku-3.5 model:', haikuData);
        }

        // Test with sonnet-3.7 model
        console.log(`\nTesting with user ID: ${testUserId}, model: sonnet-3.7`);
        const { data: sonnetData, error: sonnetError } = await supabase.rpc('increment_api_usage', {
            p_user_id: testUserId,
            p_model: 'sonnet-3.7'
        });

        if (sonnetError) {
            console.error('Error testing increment_api_usage with sonnet-3.7 model:', sonnetError);
        } else {
            console.log('Result for sonnet-3.7 model:', sonnetData);
        }
    } catch (error) {
        console.error('Unexpected error in testIncrementApiUsage:', error);
    }
}

// Test the get_user_api_usage RPC function
async function testGetUserApiUsage(supabase) {
    console.log('\n--- Testing get_user_api_usage RPC function ---');

    try {
        console.log(`Testing with user ID: ${testUserId}`);
        const { data, error } = await supabase.rpc('get_user_api_usage', {
            p_user_id: testUserId
        });

        if (error) {
            console.error('Error testing get_user_api_usage:', error);
        } else {
            console.log('Result:', data);
        }
    } catch (error) {
        console.error('Unexpected error in testGetUserApiUsage:', error);
    }
}

// Test direct table operations
async function testDirectTableOperations(supabase) {
    console.log('\n--- Testing direct table operations ---');

    try {
        // Test querying user_subscriptions table
        console.log(`Testing querying user_subscriptions table for user ID: ${testUserId}`);
        const { data: subscriptionData, error: subscriptionError } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', testUserId)
            .eq('status', 'active')
            .order('created_at', { ascending: false });

        if (subscriptionError) {
            console.error('Error querying user_subscriptions table:', subscriptionError);
        } else {
            console.log('Result from user_subscriptions table:', subscriptionData);
        }

        // Test querying api_models_usage table
        const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
        console.log(`\nTesting querying api_models_usage table for user ID: ${testUserId}, month: ${currentMonth}`);
        const { data: usageData, error: usageError } = await supabase
            .from('api_models_usage')
            .select('*')
            .eq('user_id', testUserId)
            .eq('month', currentMonth);

        if (usageError) {
            console.error('Error querying api_models_usage table:', usageError);
        } else {
            console.log('Result from api_models_usage table:', usageData);
        }

        // Test querying system_config table
        console.log('\nTesting querying system_config table');
        const { data: configData, error: configError } = await supabase
            .from('system_config')
            .select('*')
            .in('key', ['trial_limits', 'pro_limits']);

        if (configError) {
            console.error('Error querying system_config table:', configError);
        } else {
            console.log('Result from system_config table:', configData);
        }
    } catch (error) {
        console.error('Unexpected error in testDirectTableOperations:', error);
    }
}

// Run all tests
async function runTests() {
    try {
        console.log('Starting RPC function tests...');
        console.log('Vercel URL:', vercelUrl);
        console.log('Test User ID:', testUserId);

        // Get Supabase credentials
        const { supabaseUrl, supabaseKey } = await getSupabaseCredentials();
        console.log('Supabase URL:', supabaseUrl);
        console.log('Supabase Key:', supabaseKey.substring(0, 10) + '...');

        // Initialize Supabase client
        const supabase = createClient(supabaseUrl, supabaseKey);

        await testDirectTableOperations(supabase);
        await testGetModelLimits(supabase);
        await testIncrementApiUsage(supabase);
        await testGetUserApiUsage(supabase);

        console.log('\nTests completed.');
    } catch (error) {
        console.error('Error running tests:', error);
    }
}

runTests();