// api/utils/usage.js
// Utility functions for tracking and managing API usage

// Cache for model limits to avoid frequent database queries
const modelLimitsCache = {
    trial: {
        'haiku-3.5': 50,
        'sonnet-3.7': 0
    },
    pro: {
        'haiku-3.5': 500,
        'sonnet-3.7': 500
    },
    timestamp: 0
};

// Cache for user subscription type
const userSubscriptionCache = new Map();

// Cache expiration time in milliseconds (1 minute)
const CACHE_EXPIRATION = 1 * 60 * 1000;

// Default model if none is specified
const DEFAULT_MODEL = 'haiku-3.5';

/**
 * Invalidates the subscription type cache for a user
 * @param {string} userId - User ID
 */
export function invalidateSubscriptionCache(userId) {
    console.log(`Invalidating subscription cache for user ${userId}`);
    userSubscriptionCache.delete(userId);
}

/**
 * Gets the user's subscription type
 * @param {Object} supabase - Supabase client
 * @param {string} userId - User ID
 * @returns {Promise<string>} The subscription type ('trial' or 'pro')
 */
export async function getUserSubscriptionType(supabase, userId) {
    // Check if cache is still valid
    const now = Date.now();
    const cachedData = userSubscriptionCache.get(userId);

    if (cachedData && now - cachedData.timestamp < CACHE_EXPIRATION) {
        console.log(`Using cached subscription type for user ${userId}: ${cachedData.type}`);
        return cachedData.type;
    }

    try {
        console.log(`Checking subscription type for user ${userId}`);

        // Only check user_subscriptions table - simplified approach
        const { data, error } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error querying user_subscriptions:', error);

            // Update cache with trial
            userSubscriptionCache.set(userId, {
                type: 'trial',
                timestamp: now
            });

            console.log(`Defaulting to trial subscription for user ${userId} due to query error`);
            return 'trial'; // Default to trial on error
        }

        // If there's no data or empty array, user is on trial
        if (!data || data.length === 0) {
            console.log(`No active subscriptions found for user ${userId}, defaulting to trial`);

            // Update cache with trial
            userSubscriptionCache.set(userId, {
                type: 'trial',
                timestamp: now
            });

            return 'trial';
        }

        // Log all subscriptions for debugging
        console.log(`All subscriptions for user ${userId}:`, JSON.stringify(data));

        // Check for any subscription with type 'pro' (case insensitive)
        const proSubscription = data.find(sub => {
            // Ensure subscription_type exists and convert to lowercase for case-insensitive comparison
            const subType = sub.subscription_type ? sub.subscription_type.toLowerCase() : '';
            const isActive = sub.status === 'active';

            console.log(`Checking subscription: type=${subType}, active=${isActive}, id=${sub.id}`);

            return subType === 'pro' && isActive;
        });

        if (proSubscription) {
            console.log(`Found pro subscription for user ${userId}:`, proSubscription.id);

            // User has an active pro subscription
            const subscriptionType = 'pro';

            // Update cache
            userSubscriptionCache.set(userId, {
                type: subscriptionType,
                timestamp: now
            });

            console.log(`User ${userId} has subscription type: ${subscriptionType}`);
            return subscriptionType;
        } else {
            console.log(`User ${userId} has active subscriptions but none are pro type`);

            // Update cache with trial
            userSubscriptionCache.set(userId, {
                type: 'trial',
                timestamp: now
            });

            return 'trial';
        }
    } catch (error) {
        console.error('Unexpected error in getUserSubscriptionType:', error);

        // Update cache with trial
        userSubscriptionCache.set(userId, {
            type: 'trial',
            timestamp: now
        });

        console.log(`Defaulting to trial subscription for user ${userId} due to unexpected error`);
        return 'trial'; // Default fallback
    }
}

/**
 * Gets the model limits based on subscription type
 * @param {Object} supabase - Supabase client
 * @param {string} subscriptionType - Subscription type ('trial' or 'pro')
 * @returns {Promise<Object>} The model limits
 */
