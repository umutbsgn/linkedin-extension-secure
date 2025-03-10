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

// Cache expiration time in milliseconds (5 minutes)
const CACHE_EXPIRATION = 5 * 60 * 1000;

// Default model if none is specified
const DEFAULT_MODEL = 'haiku-3.5';

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
        return cachedData.type;
    }

    try {
        // Try to get the subscription type from the database function
        const { data, error } = await supabase.rpc('get_user_subscription_type', { user_id: userId });

        if (error) {
            console.error('Error getting user subscription type:', error);
            return 'trial'; // Default fallback
        }

        // Update cache
        userSubscriptionCache.set(userId, {
            type: data || 'trial',
            timestamp: now
        });

        return data || 'trial';
    } catch (error) {
        console.error('Unexpected error in getUserSubscriptionType:', error);
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
    // Check if cache is still valid
    const now = Date.now();
    if (now - modelLimitsCache.timestamp < CACHE_EXPIRATION) {
        return modelLimitsCache[subscriptionType] || modelLimitsCache.trial;
    }

    try {
        // Try to get the limits from the database function
        const { data, error } = await supabase.rpc('get_model_limits', { subscription_type: subscriptionType });

        if (error) {
            console.error('Error getting model limits:', error);
            return modelLimitsCache[subscriptionType] || modelLimitsCache.trial; // Use cached values
        }

        if (data) {
            // Update cache
            modelLimitsCache.trial = data.trial_limits || modelLimitsCache.trial;
            modelLimitsCache.pro = data.pro_limits || modelLimitsCache.pro;
            modelLimitsCache.timestamp = now;

            return data[`${subscriptionType}_limits`] || modelLimitsCache[subscriptionType] || modelLimitsCache.trial;
        }

        return modelLimitsCache[subscriptionType] || modelLimitsCache.trial; // Use cached values
    } catch (error) {
        console.error('Unexpected error in getModelLimits:', error);
        return modelLimitsCache[subscriptionType] || modelLimitsCache.trial; // Use cached values
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
        // Get the user's subscription type
        const subscriptionType = await getUserSubscriptionType(supabase, userId);

        // Get the model limits based on subscription type
        const limits = await getModelLimits(supabase, subscriptionType);

        // Return the limit for the specified model
        return limits[model] || 0;
    } catch (error) {
        console.error('Unexpected error in getModelLimit:', error);
        return model === 'haiku-3.5' ? 50 : 0; // Default fallback
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

    try {
        // Check if user should use their own API key
        const { useOwnKey, apiKey } = await shouldUseOwnApiKey(supabase, userId);

        // If user should use their own API key, skip usage tracking
        if (useOwnKey && apiKey) {
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

        // Get the model limit for this user
        const limit = await getModelLimit(supabase, userId, model);

        // Check if an entry exists for the current month and model
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

        // If no entry exists, create a new one
        if (!data) {
            const { data: newData, error: insertError } = await supabase
                .from('api_models_usage')
                .insert([{
                    user_id: userId,
                    month: currentMonth,
                    model: model,
                    calls_count: 1,
                    last_reset: new Date().toISOString()
                }])
                .select()
                .single();

            if (insertError) {
                console.error('Error creating API usage entry:', insertError);
                return { error: insertError };
            }

            return {
                data: {
                    callsCount: 1,
                    limit: limit,
                    hasRemainingCalls: 1 <= limit,
                    nextResetDate: getNextMonthDate(),
                    useOwnKey: false,
                    model: model
                }
            };
        }

        // Entry exists, increment counter
        const newCount = data.calls_count + 1;
        const hasRemainingCalls = limit === 0 ? false : newCount <= limit;

        // Only update if the limit hasn't been exceeded
        if (hasRemainingCalls) {
            const { error: updateError } = await supabase
                .from('api_models_usage')
                .update({
                    calls_count: newCount,
                    updated_at: new Date().toISOString()
                })
                .eq('id', data.id);

            if (updateError) {
                console.error('Error updating API usage:', updateError);
                return { error: updateError };
            }
        }

        return {
            data: {
                callsCount: newCount,
                limit: limit,
                hasRemainingCalls,
                nextResetDate: getNextMonthDate(),
                useOwnKey: false,
                model: model
            }
        };
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

    try {
        // Check if user should use their own API key
        const { useOwnKey, apiKey } = await shouldUseOwnApiKey(supabase, userId);

        // If user should use their own API key, return special data
        if (useOwnKey && apiKey) {
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

        // Get the model limit for this user
        const limit = await getModelLimit(supabase, userId, model);

        // Get the current usage
        const { data, error } = await supabase
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
            return {
                data: {
                    callsCount: 0,
                    limit: limit,
                    hasRemainingCalls: limit > 0,
                    nextResetDate: getNextMonthDate(),
                    useOwnKey: false,
                    model: model
                }
            };
        }

        // Return the current usage
        return {
            data: {
                callsCount: data.calls_count,
                limit: limit,
                hasRemainingCalls: limit === 0 ? false : data.calls_count < limit,
                nextResetDate: getNextMonthDate(),
                useOwnKey: false,
                model: model
            }
        };
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

    try {
        // Get the user's subscription type
        const subscriptionType = await getUserSubscriptionType(supabase, userId);

        // Get the model limits based on subscription type
        const limits = await getModelLimits(supabase, subscriptionType);

        // Check if user should use their own API key
        const { useOwnKey, apiKey } = await shouldUseOwnApiKey(supabase, userId);

        // Get the current usage for all models
        const { data, error } = await supabase
            .from('api_models_usage')
            .select('*')
            .eq('user_id', userId)
            .eq('month', currentMonth);

        if (error) {
            console.error('Error getting all API usage:', error);
            return { error };
        }

        // Create a map of model to usage data
        const usageMap = {};

        // Initialize with all available models
        for (const model in limits) {
            usageMap[model] = {
                callsCount: 0,
                limit: limits[model],
                hasRemainingCalls: limits[model] > 0,
                nextResetDate: getNextMonthDate(),
                useOwnKey: useOwnKey && apiKey,
                model: model
            };
        }

        // Update with actual usage data
        if (data && data.length > 0) {
            for (const usage of data) {
                if (usageMap[usage.model]) {
                    usageMap[usage.model].callsCount = usage.calls_count;
                    usageMap[usage.model].hasRemainingCalls =
                        useOwnKey && apiKey ? true :
                        usageMap[usage.model].limit === 0 ? false :
                        usage.calls_count < usageMap[usage.model].limit;
                }
            }
        }

        return {
            data: {
                models: usageMap,
                subscriptionType,
                useOwnKey: useOwnKey && apiKey,
                apiKey: useOwnKey ? apiKey : null,
                nextResetDate: getNextMonthDate()
            }
        };
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