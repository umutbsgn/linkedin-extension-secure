// test-rpc-functions.js
// Script to test the RPC functions in Supabase

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Supabase credentials
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase credentials not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.');
    process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Test user ID (replace with an actual user ID from your database)
const testUserId = process.argv[2];

if (!testUserId) {
    console.error('Please provide a test user ID as a command line argument.');
    console.error('Usage: node test-rpc-functions.js <user_id>');
    process.exit(1);
}

// Test the get_model_limits RPC function
async function testGetModelLimits() {
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
async function testIncrementApiUsage() {
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
async function testGetUserApiUsage() {
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
async function testDirectTableOperations() {
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
    console.log('Starting RPC function tests...');
    console.log('Supabase URL:', supabaseUrl);
    console.log('Test User ID:', testUserId);

    await testDirectTableOperations();
    await testGetModelLimits();
    await testIncrementApiUsage();
    await testGetUserApiUsage();

    console.log('\nTests completed.');
}

runTests().catch(error => {
    console.error('Error running tests:', error);
});