async function getModelLimits(supabase, subscriptionType) {
    // Normalize subscription type to lowercase for consistency
    const normalizedType = subscriptionType.toLowerCase();

    // Clear cache for testing purposes
    modelLimitsCache.timestamp = 0;

    // Check if cache is still valid
    const now = Date.now();
    if (now - modelLimitsCache.timestamp < CACHE_EXPIRATION) {
        console.log(`Using cached model limits for subscription type: ${normalizedType}`);
        return normalizedType === 'pro' ? modelLimitsCache.pro : modelLimitsCache.trial;
    }

    try {
        console.log(`Getting model limits for subscription type: ${normalizedType}`);

        // First try to get the limits from the system_config table
        const { data: configData, error: configError } = await supabase
            .from('system_config')
            .select('key, value')
            .in('key', ['trial_limits', 'pro_limits']);

        if (!configError && configData && configData.length > 0) {
            console.log('Received model limits from system_config table:', configData);

            // Process the data from system_config
            let trialLimits = modelLimitsCache.trial;
            let proLimits = modelLimitsCache.pro;

            for (const row of configData) {
                try {
                    if (row.key === 'trial_limits') {
                        // Parse the JSON value and normalize keys
                        const parsedValue = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
                        trialLimits = {
                            'haiku-3.5': parsedValue.haiku_3_5 || parsedValue['haiku_3.5'] || parsedValue['haiku-3.5'] || 50,
                            'sonnet-3.7': parsedValue.sonnet_3_7 || parsedValue['sonnet_3.7'] || parsedValue['sonnet-3.7'] || 0
                        };
                        console.log('Parsed trial limits:', trialLimits);
                    } else if (row.key === 'pro_limits') {
                        // Parse the JSON value and normalize keys
                        const parsedValue = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
                        proLimits = {
                            'haiku-3.5': parsedValue.haiku_3_5 || parsedValue['haiku_3.5'] || parsedValue['haiku-3.5'] || 500,
                            'sonnet-3.7': parsedValue.sonnet_3_7 || parsedValue['sonnet_3.7'] || parsedValue['sonnet-3.7'] || 500
                        };
                        console.log('Parsed pro limits:', proLimits);
                    }
                } catch (parseError) {
                    console.error(`Error parsing ${row.key} from system_config:`, parseError);
                }
            }

            // Update cache
            modelLimitsCache.trial = trialLimits;
            modelLimitsCache.pro = proLimits;
            modelLimitsCache.timestamp = now;

            return normalizedType === 'pro' ? proLimits : trialLimits;
        } else {
            // If system_config approach fails, try the RPC function as fallback
            console.log('Could not get limits from system_config, trying RPC function');

            const { data, error } = await supabase.rpc('get_model_limits', { subscription_type: normalizedType });

            if (error) {
                console.error('Error getting model limits from RPC:', error);
                console.log(`Using default model limits for ${normalizedType}`);
                return normalizedType === 'pro' ? modelLimitsCache.pro : modelLimitsCache.trial; // Use cached values
            }

            if (data) {
                console.log('Received model limits from RPC function:', data);

                // Update cache
                modelLimitsCache.trial = data.trial_limits || modelLimitsCache.trial;
                modelLimitsCache.pro = data.pro_limits || modelLimitsCache.pro;
                modelLimitsCache.timestamp = now;

                return normalizedType === 'pro' ?
                    modelLimitsCache.pro :
                    modelLimitsCache.trial;
            }
        }

        console.log(`No data received from database, using default model limits for ${normalizedType}`);
        return normalizedType === 'pro' ? modelLimitsCache.pro : modelLimitsCache.trial; // Use cached values
    } catch (error) {
        console.error('Unexpected error in getModelLimits:', error);
        console.log(`Using default model limits for ${normalizedType} due to error`);
        return normalizedType === 'pro' ? modelLimitsCache.pro : modelLimitsCache.trial; // Use cached values
    }
}

/**
 * Gets the model limit for a specific user and model
 * @param {Object} supabase - Supabase client
 * @param {string} userId - User ID
 * @param {string} model - Model name ('haiku-3.5' or 'sonnet-3.7')
 * @returns {Promise<number>} The model limit
 */
export async function getModelLimit(supabase, userId, model = DEFAULT_MODEL) {
    try {
        console.log(`Getting model limit for user ${userId} and model ${model}`);

        // Get the user's subscription type
        const subscriptionType = await getUserSubscriptionType(supabase, userId);
        console.log(`User ${userId} has subscription type: ${subscriptionType}`);

        // Use fixed limits based on subscription type and model
        // This simplifies the logic and avoids database queries
        if (subscriptionType === 'pro') {
            // Pro users have higher limits
            const limit = model === 'haiku-3.5' ? 500 :
                model === 'sonnet-3.7' ? 500 : 0;
            console.log(`Pro user ${userId} has limit ${limit} for model ${model}`);
            return limit;
        } else {
            // Trial users have lower limits and no access to sonnet
            const limit = model === 'haiku-3.5' ? 50 : 0;
            console.log(`Trial user ${userId} has limit ${limit} for model ${model}`);
            return limit;
        }
    } catch (error) {
        console.error('Unexpected error in getModelLimit:', error);
        const defaultLimit = model === 'haiku-3.5' ? 50 : 0;
        console.log(`Using default limit for model ${model}: ${defaultLimit}`);
        return defaultLimit; // Default fallback
    }
}

/**
 * Checks if the user should use their own API key
 * @param {Object} supabase - Supabase client
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Result with useOwnKey and apiKey
 */
export async function shouldUseOwnApiKey(supabase, userId) {
    try {
        const { data, error } = await supabase
            .from('user_subscriptions')
            .select('use_own_api_key, own_api_key')
            .eq('user_id', userId)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
            console.error('Error checking if user should use own API key:', error);
            return { useOwnKey: false, apiKey: null };
        }

        if (!data) {
            return { useOwnKey: false, apiKey: null };
        }

        return {
            useOwnKey: data.use_own_api_key && data.own_api_key,
            apiKey: data.own_api_key
        };
    } catch (error) {
        console.error('Unexpected error in shouldUseOwnApiKey:', error);
        return { useOwnKey: false, apiKey: null };
    }
}

/**
 * Checks and updates the API usage for a user and model
 * @param {Object} supabase - Supabase client
 * @param {string} userId - User ID
 * @param {string} model - Model name ('haiku-3.5' or 'sonnet-3.7')
 * @returns {Promise<Object>} Result with usage data
 */
export async function checkAndUpdateApiUsage(supabase, userId, model = DEFAULT_MODEL) {
    const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
    console.log(`Checking and updating API usage for user ${userId}, model ${model}, month ${currentMonth}`);

    try {
        // Check if user should use their own API key
        const { useOwnKey, apiKey } = await shouldUseOwnApiKey(supabase, userId);
        console.log(`User ${userId} should use own API key: ${useOwnKey}`);

        // If user should use their own API key, skip usage tracking
        if (useOwnKey && apiKey) {
            console.log(`User ${userId} is using their own API key, skipping usage tracking`);
            return {
                data: {
                    callsCount: 0,
                    limit: 0,
                    hasRemainingCalls: true,
                    nextResetDate: getNextMonthDate(),
                    useOwnKey: true,
                    apiKey
                }
            };
        }

        // Get the user's subscription type first for logging
        const subscriptionType = await getUserSubscriptionType(supabase, userId);
        console.log(`User ${userId} has subscription type: ${subscriptionType}`);

        // Get the model limit for this user
        const limit = await getModelLimit(supabase, userId, model);
        console.log(`Model limit for user ${userId}, model ${model}: ${limit}`);

        // Try to use the RPC function to increment API usage (preferred method)
        try {
            console.log(`Trying to use increment_api_usage RPC function for user ${userId}, model ${model}`);
            const { data: rpcData, error: rpcError } = await supabase.rpc('increment_api_usage', {
                p_user_id: userId,
                p_model: model
            });

            if (!rpcError && rpcData) {
                console.log(`Successfully used increment_api_usage RPC function:`, rpcData);
                return {
                    data: {
                        callsCount: rpcData.calls_count,
                        limit: rpcData.limit,
                        hasRemainingCalls: rpcData.has_remaining_calls,
                        nextResetDate: rpcData.next_reset,
                        useOwnKey: rpcData.use_own_api_key,
                        model: model,
                        subscriptionType: subscriptionType
                    }
                };
            } else {
                console.error('Error using increment_api_usage RPC function:', rpcError);
                // Fall back to direct table operations
            }
        } catch (rpcError) {
            console.error('Unexpected error using increment_api_usage RPC function:', rpcError);
            // Fall back to direct table operations
        }

        // Only check api_models_usage table - simplified approach
        let { data, error } = await supabase
            .from('api_models_usage')
            .select('*')
            .eq('user_id', userId)
            .eq('month', currentMonth)
            .eq('model', model)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
            console.error('Error checking API usage:', error);
            return { error };
        }

        // If no entry exists, create a new one in api_models_usage
        if (!data || (error && error.code === 'PGRST116')) {
            console.log(`Creating new API usage entry for user ${userId}, model ${model}`);
            const { data: newData, error: insertError } = await supabase
                .from('api_models_usage')
                .insert([{
                    user_id: userId,
                    month: currentMonth,
                    model: model,
                    calls_count: 1,
                    updated_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (insertError) {
                console.error('Error creating API usage entry:', insertError);
                return { error: insertError };
            }

            console.log(`Created new API usage entry for user ${userId}, model ${model}`);
            const result = {
                data: {
                    callsCount: 1,
                    limit: limit,
                    hasRemainingCalls: 1 <= limit,
                    nextResetDate: getNextMonthDate(),
                    useOwnKey: false,
                    model: model,
                    subscriptionType: subscriptionType
                }
            };
            console.log(`Returning API usage data:`, result.data);
            return result;
        }

        // Entry exists, increment counter
        const newCount = data.calls_count + 1;
        const hasRemainingCalls = limit === 0 ? true : newCount <= limit;
        console.log(`Updating API usage entry for user ${userId}, model ${model}: ${data.calls_count} -> ${newCount} calls`);

        // Only update if the limit hasn't been exceeded
        if (hasRemainingCalls) {
            console.log(`User ${userId} has remaining calls for model ${model}, updating usage`);

            const { error: updateError } = await supabase
                .from('api_models_usage')
                .update({
                    calls_count: newCount,
                    updated_at: new Date().toISOString()
                })
                .eq('id', data.id);

            if (updateError) {
                console.error(`Error updating API usage in api_models_usage:`, updateError);
                return { error: updateError };
            }
            console.log(`Updated API usage entry for user ${userId}, model ${model} in api_models_usage`);
        } else {
            console.log(`User ${userId} has reached the limit for model ${model}, not updating usage`);
        }

        const result = {
            data: {
                callsCount: newCount,
                limit: limit,
                hasRemainingCalls,
                nextResetDate: getNextMonthDate(),
                useOwnKey: false,
                model: model,
                subscriptionType: subscriptionType
            }
        };
        console.log(`Returning API usage data:`, result.data);
        return result;
    } catch (error) {
        console.error('Unexpected error in checkAndUpdateApiUsage:', error);
        return { error };
    }
}

/**
 * Gets the current API usage for a user and model
 * @param {Object} supabase - Supabase client
 * @param {string} userId - User ID
 * @param {string} model - Model name ('haiku-3.5' or 'sonnet-3.7')
 * @returns {Promise<Object>} Result with usage data
 */
export async function getCurrentApiUsage(supabase, userId, model = DEFAULT_MODEL) {
    const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
    console.log(`Getting current API usage for user ${userId}, model ${model}, month ${currentMonth}`);

    try {
        // Check if user should use their own API key
        const { useOwnKey, apiKey } = await shouldUseOwnApiKey(supabase, userId);
        console.log(`User ${userId} should use own API key: ${useOwnKey}`);

        // If user should use their own API key, return special data
        if (useOwnKey && apiKey) {
            console.log(`User ${userId} is using their own API key, returning unlimited usage`);
            return {
                data: {
                    callsCount: 0,
                    limit: 0,
                    hasRemainingCalls: true,
                    nextResetDate: getNextMonthDate(),
                    useOwnKey: true,
                    apiKey,
                    model: model
                }
            };
        }

        // Get the user's subscription type first for logging
        const subscriptionType = await getUserSubscriptionType(supabase, userId);
        console.log(`User ${userId} has subscription type: ${subscriptionType}`);

        // Get the model limit for this user
        const limit = await getModelLimit(supabase, userId, model);
        console.log(`Model limit for user ${userId}, model ${model}: ${limit}`);

        // Try to use the RPC function to get user API usage (preferred method)
        try {
            console.log(`Trying to use get_user_api_usage RPC function for user ${userId}`);
            const { data: rpcData, error: rpcError } = await supabase.rpc('get_user_api_usage', {
                p_user_id: userId
            });

            if (!rpcError && rpcData && rpcData.models && rpcData.models[model]) {
                console.log(`Successfully used get_user_api_usage RPC function:`, rpcData);
                const modelData = rpcData.models[model];
                return {
                    data: {
                        callsCount: modelData.calls_count,
                        limit: modelData.limit,
                        hasRemainingCalls: modelData.limit === 0 ? true : modelData.calls_count < modelData.limit,
                        nextResetDate: modelData.next_reset,
                        useOwnKey: rpcData.use_own_api_key,
                        model: model,
                        subscriptionType: rpcData.subscription_type
                    }
                };
            } else {
                console.error('Error using get_user_api_usage RPC function or model not found:', rpcError);
                // Fall back to direct table operations
            }
        } catch (rpcError) {
            console.error('Unexpected error using get_user_api_usage RPC function:', rpcError);
            // Fall back to direct table operations
        }

        // Only check api_models_usage table - simplified approach
        let { data, error } = await supabase
            .from('api_models_usage')
            .select('*')
            .eq('user_id', userId)
            .eq('month', currentMonth)
            .eq('model', model)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
            console.error('Error getting API usage:', error);
            return { error };
        }

        // If no entry exists, return default values
        if (!data) {
            console.log(`Creating default API usage data for user ${userId}, model ${model}`);
            const result = {
                data: {
                    callsCount: 0,
                    limit: limit,
                    hasRemainingCalls: limit > 0,
                    nextResetDate: getNextMonthDate(),
                    useOwnKey: false,
                    model: model,
                    subscriptionType: subscriptionType
                }
            };
            console.log(`Returning API usage data:`, result.data);
            return result;
        }

        console.log(`Found API usage entry for user ${userId}, model ${model}: ${data.calls_count} calls`);

        // Return the current usage
        const result = {
            data: {
                callsCount: data.calls_count,
                limit: limit,
                hasRemainingCalls: limit === 0 ? true : data.calls_count < limit,
                nextResetDate: getNextMonthDate(),
                useOwnKey: false,
                model: model,
                subscriptionType: subscriptionType
            }
        };

        console.log(`Returning API usage data:`, result.data);
        return result;
    } catch (error) {
        console.error('Unexpected error in getCurrentApiUsage:', error);
        return { error };
    }
}

/**
 * Gets all API usage for a user
 * @param {Object} supabase - Supabase client
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Result with usage data for all models
 */
export async function getAllApiUsage(supabase, userId) {
    const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
    console.log(`Getting all API usage for user ${userId}, month ${currentMonth}`);

    try {
        // Try to use the RPC function to get user API usage (preferred method)
        try {
            console.log(`Trying to use get_user_api_usage RPC function for user ${userId}`);
            const { data: rpcData, error: rpcError } = await supabase.rpc('get_user_api_usage', {
                p_user_id: userId
            });

            if (!rpcError && rpcData) {
                console.log(`Successfully used get_user_api_usage RPC function:`, rpcData);
                return {
                    data: {
                        // New format with models
                        models: rpcData.models,
                        subscriptionType: rpcData.subscription_type,
                        useOwnKey: rpcData.use_own_api_key,
                        apiKey: rpcData.use_own_api_key ? rpcData.api_key : null,
                        nextResetDate: Object.values(rpcData.models).length > 0 ? Object.values(rpcData.models)[0].next_reset || getNextMonthDate() : getNextMonthDate(),

                        // Old format for backward compatibility
                        callsCount: Object.values(rpcData.models).reduce((sum, model) => sum + model.calls_count, 0),
                        limit: rpcData.models['haiku-3.5'] ? rpcData.models['haiku-3.5'].limit || 0 : 0,
                        hasRemainingCalls: rpcData.use_own_api_key ? true : Object.values(rpcData.models).every(model =>
                            model.limit === 0 ? true : model.calls_count < model.limit
                        )
                    }
                };
            } else {
                console.error('Error using get_user_api_usage RPC function:', rpcError);
                // Fall back to direct table operations
            }
        } catch (rpcError) {
            console.error('Unexpected error using get_user_api_usage RPC function:', rpcError);
            // Fall back to direct table operations
        }

        // Get the user's subscription type
        const subscriptionType = await getUserSubscriptionType(supabase, userId);
        console.log(`User ${userId} has subscription type: ${subscriptionType}`);

        // Get the model limits based on subscription type
        const limits = await getModelLimits(supabase, subscriptionType);
        console.log(`Model limits for ${subscriptionType}:`, limits);

        // Check if user should use their own API key
        const { useOwnKey, apiKey } = await shouldUseOwnApiKey(supabase, userId);
        console.log(`User ${userId} should use own API key: ${useOwnKey}`);

        // Get the current usage for all models from api_models_usage table
        const { data: modelsData, error: modelsError } = await supabase
            .from('api_models_usage')
            .select('*')
            .eq('user_id', userId)
            .eq('month', currentMonth);

        if (modelsError) {
            console.error('Error getting API models usage:', modelsError);
            // Continue with empty data
        } else if (modelsData && modelsData.length > 0) {
            console.log(`Found ${modelsData.length} entries in api_models_usage table`);
        }

        // Also get data from the old api_usage table for backward compatibility
        const { data: legacyData, error: legacyError } = await supabase
            .from('api_usage')
            .select('*')
            .eq('user_id', userId)
            .eq('month', currentMonth)
            .single();

        if (legacyError && legacyError.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
            console.error('Error getting legacy API usage:', legacyError);
            // Continue with empty data
        } else if (legacyData) {
            console.log(`Found legacy API usage entry with ${legacyData.calls_count} calls`);
        }

        // Create a map of model to usage data
        const usageMap = {};

        // Initialize with all available models
        for (const model in limits) {
            usageMap[model] = {
                callsCount: 0,
                limit: limits[model],
                hasRemainingCalls: limits[model] === 0 ? true : limits[model] > 0,
                nextResetDate: getNextMonthDate(),
                useOwnKey: useOwnKey && apiKey,
                model: model,
                subscriptionType: subscriptionType
            };
        }

        // Update with data from models_data (either from user_api_usage or api_models_usage)
        if (modelsData && modelsData.length > 0) {
            for (const usage of modelsData) {
                if (usageMap[usage.model]) {
                    console.log(`Updating usage data for model ${usage.model}: ${usage.calls_count} calls`);
                    usageMap[usage.model].callsCount = usage.calls_count;
                    usageMap[usage.model].hasRemainingCalls =
                        useOwnKey && apiKey ? true :
                        usageMap[usage.model].limit === 0 ? true :
                        usage.calls_count < usageMap[usage.model].limit;
                }
            }
        }

        // If we have legacy data but no models data for the default model, use the legacy data
        if (legacyData && (!modelsData || !modelsData.some(d => d.model === 'haiku-3.5'))) {
            console.log(`Using legacy data for default model: ${legacyData.calls_count} calls`);
            if (usageMap['haiku-3.5']) {
                usageMap['haiku-3.5'].callsCount = legacyData.calls_count;
                usageMap['haiku-3.5'].hasRemainingCalls =
                    useOwnKey && apiKey ? true :
                    usageMap['haiku-3.5'].limit === 0 ? true :
                    legacyData.calls_count < usageMap['haiku-3.5'].limit;
            }
        }

        // For backward compatibility, also include the total usage as a top-level property
        // This is the sum of all model usages, or the legacy usage if no models data
        let totalCallsCount = 0;
        let totalLimit = 0;

        if (modelsData && modelsData.length > 0) {
            // Sum up all model usages
            totalCallsCount = modelsData.reduce((sum, usage) => sum + usage.calls_count, 0);
            // Use the limit of the default model (haiku-3.5)
            totalLimit = limits['haiku-3.5'] || 0;
        } else if (legacyData) {
            // Use legacy data
            totalCallsCount = legacyData.calls_count;
            totalLimit = limits['haiku-3.5'] || 0;
        }

        const result = {
            data: {
                // New format with models
                models: usageMap,
                subscriptionType,
                useOwnKey: useOwnKey && apiKey,
                apiKey: useOwnKey ? apiKey : null,
                nextResetDate: getNextMonthDate(),

                // Old format for backward compatibility
                callsCount: totalCallsCount,
                limit: totalLimit,
                hasRemainingCalls: useOwnKey && apiKey ? true : totalLimit === 0 ? true : totalCallsCount < totalLimit
            }
        };

        console.log(`Returning all API usage data for user ${userId}`);
        return result;
    } catch (error) {
        console.error('Unexpected error in getAllApiUsage:', error);
        return { error };
    }
}

/**
 * Calculates the date for the next month change
 * @returns {string} ISO date string
 */
function getNextMonthDate() {
    const now = new Date();
    // First day of the next month
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth.toISOString();
}